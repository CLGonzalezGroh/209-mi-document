import { ResolverContext } from "../types.js"
import { userAuthorization } from "../utils/userAuthorization.js"
import { assertObjectAccess } from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { DocObjectType, ModuleType } from "../generated/prisma/enums.js"
import { DOC_OBJECT_READ_PERMISSION } from "../events/catalog.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("events")

/**
 * Lectura de la traza funcional (Bloque 01).
 *
 * La traza se consulta por objeto: es la historia de ese documento, revisión o
 * transmittal.
 *
 * BLOCK_02 le aplica la segunda capa: la traza hereda el alcance del objeto al
 * que pertenece, resuelto con la misma tabla de derivación que alimenta el
 * contexto de los eventos (B7 y B9). Quien no alcanza el objeto no alcanza su
 * historia. Los objetos sin proyecto —catálogos y régimen de publicación— quedan
 * gobernados solo por el permiso global.
 *
 * Los eventos son inmutables: no se exponen operaciones de escritura (B2).
 */
export const eventResolvers = {
  Query: {
    docWorkflowEvents: async (
      _: any,
      {
        objectType,
        objectId,
        module,
        docProjectId,
      }: {
        objectType: DocObjectType
        objectId: number
        module?: ModuleType
        docProjectId?: number
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [DOC_OBJECT_READ_PERMISSION[objectType]],
        context,
      })
      logger.info("docWorkflowEvents", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio
      await assertObjectAccess({
        intent: "read",
        userId,
        objectType,
        objectId,
        context,
        notFoundMessage: "El objeto consultado no existe",
      })

      try {
        return await context.orm.docWorkflowEvent.findMany({
          // El contexto se persiste derivado del objeto (B9), de modo que
          // filtrar por módulo o por proyecto no exige resolverlo en la consulta
          where: {
            objectType,
            objectId,
            ...(module !== undefined && { module }),
            ...(docProjectId !== undefined && { docProjectId }),
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOC_WORKFLOW_EVENTS",
          messages: {
            default: "Error al obtener las transiciones del objeto.",
          },
        })
      }
    },

    docAuditEvents: async (
      _: any,
      {
        objectType,
        objectId,
        module,
        docProjectId,
      }: {
        objectType: DocObjectType
        objectId: number
        module?: ModuleType
        docProjectId?: number
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [DOC_OBJECT_READ_PERMISSION[objectType]],
        context,
      })
      logger.info("docAuditEvents", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio
      await assertObjectAccess({
        intent: "read",
        userId,
        objectType,
        objectId,
        context,
        notFoundMessage: "El objeto consultado no existe",
      })

      try {
        return await context.orm.docAuditEvent.findMany({
          // El contexto se persiste derivado del objeto (B9), de modo que
          // filtrar por módulo o por proyecto no exige resolverlo en la consulta
          where: {
            objectType,
            objectId,
            ...(module !== undefined && { module }),
            ...(docProjectId !== undefined && { docProjectId }),
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOC_AUDIT_EVENTS",
          messages: {
            default: "Error al obtener la auditoría del objeto.",
          },
        })
      }
    },
  },
}