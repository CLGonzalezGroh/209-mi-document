import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"
import type { Prisma } from "../generated/prisma/client.js"
import { ModuleType, SysLogModule } from "../generated/prisma/enums.js"
import { AuditAction } from "../events/catalog.js"
import { emitAuditEvent } from "../events/emit.js"
import { projectAuthorization } from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { visibleClassificationWhere } from "../utils/classificationScope.js"
import { planClassificationSeed, typeKey } from "../utils/classificationSeed.js"

const logger = createLogger("classification")

/**
 * La siembra del catálogo de clasificación (BLOQUE 02C, B2).
 *
 * Vive en su propio archivo y no en el de clases ni en el de tipos porque **no
 * es de ninguno de los dos**: clase y tipo son un solo sistema de clasificación
 * (B1), y sembrar recae sobre el par. Elegir uno de los dos archivos habría sido
 * arbitrario, y habría dejado la mitad del acto lejos de la otra.
 */

/** Lo que un ámbito ve del catálogo de clasificación, con su alcance resuelto. */
const visibleClassification = async (
  client: Prisma.TransactionClient,
  docProjectId: number | null,
) => {
  const alcance = await visibleClassificationWhere(client, docProjectId)

  // El módulo se filtra acá y no en el plan, con el mismo criterio que el
  // alcance: el plan recibe **lo que cada lado ve**, ya resuelto, y por eso no
  // sabe de ejes. Un proyecto ve el catálogo de proyectos más el compartido, de
  // modo que una clase de calidad no viaja — el destino no la vería nunca.
  const delModulo = {
    OR: [{ module: ModuleType.PROJECTS }, { module: null }],
  }

  const classes = await client.documentClass.findMany({
    where: { AND: [alcance, delModulo] },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      sortOrder: true,
      terminatedAt: true,
    },
  })

  const types = await client.documentType.findMany({
    where: { AND: [alcance, delModulo] },
    select: {
      id: true,
      code: true,
      name: true,
      classId: true,
      description: true,
      requiresFormalReview: true,
      terminatedAt: true,
    },
  })

  return { classes, types }
}

export const classificationResolvers = {
  Query: {
    /**
     * Los proyectos que pueden sembrar a este, con cuánto aportaría cada uno.
     *
     * Son los que el usuario **alcanza por membresía vigente** y que tienen
     * catálogo propio: el segundo proyecto para el mismo cliente copia del
     * primero. El global del despliegue no figura porque siempre está
     * disponible y no es una opción entre otras.
     */
    classificationSeedSources: async (
      _: any,
      { docProjectId }: { docProjectId: number },
      context: ResolverContext,
    ) => {
      const userId = await projectAuthorization({
        intent: "read",
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_LIST],
        docProjectId,
        context,
      })
      logger.info("classificationSeedSources", { userId })

      try {
        const membresias = await context.orm.docProjectMember.findMany({
          where: { userId, isActive: true, revokedAt: null },
          select: { docProjectId: true },
        })

        const candidatos = membresias
          .map((m) => m.docProjectId)
          .filter((p) => p !== docProjectId)

        if (candidatos.length === 0) return []

        // Dos agrupamientos y no una consulta por proyecto: la lista alimenta un
        // selector y no debe costar una lectura por opción.
        const [clases, tipos] = await Promise.all([
          context.orm.documentClass.groupBy({
            by: ["docProjectId"],
            where: { docProjectId: { in: candidatos } },
            _count: { _all: true },
          }),
          context.orm.documentType.groupBy({
            by: ["docProjectId"],
            where: { docProjectId: { in: candidatos } },
            _count: { _all: true },
          }),
        ])

        const total = new Map<number, number>()
        for (const g of [...clases, ...tipos]) {
          const p = g.docProjectId as number
          total.set(p, (total.get(p) ?? 0) + g._count._all)
        }

        return [...total.entries()]
          .map(([p, nodeCount]) => ({ docProjectId: p, nodeCount }))
          .sort((a, b) => a.docProjectId - b.docProjectId)
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_CLASSIFICATION_SEED_SOURCES",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener las fuentes de siembra disponibles.",
          },
        })
      }
    },
  },

  Mutation: {
    /**
     * Copiar clase y tipo desde el despliegue o desde otro proyecto.
     *
     * La siembra es **puntual**: copia lo que hay al momento de ejecutarse y no
     * deja vínculo. Una copia permanente **es** herencia, y llamarla de otro modo
     * daría dos formas de lo mismo (`BLOCK_02B`, B2).
     */
    seedProjectClassification: async (
      _: any,
      {
        docProjectId,
        sourceProjectId,
      }: { docProjectId: number; sourceProjectId?: number | null },
      context: ResolverContext,
    ) => {
      const fuente = sourceProjectId ?? null

      const userId = await projectAuthorization({
        intent: "write",
        requiredPermissions: [
          PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_CREATE,
          PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_CREATE,
        ],
        docProjectId,
        context,
      })
      logger.info("seedProjectClassification", { userId })

      // La segunda capa sobre la FUENTE, y aparte: alcanzar el destino no
      // habilita leer el catálogo de un proyecto ajeno.
      if (fuente !== null) {
        await projectAuthorization({
          intent: "write",
          requiredPermissions: [
            PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_LIST,
            PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_LIST,
          ],
          docProjectId: fuente,
          context,
        })
      }

      try {
        if (fuente === docProjectId) {
          throw new GraphQLError("Un proyecto no se siembra de sí mismo.", {
            extensions: { code: "BAD_USER_INPUT" },
          })
        }

        return await context.orm.$transaction(async (tx) => {
          const origen = await visibleClassification(tx, fuente)
          const destino = await visibleClassification(tx, docProjectId)

          const codigoDeClase = new Map(destino.classes.map((c) => [c.id, c.code]))

          const plan = planClassificationSeed({
            source: origen,
            destination: {
              classCodes: destino.classes.map((c) => c.code),
              typeKeys: destino.types.map((t) =>
                typeKey(t.classId === null ? null : (codigoDeClase.get(t.classId) ?? null), t.code),
              ),
            },
          })

          // Los códigos que el destino resuelve, más los que esta siembra agrega:
          // es lo que convierte `classCode` en identificador, sin distinguir la
          // clase preexistente de la recién creada.
          const idPorCodigo = new Map(destino.classes.map((c) => [c.code, c.id]))

          for (const paso of plan.classSteps) {
            const creada = await tx.documentClass.create({
              data: {
                // Toda entrada de proyecto es del módulo de proyectos, que es lo
                // que el CHECK de la base exige. La clase compartida del
                // despliegue —sin módulo— se vuelve de proyectos al copiarse,
                // porque ese es el alcance en que pasa a vivir.
                module: ModuleType.PROJECTS,
                docProjectId,
                code: paso.code,
                name: paso.name,
                description: paso.description,
                sortOrder: paso.sortOrder,
                updatedById: userId,
              },
            })

            idPorCodigo.set(creada.code, creada.id)

            // Cada entrada emite su creación, como cualquier otra: una clase que
            // apareciera sin registro de haber sido creada sería la excepción.
            await emitAuditEvent(tx, {
              action: AuditAction.CreateDocumentClass,
              objectId: creada.id,
              actorId: userId,
              meta: {
                name: creada.name,
                code: creada.code,
                seededFrom: fuente,
              },
            })
          }

          for (const paso of plan.typeSteps) {
            const creado = await tx.documentType.create({
              data: {
                module: ModuleType.PROJECTS,
                docProjectId,
                classId:
                  paso.classCode === null
                    ? null
                    : (idPorCodigo.get(paso.classCode) ?? null),
                code: paso.code,
                name: paso.name,
                description: paso.description,
                requiresFormalReview: paso.requiresFormalReview,
                updatedById: userId,
              },
            })

            await emitAuditEvent(tx, {
              action: AuditAction.CreateDocumentType,
              objectId: creado.id,
              actorId: userId,
              meta: {
                name: creado.name,
                code: creado.code,
                classId: creado.classId,
                seededFrom: fuente,
              },
            })
          }

          // Y el acto, una vez. **Sin objeto**, con el criterio de la siembra del
          // árbol: no recae sobre una entrada sino sobre el catálogo del
          // proyecto, y elegir una de las creadas para colgarle la traza sería
          // una atribución arbitraria. Existe además por el caso que las
          // creaciones no cubren: una siembra que no agrega nada.
          //
          // El desglose entre clases y tipos vive acá y no en el resultado: el
          // resultado es el del mecanismo, que es uno para los tres catálogos.
          await emitAuditEvent(tx, {
            action: AuditAction.SeedClassification,
            objectId: null,
            actorId: userId,
            meta: {
              docProjectId,
              sourceProjectId: fuente,
              addedClasses: plan.classSteps.length,
              addedTypes: plan.typeSteps.length,
              alreadyPresent: plan.alreadyPresent,
              skippedTerminated: plan.skippedTerminated,
            },
          })

          return {
            added: plan.classSteps.length + plan.typeSteps.length,
            alreadyPresent: plan.alreadyPresent,
            skippedTerminated: plan.skippedTerminated,
          }
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "SEED_PROJECT_CLASSIFICATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            uniqueConstraint:
              "Ya existe una entrada con ese código en el mismo alcance.",
            default: "Error al sembrar el catálogo de clasificación.",
          },
        })
      }
    },
  },
}
