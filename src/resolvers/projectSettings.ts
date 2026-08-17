import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { DocumentRole, RevisionScheme } from "../generated/prisma/enums.js"
import { AuditAction } from "../events/catalog.js"
import { emitAuditEvent } from "../events/emit.js"
import { assertCounterparty, assertRoleIsSettled } from "../utils/projectSettings.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("projectSettings")

/**
 * Configuración documental del proyecto (BLOQUE 02, D-09, D-19 y B4).
 *
 * Declarar el rol documental de un proyecto es un acto ADMINISTRATIVO y se
 * gobierna únicamente por el permiso global, sin la segunda capa. El motivo es
 * de arranque: un proyecto que todavía no tiene configuración tampoco tiene
 * miembros, de modo que exigir membresía lo volvería inconfigurable.
 *
 * Es el mismo criterio con que OperMask Digitalization trata su membresía.
 */
export const projectSettingsResolvers = {
  Query: {
    docProjectSettings: async (
      _: any,
      { projectId }: { projectId: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_PROJECT_SETTINGS_READ],
        context,
      })
      logger.info("docProjectSettings", { userId })

      try {
        // Nulo cuando el proyecto todavía no declaró su rol documental
        return await context.orm.docProjectSettings.findUnique({
          where: { projectId },
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOC_PROJECT_SETTINGS",
          messages: {
            default: "Error al obtener la configuración documental del proyecto.",
          },
        })
      }
    },
  },

  Mutation: {
    declareDocProjectSettings: async (
      _: any,
      {
        input,
      }: {
        input: {
          projectId: number
          documentRole: DocumentRole
          counterpartyName?: string
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
      logger.info("declareDocProjectSettings", { userId })

      // Invariante de la contraparte (B4): exigida en ISSUER y RECEIVER,
      // prohibida en INTERNAL, que por definición no la tiene (D-19).
      assertCounterparty(input.documentRole, input.counterpartyName)

      // El rol es inmutable desde el primer documento o transmittal (B5)
      await assertRoleIsSettled(context, input.projectId, input.documentRole)

      try {
        return await context.orm.$transaction(async (tx) => {
          const settings = await tx.docProjectSettings.upsert({
            where: { projectId: input.projectId },
            update: {
              documentRole: input.documentRole,
              counterpartyName: input.counterpartyName ?? null,
              revisionScheme: input.revisionScheme ?? null,
              defaultOrganizerId: input.defaultOrganizerId ?? null,
              locationEnabled: input.locationEnabled ?? true,
              locationRequired: input.locationRequired ?? false,
              locationLabel: input.locationLabel ?? null,
              updatedById: userId,
            },
            create: {
              projectId: input.projectId,
              documentRole: input.documentRole,
              counterpartyName: input.counterpartyName ?? null,
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
            action: AuditAction.DeclareProjectSettings,
            objectId: settings.id,
            actorId: userId,
            meta: {
              projectId: input.projectId,
              documentRole: input.documentRole,
              counterpartyName: input.counterpartyName ?? null,
              revisionScheme: input.revisionScheme ?? null,
              defaultOrganizerId: input.defaultOrganizerId ?? null,
              locationEnabled: input.locationEnabled ?? true,
              locationRequired: input.locationRequired ?? false,
              locationLabel: input.locationLabel ?? null,
            },
          })

          return settings
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DECLARE_DOC_PROJECT_SETTINGS",
          messages: {
            uniqueConstraint: "El proyecto ya tiene configuración documental.",
            default: "Error al declarar la configuración documental del proyecto.",
          },
        })
      }
    },
  },
}

export { GraphQLError }
