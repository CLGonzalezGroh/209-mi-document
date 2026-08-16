import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PaginationInput,
  ListResponse,
  PERMISSIONS,
} from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import {
  applyProjectScope,
  assertObjectAccess,
  projectAuthorization,
  projectScopeAuthorization,
} from "../utils/projectAuthorization.js"
import { DocObjectType } from "../generated/prisma/enums.js"
import { handleError } from "../utils/handleError.js"
import { buildTransmittalOrderBy } from "../utils/orderByHelper.js"
import {
  TransmittalStatus,
  TransmittalNature,
  ClientStatus,
  SysLogModule,
} from "../generated/prisma/enums.js"
import {
  assertNature,
  generateTransmittalCode,
  responseLinkViolation,
} from "../utils/transmittalCirculation.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { emitAuditEvent, emitWorkflowEvent } from "../events/emit.js"
import { Transmittal } from "../generated/prisma/client.js"
import { OrderByInput } from "@CLGonzalezGroh/mi-common"

export interface TransmittalOrderByInput extends OrderByInput {
  field: "CODE" | "CREATED_AT" | "ISSUED_AT" | "STATUS"
}

interface TransmittalFilterInput {
  query?: string
  projectId?: number
  status?: TransmittalStatus
  nature?: TransmittalNature
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

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("transmittals")

/**
 * Reintento acotado ante colisión de código (BLOQUE 04, B2).
 *
 * El código se propone leyendo el último del proyecto y el índice único es el
 * árbitro. Dos creaciones simultáneas pueden proponer el mismo, y la segunda
 * falla con `P2002`: se repite la transacción **entera**, porque una violación
 * de unicidad aborta la transacción en PostgreSQL y reintentar adentro no es
 * posible.
 *
 * Solo reintenta la colisión de código: cualquier otra unicidad —un ítem
 * repetido, por ejemplo— es un error del pedido y debe llegarle a quien lo hizo.
 */
//
// El tope acompaña a la concurrencia real: con N creaciones simultáneas sobre el
// mismo proyecto, todas leen el mismo último código y avanzan de a una por
// vuelta, de modo que la última necesita N intentos.
const INTENTOS = 10

/**
 * Qué restricción se violó.
 *
 * El cliente no lo expone en un solo lugar: `meta.target` en unas versiones, y
 * `meta.driverAdapterError.cause.constraint` en las que usan adaptador de
 * driver, que es el caso de este módulo. Se juntan las formas conocidas, porque
 * mirar una sola deja el reintento inerte sin que la compilación lo advierta
 * —fue exactamente lo que pasó al escribirlo—.
 */
const restriccionViolada = (error: any): string => {
  const meta = error?.meta ?? {}
  const constraint = meta?.driverAdapterError?.cause?.constraint ?? {}

  return [
    Array.isArray(meta.target) ? meta.target.join(",") : meta.target,
    Array.isArray(constraint.fields) ? constraint.fields.join(",") : undefined,
    constraint.index,
    meta?.driverAdapterError?.cause?.originalMessage,
  ]
    .filter(Boolean)
    .join(" ")
}

const esColisionDeCodigo = (error: any): boolean =>
  error?.code === "P2002" && restriccionViolada(error).includes("code")

const withCodeRetry = async <T>(operacion: () => Promise<T>): Promise<T> => {
  for (let intento = 1; ; intento++) {
    try {
      return await operacion()
    } catch (error) {
      if (intento >= INTENTOS || !esColisionDeCodigo(error)) throw error
      logger.warn("colisión de código de transmittal, reintentando", { intento })
    }
  }
}

export const transmittalResolvers = {
  Query: {
    transmittalById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_READ],
        context,
      })
      logger.info("transmittalById", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      // El transmittal lleva su propio projectId, y nunca es nulo.
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.TRANSMITTAL,
        objectId: id,
        context,
        notFoundMessage: "Transmittal no encontrado",
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
          module: SysLogModule.PROJECTS,
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
      // Listado sin proyecto en los argumentos: la segunda capa filtra (B7).
      // Sin el régimen de publicación: Transmittal.projectId es obligatorio.
      const { userId, scope } = await projectScopeAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_LIST],
        context,
        includeWithoutProject: false,
      })
      logger.info("transmittals", { userId })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const where: any = {}

        if (filter?.query) {
          where.OR = [
            { code: { contains: filter.query, mode: "insensitive" as const } },
            {
              counterpartyReference: {
                contains: filter.query,
                mode: "insensitive" as const,
              },
            },
          ]
        }

        if (filter?.projectId) {
          where.projectId = filter.projectId
        }

        if (filter?.status) {
          where.status = filter.status
        }

        if (filter?.nature) {
          where.nature = filter.nature
        }

        const orderByClause = buildTransmittalOrderBy(orderBy)

        // El alcance se incorpora bajo AND para no pisar el OR de la búsqueda
        const scopedWhere = applyProjectScope(where, scope)
        const totalItems = await context.orm.transmittal.count({
          where: scopedWhere,
        })

        const transmittals = await context.orm.transmittal.findMany({
          where: scopedWhere,
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
          module: SysLogModule.PROJECTS,
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
      // El proyecto es argumento explícito: doble capa estricta
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_LIST],
        projectId,
        context,
      })
      logger.info("transmittalsByProject", { userId })

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
          module: SysLogModule.PROJECTS,
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
          nature: TransmittalNature
          counterpartyReference?: string
          respondsToTransmittalId?: number
          items: Array<{
            documentRevisionId: number
            purposeCode: string
          }>
        }
      },
      context: ResolverContext,
    ) => {
      // El proyecto viene en el input: doble capa estricta, sin nulo posible
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_CREATE],
        projectId: input.projectId,
        context,
      })
      logger.info("createTransmittal", { userId })

      try {
        // El rol se DECLARA y no se deduce (D-19). Sin declaración no hay
        // circulación posible: es el rol el que dice si el transmittal sale, si
        // entra, o si no existe.
        const settings = await context.orm.docProjectSettings.findUnique({
          where: { projectId: input.projectId },
          select: { documentRole: true },
        })

        if (!settings) {
          throw new GraphQLError(
            "El proyecto no declaró su rol documental: no puede circular documentación",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        // Un proyecto interno no admite transmittals de ninguna naturaleza, y
        // en modo Receptor no existe el de respuesta (B1).
        assertNature(settings.documentRole, input.nature)

        const respondsTo = input.respondsToTransmittalId
          ? await context.orm.transmittal.findUnique({
              where: { id: input.respondsToTransmittalId },
              select: { projectId: true, nature: true },
            })
          : null

        if (input.respondsToTransmittalId && !respondsTo) {
          throw new GraphQLError("El transmittal que se contesta no existe", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        const vinculo = responseLinkViolation(
          input.nature,
          respondsTo,
          input.projectId,
        )

        if (vinculo) {
          throw new GraphQLError(vinculo, {
            extensions: { code: "BAD_USER_INPUT" },
          })
        }

        // El código se calcula DENTRO de la transacción y el índice único
        // `[projectId, code]` es el árbitro (B2). El reintento repite la
        // transacción entera, porque una violación de unicidad la aborta en
        // PostgreSQL y continuar adentro no es posible.
        const transmittal = await withCodeRetry(() =>
          context.orm.$transaction(async (tx) => {
            const code = await generateTransmittalCode(tx, input.projectId)

            const created = await tx.transmittal.create({
              data: {
                code,
                projectId: input.projectId,
                nature: input.nature,
                counterpartyReference: input.counterpartyReference,
                respondsToTransmittalId: input.respondsToTransmittalId,
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

            await emitAuditEvent(tx, {
              action: AuditAction.CreateTransmittal,
              objectId: created.id,
              actorId: userId,
              meta: {
                code: created.code,
                projectId: input.projectId,
                nature: created.nature,
                itemsCount: input.items.length,
              },
            })
            await emitWorkflowEvent(tx, {
              name: WorkflowEvent.TransmittalCreated,
              objectId: created.id,
              toState: TransmittalStatus.DRAFT,
              actorId: userId,
            })

            return created
          }),
        )

        return transmittal
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_TRANSMITTAL",
          module: SysLogModule.PROJECTS,
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
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_UPDATE],
        context,
      })
      logger.info("issueTransmittal", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      // El transmittal lleva su propio projectId, y nunca es nulo.
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.TRANSMITTAL,
        objectId: id,
        context,
        notFoundMessage: "Transmittal no encontrado",
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

        const updated = await context.orm.$transaction(async (tx) => {
          const issued = await tx.transmittal.update({
            where: { id },
            data: {
              status: TransmittalStatus.ISSUED,
              issuedAt: new Date(),
              updatedById: userId,
              issuedById: userId,
            },
            include: transmittalIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.IssueTransmittal,
            objectId: id,
            actorId: userId,
            meta: { code: issued.code },
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.TransmittalIssued,
            objectId: id,
            fromState: transmittal.status,
            toState: TransmittalStatus.ISSUED,
            actorId: userId,
          })

          return issued
        })

        return updated
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ISSUE_TRANSMITTAL",
          module: SysLogModule.PROJECTS,
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
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_UPDATE],
        context,
      })
      logger.info("respondTransmittal", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      // El transmittal lleva su propio projectId, y nunca es nulo.
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.TRANSMITTAL,
        objectId: id,
        context,
        notFoundMessage: "Transmittal no encontrado",
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

          await emitAuditEvent(tx, {
            action: AuditAction.RespondTransmittal,
            objectId: id,
            actorId: userId,
            meta: { code: transmittal.code, itemsCount: input.items.length },
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.TransmittalResponded,
            objectId: id,
            fromState: transmittal.status,
            toState: TransmittalStatus.RESPONDED,
            actorId: userId,
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
          module: SysLogModule.PROJECTS,
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
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_UPDATE],
        context,
      })
      logger.info("closeTransmittal", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      // El transmittal lleva su propio projectId, y nunca es nulo.
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.TRANSMITTAL,
        objectId: id,
        context,
        notFoundMessage: "Transmittal no encontrado",
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

        const updated = await context.orm.$transaction(async (tx) => {
          const closed = await tx.transmittal.update({
            where: { id },
            data: {
              status: TransmittalStatus.CLOSED,
              updatedById: userId,
            },
            include: transmittalIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CloseTransmittal,
            objectId: id,
            actorId: userId,
            meta: { code: closed.code },
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.TransmittalClosed,
            objectId: id,
            fromState: transmittal.status,
            toState: TransmittalStatus.CLOSED,
            actorId: userId,
          })

          return closed
        })

        return updated
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CLOSE_TRANSMITTAL",
          module: SysLogModule.PROJECTS,
          messages: {
            notFound: "El transmittal no existe.",
            default: "Error al cerrar el transmittal.",
          },
        })
      }
    },
  },
}
