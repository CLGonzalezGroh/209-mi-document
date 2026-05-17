import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { ModuleType, TaskDocumentRole } from "../generated/prisma/enums.js"

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("taskDocumentReferences")

// Permisos
//   linkDocumentToTask / unlinkDocumentFromTask  → PROJECTS_PROJECT_TASK_UPDATE
//     (es información que pertenece a la tarea: quién puede editar la tarea
//      decide qué documentos son sus entregables)
//   addTaskDocumentReference / removeTaskDocumentReference
//                                                → DOCUMENTS_TASK_DOCUMENT_REFERENCE_UPDATE

export const taskDocumentReferenceResolvers = {
  Mutation: {
    // ── Capa 1: entregable principal ────────────────────────────────────────
    linkDocumentToTask: async (
      _: any,
      { documentId, projectTaskId }: { documentId: number; projectTaskId: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.PROJECTS_PROJECT_TASK_UPDATE],
        context,
      })
      logger.info("linkDocumentToTask", { userId, documentId, projectTaskId })

      try {
        const document = await context.orm.document.findUnique({
          where: { id: documentId },
        })
        if (!document) {
          throw new GraphQLError("Documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }
        if (document.module !== ModuleType.PROJECTS) {
          throw new GraphQLError(
            "Solo documentos del módulo PROJECTS pueden vincularse a tareas de proyecto",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        return await context.orm.document.update({
          where: { id: documentId },
          data: { projectTaskId, updatedById: userId },
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "LINK_DOCUMENT_TO_TASK",
          messages: {
            notFound: "El documento solicitado no existe.",
            default: "Error al vincular el documento a la tarea.",
          },
        })
      }
    },

    unlinkDocumentFromTask: async (
      _: any,
      { documentId }: { documentId: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.PROJECTS_PROJECT_TASK_UPDATE],
        context,
      })
      logger.info("unlinkDocumentFromTask", { userId, documentId })

      try {
        const document = await context.orm.document.findUnique({
          where: { id: documentId },
        })
        if (!document) {
          throw new GraphQLError("Documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return await context.orm.document.update({
          where: { id: documentId },
          data: { projectTaskId: null, updatedById: userId },
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UNLINK_DOCUMENT_FROM_TASK",
          messages: {
            notFound: "El documento solicitado no existe.",
            default: "Error al desvincular el documento de la tarea.",
          },
        })
      }
    },

    // ── Capa 2: referencias N:N (inputs / outputs adicionales / refs) ───────
    addTaskDocumentReference: async (
      _: any,
      {
        input,
      }: {
        input: {
          projectTaskId: number
          documentId: number
          role: TaskDocumentRole
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TASK_DOCUMENT_REFERENCE_UPDATE],
        context,
      })
      logger.info("addTaskDocumentReference", { userId, input })

      try {
        const document = await context.orm.document.findUnique({
          where: { id: input.documentId },
        })
        if (!document) {
          throw new GraphQLError("Documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return await context.orm.taskDocumentReference.create({
          data: {
            projectTaskId: input.projectTaskId,
            documentId: input.documentId,
            role: input.role,
            createdById: userId,
          },
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ADD_TASK_DOCUMENT_REFERENCE",
          messages: {
            notFound: "El documento solicitado no existe.",
            uniqueConstraint:
              "Ya existe una referencia de ese documento a esa tarea con el mismo rol.",
            default: "Error al agregar la referencia documental.",
          },
        })
      }
    },

    removeTaskDocumentReference: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TASK_DOCUMENT_REFERENCE_UPDATE],
        context,
      })
      logger.info("removeTaskDocumentReference", { userId, id })

      try {
        await context.orm.taskDocumentReference.delete({ where: { id } })
        return true
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "REMOVE_TASK_DOCUMENT_REFERENCE",
          messages: {
            notFound: "La referencia documental solicitada no existe.",
            default: "Error al eliminar la referencia documental.",
          },
        })
      }
    },
  },
}

