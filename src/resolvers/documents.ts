import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PaginationInput,
  ListResponse,
  OrderByInput,
  SelectOption,
  PERMISSIONS,
  TerminatedFilter,
} from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { buildDocumentOrderBy } from "../utils/orderByHelper.js"
import { ModuleType, RevisionStatus, RevisionScheme } from "../generated/prisma/enums.js"
import { Document } from "../generated/prisma/client.js"

export interface DocumentOrderByInput extends OrderByInput {
  field: "CODE" | "TITLE" | "CREATED_AT" | "UPDATED_AT" | "MODULE"
}

interface DocumentFilterInput {
  query?: string
  module?: ModuleType
  documentTypeId?: number
  documentClassId?: number
  status?: RevisionStatus
  terminatedFilter?: TerminatedFilter
}

const documentIncludes = {
  documentType: true,
  documentClass: true,
  revisions: {
    include: {
      versions: true,
      workflow: {
        include: {
          steps: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
}

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("documents")

export const documentResolvers = {
  Query: {
    documentById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_READ],
        context,
      })
      logger.info("documentById", { userId })

      try {
        const document = await context.orm.document.findFirst({
          where: { id },
          include: documentIncludes,
        })

        if (!document) {
          throw new GraphQLError("Documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENT_BY_ID",
          messages: {
            notFound: "El documento solicitado no existe o no está disponible.",
            default: "Error al obtener el documento.",
          },
        })
      }
    },

    documents: async (
      _: any,
      {
        filter,
        pagination,
        orderBy,
      }: {
        filter?: DocumentFilterInput
        pagination?: PaginationInput
        orderBy?: DocumentOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_LIST],
        context,
      })
      logger.info("documents", { userId })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        // Construir filtros
        const where: any = {}

        // Filtro de estado activo/inactivo
        if (filter?.terminatedFilter !== undefined) {
          if (filter.terminatedFilter === TerminatedFilter.ACTIVE) {
            where.terminatedAt = null
          } else if (filter.terminatedFilter === TerminatedFilter.DISABLED) {
            where.terminatedAt = { not: null }
          }
        }

        if (filter?.query) {
          where.OR = [
            { code: { contains: filter.query, mode: "insensitive" as const } },
            { title: { contains: filter.query, mode: "insensitive" as const } },
            { description: { contains: filter.query, mode: "insensitive" as const } },
          ]
        }

        if (filter?.module) {
          where.module = filter.module
        }

        if (filter?.documentTypeId) {
          where.documentTypeId = filter.documentTypeId
        }

        if (filter?.documentClassId) {
          where.documentClassId = filter.documentClassId
        }

        if (filter?.status) {
          where.revisions = {
            some: {
              status: filter.status,
            },
          }
        }

        // Construir ordenamiento
        const orderByClause = buildDocumentOrderBy(orderBy)

        // Obtener total de elementos
        const totalItems = await context.orm.document.count({ where })

        // Obtener documentos paginados
        const documents = await context.orm.document.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause,
          include: documentIncludes,
        })

        // Calcular información de paginación
        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<Document> = {
          items: documents,
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
          logName: "GET_DOCUMENTS",
          messages: {
            default: "Error al obtener la lista de documentos.",
          },
        })
      }
    },

    documentsByModule: async (
      _: any,
      {
        module,
        entityType,
        entityId,
        pagination,
        orderBy,
      }: {
        module: ModuleType
        entityType?: string
        entityId?: number
        pagination?: PaginationInput
        orderBy?: DocumentOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_LIST],
        context,
      })
      logger.info("documentsByModule", { userId })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const where: any = {
          module,
          terminatedAt: null,
        }

        if (entityType) {
          where.entityType = entityType
        }

        if (entityId) {
          where.entityId = entityId
        }

        const orderByClause = buildDocumentOrderBy(orderBy)
        const totalItems = await context.orm.document.count({ where })

        const documents = await context.orm.document.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause,
          include: documentIncludes,
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        return {
          items: documents,
          pagination: {
            currentPage,
            totalPages,
            totalItems,
            hasNext: skip + take < totalItems,
            hasPrev: skip > 0,
          },
        }
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENTS_BY_MODULE",
          messages: {
            default: "Error al obtener documentos del módulo.",
          },
        })
      }
    },

    documentsSelectList: async (
      _: any,
      { filter }: { filter?: DocumentFilterInput },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_SELECT],
        context,
      })
      logger.info("documentsSelectList", { userId })

      try {
        const where: any = { terminatedAt: null }

        if (filter?.module) {
          where.module = filter.module
        }

        if (filter?.query) {
          where.OR = [
            { code: { contains: filter.query, mode: "insensitive" as const } },
            { title: { contains: filter.query, mode: "insensitive" as const } },
          ]
        }

        const documents = await context.orm.document.findMany({
          where,
          select: { id: true, code: true, title: true },
          orderBy: { code: "asc" },
        })

        return documents.map(
          (d): SelectOption => ({
            value: String(d.id),
            label: `${d.code} - ${d.title}`,
          }),
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENTS_SELECT_LIST",
          messages: {
            default: "Error al obtener la lista de documentos.",
          },
        })
      }
    },
  },

  Mutation: {
    createDocument: async (
      _: any,
      {
        input,
      }: {
        input: {
          code: string
          title: string
          description?: string
          module: ModuleType
          entityType?: string
          entityId?: number
          documentTypeId: number
          documentClassId?: number
          revisionScheme?: RevisionScheme
          initialRevisionCode?: string
          fileKey: string
          fileName: string
          fileSize: number
          mimeType: string
          checksum?: string
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_CREATE],
        context,
      })
      logger.info("createDocument", { userId })

      try {
        // Determinar esquema de revisión y código inicial
        const revisionScheme =
          input.revisionScheme || RevisionScheme.ALPHABETICAL
        const initialRevisionCode =
          input.initialRevisionCode ||
          (revisionScheme === RevisionScheme.NUMERIC ? "0" : "A")

        // Crear documento con primera revisión y primera versión en una transacción
        const document = await context.orm.document.create({
          data: {
            code: input.code,
            title: input.title,
            description: input.description,
            module: input.module,
            entityType: input.entityType,
            entityId: input.entityId,
            documentTypeId: input.documentTypeId,
            documentClassId: input.documentClassId,
            revisionScheme,
            createdById: userId,
            updatedById: userId,
            revisions: {
              create: {
                revisionCode: initialRevisionCode,
                status: "DRAFT",
                createdById: userId,
                updatedById: userId,
                versions: {
                  create: {
                    versionNumber: 1,
                    fileKey: input.fileKey,
                    fileName: input.fileName,
                    fileSize: input.fileSize,
                    mimeType: input.mimeType,
                    checksum: input.checksum,
                    createdById: userId,
                  },
                },
              },
            },
          },
          include: documentIncludes,
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "CREATE_DOCUMENT",
            message: `Documento creado: ${document.title} (${document.code})`,
            meta: JSON.stringify({ documentId: document.id, input }),
          },
        })

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_DOCUMENT",
          messages: {
            uniqueConstraint: "Ya existe un documento con ese código en este contexto.",
            foreignKeyConstraint:
              "El tipo de documento especificado no existe.",
            default: "Error al crear el documento.",
          },
        })
      }
    },

    updateDocument: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: {
          title?: string
          description?: string
          documentTypeId?: number
          documentClassId?: number
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_UPDATE],
        context,
      })
      logger.info("updateDocument", { userId })

      try {
        const { documentTypeId, documentClassId, ...rest } = input

        const document = await context.orm.document.update({
          where: { id },
          data: {
            ...rest,
            updatedById: userId,
            ...(documentTypeId !== undefined && {
              documentType: { connect: { id: documentTypeId } },
            }),
            ...(documentClassId !== undefined && {
              documentClass: documentClassId
                ? { connect: { id: documentClassId } }
                : { disconnect: true },
            }),
          },
          include: documentIncludes,
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "UPDATE_DOCUMENT",
            message: `Documento actualizado: ${document.title} (${document.code})`,
            meta: JSON.stringify({ documentId: id, input }),
          },
        })

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_DOCUMENT",
          messages: {
            notFound: "El documento no existe.",
            foreignKeyConstraint:
              "El tipo o clase de documento especificado no existe.",
            default: "Error al actualizar el documento.",
          },
        })
      }
    },

    terminateDocument: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_DELETE],
        context,
      })
      logger.info("terminateDocument", { userId })

      try {
        const document = await context.orm.document.update({
          where: { id },
          data: {
            terminatedAt: new Date(),
            updatedById: userId,
          },
          include: documentIncludes,
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "TERMINATE_DOCUMENT",
            message: `Documento deshabilitado: ${document.title} (${document.code})`,
            meta: JSON.stringify({ documentId: id }),
          },
        })

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_DOCUMENT",
          messages: {
            notFound: "El documento no existe.",
            default: "Error al deshabilitar el documento.",
          },
        })
      }
    },

    activateDocument: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_UPDATE],
        context,
      })
      logger.info("activateDocument", { userId })

      try {
        const document = await context.orm.document.update({
          where: { id },
          data: {
            terminatedAt: null,
            updatedById: userId,
          },
          include: documentIncludes,
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "ACTIVATE_DOCUMENT",
            message: `Documento reactivado: ${document.title} (${document.code})`,
            meta: JSON.stringify({ documentId: id }),
          },
        })

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACTIVATE_DOCUMENT",
          messages: {
            notFound: "El documento no existe.",
            default: "Error al reactivar el documento.",
          },
        })
      }
    },

    switchRevisionScheme: async (
      _: any,
      { id, scheme }: { id: number; scheme: RevisionScheme },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_UPDATE],
        context,
      })
      logger.info("switchRevisionScheme", { userId })

      try {
        const existing = await context.orm.document.findFirst({
          where: { id },
        })

        if (!existing) {
          throw new GraphQLError("Documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (existing.revisionScheme === scheme) {
          throw new GraphQLError(
            `El documento ya tiene el esquema de revisión ${scheme}.`,
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        const document = await context.orm.document.update({
          where: { id },
          data: {
            revisionScheme: scheme,
            updatedById: userId,
          },
          include: documentIncludes,
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "SWITCH_REVISION_SCHEME",
            message: `Esquema de revisión cambiado a ${scheme}: ${document.title} (${document.code})`,
            meta: JSON.stringify({ documentId: id, scheme }),
          },
        })

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "SWITCH_REVISION_SCHEME",
          messages: {
            notFound: "El documento no existe.",
            default: "Error al cambiar el esquema de revisión.",
          },
        })
      }
    },
  },
}
