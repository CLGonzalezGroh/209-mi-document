import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PERMISSIONS,
  SelectOption,
  TerminatedFilter,
} from "@CLGonzalezGroh/mi-common"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"
import type { Prisma } from "../generated/prisma/client.js"
import { DocLocationOrigin, SysLogModule } from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { emitAuditEvent, emitWorkflowEvent } from "../events/emit.js"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { composePath, subtreePaths, wouldCycle } from "../utils/locationPath.js"

const logger = createLogger("locations")

/**
 * Catálogo jerárquico de ubicación física (BLOQUE 02B, fase 1).
 *
 * Sitio ▸ planta ▸ área ▸ unidad, con profundidad libre. En esta fase el
 * catálogo es **del despliegue** y la autorización es global: el alcance por
 * proyecto —y con él la segunda capa de B7 de BLOQUE 02— llega en la fase 2.
 *
 * La ubicación no tiene ningún consumidor de comportamiento: ninguna regla del
 * módulo la lee. Es clasificación y filtrado, y el atributo del documento lo
 * incorpora la fase 4.
 */

interface LocationFilterInput {
  query?: string
  parentId?: number
  rootsOnly?: boolean
  terminatedFilter?: TerminatedFilter
}

type ExternalReferenceInput = {
  externalOrigin?: DocLocationOrigin | null
  externalRef?: string | null
}

/**
 * Los tipos de los inputs se declaran como literales y no como intersecciones:
 * el meta del evento de auditoría los recibe como JSON, y TypeScript solo
 * infiere la firma de índice que eso exige para un tipo literal de objeto.
 */
type CreateLocationInput = {
  parentId?: number | null
  code: string
  name: string
  sortOrder?: number
  externalOrigin?: DocLocationOrigin | null
  externalRef?: string | null
}

type UpdateLocationInput = {
  code?: string
  name?: string
  sortOrder?: number
  externalOrigin?: DocLocationOrigin | null
  externalRef?: string | null
}

const buildWhere = (filter?: LocationFilterInput): Prisma.DocLocationWhereInput => {
  const where: Prisma.DocLocationWhereInput = {}

  if (filter?.terminatedFilter === TerminatedFilter.ACTIVE) {
    where.terminatedAt = null
  } else if (filter?.terminatedFilter === TerminatedFilter.DISABLED) {
    where.terminatedAt = { not: null }
  }

  // `rootsOnly` gana sobre `parentId`: pedir las raíces es pedir las de padre
  // nulo, y no un nivel más de un padre concreto.
  if (filter?.rootsOnly) {
    where.parentId = null
  } else if (filter?.parentId !== undefined) {
    where.parentId = filter.parentId
  }

  if (filter?.query) {
    where.OR = [
      { code: { contains: filter.query, mode: "insensitive" } },
      { name: { contains: filter.query, mode: "insensitive" } },
      { path: { contains: filter.query, mode: "insensitive" } },
    ]
  }

  return where
}

/**
 * La referencia externa se declara completa o no se declara (B7).
 *
 * La base lo sostiene con un CHECK; acá se rechaza antes, para devolver un
 * mensaje y no un error de restricción.
 */
const assertExternalReference = (input: ExternalReferenceInput) => {
  const tieneOrigen =
    input.externalOrigin !== undefined && input.externalOrigin !== null
  const tieneRef = input.externalRef !== undefined && input.externalRef !== null

  if (tieneOrigen !== tieneRef) {
    throw new GraphQLError(
      "La referencia externa exige origen e identificador: un origen sin identificador no dice nada.",
      { extensions: { code: "BAD_USER_INPUT" } },
    )
  }
}

/**
 * Reescribe la ruta de un nodo y de toda su descendencia.
 *
 * Lee el catálogo completo con tres columnas y calcula en memoria: es un
 * catálogo de decenas o centenas de nodos, y renombrar o mover son operaciones
 * infrecuentes. La alternativa —una consulta por nivel— multiplica los viajes a
 * la base sin ganar nada a esta escala.
 *
 * Escribe **solo lo que cambió**: reescribir rutas idénticas ensuciaría
 * `updatedAt` de nodos que nadie tocó.
 */
const rewriteSubtree = async (
  tx: Prisma.TransactionClient,
  { rootId, parentPath }: { rootId: number; parentPath: string | null },
): Promise<number> => {
  const nodes = await tx.docLocation.findMany({
    select: { id: true, parentId: true, name: true, path: true },
  })

  const rutas = subtreePaths({ rootId, parentPath, nodes })
  const actual = new Map(nodes.map((n) => [n.id, n.path]))

  let reescritos = 0
  for (const [id, path] of rutas) {
    if (actual.get(id) === path) continue
    await tx.docLocation.update({ where: { id }, data: { path } })
    reescritos++
  }

  return reescritos
}

/** La ruta del padre de un nodo, o nula si el nodo es raíz. */
const parentPathOf = async (
  tx: Prisma.TransactionClient,
  parentId: number | null,
): Promise<string | null> => {
  if (parentId === null) return null

  const parent = await tx.docLocation.findUnique({
    where: { id: parentId },
    select: { path: true },
  })

  if (!parent) {
    throw new GraphQLError("La ubicación padre no existe", {
      extensions: { code: "BAD_USER_INPUT" },
    })
  }

  return parent.path
}

export const locationResolvers = {
  Query: {
    /**
     * El árbol como lista plana, ordenada por ruta.
     *
     * Ordenar por ruta agrupa cada rama con su descendencia, que es lo que una
     * pantalla de árbol necesita para armarse sin recorrer la jerarquía.
     */
    locations: async (
      _: any,
      { filter }: { filter?: LocationFilterInput },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_LIST],
        context,
      })
      logger.info("locations", { userId })

      try {
        return await context.orm.docLocation.findMany({
          where: buildWhere(filter),
          orderBy: [{ path: "asc" }],
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_LOCATIONS",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener el catálogo de ubicaciones.",
          },
        })
      }
    },

    locationById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_READ],
        context,
      })
      logger.info("locationById", { userId })

      try {
        const location = await context.orm.docLocation.findUnique({
          where: { id },
        })

        if (!location) {
          throw new GraphQLError("Ubicación no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return location
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_LOCATION_BY_ID",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La ubicación solicitada no existe.",
            default: "Error al obtener la ubicación.",
          },
        })
      }
    },

    /**
     * El rótulo de la lista es la **ruta completa** y no el nombre: "Unidad 110"
     * no identifica nada por sí solo, y el mismo nombre puede repetirse en dos
     * plantas.
     */
    locationsSelectList: async (
      _: any,
      { filter }: { filter?: LocationFilterInput },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [
          PERMISSIONS.DOCUMENTS_LOCATION_SELECT,
          PERMISSIONS.COMMON_SELECT_LIST_ACCESS,
        ],
        context,
      })
      logger.info("locationsSelectList", { userId })

      try {
        const items = await context.orm.docLocation.findMany({
          where: buildWhere({
            ...filter,
            terminatedFilter: TerminatedFilter.ACTIVE,
          }),
          orderBy: [{ path: "asc" }],
          select: { id: true, path: true },
        })

        return items.map(
          (i): SelectOption => ({ value: String(i.id), label: i.path }),
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_LOCATIONS_SELECT_LIST",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener la lista de ubicaciones.",
          },
        })
      }
    },
  },

  Mutation: {
    createLocation: async (
      _: any,
      { input }: { input: CreateLocationInput },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_CREATE],
        context,
      })
      logger.info("createLocation", { userId })

      try {
        assertExternalReference(input)

        const name = input.name.trim()
        const parentId = input.parentId ?? null

        return await context.orm.$transaction(async (tx) => {
          const created = await tx.docLocation.create({
            data: {
              parentId,
              code: input.code.trim(),
              name,
              path: composePath(await parentPathOf(tx, parentId), name),
              sortOrder: input.sortOrder ?? 0,
              externalOrigin: input.externalOrigin ?? null,
              externalRef: input.externalRef?.trim() ?? null,
              createdById: userId,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CreateLocation,
            objectId: created.id,
            actorId: userId,
            meta: {
              code: created.code,
              name: created.name,
              path: created.path,
              parentId: created.parentId,
            },
          })

          return created
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_LOCATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            uniqueConstraint:
              "Ya existe una ubicación con ese código en el mismo nivel.",
            default: "Error al crear la ubicación.",
          },
        })
      }
    },

    /**
     * Renombrar, recodificar, reordenar y declarar la referencia externa.
     *
     * **El padre no se edita acá**: mover tiene operación propia, porque cambia
     * de lugar una rama entera y exige verificar que no se cuelgue de su propia
     * descendencia. Renombrar reescribe las mismas rutas, y por eso comparte el
     * recálculo.
     */
    updateLocation: async (
      _: any,
      { id, input }: { id: number; input: UpdateLocationInput },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_UPDATE],
        context,
      })
      logger.info("updateLocation", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          const current = await tx.docLocation.findUnique({ where: { id } })

          if (!current) {
            throw new GraphQLError("Ubicación no encontrada", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          // La referencia externa se valida sobre el resultado y no sobre el
          // input: dejar el origen y borrar el identificador es la forma en que
          // una edición parcial rompe el par.
          assertExternalReference({
            externalOrigin:
              input.externalOrigin !== undefined
                ? input.externalOrigin
                : current.externalOrigin,
            externalRef:
              input.externalRef !== undefined
                ? input.externalRef
                : current.externalRef,
          })

          const name = input.name?.trim() ?? current.name

          const updated = await tx.docLocation.update({
            where: { id },
            data: {
              code: input.code?.trim(),
              name,
              sortOrder: input.sortOrder,
              externalOrigin:
                input.externalOrigin !== undefined
                  ? input.externalOrigin
                  : undefined,
              externalRef:
                input.externalRef !== undefined
                  ? (input.externalRef?.trim() ?? null)
                  : undefined,
              updatedById: userId,
            },
          })

          const reescritos =
            name === current.name
              ? 0
              : await rewriteSubtree(tx, {
                  rootId: id,
                  parentPath: await parentPathOf(tx, current.parentId),
                })

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateLocation,
            objectId: id,
            actorId: userId,
            // `rewritten` cuenta el nodo y su descendencia: es lo que explica
            // después por qué cambiaron rutas de nodos que nadie editó.
            meta: { input, rewritten: reescritos },
          })

          return reescritos === 0
            ? updated
            : tx.docLocation.findUnique({ where: { id } })
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_LOCATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La ubicación no existe.",
            uniqueConstraint:
              "Ya existe una ubicación con ese código en el mismo nivel.",
            default: "Error al actualizar la ubicación.",
          },
        })
      }
    },

    /**
     * Mover una rama de lugar (B6).
     *
     * Tiene operación y acción propias porque reescribe la ruta de toda su
     * descendencia: registrar el movimiento es lo que explica después por qué
     * cambiaron nodos que nadie tocó. `parentId` nulo la convierte en raíz.
     */
    moveLocation: async (
      _: any,
      { id, parentId }: { id: number; parentId?: number | null },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_UPDATE],
        context,
      })
      logger.info("moveLocation", { userId })

      const destino = parentId ?? null

      try {
        return await context.orm.$transaction(async (tx) => {
          const current = await tx.docLocation.findUnique({ where: { id } })

          if (!current) {
            throw new GraphQLError("Ubicación no encontrada", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          const nodes = await tx.docLocation.findMany({
            select: { id: true, parentId: true },
          })

          if (wouldCycle(id, destino, nodes)) {
            throw new GraphQLError(
              "Una ubicación no puede colgarse de sí misma ni de su propia descendencia.",
              { extensions: { code: "BAD_USER_INPUT" } },
            )
          }

          const parentPath = await parentPathOf(tx, destino)

          await tx.docLocation.update({
            where: { id },
            data: { parentId: destino, updatedById: userId },
          })

          const reescritos = await rewriteSubtree(tx, {
            rootId: id,
            parentPath,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.MoveLocation,
            objectId: id,
            actorId: userId,
            meta: {
              fromParentId: current.parentId,
              toParentId: destino,
              fromPath: current.path,
              toPath: composePath(parentPath, current.name),
              rewritten: reescritos,
            },
          })

          return tx.docLocation.findUnique({ where: { id } })
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "MOVE_LOCATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La ubicación no existe.",
            uniqueConstraint:
              "Ya existe una ubicación con ese código en el nivel de destino.",
            default: "Error al mover la ubicación.",
          },
        })
      }
    },

    /**
     * Baja lógica. Lo ya clasificado con ella **no se revalida**: la validación
     * ocurre solo en escritura, según la orientación de D-13.
     *
     * La baja no alcanza a la descendencia: un nodo dado de baja con hijos
     * vigentes es un estado legítimo —el área sigue existiendo, la unidad
     * intermedia dejó de usarse— y cerrar la rama entera de oficio decidiría por
     * el usuario algo que nadie pidió.
     */
    terminateLocation: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_DELETE],
        context,
      })
      logger.info("terminateLocation", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          const updated = await tx.docLocation.update({
            where: { id },
            data: { terminatedAt: new Date(), updatedById: userId },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.TerminateLocation,
            objectId: id,
            actorId: userId,
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.LocationTerminated,
            objectId: id,
            fromState: "ACTIVE",
            toState: "TERMINATED",
            actorId: userId,
          })

          return updated
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_LOCATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La ubicación no existe.",
            default: "Error al deshabilitar la ubicación.",
          },
        })
      }
    },

    activateLocation: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_UPDATE],
        context,
      })
      logger.info("activateLocation", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          const updated = await tx.docLocation.update({
            where: { id },
            data: { terminatedAt: null, updatedById: userId },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.ActivateLocation,
            objectId: id,
            actorId: userId,
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.LocationActivated,
            objectId: id,
            fromState: "TERMINATED",
            toState: "ACTIVE",
            actorId: userId,
          })

          return updated
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACTIVATE_LOCATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La ubicación no existe.",
            default: "Error al habilitar la ubicación.",
          },
        })
      }
    },

    /**
     * Eliminación definitiva, admitida solo cuando el nodo no tiene
     * descendencia. Es el ciclo de vida del precedente (DOM-024).
     *
     * La fase 4 le agrega la otra mitad de la condición —que ningún documento lo
     * referencie—, que hoy no puede existir porque el atributo todavía no está.
     */
    deleteLocation: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_DELETE],
        context,
      })
      logger.info("deleteLocation", { userId })

      try {
        await context.orm.$transaction(async (tx) => {
          const location = await tx.docLocation.findUnique({ where: { id } })

          if (!location) {
            throw new GraphQLError("Ubicación no encontrada", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          const hijos = await tx.docLocation.count({ where: { parentId: id } })

          if (hijos > 0) {
            throw new GraphQLError(
              `No se puede eliminar: la ubicación tiene ${hijos} descendiente(s) directo(s). Dela de baja o mueva su descendencia.`,
              { extensions: { code: "BAD_USER_INPUT" } },
            )
          }

          await tx.docLocation.delete({ where: { id } })

          // Después del borrado: el contexto del evento no se puede derivar de
          // un objeto que ya no existe, y `resolveEventContext` lo contempla.
          // Perder la traza por eso sería peor que registrarla sin contexto.
          await emitAuditEvent(tx, {
            action: AuditAction.DeleteLocation,
            objectId: id,
            actorId: userId,
            meta: {
              code: location.code,
              name: location.name,
              path: location.path,
            },
          })
        })

        return true
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DELETE_LOCATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La ubicación no existe.",
            default: "Error al eliminar la ubicación.",
          },
        })
      }
    },
  },
}
