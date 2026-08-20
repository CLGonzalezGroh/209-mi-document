import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { SysLogModule } from "../generated/prisma/enums.js"

type DocumentDependencyEntityInput = "PROJECT" | "FINDING" | "ACTION"

interface DependencyCount {
  model: string
  count: number
  label: string
}

interface DependencyCheck {
  entityId: number
  dependencies: DependencyCount[]
  hasDependencies: boolean
}

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("dependencies")

export const dependencyResolvers = {
  Query: {
    checkDocumentDependencies: async (
      _: any,
      {
        entityType,
        entityId,
      }: {
        entityType: DocumentDependencyEntityInput
        entityId: number
      },
      context: ResolverContext,
    ): Promise<DependencyCheck> => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.ADMIN_USER_READ],
        context,
      })
      logger.info("checkDocumentDependencies", { userId })

      try {
        const dependencies: DependencyCount[] = []

        if (entityType === "PROJECT") {
          const [transmittalCount, scannedFileCount, areaCount, documentCount] =
            await Promise.all([
              // Transmittals y documentos cuelgan del CONTRATO, y el que se
              // borra es un proyecto de mi-project: el conteo cruza por el
              // vínculo PMI, que es N:1 (BLOQUE 02D, B3).
              context.orm.transmittal.count({
                where: { docProject: { projectId: entityId } },
              }),
              context.orm.scannedFile.count({
                where: { projectId: entityId },
              }),
              context.orm.area.count({
                where: { projectId: entityId },
              }),
              context.orm.document.count({
                where: { docProject: { projectId: entityId } },
              }),
            ])

          if (transmittalCount > 0) {
            dependencies.push({
              model: "Transmittal",
              count: transmittalCount,
              label: "Transmittals",
            })
          }
          if (scannedFileCount > 0) {
            dependencies.push({
              model: "ScannedFile",
              count: scannedFileCount,
              label: "Archivos Escaneados",
            })
          }
          if (areaCount > 0) {
            dependencies.push({
              model: "Area",
              count: areaCount,
              label: "Áreas",
            })
          }
          if (documentCount > 0) {
            dependencies.push({
              model: "Document",
              count: documentCount,
              label: "Documentos",
            })
          }
        }

        // Las ramas FINDING y ACTION dejan de contar documentos (BLOQUE 02, B3).
        //
        // Contaban con `entityType`/`entityId`, columnas que este bloque retira
        // por expresar la pertenencia sin integridad referencial. Sin ellas solo
        // quedaría filtrar por `module: QUALITY`, que no distingue el hallazgo
        // concreto y sobre-reportaría dependencias inexistentes.
        //
        // Hoy no existe ningún documento de calidad y D-07 y D-08 difieren esa
        // integración. Cuando el módulo atienda a calidad, el vínculo se modelará
        // con una referencia propia, como se hizo con el proyecto, y estas ramas
        // volverán a contar.
        //
        // El contrato GraphQL no cambia: los argumentos identifican la entidad
        // que el otro servicio va a borrar, no columnas de Document. mi-quality
        // sigue compilando sin cambios y recibe una respuesta bien formada.

        return {
          entityId,
          dependencies,
          hasDependencies: dependencies.length > 0,
        }
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CHECK_DOCUMENT_DEPENDENCIES",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al verificar dependencias documentales.",
          },
        })
      }
    },
  },
}
