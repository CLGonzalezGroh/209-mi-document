import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PaginationInput,
  OrderByInput,
  SelectOption,
  PERMISSIONS,
  TerminatedFilter,
} from "@CLGonzalezGroh/mi-common"
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
            { name: { contains: filter.query } },
            { code: { contains: filter.query } },
            { description: { contains: filter.query } },
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
                  { name: { contains: filter.query } },
                  { code: { contains: filter.query } },
                  { description: { contains: filter.query } },
                ],
              },
              {
                OR: [{ module: filter.module }, { module: null }],
              },
            ]
            delete where.OR
          }
        }

        const orderByClause = buildDocumentTypeOrderBy(orderBy)

        const documentTypes = await context.orm.documentType.findMany({
          where,
          orderBy: orderByClause || { name: "asc" },
        })

        return documentTypes
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
      { module }: { module?: ModuleType },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_TYPE_LIST],
        context,
      })

      try {
        const where: any = { terminatedAt: null }

        if (module) {
          where.OR = [{ module }, { module: null }]
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
            description: input.description,
            requiresWorkflow: input.requiresWorkflow ?? false,
            updatedById: userId,
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
  },
}
