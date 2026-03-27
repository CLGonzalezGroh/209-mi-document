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
import { DocumentType } from "../generated/prisma/client.js"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { buildDocumentTypeOrderBy } from "../utils/orderByHelper.js"
import { ModuleType } from "../generated/prisma/enums.js"

export interface DocumentTypeOrderByInput extends OrderByInput {
  field: "NAME" | "CODE" | "CREATED_AT" | "UPDATED_AT"
}

interface DocumentTypeFilterInput {
  query?: string
  module?: ModuleType
  classId?: number
  terminatedFilter?: TerminatedFilter
}

export const documentTypeResolvers = {
  Query: {
    documentTypes: async (
      _: any,
      {
        filter,
        pagination,
        orderBy,
      }: {
        filter?: DocumentTypeFilterInput
        pagination?: PaginationInput
        orderBy?: DocumentTypeOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_TYPE_LIST],
        context,
      })

      try {
        const where: any = {}

        if (filter?.terminatedFilter !== undefined) {
          if (filter.terminatedFilter === TerminatedFilter.ACTIVE) {
            where.terminatedAt = null
          } else if (filter.terminatedFilter === TerminatedFilter.DISABLED) {
            where.terminatedAt = { not: null }
          }
        }

        if (filter?.query) {
          where.OR = [
            { name: { contains: filter.query, mode: "insensitive" as const } },
            { code: { contains: filter.query, mode: "insensitive" as const } },
            { description: { contains: filter.query, mode: "insensitive" as const } },
          ]
        }

        if (filter?.module) {
          where.OR = [
            ...(where.OR || []),
            { module: filter.module },
            { module: null }, // Disponible para todos
          ]
          // Si ya había un OR, necesitamos usar AND
          if (where.OR && filter?.query) {
            where.AND = [
              {
                OR: [
                  { name: { contains: filter.query, mode: "insensitive" as const } },
                  { code: { contains: filter.query, mode: "insensitive" as const } },
                  { description: { contains: filter.query, mode: "insensitive" as const } },
                ],
              },
              {
                OR: [{ module: filter.module }, { module: null }],
              },
            ]
            delete where.OR
          }
        }

        if (filter?.classId) {
          // Filtrar por clase específica O tipos sin clase (universales)
          const classCondition = {
            OR: [{ classId: filter.classId }, { classId: null }],
          }
          if (where.AND) {
            where.AND.push(classCondition)
          } else if (where.OR) {
            where.AND = [
              { OR: where.OR },
              classCondition,
            ]
            delete where.OR
          } else {
            Object.assign(where, classCondition)
          }
        }

        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const orderByClause = buildDocumentTypeOrderBy(orderBy)

        const totalItems = await context.orm.documentType.count({ where })

        const documentTypes = await context.orm.documentType.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause || { name: "asc" },
          include: { class: true },
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<DocumentType> = {
          items: documentTypes,
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
          logName: "GET_DOCUMENT_TYPES",
          messages: {
            default: "Error al obtener los tipos de documento.",
          },
        })
      }
    },

    documentTypeById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_TYPE_READ],
        context,
      })

      try {
        const documentType = await context.orm.documentType.findFirst({
          where: { id },
          include: { class: true },
        })

        if (!documentType) {
          throw new GraphQLError("Tipo de documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return documentType
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENT_TYPE_BY_ID",
          messages: {
            notFound:
              "El tipo de documento solicitado no existe o no está disponible.",
            default: "Error al obtener el tipo de documento.",
          },
        })
      }
    },

    documentTypesSelectList: async (
      _: any,
      { module, classId }: { module?: ModuleType; classId?: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [
          PERMISSIONS.DOCUMENT_DOCUMENT_TYPE_SELECT,
          PERMISSIONS.COMMON_SELECT_LIST_ACCESS,
        ],
        context,
      })

      try {
        const where: any = { terminatedAt: null }

        if (module) {
          where.OR = [{ module }, { module: null }]
        }

        if (classId) {
          const classCondition = {
            OR: [{ classId }, { classId: null }],
          }
          if (where.OR) {
            where.AND = [
              { OR: where.OR },
              classCondition,
            ]
            delete where.OR
          } else {
            Object.assign(where, classCondition)
          }
        }

        const documentTypes = await context.orm.documentType.findMany({
          where,
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })

        return documentTypes.map(
          (dt): SelectOption => ({
            value: String(dt.id),
            label: dt.name,
          }),
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENT_TYPES_SELECT_LIST",
          messages: {
            default: "Error al obtener la lista de tipos de documento.",
          },
        })
      }
    },
  },

  Mutation: {
    createDocumentType: async (
      _: any,
      {
        input,
      }: {
        input: {
          name: string
          code: string
          module?: ModuleType
          classId?: number
          description?: string
          requiresWorkflow?: boolean
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_TYPE_CREATE],
        context,
      })

      try {
        const documentType = await context.orm.documentType.create({
          data: {
            name: input.name,
            code: input.code,
            module: input.module,
            classId: input.classId,
            description: input.description,
            requiresWorkflow: input.requiresWorkflow ?? false,
            updatedById: userId,
          },
          include: { class: true },
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "CREATE_DOCUMENT_TYPE",
            message: `Tipo de documento creado: ${documentType.name} (${documentType.code})`,
            meta: JSON.stringify({ documentTypeId: documentType.id, input }),
          },
        })

        return documentType
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_DOCUMENT_TYPE",
          messages: {
            uniqueConstraint:
              "Ya existe un tipo de documento con ese nombre o código.",
            default: "Error al crear el tipo de documento.",
          },
        })
      }
    },

    updateDocumentType: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: {
          name?: string
          code?: string
          module?: ModuleType
          classId?: number
          description?: string
          requiresWorkflow?: boolean
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_TYPE_UPDATE],
        context,
      })

      try {
        const documentType = await context.orm.documentType.update({
          where: { id },
          data: {
            ...input,
            updatedById: userId,
          },
          include: { class: true },
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "UPDATE_DOCUMENT_TYPE",
            message: `Tipo de documento actualizado: ${documentType.name} (${documentType.code})`,
            meta: JSON.stringify({ documentTypeId: id, input }),
          },
        })

        return documentType
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_DOCUMENT_TYPE",
          messages: {
            notFound: "El tipo de documento no existe.",
            uniqueConstraint:
              "Ya existe un tipo de documento con ese nombre o código.",
            default: "Error al actualizar el tipo de documento.",
          },
        })
      }
    },

    terminateDocumentType: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_TYPE_DELETE],
        context,
      })

      try {
        const documentType = await context.orm.documentType.update({
          where: { id },
          data: {
            terminatedAt: new Date(),
            updatedById: userId,
          },
          include: { class: true },
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "TERMINATE_DOCUMENT_TYPE",
            message: `Tipo de documento deshabilitado: ${documentType.name} (${documentType.code})`,
            meta: JSON.stringify({ documentTypeId: id }),
          },
        })

        return documentType
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_DOCUMENT_TYPE",
          messages: {
            notFound: "El tipo de documento no existe.",
            default: "Error al deshabilitar el tipo de documento.",
          },
        })
      }
    },

    activateDocumentType: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_TYPE_UPDATE],
        context,
      })

      try {
        const documentType = await context.orm.documentType.update({
          where: { id },
          data: {
            terminatedAt: null,
            updatedById: userId,
          },
          include: { class: true },
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "ACTIVATE_DOCUMENT_TYPE",
            message: `Tipo de documento reactivado: ${documentType.name} (${documentType.code})`,
            meta: JSON.stringify({ documentTypeId: id }),
          },
        })

        return documentType
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACTIVATE_DOCUMENT_TYPE",
          messages: {
            notFound: "El tipo de documento no existe.",
            default: "Error al reactivar el tipo de documento.",
          },
        })
      }
    },

    deleteDocumentType: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_TYPE_DELETE],
        context,
      })

      try {
        const documentType = await context.orm.documentType.findFirst({
          where: { id },
        })

        if (!documentType) {
          throw new GraphQLError("Tipo de documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        await context.orm.documentType.delete({
          where: { id },
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "WARNING",
            name: "DELETE_DOCUMENT_TYPE",
            message: `Tipo de documento eliminado: ${documentType.name} (${documentType.code})`,
            meta: JSON.stringify({ documentTypeId: id }),
          },
        })

        return true
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DELETE_DOCUMENT_TYPE",
          messages: {
            notFound: "El tipo de documento no existe.",
            default: "Error al eliminar el tipo de documento.",
          },
        })
      }
    },
  },
}
