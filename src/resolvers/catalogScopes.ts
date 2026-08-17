import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"
import {
  DocCatalogKind,
  DocScopeMode,
  ModuleType,
  SysLogModule,
} from "../generated/prisma/enums.js"
import { AuditAction } from "../events/catalog.js"
import { emitAuditEvent } from "../events/emit.js"
import { projectAuthorization } from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { crossScopeChildren } from "../utils/catalogScope.js"

const logger = createLogger("catalogScopes")

/**
 * Alcance por proyecto de los catálogos documentales (BLOQUE 02B, B1).
 *
 * Un solo mecanismo para los tres catálogos. `BLOCK_02C` no agrega operaciones:
 * incorpora valores a `DocCatalogKind` y estas dos sirven igual.
 *
 * **El permiso es el de la configuración del proyecto** y no uno propio del
 * catálogo: declarar si un proyecto hereda es configurarlo, de la misma familia
 * que el rol documental, el esquema de revisión y el armador por defecto.
 * Administrar las entradas del catálogo es otra cosa, y tiene su propio permiso.
 */
export const catalogScopeResolvers = {
  Query: {
    /**
     * Lo declarado por un proyecto, que puede ser nada.
     *
     * Devuelve solo las filas existentes y no completa con `INHERIT` los
     * catálogos sin declarar: la ausencia **es** el default, y fabricar filas
     * inexistentes haría indistinguible lo declarado de lo supuesto. Cada
     * catálogo expone su modo efectivo por su lado.
     */
    catalogScopes: async (
      _: any,
      { projectId }: { projectId: number },
      context: ResolverContext,
    ) => {
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_PROJECT_SETTINGS_READ],
        projectId,
        context,
      })
      logger.info("catalogScopes", { userId })

      try {
        return await context.orm.docCatalogScope.findMany({
          // El módulo se declara además del proyecto (BLOQUE 02C, B6): un
          // `projectId` suelto alcanzaría hoy, pero dejaría la consulta
          // dependiendo de que ninguna otra fila lo repita.
          where: { module: ModuleType.PROJECTS, projectId },
          orderBy: { catalog: "asc" },
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_CATALOG_SCOPES",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener el alcance de los catálogos del proyecto.",
          },
        })
      }
    },
  },

  Mutation: {
    /**
     * Declarar cómo un proyecto resuelve un catálogo.
     *
     * Es un upsert por el par proyecto–catálogo: declarar dos veces no acumula
     * filas, y volver a `INHERIT` es declararlo, no borrar la fila. Que quede el
     * registro de haber vuelto es justamente lo que la traza necesita.
     *
     * **Declarar `OWN` se rechaza mientras algún nodo del proyecto cuelgue del
     * árbol del despliegue.** Al dejar de heredar, esos nodos quedarían colgados
     * de un padre que el proyecto ya no ve. Se rechaza y se nombran los nodos que
     * lo impiden, en lugar de convertirlos en raíces por decisión del sistema:
     * eso reescribiría rutas de nodos que nadie tocó, por un cambio de
     * configuración.
     */
    declareCatalogScope: async (
      _: any,
      {
        input,
      }: {
        input: {
          projectId: number
          catalog: DocCatalogKind
          mode: DocScopeMode
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_PROJECT_SETTINGS_UPDATE],
        projectId: input.projectId,
        context,
      })
      logger.info("declareCatalogScope", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          // La clasificación tiene el mismo problema que el árbol, con el
          // vínculo un catálogo más allá: los tipos del proyecto que cuelgan de
          // una clase del despliegue quedarían apuntando a una clase que el
          // proyecto ya no ve. Se rechaza y se nombran, en lugar de dejarlos sin
          // clase por decisión del sistema — eso reclasificaría entradas que
          // nadie tocó, por un cambio de configuración.
          if (
            input.catalog === DocCatalogKind.CLASSIFICATION &&
            input.mode === DocScopeMode.OWN
          ) {
            const colgados = await tx.documentType.findMany({
              where: {
                projectId: input.projectId,
                class: { projectId: null },
              },
              select: { code: true },
            })

            if (colgados.length > 0) {
              throw new GraphQLError(
                `No se puede declarar catálogo propio: ${colgados.length} tipo(s) del proyecto cuelgan de una clase del despliegue. Muévalos a una clase propia primero: ${colgados
                  .map((t) => t.code)
                  .join("; ")}`,
                { extensions: { code: "BAD_USER_INPUT" } },
              )
            }
          }

          if (
            input.catalog === DocCatalogKind.LOCATION &&
            input.mode === DocScopeMode.OWN
          ) {
            const nodes = await tx.docLocation.findMany({
              select: { id: true, parentId: true, projectId: true, path: true },
            })
            const colgados = crossScopeChildren(nodes, input.projectId)

            if (colgados.length > 0) {
              throw new GraphQLError(
                `No se puede declarar catálogo propio: ${colgados.length} ubicación(es) del proyecto cuelgan del árbol del despliegue. Muévalas a un nodo propio primero: ${colgados
                  .map((n) => n.path)
                  .join("; ")}`,
                { extensions: { code: "BAD_USER_INPUT" } },
              )
            }
          }

          const declarado = await tx.docCatalogScope.upsert({
            where: {
              module_projectId_catalog: {
                module: ModuleType.PROJECTS,
                projectId: input.projectId,
                catalog: input.catalog,
              },
            },
            create: {
              // La operación declara el alcance de un PROYECTO, y un proyecto
              // pertenece siempre al módulo de proyectos (BLOQUE 02C, B6). La
              // declaración por módulo tendrá su propia operación cuando exista
              // quién la administre; la estructura ya la admite.
              module: ModuleType.PROJECTS,
              projectId: input.projectId,
              catalog: input.catalog,
              mode: input.mode,
              createdById: userId,
              updatedById: userId,
            },
            update: { mode: input.mode, updatedById: userId },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.DeclareCatalogScope,
            objectId: declarado.id,
            actorId: userId,
            meta: { catalog: input.catalog, mode: input.mode },
          })

          return declarado
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DECLARE_CATALOG_SCOPE",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al declarar el alcance del catálogo.",
          },
        })
      }
    },
  },
}
