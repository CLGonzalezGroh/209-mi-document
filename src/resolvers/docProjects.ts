import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { DocProjectStatus, DocumentRole, RevisionScheme } from "../generated/prisma/enums.js"
import { AuditAction } from "../events/catalog.js"
import { emitAuditEvent } from "../events/emit.js"
import { assertCounterparty, assertRoleIsSettled } from "../utils/docProjects.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("docProjects")

/** Lo que declara un contrato. El alta exige el código; la edición no lo toca. */
type DocProjectInput = {
  code: string
  name: string
  description?: string | null
  /** Gestión PMI asociada. Nulo = la obra no se administra en mi-project (B3). */
  projectId?: number | null
  documentRole: DocumentRole
  /** Contraparte: referencia a Company de mi-admin (B4). */
  counterpartyId?: number | null
  revisionScheme?: RevisionScheme | null
  defaultOrganizerId?: number | null
  locationEnabled?: boolean
  locationRequired?: boolean
  locationLabel?: string | null
}

/** Los datos del contrato, sin el código cuando la operación no lo toca. */
const datosDelContrato = (input: DocProjectInput | Omit<DocProjectInput, "code">) => ({
  ...("code" in input ? { code: input.code } : {}),
  name: input.name,
  description: input.description ?? null,
  projectId: input.projectId ?? null,
  documentRole: input.documentRole,
  counterpartyId: input.counterpartyId ?? null,
  revisionScheme: input.revisionScheme ?? null,
  defaultOrganizerId: input.defaultOrganizerId ?? null,
  locationEnabled: input.locationEnabled ?? true,
  locationRequired: input.locationRequired ?? false,
  locationLabel: input.locationLabel ?? null,
})

const metaDelContrato = (input: DocProjectInput | Omit<DocProjectInput, "code">) =>
  JSON.parse(JSON.stringify(datosDelContrato(input)))

/**
 * El contrato: raíz de alcance del módulo documental (BLOQUE 02D, D-29, B1 y B2).
 *
 * Absorbe la configuración documental que BLOQUE 02 había puesto en una entidad
 * aparte. `documentRole` no es una preferencia de configuración, es lo que el
 * contrato ES (D-09), y por eso vive en el objeto y no en un satélite.
 *
 * Declarar el rol documental de un proyecto es un acto ADMINISTRATIVO y se
 * gobierna únicamente por el permiso global, sin la segunda capa. El motivo es
 * de arranque: un proyecto que todavía no tiene configuración tampoco tiene
 * miembros, de modo que exigir membresía lo volvería inconfigurable.
 *
 * Es el mismo criterio con que OperMask Digitalization trata su membresía.
 */
export const docProjectsResolvers = {
  Query: {
    /**
     * Listado de contratos del despliegue, paginado.
     *
     * Es una consulta del ÁMBITO DEL DESPLIEGUE y no de un contrato, de modo
     * que se gobierna por el permiso global: quien administra contratos todavía
     * no es miembro de ninguno. Es el mismo criterio de arranque con que el rol
     * documental se declara sin exigir membresía.
     */
    docProjects: async (
      _: any,
      {
        filter,
        pagination,
      }: {
        filter?: {
          query?: string
          status?: DocProjectStatus
          documentRole?: DocumentRole
          projectId?: number
          withoutProject?: boolean
        }
        pagination?: { skip?: number; take?: number }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOC_PROJECT_LIST],
        context,
      })
      logger.info("docProjects", { userId })

      try {
        const where: any = {}

        if (filter?.status) where.status = filter.status
        if (filter?.documentRole) where.documentRole = filter.documentRole

        // La obra y "sin obra" son dos filtros distintos, y el segundo no es la
        // ausencia del primero: nombra los contratos sin gestión PMI (B3, B6).
        if (filter?.projectId !== undefined) where.projectId = filter.projectId
        else if (filter?.withoutProject) where.projectId = null

        if (filter?.query) {
          where.OR = [
            { code: { contains: filter.query, mode: "insensitive" as const } },
            { name: { contains: filter.query, mode: "insensitive" as const } },
            {
              description: {
                contains: filter.query,
                mode: "insensitive" as const,
              },
            },
          ]
        }

        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const totalItems = await context.orm.docProject.count({ where })
        const items = await context.orm.docProject.findMany({
          where,
          skip,
          take,
          orderBy: { code: "asc" },
        })

        const totalPages = Math.ceil(totalItems / take)

        return {
          items,
          pagination: {
            currentPage: Math.floor(skip / take) + 1,
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
          logName: "LIST_DOC_PROJECTS",
          messages: { default: "Error al listar los contratos documentales." },
        })
      }
    },

    /** Selector de contratos, para poblar desplegables. */
    docProjectsSelectList: async (
      _: any,
      { onlyActive }: { onlyActive?: boolean },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOC_PROJECT_SELECT],
        context,
      })
      logger.info("docProjectsSelectList", { userId })

      try {
        const contratos = await context.orm.docProject.findMany({
          where: onlyActive ? { status: DocProjectStatus.ACTIVE } : {},
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true },
        })

        return contratos.map((c) => ({
          value: String(c.id),
          label: `${c.code} — ${c.name}`,
        }))
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "SELECT_DOC_PROJECTS",
          messages: { default: "Error al obtener los contratos documentales." },
        })
      }
    },

    /** El contrato por su identidad. */
    docProjectById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOC_PROJECT_READ],
        context,
      })
      logger.info("docProjectById", { userId })

      try {
        return await context.orm.docProject.findUnique({ where: { id } })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOC_PROJECT",
          messages: {
            default: "Error al obtener el contrato documental.",
          },
        })
      }
    },

    /**
     * Los contratos de una obra de `mi-project` (B3).
     *
     * Devuelve una LISTA y no un contrato: el vínculo es N:1 desde la fase 4, y
     * una obra con tres contratistas tiene tres contratos. Vacía cuando la obra
     * todavía no tiene ninguno, que no es un error.
     */
    docProjectsByProject: async (
      _: any,
      { projectId }: { projectId: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOC_PROJECT_LIST],
        context,
      })
      logger.info("docProjectsByProject", { userId })

      try {
        return await context.orm.docProject.findMany({
          where: { projectId },
          orderBy: { code: "asc" },
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "LIST_DOC_PROJECTS_BY_PROJECT",
          messages: {
            default: "Error al obtener los contratos documentales de la obra.",
          },
        })
      }
    },
  },

  Mutation: {
    /**
     * Dar de alta un contrato (BLOQUE 02D, B1).
     *
     * Reemplaza al `declareDocProject` de la fase 2, que hacía upsert por
     * código. Se separa en alta y edición porque son actos distintos y lo
     * confuso era el intermedio: quien creía estar declarando la configuración
     * de un contrato podía estar creando uno nuevo por errar el código.
     */
    createDocProject: async (
      _: any,
      { input }: { input: DocProjectInput },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOC_PROJECT_CREATE],
        context,
      })
      logger.info("createDocProject", { userId })

      // Invariante de la contraparte (B4): exigida en ISSUER y RECEIVER,
      // prohibida en INTERNAL, que por definición no la tiene (D-19).
      assertCounterparty(input.documentRole, input.counterpartyId)

      try {
        return await context.orm.$transaction(async (tx) => {
          const contrato = await tx.docProject.create({
            data: {
              ...datosDelContrato(input),
              code: input.code,
              createdById: userId,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.DeclareDocProject,
            objectId: contrato.id,
            actorId: userId,
            meta: metaDelContrato(input),
          })

          return contrato
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_DOC_PROJECT",
          messages: {
            uniqueConstraint: "Ya existe un contrato con ese código.",
            default: "Error al dar de alta el contrato documental.",
          },
        })
      }
    },

    /**
     * Editar un contrato.
     *
     * El código NO se puede cambiar: es la identidad del contrato, con el mismo
     * criterio con que D-24 la fija para el documento. El vínculo con la gestión
     * PMI sí, porque no es identidad y puede aparecer después (B3).
     */
    updateDocProject: async (
      _: any,
      { id, input }: { id: number; input: Omit<DocProjectInput, "code"> },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOC_PROJECT_UPDATE],
        context,
      })
      logger.info("updateDocProject", { userId })

      assertCounterparty(input.documentRole, input.counterpartyId)

      const actual = await context.orm.docProject.findUnique({
        where: { id },
        select: { code: true, status: true },
      })

      if (!actual) {
        throw new GraphQLError("El contrato no existe", {
          extensions: { code: "NOT_FOUND" },
        })
      }

      // La puerta de B9 alcanza también a la edición del propio contrato: un
      // contrato cerrado solo admite lectura. Reabrirlo es el camino.
      if (actual.status === DocProjectStatus.CLOSED) {
        throw new GraphQLError(
          "El contrato está cerrado y solo admite lectura",
          { extensions: { code: "CONFLICT" } },
        )
      }

      // El rol es inmutable desde el primer documento o transmittal (B5)
      await assertRoleIsSettled(context, actual.code, input.documentRole)

      try {
        return await context.orm.$transaction(async (tx) => {
          const contrato = await tx.docProject.update({
            where: { id },
            data: { ...datosDelContrato(input), updatedById: userId },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateDocProject,
            objectId: contrato.id,
            actorId: userId,
            meta: metaDelContrato(input),
          })

          return contrato
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_DOC_PROJECT",
          messages: {
            default: "Error al editar el contrato documental.",
          },
        })
      }
    },

    /**
     * Borrar un contrato.
     *
     * Solo se puede si no tiene NADA colgando, y de eso se encarga la clave
     * foránea `RESTRICT` de B7: la base rechaza el borrado y el error se
     * traduce. Un contrato con documentación no se borra, se cierra (B9).
     */
    deleteDocProject: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOC_PROJECT_DELETE],
        context,
      })
      logger.info("deleteDocProject", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          const contrato = await tx.docProject.delete({ where: { id } })

          await emitAuditEvent(tx, {
            action: AuditAction.DeleteDocProject,
            objectId: contrato.id,
            actorId: userId,
            meta: { code: contrato.code, name: contrato.name },
          })

          return contrato
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DELETE_DOC_PROJECT",
          messages: {
            foreignKeyConstraint:
              "El contrato tiene documentación asociada y no puede borrarse. Cerralo en lugar de borrarlo.",
            notFound: "El contrato no existe",
            default: "Error al borrar el contrato documental.",
          },
        })
      }
    },

    /**
     * Cerrar el contrato (BLOQUE 02D, B9).
     *
     * Es una PUERTA sobre la escritura y no una máquina de estados: no se
     * propaga hacia abajo. Una revisión en circuito al momento del cierre queda
     * donde está y deja de poder avanzar. Abandonarla o cancelar su circuito
     * sería inventar desenlaces que nadie decidió, y D-26 ya le dio a cada nivel
     * su palabra propia para terminar mal.
     *
     * Y no promueve nada: la promoción al régimen de publicación es selectiva
     * por naturaleza, y por eso no puede ser un efecto automático del cierre.
     */
    closeDocProject: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOC_PROJECT_UPDATE],
        context,
      })
      logger.info("closeDocProject", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          const actual = await tx.docProject.findUnique({
            where: { id },
            select: { status: true },
          })

          if (!actual) {
            throw new GraphQLError("El contrato no existe", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          if (actual.status === DocProjectStatus.CLOSED) {
            throw new GraphQLError("El contrato ya está cerrado", {
              extensions: { code: "CONFLICT" },
            })
          }

          const contrato = await tx.docProject.update({
            where: { id },
            data: {
              status: DocProjectStatus.CLOSED,
              closedAt: new Date(),
              closedById: userId,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CloseDocProject,
            objectId: contrato.id,
            actorId: userId,
            meta: { code: contrato.code },
          })

          return contrato
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CLOSE_DOC_PROJECT",
          messages: { default: "Error al cerrar el contrato documental." },
        })
      }
    },

    /**
     * Reabrir el contrato (BLOQUE 02D, B9).
     *
     * Sin reapertura, un cierre por error dejaría la documentación de un
     * contrato congelada sin ninguna salida. Es un acto explícito, con actor y
     * fecha en su evento de auditoría.
     */
    reopenDocProject: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOC_PROJECT_UPDATE],
        context,
      })
      logger.info("reopenDocProject", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          const actual = await tx.docProject.findUnique({
            where: { id },
            select: { status: true },
          })

          if (!actual) {
            throw new GraphQLError("El contrato no existe", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          if (actual.status !== DocProjectStatus.CLOSED) {
            throw new GraphQLError("El contrato no está cerrado", {
              extensions: { code: "CONFLICT" },
            })
          }

          const contrato = await tx.docProject.update({
            where: { id },
            data: {
              status: DocProjectStatus.ACTIVE,
              closedAt: null,
              closedById: null,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.ReopenDocProject,
            objectId: contrato.id,
            actorId: userId,
            meta: { code: contrato.code },
          })

          return contrato
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "REOPEN_DOC_PROJECT",
          messages: { default: "Error al reabrir el contrato documental." },
        })
      }
    },
  },
}

export { GraphQLError }
