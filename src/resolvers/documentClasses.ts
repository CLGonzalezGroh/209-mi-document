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
import { DocumentClass } from "../generated/prisma/client.js"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { buildDocumentClassOrderBy } from "../utils/orderByHelper.js"
import { ModuleType } from "../generated/prisma/enums.js"

export interface DocumentClassOrderByInput extends OrderByInput {
  field: "NAME" | "CODE" | "SORT_ORDER" | "CREATED_AT"
}

interface DocumentClassFilterInput {
  query?: string
  module?: ModuleType
  terminatedFilter?: TerminatedFilter
}

const documentClassIncludes = {
  documentTypes: {
    where: { terminatedAt: null },
    orderBy: { name: "asc" as const },
  },
}

export const documentClassResolvers = {
  Query: {
    documentClasses: async (
      _: any,
      {
        filter,
        pagination,
        orderBy,
      }: {
        filter?: DocumentClassFilterInput
        pagination?: PaginationInput
        orderBy?: DocumentClassOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:documentClass:list"],
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
          const moduleCondition = {
            OR: [{ module: filter.module }, { module: null }],
          }
          if (where.OR && filter?.query) {
            where.AND = [
              {
                OR: [
                  { name: { contains: filter.query } },
                  { code: { contains: filter.query } },
                  { description: { contains: filter.query } },
                ],
              },
              moduleCondition,
            ]
            delete where.OR
          } else {
            Object.assign(where, moduleCondition)
          }
        }

        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const orderByClause = buildDocumentClassOrderBy(orderBy)

        const totalItems = await context.orm.documentClass.count({
          where,
        })

        const documentClasses = await context.orm.documentClass.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause || { sortOrder: "asc" },
          include: documentClassIncludes,
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<DocumentClass> = {
          items: documentClasses,
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
          logName: "GET_DOCUMENT_CLASSES",
          messages: {
            default: "Error al obtener las clases de documento.",
          },
        })
      }
    },

    documentClassById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:documentClass:read"],
        context,
      })

      try {
        const documentClass = await context.orm.documentClass.findFirst({
          where: { id },
          include: documentClassIncludes,
        })

        if (!documentClass) {
          throw new GraphQLError("Clase de documento no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return documentClass
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENT_CLASS_BY_ID",
          messages: {
            notFound: "La clase de documento solicitada no existe.",
            default: "Error al obtener la clase de documento.",
          },
        })
      }
    },

    documentClassesSelectList: async (
      _: any,
      { module }: { module?: ModuleType },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:documentClass:select"],
        context,
      })

      try {
        const where: any = { terminatedAt: null }

        if (module) {
          where.OR = [{ module }, { module: null }]
        }

        const documentClasses = await context.orm.documentClass.findMany({
          where,
          select: { id: true, name: true },
          orderBy: { sortOrder: "asc" },
        })

        return documentClasses.map(
          (dc): SelectOption => ({
            value: String(dc.id),
            label: dc.name,
          }),
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENT_CLASSES_SELECT_LIST",
          messages: {
            default: "Error al obtener la lista de clases de documento.",
          },
        })
      }
    },
  },

  Mutation: {
    createDocumentClass: async (
      _: any,
      {
        input,
      }: {
        input: {
          name: string
          code: string
          module?: ModuleType
          description?: string
          sortOrder?: number
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:documentClass:create"],
        context,
      })

      try {
        const documentClass = await context.orm.documentClass.create({
          data: {
            name: input.name,
            code: input.code,
            module: input.module,
            description: input.description,
            sortOrder: input.sortOrder ?? 0,
            updatedById: userId,
          },
          include: documentClassIncludes,
        })

        return documentClass
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_DOCUMENT_CLASS",
          messages: {
            uniqueConstraint:
              "Ya existe una clase de documento con ese nombre o código.",
            default: "Error al crear la clase de documento.",
          },
        })
      }
    },

    updateDocumentClass: async (
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
          sortOrder?: number
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:documentClass:update"],
        context,
      })

      try {
        const documentClass = await context.orm.documentClass.update({
          where: { id },
          data: {
            ...input,
            updatedById: userId,
          },
          include: documentClassIncludes,
        })

        return documentClass
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_DOCUMENT_CLASS",
          messages: {
            notFound: "La clase de documento no existe.",
            uniqueConstraint:
              "Ya existe una clase de documento con ese nombre o código.",
            default: "Error al actualizar la clase de documento.",
          },
        })
      }
    },

    terminateDocumentClass: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:documentClass:delete"],
        context,
      })

      try {
        const documentClass = await context.orm.documentClass.update({
          where: { id },
          data: {
            terminatedAt: new Date(),
            updatedById: userId,
          },
          include: documentClassIncludes,
        })

        return documentClass
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_DOCUMENT_CLASS",
          messages: {
            notFound: "La clase de documento no existe.",
            default: "Error al deshabilitar la clase de documento.",
          },
        })
      }
    },

    activateDocumentClass: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:documentClass:update"],
        context,
      })

      try {
        const documentClass = await context.orm.documentClass.update({
          where: { id },
          data: {
            terminatedAt: null,
            updatedById: userId,
          },
          include: documentClassIncludes,
        })

        return documentClass
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACTIVATE_DOCUMENT_CLASS",
          messages: {
            notFound: "La clase de documento no existe.",
            default: "Error al reactivar la clase de documento.",
          },
        })
      }
    },
  },
}
