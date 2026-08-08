import { ResolverContext } from "../types.js"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { DocObjectType } from "../generated/prisma/enums.js"
import { DOC_OBJECT_READ_PERMISSION } from "../events/catalog.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("events")

/**
 * Lectura de la traza funcional (Bloque 01).
 *
 * La traza se consulta por objeto: es la historia de ese documento, revisión o
 * transmittal. La consulta transversal por proyecto corresponde a BLOCK_02,
 * cuando el documento tenga proyecto y exista el alcance por membresía (B6).
 *
 * Los eventos son inmutables: no se exponen operaciones de escritura (B2).
 */
export const eventResolvers = {
  Query: {
    docWorkflowEvents: async (
      _: any,
      { objectType, objectId }: { objectType: DocObjectType; objectId: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [DOC_OBJECT_READ_PERMISSION[objectType]],
        context,
      })
      logger.info("docWorkflowEvents", { userId })

      try {
        return await context.orm.docWorkflowEvent.findMany({
          where: { objectType, objectId },
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
      { objectType, objectId }: { objectType: DocObjectType; objectId: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [DOC_OBJECT_READ_PERMISSION[objectType]],
        context,
      })
      logger.info("docAuditEvents", { userId })

      try {
        return await context.orm.docAuditEvent.findMany({
          where: { objectType, objectId },
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