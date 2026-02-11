import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PaginationInput,
  ListResponse,
  PERMISSIONS,
} from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import type { Attachment } from "../generated/prisma/client.js"
import { ModuleType } from "../generated/prisma/enums.js"

export const attachmentResolvers = {
  Query: {
    attachmentById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_ATTACHMENT_READ],
        context,
      })

      try {
        const attachment = await context.orm.attachment.findFirst({
          where: { id },
        })

        if (!attachment) {
          throw new GraphQLError("Adjunto no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return attachment
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_ATTACHMENT_BY_ID",
          messages: {
            notFound: "El adjunto solicitado no existe.",
            default: "Error al obtener el adjunto.",
          },
        })
      }
    },

    attachmentsByModule: async (
      _: any,
      {
        module,
        entityType,
        entityId,
        pagination,
      }: {
        module: ModuleType
        entityType: string
        entityId: number
        pagination?: PaginationInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_ATTACHMENT_LIST],
        context,
      })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const where = {
          module,
          entityType,
          entityId,
        }

        const totalItems = await context.orm.attachment.count({ where })

        const attachments = await context.orm.attachment.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" as const },
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<Attachment> = {
          items: attachments,
          pagination: {
            currentPage,
            totalPages,
            totalItems,
            hasNext: skip + take < totalItems,
            hasPrev: skip > 0,
          },
        }

        return response
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_ATTACHMENTS_BY_MODULE",
          messages: {
            default: "Error al obtener los adjuntos.",
          },
        })
      }
    },
  },

  Mutation: {
    createAttachment: async (
      _: any,
      {
        input,
      }: {
        input: {
          module: ModuleType
          entityType: string
          entityId: number
          fileKey: string
          fileName: string
          fileSize: number
          mimeType: string
          description?: string
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_ATTACHMENT_CREATE],
        context,
      })

      try {
        const attachment = await context.orm.attachment.create({
          data: {
            createdById: userId,
            module: input.module,
            entityType: input.entityType,
            entityId: input.entityId,
            fileKey: input.fileKey,
            fileName: input.fileName,
            fileSize: input.fileSize,
            mimeType: input.mimeType,
            description: input.description,
          },
        })

        return attachment
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_ATTACHMENT",
          messages: {
            default: "Error al crear el adjunto.",
          },
        })
      }
    },

    deleteAttachment: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_ATTACHMENT_DELETE],
        context,
      })

      try {
        const attachment = await context.orm.attachment.findFirst({
          where: { id },
        })

        if (!attachment) {
          throw new GraphQLError("Adjunto no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        await context.orm.attachment.delete({
          where: { id },
        })

        return true
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DELETE_ATTACHMENT",
          messages: {
            notFound: "El adjunto no existe.",
            default: "Error al eliminar el adjunto.",
          },
        })
      }
    },
  },
}
