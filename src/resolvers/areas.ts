import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PaginationInput,
  ListResponse,
  OrderByInput,
  SelectOption,
  TerminatedFilter,
} from "@CLGonzalezGroh/mi-common"
import { Area } from "../generated/prisma/client.js"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { buildAreaOrderBy } from "../utils/orderByHelper.js"

export interface AreaOrderByInput extends OrderByInput {
  field: "NAME" | "CODE" | "SORT_ORDER" | "CREATED_AT"
}

interface AreaFilterInput {
  query?: string
  projectId?: number
  terminatedFilter?: TerminatedFilter
}

export const areaResolvers = {
  Query: {
    areas: async (
      _: any,
      {
        filter,
        pagination,
        orderBy,
      }: {
        filter?: AreaFilterInput
        pagination?: PaginationInput
        orderBy?: AreaOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:area:list"],
        context,
      })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

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

        if (filter?.projectId) {
          where.projectId = filter.projectId
        }

        const orderByClause = buildAreaOrderBy(orderBy)
        const totalItems = await context.orm.area.count({ where })

        const areas = await context.orm.area.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause || { sortOrder: "asc" },
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<Area> = {
          items: areas,
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
          logName: "GET_AREAS",
          messages: {
            default: "Error al obtener la lista de áreas.",
          },
        })
      }
    },

    areaById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:area:read"],
        context,
      })

      try {
        const area = await context.orm.area.findFirst({
          where: { id },
        })

        if (!area) {
          throw new GraphQLError("Área no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return area
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_AREA_BY_ID",
          messages: {
            notFound: "El área solicitada no existe.",
            default: "Error al obtener el área.",
          },
        })
      }
    },

    areasSelectList: async (
      _: any,
      { projectId }: { projectId: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:area:select"],
        context,
      })

      try {
        const where: any = {
          terminatedAt: null,
          projectId,
        }

        const areas = await context.orm.area.findMany({
          where,
          select: { id: true, name: true, code: true },
          orderBy: { sortOrder: "asc" },
        })

        return areas.map(
          (a): SelectOption => ({
            value: String(a.id),
            label: `${a.code} - ${a.name}`,
          }),
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_AREAS_SELECT_LIST",
          messages: {
            default: "Error al obtener la lista de áreas.",
          },
        })
      }
    },
  },

  Mutation: {
    createArea: async (
      _: any,
      {
        input,
      }: {
        input: {
          name: string
          code: string
          projectId: number
          description?: string
          sortOrder?: number
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:area:create"],
        context,
      })

      try {
        const area = await context.orm.area.create({
          data: {
            name: input.name,
            code: input.code,
            projectId: input.projectId,
            description: input.description,
            sortOrder: input.sortOrder ?? 0,
            updatedById: userId,
          },
        })

        return area
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_AREA",
          messages: {
            uniqueConstraint:
              "Ya existe un área con ese código en este proyecto.",
            default: "Error al crear el área.",
          },
        })
      }
    },

    updateArea: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: {
          name?: string
          code?: string
          description?: string
          sortOrder?: number
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:area:update"],
        context,
      })

      try {
        const area = await context.orm.area.update({
          where: { id },
          data: {
            ...input,
            updatedById: userId,
          },
        })

        return area
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_AREA",
          messages: {
            notFound: "El área no existe.",
            uniqueConstraint:
              "Ya existe un área con ese código en este proyecto.",
            default: "Error al actualizar el área.",
          },
        })
      }
    },

    terminateArea: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:area:delete"],
        context,
      })

      try {
        const area = await context.orm.area.update({
          where: { id },
          data: {
            terminatedAt: new Date(),
            updatedById: userId,
          },
        })

        return area
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_AREA",
          messages: {
            notFound: "El área no existe.",
            default: "Error al deshabilitar el área.",
          },
        })
      }
    },

    activateArea: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: ["document:area:update"],
        context,
      })

      try {
        const area = await context.orm.area.update({
          where: { id },
          data: {
            terminatedAt: null,
            updatedById: userId,
          },
        })

        return area
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACTIVATE_AREA",
          messages: {
            notFound: "El área no existe.",
            default: "Error al reactivar el área.",
          },
        })
      }
    },
  },
}
