import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { RevisionScheme } from "../generated/prisma/enums.js"
import { AuditAction } from "../events/catalog.js"
import { emitAuditEvent } from "../events/emit.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("docSettings")

/** El registro único del despliegue (BLOQUE 03, B13, patrón `CatalogSettings`). */
const UNICO = 1

/**
 * Configuración documental del despliegue.
 *
 * Es el último escalón de la precedencia documento ▸ proyecto ▸ despliegue:
 * permite fijar la convención del cliente sin desplegar y sin configurar
 * proyecto por proyecto, que es lo que D-13 busca al hablar de un default
 * global.
 *
 * **Autorización global, sin segunda capa**: no pertenece a ningún proyecto,
 * igual que los catálogos de clase y tipo.
 */
export const docSettingsResolvers = {
  Query: {
    docSettings: async (_: any, __: any, context: ResolverContext) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_SETTINGS_READ],
        context,
      })
      logger.info("docSettings", { userId })

      try {
        // El registro puede no existir todavía: un despliegue recién instalado
        // debe poder crear documentos, de modo que rige el valor por defecto del
        // modelo hasta que alguien lo declare.
        return (
          (await context.orm.docSettings.findUnique({ where: { id: UNICO } })) ?? {
            id: UNICO,
            createdAt: new Date(),
            updatedAt: null,
            updatedById: 1,
            revisionScheme: RevisionScheme.ALPHA,
          }
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOC_SETTINGS",
          messages: {
            default:
              "Error al obtener la configuración documental del despliegue.",
          },
        })
      }
    },
  },

  Mutation: {
    declareDocSettings: async (
      _: any,
      { input }: { input: { revisionScheme: RevisionScheme } },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_SETTINGS_UPDATE],
        context,
      })
      logger.info("declareDocSettings", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          const settings = await tx.docSettings.upsert({
            where: { id: UNICO },
            update: {
              revisionScheme: input.revisionScheme,
              updatedById: userId,
            },
            create: {
              id: UNICO,
              revisionScheme: input.revisionScheme,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.DeclareDocSettings,
            objectId: settings.id,
            actorId: userId,
            meta: { revisionScheme: input.revisionScheme },
          })

          return settings
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DECLARE_DOC_SETTINGS",
          messages: {
            default:
              "Error al declarar la configuración documental del despliegue.",
          },
        })
      }
    },
  },
}
