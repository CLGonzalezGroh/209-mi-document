import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PERMISSIONS,
  SelectOption,
  TerminatedFilter,
} from "@CLGonzalezGroh/mi-common"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"
import type { Prisma } from "../generated/prisma/client.js"
import {
  DocCatalogKind,
  DocLocationOrigin,
  DocObjectType,
  DocScopeMode,
  SysLogModule,
} from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { emitAuditEvent, emitWorkflowEvent } from "../events/emit.js"
import { userAuthorization } from "../utils/userAuthorization.js"
import {
  assertObjectAccess,
  projectAuthorization,
} from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import {
  composePath,
  subtreeIds,
  subtreePaths,
  wouldCycle,
} from "../utils/locationPath.js"
import {
  effectiveMode,
  parentScopeAdmitted,
  scopeWhere,
} from "../utils/catalogScope.js"
import { planSeed } from "../utils/catalogSeed.js"

const logger = createLogger("locations")

/**
 * Catálogo jerárquico de ubicación física (BLOQUE 02B).
 *
 * Sitio ▸ planta ▸ área ▸ unidad, con profundidad libre y **alcance por
 * proyecto**: el árbol del despliegue, que los proyectos heredan y amplían, o el
 * propio del proyecto (B1).
 *
 * La autorización es la de dos capas de B7 de BLOQUE 02, y sale del alcance del
 * propio nodo: uno del despliegue se resuelve con el permiso global, uno de
 * proyecto exige membresía. No hay una regla por operación — la da el derivador
 * de contexto.
 *
 * La ubicación no tiene ningún consumidor de comportamiento: ninguna regla del
 * módulo la lee. Es clasificación y filtrado, y el atributo del documento lo
 * incorpora la fase 4.
 */

interface LocationFilterInput {
  query?: string
  parentId?: number
  rootsOnly?: boolean
  branchOf?: number
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
  projectId?: number | null
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

/**
 * Filtro del catálogo, con la rama ya resuelta si se pidió.
 *
 * `branchOf` exige leer el catálogo para recorrerlo, de modo que el armado del
 * criterio deja de ser sincrónico. Se resuelve una vez acá en lugar de repetirse
 * en cada consulta.
 */
const buildScopedWhere = async (
  client: Prisma.TransactionClient,
  filter?: LocationFilterInput,
): Promise<Prisma.DocLocationWhereInput> => {
  const where = buildWhere(filter)

  if (filter?.branchOf === undefined) return where

  const nodes = await client.docLocation.findMany({
    select: { id: true, parentId: true, name: true },
  })

  // La rama gana sobre `parentId` y sobre `rootsOnly`, porque los contiene:
  // pedir la rama de un nodo es pedir ese nodo y todo lo que cuelga de él.
  return { ...where, parentId: undefined, id: { in: subtreeIds(nodes, filter.branchOf) } }
}

const buildWhere = (
  filter?: LocationFilterInput,
): Prisma.DocLocationWhereInput => {
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
 * Las ubicaciones que un ámbito **ve**.
 *
 * Un proyecto ve las propias más las del despliegue si hereda; el despliegue ve
 * las suyas, que son el árbol global. Los dos casos son una sola función, y es lo
 * que permite que la siembra trate al despliegue y a otro proyecto con la misma
 * regla (B2).
 */
const visibleLocations = async (
  client: Prisma.TransactionClient,
  projectId: number | null,
) => {
  const where =
    projectId === null
      ? { projectId: null }
      : scopeWhere({
          projectId,
          mode: await locationScopeMode(client, projectId),
        })

  return client.docLocation.findMany({
    where,
    select: {
      id: true,
      parentId: true,
      code: true,
      name: true,
      path: true,
      sortOrder: true,
      externalOrigin: true,
      externalRef: true,
      terminatedAt: true,
    },
  })
}

/** El modo con que un proyecto resuelve el catálogo de ubicación. */
const locationScopeMode = async (
  client: Prisma.TransactionClient,
  projectId: number,
): Promise<DocScopeMode> => {
  const declarado = await client.docCatalogScope.findUnique({
    where: {
      projectId_catalog: { projectId, catalog: DocCatalogKind.LOCATION },
    },
    select: { mode: true },
  })

  return effectiveMode(declarado?.mode)
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
 * El padre existe y su alcance admite al hijo (B1).
 *
 * El cruce se admite en un solo sentido: un nodo del proyecto cuelga de uno del
 * despliegue, que es lo que significa *ampliar*. Al revés volvería el árbol
 * global dependiente de un proyecto.
 *
 * Devuelve la ruta del padre, o nula si el nodo es raíz, porque es lo que se
 * necesita a continuación para componer la propia.
 */
const assertParentAdmitted = async (
  tx: Prisma.TransactionClient,
  {
    parentId,
    scope,
  }: { parentId: number | null; scope: number | null },
): Promise<string | null> => {
  if (parentId === null) return null

  const parent = await tx.docLocation.findUnique({
    where: { id: parentId },
    select: { path: true, projectId: true },
  })

  if (!parent) {
    throw new GraphQLError("La ubicación padre no existe", {
      extensions: { code: "BAD_USER_INPUT" },
    })
  }

  if (!parentScopeAdmitted({ childScope: scope, parentScope: parent.projectId })) {
    throw new GraphQLError(
      scope === null
        ? "Una ubicación del despliegue no puede colgar de una de proyecto: el árbol global quedaría dependiendo de un proyecto."
        : "Una ubicación de proyecto solo puede colgar del árbol del despliegue o de su propio árbol.",
      { extensions: { code: "BAD_USER_INPUT" } },
    )
  }

  return parent.path
}

/**
 * Reescribe la ruta de un nodo y de toda su descendencia.
 *
 * Lee el catálogo completo con cuatro columnas y calcula en memoria: es un
 * catálogo de decenas o centenas de nodos, y renombrar o mover son operaciones
 * infrecuentes. La alternativa —una consulta por nivel— multiplica los viajes a
 * la base sin ganar nada a esta escala.
 *
 * **Lee sin acotar por alcance, y debe hacerlo.** La descendencia de un nodo del
 * despliegue incluye las ampliaciones que le colgaron los proyectos, y su ruta
 * también cambia cuando el ancestro global se renombra o se mueve.
 *
 * Escribe **solo lo que cambió**: reescribir rutas idénticas ensuciaría
 * `updatedAt` de nodos que nadie tocó.
 */
const rewriteSubtree = async (
  tx: Prisma.TransactionClient,
  { rootId, parentPath }: { rootId: number; parentPath: string | null },
): Promise<{ nodes: number; documents: number }> => {
  const nodes = await tx.docLocation.findMany({
    select: { id: true, parentId: true, name: true, path: true },
  })

  const rutas = subtreePaths({ rootId, parentPath, nodes })
  const actual = new Map(nodes.map((n) => [n.id, n.path]))

  let reescritos = 0
  let documentos = 0

  for (const [id, path] of rutas) {
    if (actual.get(id) === path) continue

    await tx.docLocation.update({ where: { id }, data: { path } })
    reescritos++

    // El snapshot del documento se recalcula con la misma escritura, porque es
    // la misma denormalización un nivel más abajo (BLOQUE 02B, B6): la ruta del
    // documento no acredita nada, de modo que no hay inmutabilidad que respetar
    // ni propagación que pedir.
    //
    // **En SQL y no con `updateMany`**, y por una razón concreta: `updatedAt` es
    // `@updatedAt`, y Prisma lo mueve también en una actualización masiva. Nadie
    // editó estos documentos —el snapshot es consecuencia de haber tocado el
    // nodo— y dejar "modificado en T por X" con un X que no hizo nada en T es
    // exactamente el ruido que esta denormalización no debe producir. Los
    // parámetros van interpolados por Prisma, no concatenados.
    documentos += await tx.$executeRaw`
      UPDATE "documents" SET "locationPath" = ${path} WHERE "locationId" = ${id}
    `
  }

  return { nodes: reescritos, documents: documentos }
}

export const locationResolvers = {
  Query: {
    /**
     * El catálogo tal como está declarado, **sin resolver alcance**: lista el del
     * despliegue o el de un proyecto según se pida. Es la vista de
     * administración, con la misma forma que la de calificaciones.
     */
    locations: async (
      _: any,
      {
        projectId,
        filter,
      }: { projectId?: number; filter?: LocationFilterInput },
      context: ResolverContext,
    ) => {
      const userId =
        projectId !== undefined
          ? await projectAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_LIST],
              projectId,
              context,
            })
          : await userAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_LIST],
              context,
            })
      logger.info("locations", { userId })

      try {
        return await context.orm.docLocation.findMany({
          where: {
            ...(await buildScopedWhere(context.orm, filter)),
            projectId: projectId ?? null,
          },
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

    /**
     * Las ubicaciones con que se puede clasificar en un proyecto.
     *
     * Resuelve el alcance —heredando del despliegue y sumando las propias, o solo
     * las propias— y excluye las dadas de baja. La resolución se expone acá y no
     * se deriva en cada consumidor, con el criterio del §13.
     */
    projectLocations: async (
      _: any,
      { projectId, filter }: { projectId: number; filter?: LocationFilterInput },
      context: ResolverContext,
    ) => {
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_LIST],
        projectId,
        context,
      })
      logger.info("projectLocations", { userId })

      try {
        const mode = await locationScopeMode(context.orm, projectId)

        return await context.orm.docLocation.findMany({
          where: {
            ...(await buildScopedWhere(context.orm, filter)),
            ...scopeWhere({ projectId, mode }),
          },
          orderBy: [{ path: "asc" }],
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_PROJECT_LOCATIONS",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener las ubicaciones del proyecto.",
          },
        })
      }
    },

    /**
     * El modo con que un proyecto resuelve este catálogo, resuelto.
     *
     * Existe además de `catalogScopes` porque esa consulta devuelve lo declarado,
     * que puede ser nada, y quien arma una pantalla necesita el modo que rige.
     */
    locationScope: async (
      _: any,
      { projectId }: { projectId: number },
      context: ResolverContext,
    ) => {
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_LIST],
        projectId,
        context,
      })
      logger.info("locationScope", { userId })

      try {
        return await locationScopeMode(context.orm, projectId)
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_LOCATION_SCOPE",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener el alcance del catálogo de ubicaciones.",
          },
        })
      }
    },

    /**
     * De qué proyectos puede este usuario copiar el catálogo (B2).
     *
     * Los que alcanza por **membresía vigente** y que tienen catálogo propio, sin
     * el destino. La nomenclatura de un cliente es información de ese cliente, de
     * modo que la lista no es "todos los proyectos" sino los que ya podía leer
     * (D-15).
     *
     * Existe para que la pantalla no tenga que cruzar la membresía con "¿tiene
     * catálogo?" por su cuenta: sin eso ofrecería proyectos cuya siembra no
     * agregaría nada. El árbol del despliegue es siempre una fuente posible y no
     * figura acá, porque no es un proyecto.
     *
     * Devuelve el identificador y cuántos nodos aporta; el nombre del proyecto lo
     * resuelve quien consulta, con el criterio del módulo de no duplicar lo que
     * vive en `mi-project`.
     */
    locationSeedSources: async (
      _: any,
      { projectId }: { projectId: number },
      context: ResolverContext,
    ) => {
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_LIST],
        projectId,
        context,
      })
      logger.info("locationSeedSources", { userId })

      try {
        const membresias = await context.orm.docProjectMember.findMany({
          where: { userId, isActive: true, revokedAt: null },
          select: { projectId: true },
        })

        const candidatos = membresias
          .map((m) => m.projectId)
          .filter((p) => p !== projectId)

        if (candidatos.length === 0) return []

        // Un solo agrupamiento en lugar de una consulta por proyecto: la lista
        // alimenta un selector y no debe costar una lectura por opción.
        const conNodos = await context.orm.docLocation.groupBy({
          by: ["projectId"],
          where: { projectId: { in: candidatos } },
          _count: { _all: true },
        })

        return conNodos
          .map((g) => ({ projectId: g.projectId as number, nodeCount: g._count._all }))
          .sort((a, b) => a.projectId - b.projectId)
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_LOCATION_SEED_SOURCES",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener las fuentes de siembra disponibles.",
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

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      // La ubicación de un proyecto exige membresía; la del despliegue no
      // pertenece a ninguno y se resuelve con el permiso global (BLOQUE 02, B7).
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_LOCATION,
        objectId: id,
        context,
        notFoundMessage: "Ubicación no encontrada",
      })

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
     * Ubicaciones vigentes como lista de selección, con el alcance resuelto.
     *
     * El rótulo es la **ruta completa** y no el nombre: "Unidad 110" no
     * identifica nada por sí solo, y el mismo nombre puede repetirse en dos
     * plantas.
     *
     * `projectId` es opcional porque hay documentos sin proyecto —calidad,
     * comercial, activos—, y para ellos el catálogo que rige es el del
     * despliegue. Omitirlo no es un descuido: es el régimen de publicación.
     */
    locationsSelectList: async (
      _: any,
      {
        projectId,
        filter,
      }: { projectId?: number; filter?: LocationFilterInput },
      context: ResolverContext,
    ) => {
      const permisos = [
        PERMISSIONS.DOCUMENTS_LOCATION_SELECT,
        PERMISSIONS.COMMON_SELECT_LIST_ACCESS,
      ]

      const userId =
        projectId !== undefined
          ? await projectAuthorization({
              requiredPermissions: permisos,
              projectId,
              context,
            })
          : await userAuthorization({ requiredPermissions: permisos, context })
      logger.info("locationsSelectList", { userId })

      try {
        const alcance =
          projectId !== undefined
            ? scopeWhere({
                projectId,
                mode: await locationScopeMode(context.orm, projectId),
              })
            : { projectId: null }

        const items = await context.orm.docLocation.findMany({
          where: {
            ...(await buildScopedWhere(context.orm, {
              ...filter,
              terminatedFilter: TerminatedFilter.ACTIVE,
            })),
            ...alcance,
          },
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
      const scope = input.projectId ?? null

      const userId =
        scope !== null
          ? await projectAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_CREATE],
              projectId: scope,
              context,
            })
          : await userAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_CREATE],
              context,
            })
      logger.info("createLocation", { userId })

      try {
        assertExternalReference(input)

        const name = input.name.trim()
        const parentId = input.parentId ?? null

        return await context.orm.$transaction(async (tx) => {
          const parentPath = await assertParentAdmitted(tx, { parentId, scope })

          const created = await tx.docLocation.create({
            data: {
              projectId: scope,
              parentId,
              code: input.code.trim(),
              name,
              path: composePath(parentPath, name),
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
              "Ya existe una ubicación con ese código en el mismo nivel y alcance.",
            default: "Error al crear la ubicación.",
          },
        })
      }
    },

    /**
     * Sembrar el catálogo de un proyecto copiando otro (B2).
     *
     * La copia es **puntual** y no deja vínculo: una copia permanente *es*
     * herencia. La fuente es el árbol del despliegue —el estándar de la propia
     * organización— o el de otro proyecto —el estándar de un cliente, que el
     * segundo proyecto para el mismo cliente no debería recargar a mano—.
     *
     * **Solo agrega.** Nunca quita ni modifica, se admite más de una vez y
     * sembrar dos veces no duplica, porque la identidad del nodo es su ruta
     * completa. El detalle de qué se copia y en qué orden lo decide `planSeed`;
     * acá está lo que exige la base: escribir en orden y resolver cada ruta a su
     * identificador.
     *
     * **Leer la fuente exige alcanzarla**: la del despliegue con el permiso
     * global, la de otro proyecto con membresía en ese proyecto. La nomenclatura
     * de un cliente es información de ese cliente (D-15).
     */
    seedProjectLocations: async (
      _: any,
      {
        projectId,
        sourceProjectId,
      }: { projectId: number; sourceProjectId?: number | null },
      context: ResolverContext,
    ) => {
      const fuente = sourceProjectId ?? null

      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_CREATE],
        projectId,
        context,
      })
      logger.info("seedProjectLocations", { userId })

      // La segunda capa sobre la FUENTE, y aparte: alcanzar el destino no
      // habilita leer el catálogo de un proyecto ajeno.
      if (fuente !== null) {
        await projectAuthorization({
          requiredPermissions: [PERMISSIONS.DOCUMENTS_LOCATION_LIST],
          projectId: fuente,
          context,
        })
      }

      try {
        if (fuente === projectId) {
          throw new GraphQLError(
            "Un proyecto no se siembra de sí mismo.",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        return await context.orm.$transaction(async (tx) => {
          const origen = await visibleLocations(tx, fuente)
          const destino = await visibleLocations(tx, projectId)

          const plan = planSeed({
            source: origen,
            destinationPaths: destino.map((n) => n.path),
          })

          // Las rutas que el destino ya resuelve, más las que esta siembra
          // agrega: es lo que convierte `parentPath` en identificador, sin
          // distinguir el nodo preexistente del recién creado.
          const idPorRuta = new Map(destino.map((n) => [n.path, n.id]))

          for (const paso of plan.steps) {
            const parentId =
              paso.parentPath === null
                ? null
                : (idPorRuta.get(paso.parentPath) ?? null)

            const creado = await tx.docLocation.create({
              data: {
                projectId,
                parentId,
                code: paso.code,
                name: paso.name,
                // Se recompone en lugar de copiarse: la ruta del destino queda
                // consistente con su propia ascendencia por construcción, en
                // lugar de confiar en la de la fuente. Coincide con `paso.path`,
                // porque la identidad del nodo ES su ruta.
                path: composePath(paso.parentPath, paso.name),
                sortOrder: paso.sortOrder,
                externalOrigin: paso.externalOrigin,
                externalRef: paso.externalRef,
                createdById: userId,
                updatedById: userId,
              },
            })

            idPorRuta.set(creado.path, creado.id)

            // Cada nodo emite su creación, como cualquier otro: un nodo que
            // apareciera sin registro de haber sido creado sería la excepción.
            // El contexto sale del propio nodo, de modo que la traza del proyecto
            // los muestra.
            await emitAuditEvent(tx, {
              action: AuditAction.CreateLocation,
              objectId: creado.id,
              actorId: userId,
              meta: {
                code: creado.code,
                name: creado.name,
                path: creado.path,
                parentId: creado.parentId,
                seededFrom: fuente,
              },
            })
          }

          // Y el acto, una vez. **Sin objeto**, y es deliberado: la siembra no
          // recae sobre un nodo sino sobre el catálogo del proyecto, y elegir uno
          // de los creados para colgarle la traza sería la atribución arbitraria
          // que `DOC_REPLACEMENT` evitó con un tipo propio. El costo es que este
          // evento no lleva contexto derivado; lo compensan las creaciones, que
          // sí lo llevan.
          //
          // Existe además por un caso que las creaciones no cubren: una siembra
          // que no agrega nada. Sin este evento, intentarla no dejaría rastro.
          await emitAuditEvent(tx, {
            action: AuditAction.SeedLocations,
            objectId: null,
            actorId: userId,
            meta: {
              projectId,
              sourceProjectId: fuente,
              added: plan.steps.length,
              alreadyPresent: plan.alreadyPresent,
              skippedTerminated: plan.skippedTerminated,
            },
          })

          return {
            added: plan.steps.length,
            alreadyPresent: plan.alreadyPresent,
            skippedTerminated: plan.skippedTerminated,
          }
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "SEED_PROJECT_LOCATIONS",
          module: SysLogModule.DOCUMENT,
          messages: {
            uniqueConstraint:
              "Ya existe una ubicación con ese código en el mismo nivel y alcance.",
            default: "Error al sembrar el catálogo de ubicaciones.",
          },
        })
      }
    },

    /**
     * Renombrar, recodificar, reordenar y declarar la referencia externa.
     *
     * **Ni el padre ni el alcance se editan acá**: mover tiene operación propia,
     * porque cambia de lugar una rama entera y exige verificar que no se cuelgue
     * de su propia descendencia. El alcance no se edita en absoluto, con el
     * criterio de las calificaciones: mover un nodo entre el despliegue y un
     * proyecto cambiaría qué ve cada proyecto sin que nadie lo declare, y
     * arrastraría a su descendencia.
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

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_LOCATION,
        objectId: id,
        context,
        notFoundMessage: "Ubicación no encontrada",
      })

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
              ? { nodes: 0, documents: 0 }
              : await rewriteSubtree(tx, {
                  rootId: id,
                  parentPath: await assertParentAdmitted(tx, {
                    parentId: current.parentId,
                    scope: current.projectId,
                  }),
                })

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateLocation,
            objectId: id,
            actorId: userId,
            // `rewritten` cuenta el nodo y su descendencia, y `documents` los
            // documentos cuyo snapshot se recalculó: es lo que explica después por
            // qué cambiaron rutas de objetos que nadie editó, incluidas las
            // ampliaciones que otros proyectos colgaron de un nodo global.
            meta: {
              input,
              rewritten: reescritos.nodes,
              documents: reescritos.documents,
            },
          })

          return reescritos.nodes === 0
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
              "Ya existe una ubicación con ese código en el mismo nivel y alcance.",
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
     *
     * **No cambia el alcance**, y el destino debe admitirlo: es la vía por la que
     * un nodo de proyecto colgado del árbol global se acomoda dentro del propio,
     * que es lo que habilita después declarar catálogo propio.
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

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_LOCATION,
        objectId: id,
        context,
        notFoundMessage: "Ubicación no encontrada",
      })

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

          const parentPath = await assertParentAdmitted(tx, {
            parentId: destino,
            scope: current.projectId,
          })

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
              rewritten: reescritos.nodes,
              documents: reescritos.documents,
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

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_LOCATION,
        objectId: id,
        context,
        notFoundMessage: "Ubicación no encontrada",
      })

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

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_LOCATION,
        objectId: id,
        context,
        notFoundMessage: "Ubicación no encontrada",
      })

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
     * La descendencia se cuenta **sin acotar por alcance**: un nodo del
     * despliegue con ampliaciones de un proyecto tiene descendencia, aunque quien
     * lo mira no la vea desde su propio catálogo.
     *
     * Y que **ningún documento lo referencie**, que es la otra mitad de la
     * condición del precedente. La clave es `RESTRICT` y la base lo rechazaría
     * igual; acá se verifica antes para decir cuántos son.
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

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_LOCATION,
        objectId: id,
        context,
        notFoundMessage: "Ubicación no encontrada",
      })

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

          const clasificados = await tx.document.count({
            where: { locationId: id },
          })

          if (clasificados > 0) {
            throw new GraphQLError(
              `No se puede eliminar: ${clasificados} documento(s) están clasificados con esta ubicación. Dela de baja, que no revalida lo ya clasificado.`,
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
              projectId: location.projectId,
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
