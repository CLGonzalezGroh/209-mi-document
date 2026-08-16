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
  SysLogModule,
} from "../generated/prisma/enums.js"
import {
  assertCarriesItems,
  assertNature,
  generateTransmittalCode,
  responseLinkViolation,
} from "../utils/transmittalCirculation.js"
import {
  assertApprovedForEmission,
  missingFileRoles,
} from "../utils/emissionPurpose.js"
import {
  assertCanAcknowledge,
  assertCarrier,
  assertIssued,
  statusAfterResponse,
  wasTranscribed,
} from "../utils/itemResponse.js"
import { resolveScope } from "../utils/qualifications.js"
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
      // La respuesta viaja con el ítem: el avance de B10 se deriva de ella, y
      // sin incluirla cada transmittal cuesta una lectura extra.
      response: { include: { files: true } },
      documentRevision: {
        include: {
          document: true,
          versions: {
            // Con sus archivos: la advertencia de B4 se resuelve sobre ellos,
            // y sin incluirlos cada ítem cuesta una lectura extra.
            include: { files: true },
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

/**
 * Emitido, el contenido del transmittal queda fijo (B9).
 *
 * La carátula que la contraparte recibió declara un contenido; corregir una
 * emisión ya salida no es editarla sino emitir otra.
 */
const assertDraft = (status: TransmittalStatus, accion: string): void => {
  if (status !== TransmittalStatus.DRAFT) {
    throw new GraphQLError(
      `Solo se pueden ${accion} mientras el transmittal está en borrador`,
      { extensions: { code: "BAD_REQUEST" } },
    )
  }
}

/**
 * La calificación elegida debe ser una de las que el proyecto resuelve (B11).
 *
 * El alcance no es decorativo: una lista mezclada admite calificar con un valor
 * que la contraparte no usa, que es justamente lo que el catálogo por proyecto
 * viene a impedir.
 */
const assertQualificationInScope = async (
  context: ResolverContext,
  projectId: number,
  qualificationId: number,
): Promise<void> => {
  const catalogo = await context.orm.docQualification.findMany({
    where: { OR: [{ projectId }, { projectId: null }] },
    select: { id: true, projectId: true, terminatedAt: true },
  })

  const vigentes = resolveScope(catalogo, projectId).filter(
    (q) => q.terminatedAt === null,
  )

  if (!vigentes.some((q) => q.id === qualificationId)) {
    throw new GraphQLError(
      "Esa calificación no pertenece al catálogo vigente del proyecto",
      { extensions: { code: "BAD_USER_INPUT" } },
    )
  }
}

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

        // La puerta se aplica al INCORPORAR el ítem y no solo al emitir (B3):
        // una revisión en circuito no es candidata a salir, de modo que tampoco
        // es candidata a entrar en la carpeta. Solo donde la emisión es
        // saliente; en modo Receptor no hay aprobación interna que exigir.
        if (input.items.length > 0) {
          assertCarriesItems(input.nature)
        }

        if (input.nature === TransmittalNature.EMISSION && input.items.length > 0) {
          const revisiones = await context.orm.documentRevision.findMany({
            where: { id: { in: input.items.map((i) => i.documentRevisionId) } },
            select: { id: true, revisionCode: true, status: true },
          })

          assertApprovedForEmission(settings.documentRole, revisiones)
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
            // Dos unicidades distintas llegan acá y no deben confundirse: la
            // del código, que el reintento ya agotó, y la de la revisión, que
            // es el árbitro de "no emitidas" (B3) y le habla a quien la eligió.
            uniqueConstraint: esColisionDeCodigo(error)
              ? "No se pudo asignar un código libre para el transmittal. Reintente."
              : "Una de las revisiones ya fue incluida en otro transmittal: una revisión se emite una sola vez.",
            foreignKeyConstraint:
              "Una de las revisiones de documento no existe.",
            default: "Error al crear el transmittal.",
          },
        })
      }
    },
    /**
     * Los ítems se editan mientras el transmittal está en borrador (B9).
     *
     * Emitido, el contenido queda fijo: la carátula que la contraparte recibió
     * declara un contenido, y corregir una emisión ya salida no es editarla sino
     * emitir otra. Es el mismo corte que `B3` aplica a la puerta, y el tercer
     * nivel en que el módulo lo aplica —la versión no se modifica, la revisión
     * aprobada tampoco—.
     */
    addTransmittalItem: async (
      _: any,
      {
        transmittalId,
        input,
      }: {
        transmittalId: number
        input: { documentRevisionId: number; purposeCode: string }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_UPDATE],
        context,
      })
      logger.info("addTransmittalItem", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.TRANSMITTAL,
        objectId: transmittalId,
        context,
        notFoundMessage: "Transmittal no encontrado",
      })

      try {
        const transmittal = await context.orm.transmittal.findUniqueOrThrow({
          where: { id: transmittalId },
          select: { id: true, projectId: true, nature: true, status: true },
        })

        assertCarriesItems(transmittal.nature)
        assertDraft(transmittal.status, "agregar documentos")

        const settings = await context.orm.docProjectSettings.findUnique({
          where: { projectId: transmittal.projectId },
          select: { documentRole: true },
        })

        if (!settings) {
          throw new GraphQLError(
            "El proyecto no declaró su rol documental: no puede circular documentación",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        const revision = await context.orm.documentRevision.findUnique({
          where: { id: input.documentRevisionId },
          select: { id: true, revisionCode: true, status: true },
        })

        if (!revision) {
          throw new GraphQLError("La revisión no existe", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        // La misma puerta que la creación, sobre el mismo util (B3): es acá
        // donde "se aplica al incorporar el ítem" tiene su caso propio.
        assertApprovedForEmission(settings.documentRole, [revision])

        return await context.orm.$transaction(async (tx) => {
          const item = await tx.transmittalItem.create({
            data: {
              transmittalId,
              documentRevisionId: input.documentRevisionId,
              purposeCode: input.purposeCode as any,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.AddTransmittalItem,
            objectId: transmittalId,
            actorId: userId,
            meta: {
              itemId: item.id,
              documentRevisionId: input.documentRevisionId,
              purposeCode: input.purposeCode,
            },
          })

          return tx.transmittal.findUniqueOrThrow({
            where: { id: transmittalId },
            include: transmittalIncludes,
          })
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ADD_TRANSMITTAL_ITEM",
          module: SysLogModule.PROJECTS,
          messages: {
            notFound: "El transmittal o la revisión no existen.",
            uniqueConstraint:
              "Esa revisión ya fue incluida en otro transmittal: una revisión se emite una sola vez.",
            default: "Error al agregar el documento al transmittal.",
          },
        })
      }
    },

    /**
     * Quitar el ítem **libera la revisión** para otra carpeta.
     *
     * Es la contracara de la unicidad de `B3`: la revisión deja de estar emitida
     * porque nunca salió, y vuelve a ser candidata. Solo en borrador, por lo
     * mismo que rige para agregar.
     */
    removeTransmittalItem: async (
      _: any,
      { itemId }: { itemId: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_UPDATE],
        context,
      })
      logger.info("removeTransmittalItem", { userId })

      const item = await context.orm.transmittalItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          documentRevisionId: true,
          transmittal: { select: { id: true, status: true } },
        },
      })

      if (!item) {
        throw new GraphQLError("El ítem no existe", {
          extensions: { code: "NOT_FOUND" },
        })
      }

      // Fuera del try, y sobre el transmittal: el ítem no lleva proyecto propio.
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.TRANSMITTAL,
        objectId: item.transmittal.id,
        context,
        notFoundMessage: "Transmittal no encontrado",
      })

      try {
        assertDraft(item.transmittal.status, "quitar documentos")

        return await context.orm.$transaction(async (tx) => {
          await tx.transmittalItem.delete({ where: { id: itemId } })

          await emitAuditEvent(tx, {
            action: AuditAction.RemoveTransmittalItem,
            objectId: item.transmittal.id,
            actorId: userId,
            meta: {
              itemId,
              documentRevisionId: item.documentRevisionId,
            },
          })

          return tx.transmittal.findUniqueOrThrow({
            where: { id: item.transmittal.id },
            include: transmittalIncludes,
          })
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "REMOVE_TRANSMITTAL_ITEM",
          module: SysLogModule.PROJECTS,
          messages: {
            notFound: "El ítem no existe.",
            default: "Error al quitar el documento del transmittal.",
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

        const settings = await context.orm.docProjectSettings.findUnique({
          where: { projectId: transmittal.projectId },
          select: { documentRole: true },
        })

        if (!settings) {
          throw new GraphQLError(
            "El proyecto no declaró su rol documental: no puede circular documentación",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        const items = await context.orm.transmittalItem.findMany({
          where: { transmittalId: id },
          select: {
            purposeCode: true,
            documentRevision: {
              select: {
                id: true,
                revisionCode: true,
                status: true,
                versions: {
                  orderBy: { versionNumber: "desc" },
                  take: 1,
                  select: { files: { select: { role: true } } },
                },
              },
            },
          },
        })

        // La puerta se verifica de nuevo al emitir: entre incorporar el ítem y
        // emitir, la revisión pudo abandonarse (B3).
        assertApprovedForEmission(
          settings.documentRole,
          items.map((i) => i.documentRevision),
        )

        // Los archivos que el propósito espera se ADVIERTEN y no se exigen (B4).
        // En este punto la revisión ya está aprobada: no admite versiones nuevas
        // y su conjunto es inmutable, de modo que una puerta dura acá sería
        // insatisfacible. Lo que queda es que el hecho no pase en silencio.
        const faltantes = items
          .map((item) => ({
            revisionCode: item.documentRevision.revisionCode,
            purposeCode: item.purposeCode,
            missing: missingFileRoles(
              item.purposeCode,
              item.documentRevision.versions[0]?.files.map((f) => f.role) ?? [],
            ),
          }))
          .filter((f) => f.missing.length > 0)

        if (faltantes.length > 0) {
          logger.warn("emisión con archivos faltantes", { id, faltantes })
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
            meta: {
              code: issued.code,
              // Lo que faltaba queda REGISTRADO y no solo advertido: es lo que
              // convierte el caso legítimo —el editable que viaja por otro
              // medio— en un dato de la auditoría en lugar de un silencio.
              ...(faltantes.length > 0 && { missingFiles: faltantes }),
            },
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

    /**
     * Registrar la respuesta de un documento emitido (B5).
     *
     * Es la vía **documento a documento**, que es la práctica actual: los
     * sistemas de los clientes distribuyen por matriz de responsabilidad y cada
     * revisor califica y devuelve a medida que trata cada documento.
     *
     * La respuesta cuelga del ítem por el que ese documento salió, de modo que
     * H-14 desaparece por construcción: ya no existe la operación que
     * actualizaba ítems por identificador sin verificar a qué transmittal
     * pertenecían.
     */
    registerItemResponse: async (
      _: any,
      {
        itemId,
        input,
      }: {
        itemId: number
        input: {
          qualificationId: number
          comments?: string
          respondedBy?: string
          respondedAt?: Date
          responseTransmittalId?: number
          files?: Array<{
            fileKey: string
            fileName: string
            fileSize: number
            mimeType: string
            checksum?: string
          }>
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_UPDATE],
        context,
      })
      logger.info("registerItemResponse", { userId })

      const item = await context.orm.transmittalItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          transmittal: { select: { id: true, projectId: true, status: true } },
        },
      })

      if (!item) {
        throw new GraphQLError("El ítem no existe", {
          extensions: { code: "NOT_FOUND" },
        })
      }

      // Fuera del try, y sobre el transmittal: el ítem no lleva proyecto propio.
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.TRANSMITTAL,
        objectId: item.transmittal.id,
        context,
        notFoundMessage: "Transmittal no encontrado",
      })

      try {
        assertIssued(item.transmittal.status)

        await assertQualificationInScope(
          context,
          item.transmittal.projectId,
          input.qualificationId,
        )

        if (input.responseTransmittalId) {
          const sobre = await context.orm.transmittal.findUnique({
            where: { id: input.responseTransmittalId },
            select: { nature: true, respondsToTransmittalId: true },
          })

          if (!sobre) {
            throw new GraphQLError("El transmittal de respuesta no existe", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          assertCarrier(sobre, item.transmittal.id)
        }

        return await context.orm.$transaction(async (tx) => {
          const respuesta = await tx.docTransmittalResponse.create({
            data: {
              transmittalItemId: itemId,
              qualificationId: input.qualificationId,
              comments: input.comments,
              respondedBy: input.respondedBy,
              respondedAt: input.respondedAt,
              responseTransmittalId: input.responseTransmittalId,
              registeredById: userId,
              updatedById: userId,
              ...(input.files?.length && {
                files: { create: input.files },
              }),
            },
            include: { files: true, qualification: true },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.RegisterItemResponse,
            objectId: respuesta.id,
            actorId: userId,
            meta: {
              itemId,
              qualificationCode: respuesta.qualification.code,
              effect: respuesta.qualification.effect,
              transcripta: wasTranscribed(input.respondedBy),
              filesCount: respuesta.files.length,
            },
          })

          // Las respuestas son parciales y no bloquean (D-18): el transmittal
          // acompaña el hecho de que empezó a contestarse, sin esperar al resto.
          const siguiente = statusAfterResponse(item.transmittal.status)

          if (siguiente) {
            await tx.transmittal.update({
              where: { id: item.transmittal.id },
              data: { status: siguiente, updatedById: userId },
            })
            await emitWorkflowEvent(tx, {
              name: WorkflowEvent.TransmittalResponded,
              objectId: item.transmittal.id,
              fromState: item.transmittal.status,
              toState: siguiente,
              actorId: userId,
            })
          }

          return respuesta
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "REGISTER_ITEM_RESPONSE",
          module: SysLogModule.PROJECTS,
          messages: {
            notFound: "El ítem o la calificación no existen.",
            uniqueConstraint:
              "Ese documento ya fue respondido: la contraparte califica una emisión una sola vez. Corrija la respuesta existente.",
            default: "Error al registrar la respuesta.",
          },
        })
      }
    },

    /**
     * Corregir una respuesta ya registrada (B5).
     *
     * **Nadie la firma**: el cliente no participa de nuestro circuito, de modo
     * que la inmutabilidad que D-05 impone a la versión y a la firma no le
     * aplica. Y siendo transcripta a mano en el caso habitual, el error de
     * transcripción es esperable.
     *
     * Lo que la corrección no puede hacer es borrar que existió: la auditoría de
     * `BLOQUE 01` conserva quién la registró y quién la corrigió, con sus
     * valores.
     */
    correctItemResponse: async (
      _: any,
      {
        responseId,
        input,
      }: {
        responseId: number
        input: {
          qualificationId?: number
          comments?: string
          respondedBy?: string
          respondedAt?: Date
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_UPDATE],
        context,
      })
      logger.info("correctItemResponse", { userId })

      // Fuera del try: el contexto de la respuesta sale del transmittal por el
      // que el documento salió, a través de su ítem.
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_TRANSMITTAL_RESPONSE,
        objectId: responseId,
        context,
        notFoundMessage: "Respuesta no encontrada",
      })

      try {
        const previa = await context.orm.docTransmittalResponse.findUniqueOrThrow({
          where: { id: responseId },
          select: {
            qualificationId: true,
            comments: true,
            respondedBy: true,
            respondedAt: true,
            transmittalItem: {
              select: { transmittal: { select: { projectId: true } } },
            },
          },
        })

        if (input.qualificationId) {
          await assertQualificationInScope(
            context,
            previa.transmittalItem.transmittal.projectId,
            input.qualificationId,
          )
        }

        return await context.orm.$transaction(async (tx) => {
          const corregida = await tx.docTransmittalResponse.update({
            where: { id: responseId },
            data: { ...input, updatedById: userId },
            include: { files: true, qualification: true },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CorrectItemResponse,
            objectId: responseId,
            actorId: userId,
            meta: {
              // El valor anterior queda en la traza: sin él, la corrección
              // registraría que algo cambió sin decir desde qué.
              antes: {
                qualificationId: previa.qualificationId,
                comments: previa.comments,
                respondedBy: previa.respondedBy,
                respondedAt: previa.respondedAt,
              },
              ahora: input,
            },
          })

          return corregida
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CORRECT_ITEM_RESPONSE",
          module: SysLogModule.PROJECTS,
          messages: {
            notFound: "La respuesta no existe.",
            default: "Error al corregir la respuesta.",
          },
        })
      }
    },

    /**
     * Acusar recibo de una emisión (B8). Da operación al `ACKNOWLEDGED` que
     * hasta ahora ninguna asignaba (H-12).
     *
     * **No es una calificación**: no dice nada sobre el documento, dice que el
     * envío llegó. Por eso vive en el transmittal y no en el ítem, y por eso no
     * entra en el catálogo de D-22, cuyos dos efectos declaran inexistente
     * justamente la combinación en que un acuse caería.
     *
     * No es precondición de la respuesta: un cliente puede responder sin haber
     * acusado nunca.
     */
    acknowledgeTransmittal: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input?: { acknowledgedBy?: string; acknowledgedAt?: Date }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_TRANSMITTAL_UPDATE],
        context,
      })
      logger.info("acknowledgeTransmittal", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.TRANSMITTAL,
        objectId: id,
        context,
        notFoundMessage: "Transmittal no encontrado",
      })

      try {
        const transmittal = await context.orm.transmittal.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            code: true,
            projectId: true,
            nature: true,
            status: true,
          },
        })

        const settings = await context.orm.docProjectSettings.findUnique({
          where: { projectId: transmittal.projectId },
          select: { documentRole: true },
        })

        if (!settings) {
          throw new GraphQLError(
            "El proyecto no declaró su rol documental: no puede circular documentación",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        assertCanAcknowledge(
          settings.documentRole,
          transmittal.nature,
          transmittal.status,
        )

        return await context.orm.$transaction(async (tx) => {
          const acusado = await tx.transmittal.update({
            where: { id },
            data: {
              status: TransmittalStatus.ACKNOWLEDGED,
              acknowledgedBy: input?.acknowledgedBy,
              acknowledgedAt: input?.acknowledgedAt ?? new Date(),
              acknowledgeRegisteredById: userId,
              acknowledgeRegisteredAt: new Date(),
              updatedById: userId,
            },
            include: transmittalIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.AcknowledgeTransmittal,
            objectId: id,
            actorId: userId,
            meta: {
              code: transmittal.code,
              // La misma divergencia derivada que en la respuesta: quien acusó
              // no es necesariamente quien lo registró (D-12).
              transcripto: wasTranscribed(input?.acknowledgedBy),
            },
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.TransmittalAcknowledged,
            objectId: id,
            fromState: transmittal.status,
            toState: TransmittalStatus.ACKNOWLEDGED,
            actorId: userId,
          })

          return acusado
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACKNOWLEDGE_TRANSMITTAL",
          module: SysLogModule.PROJECTS,
          messages: {
            notFound: "El transmittal no existe.",
            default: "Error al registrar el acuse de recibo.",
          },
        })
      }
    },

    closeTransmittal: async (
      _: any,
      { id, input }: { id: number; input?: { closeReason?: string } },
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
              closedAt: new Date(),
              closedById: userId,
              closeReason: input?.closeReason,
              updatedById: userId,
            },
            include: transmittalIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CloseTransmittal,
            objectId: id,
            actorId: userId,
            meta: {
              code: closed.code,
              ...(input?.closeReason && { closeReason: input.closeReason }),
            },
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
