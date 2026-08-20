import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { DocumentRole, RevisionScheme } from "../generated/prisma/enums.js"
import { AuditAction } from "../events/catalog.js"
import { emitAuditEvent } from "../events/emit.js"
import { assertCounterparty, assertRoleIsSettled } from "../utils/docProjects.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("docProjects")

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
    /** El contrato por su identidad. */
    docProject: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_PROJECT_SETTINGS_READ],
        context,
      })
      logger.info("docProject", { userId })

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
        requiredPermissions: [PERMISSIONS.DOCUMENTS_PROJECT_SETTINGS_READ],
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
    declareDocProject: async (
      _: any,
      {
        input,
      }: {
        input: {
          // Identidad del contrato (B1). El código lo identifica dentro del
          // módulo y no cambia, con el criterio de D-24.
          code: string
          name: string
          description?: string | null
          // Gestión PMI asociada. Nulo = la obra de este contrato no se
          // administra en mi-project (B3, B6).
          projectId?: number | null
          documentRole: DocumentRole
          // Contraparte: referencia a Company de mi-admin (B4)
          counterpartyId?: number | null
          // Esquema con que el proyecto propone el código de la PRIMERA revisión
          // de sus documentos (BLOQUE 03, B13). Nulo = rige el del despliegue.
          revisionScheme?: RevisionScheme | null
          // Armador por defecto —habitualmente el jefe de proyecto—, con el que
          // el alta llega con el campo lleno (B3).
          defaultOrganizerId?: number | null
          // Configuración del atributo de ubicación física (BLOQUE 02B, B4).
          // Habilitado y no obligatorio por defecto, en los tres roles: la planta
          // lo usa para filtrar, no para exigir. La etiqueta sí es configurable,
          // porque "área", "unidad" o "sector" son nombres que cada organización
          // usa distinto.
          locationEnabled?: boolean
          locationRequired?: boolean
          locationLabel?: string | null
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_PROJECT_SETTINGS_UPDATE],
        context,
      })
      logger.info("declareDocProject", { userId })

      // Invariante de la contraparte (B4): exigida en ISSUER y RECEIVER,
      // prohibida en INTERNAL, que por definición no la tiene (D-19).
      assertCounterparty(input.documentRole, input.counterpartyId)

      // El rol es inmutable desde el primer documento o transmittal (B5)
      await assertRoleIsSettled(context, input.code, input.documentRole)

      try {
        return await context.orm.$transaction(async (tx) => {
          const contrato = await tx.docProject.upsert({
            // Por CÓDIGO y no por proyecto: es la identidad del contrato, y
            // siempre está. Un contrato sin gestión PMI no tendría clave.
            where: { code: input.code },
            update: {
              code: input.code,
              name: input.name,
              description: input.description ?? null,
              // El vínculo PMI se puede agregar y quitar después del alta (B3):
              // no es identidad, a diferencia del código.
              projectId: input.projectId ?? null,
              documentRole: input.documentRole,
              counterpartyId: input.counterpartyId ?? null,
              revisionScheme: input.revisionScheme ?? null,
              defaultOrganizerId: input.defaultOrganizerId ?? null,
              locationEnabled: input.locationEnabled ?? true,
              locationRequired: input.locationRequired ?? false,
              locationLabel: input.locationLabel ?? null,
              updatedById: userId,
            },
            create: {
              code: input.code,
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
              createdById: userId,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.DeclareDocProject,
            objectId: contrato.id,
            actorId: userId,
            meta: {
              code: input.code,
              name: input.name,
              projectId: input.projectId ?? null,
              documentRole: input.documentRole,
              counterpartyId: input.counterpartyId ?? null,
              revisionScheme: input.revisionScheme ?? null,
              defaultOrganizerId: input.defaultOrganizerId ?? null,
              locationEnabled: input.locationEnabled ?? true,
              locationRequired: input.locationRequired ?? false,
              locationLabel: input.locationLabel ?? null,
            },
          })

          return contrato
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DECLARE_DOC_PROJECT",
          messages: {
            uniqueConstraint:
              "Ya existe un contrato con ese código, o la obra ya tiene contrato documental.",
            default: "Error al declarar el contrato documental.",
          },
        })
      }
    },
  },
}

export { GraphQLError }
