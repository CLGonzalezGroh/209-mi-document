import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PaginationInput,
  ListResponse,
  PERMISSIONS,
} from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { buildTransmittalOrderBy } from "../utils/orderByHelper.js"
import { TransmittalStatus, ClientStatus } from "../generated/prisma/enums.js"
import { Transmittal } from "../generated/prisma/client.js"
import { OrderByInput } from "@CLGonzalezGroh/mi-common"

export interface TransmittalOrderByInput extends OrderByInput {
  field: "CODE" | "CREATED_AT" | "ISSUED_AT" | "STATUS"
}

interface TransmittalFilterInput {
  query?: string
  projectId?: number
  status?: TransmittalStatus
}

const transmittalIncludes = {
  items: {
    include: {
      documentRevision: {
        include: {
          document: true,
          versions: {
            orderBy: { versionNumber: "desc" as const },
            take: 1,
          },
        },
      },
    },
  },
}

/**
 * Genera el próximo código de transmittal.
 * Formato: TR-001, TR-002, TR-003...
 */
async function generateTransmittalCode(
  orm: ResolverContext["orm"],
): Promise<string> {
  const lastTransmittal = await orm.transmittal.findFirst({
    orderBy: { id: "desc" },
    select: { code: true },
  })

  if (!lastTransmittal) {
    return "TR-001"
  }

  const match = lastTransmittal.code.match(/TR-(\d+)/)
  const nextNumber = match ? parseInt(match[1]) + 1 : 1
  return `TR-${nextNumber.toString().padStart(3, "0")}`
}

export const transmittalResolvers = {
  Query: {
    transmittalById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_TRANSMITTAL_READ],
        context,
      })

      try {
        const transmittal = await context.orm.transmittal.findFirst({
          where: { id },
          include: transmittalIncludes,
        })

        if (!transmittal) {
          throw new GraphQLError("Transmittal no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return transmittal
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_TRANSMITTAL_BY_ID",
          messages: {
            notFound:
              "El transmittal solicitado no existe o no está disponible.",
            default: "Error al obtener el transmittal.",
          },
        })
      }
    },

    transmittals: async (
      _: any,
      {
        filter,
        pagination,
        orderBy,
      }: {
        filter?: TransmittalFilterInput
        pagination?: PaginationInput
        orderBy?: TransmittalOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_TRANSMITTAL_LIST],
        context,
      })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const where: any = {}

        if (filter?.query) {
          where.OR = [
            { code: { contains: filter.query } },
            { issuedTo: { contains: filter.query } },
          ]
        }

        if (filter?.projectId) {
          where.projectId = filter.projectId
        }

        if (filter?.status) {
          where.status = filter.status
        }

        const orderByClause = buildTransmittalOrderBy(orderBy)
        const totalItems = await context.orm.transmittal.count({ where })

        const transmittals = await context.orm.transmittal.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause,
          include: transmittalIncludes,
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<Transmittal> = {
          items: transmittals,
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
          logName: "GET_TRANSMITTALS",
          messages: {
            default: "Error al obtener la lista de transmittals.",
          },
        })
      }
    },

    transmittalsByProject: async (
      _: any,
      {
        projectId,
        pagination,
      }: {
        projectId: number
        pagination?: PaginationInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_TRANSMITTAL_LIST],
        context,
      })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const where = { projectId }

        const totalItems = await context.orm.transmittal.count({ where })

        const transmittals = await context.orm.transmittal.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: transmittalIncludes,
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        return {
          items: transmittals,
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
          logName: "GET_TRANSMITTALS_BY_PROJECT",
          messages: {
            default: "Error al obtener transmittals del proyecto.",
          },
        })
      }
    },
  },

  Mutation: {
    createTransmittal: async (
      _: any,
      {
        input,
      }: {
        input: {
          projectId: number
          issuedTo: string
          items: Array<{
            documentRevisionId: number
            purposeCode: string
          }>
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_TRANSMITTAL_CREATE],
        context,
      })

      try {
        const code = await generateTransmittalCode(context.orm)

        const transmittal = await context.orm.transmittal.create({
          data: {
            code,
            projectId: input.projectId,
            issuedTo: input.issuedTo,
            issuedById: userId,
            updatedById: userId,
            items: {
              create: input.items.map((item) => ({
                documentRevisionId: item.documentRevisionId,
                purposeCode: item.purposeCode as any,
              })),
            },
          },
          include: transmittalIncludes,
        })

        return transmittal
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_TRANSMITTAL",
          messages: {
            uniqueConstraint: "Ya existe un transmittal con ese código.",
            foreignKeyConstraint:
              "Una de las revisiones de documento no existe.",
            default: "Error al crear el transmittal.",
          },
        })
      }
    },

    issueTransmittal: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_TRANSMITTAL_UPDATE],
        context,
      })

      try {
        const transmittal = await context.orm.transmittal.findFirst({
          where: { id },
        })

        if (!transmittal) {
          throw new GraphQLError("Transmittal no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (transmittal.status !== TransmittalStatus.DRAFT) {
          throw new GraphQLError(
            "Solo se pueden emitir transmittals en estado DRAFT.",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const updated = await context.orm.transmittal.update({
          where: { id },
          data: {
            status: TransmittalStatus.ISSUED,
            issuedAt: new Date(),
            updatedById: userId,
            issuedById: userId,
          },
          include: transmittalIncludes,
        })

        return updated
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ISSUE_TRANSMITTAL",
          messages: {
            notFound: "El transmittal no existe.",
            default: "Error al emitir el transmittal.",
          },
        })
      }
    },

    respondTransmittal: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: {
          responseComments?: string
          items: Array<{
            itemId: number
            clientStatus: ClientStatus
            clientComments?: string
          }>
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_TRANSMITTAL_UPDATE],
        context,
      })

      try {
        const transmittal = await context.orm.transmittal.findFirst({
          where: { id },
        })

        if (!transmittal) {
          throw new GraphQLError("Transmittal no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (
          transmittal.status !== TransmittalStatus.ISSUED &&
          transmittal.status !== TransmittalStatus.ACKNOWLEDGED
        ) {
          throw new GraphQLError(
            "Solo se puede responder transmittals en estado ISSUED o ACKNOWLEDGED.",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const result = await context.orm.$transaction(async (tx) => {
          // Actualizar cada item con la respuesta del cliente
          for (const itemResponse of input.items) {
            await tx.transmittalItem.update({
              where: { id: itemResponse.itemId },
              data: {
                clientStatus: itemResponse.clientStatus,
                clientComments: itemResponse.clientComments,
              },
            })
          }

          // Actualizar transmittal
          const updated = await tx.transmittal.update({
            where: { id },
            data: {
              status: TransmittalStatus.RESPONDED,
              responseAt: new Date(),
              responseComments: input.responseComments,
              updatedById: userId,
            },
            include: transmittalIncludes,
          })

          return updated
        })

        return result
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "RESPOND_TRANSMITTAL",
          messages: {
            notFound: "El transmittal o uno de sus items no existe.",
            default: "Error al registrar la respuesta del transmittal.",
          },
        })
      }
    },

    closeTransmittal: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_TRANSMITTAL_UPDATE],
        context,
      })

      try {
        const transmittal = await context.orm.transmittal.findFirst({
          where: { id },
        })

        if (!transmittal) {
          throw new GraphQLError("Transmittal no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (transmittal.status === TransmittalStatus.CLOSED) {
          throw new GraphQLError("El transmittal ya está cerrado.", {
            extensions: { code: "BAD_REQUEST" },
          })
        }

        if (transmittal.status === TransmittalStatus.DRAFT) {
          throw new GraphQLError(
            "No se puede cerrar un transmittal en estado DRAFT. Debe emitirlo primero.",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const updated = await context.orm.transmittal.update({
          where: { id },
          data: {
            status: TransmittalStatus.CLOSED,
            updatedById: userId,
          },
          include: transmittalIncludes,
        })

        return updated
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CLOSE_TRANSMITTAL",
          messages: {
            notFound: "El transmittal no existe.",
            default: "Error al cerrar el transmittal.",
          },
        })
      }
    },
  },
}
