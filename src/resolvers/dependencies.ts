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
              context.orm.transmittal.count({
                where: { projectId: entityId },
              }),
              context.orm.scannedFile.count({
                where: { projectId: entityId },
              }),
              context.orm.area.count({
                where: { projectId: entityId },
              }),
              context.orm.document.count({
                where: {
                  module: "PROJECTS",
                  entityId: entityId,
                },
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
        } else if (entityType === "FINDING") {
          const documentCount = await context.orm.document.count({
            where: {
              module: "QUALITY",
              entityType: "finding",
              entityId: entityId,
            },
          })

          if (documentCount > 0) {
            dependencies.push({
              model: "Document",
              count: documentCount,
              label: "Documentos",
            })
          }
        } else if (entityType === "ACTION") {
          const documentCount = await context.orm.document.count({
            where: {
              module: "QUALITY",
              entityType: "action",
              entityId: entityId,
            },
          })

          if (documentCount > 0) {
            dependencies.push({
              model: "Document",
              count: documentCount,
              label: "Documentos",
            })
          }
        }

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
