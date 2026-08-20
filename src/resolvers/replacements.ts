import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { assertObjectAccess } from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import {
  DocObjectType,
  DocReplacementRole,
} from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { emitAuditEvent, emitWorkflowEvents } from "../events/emit.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("replacements")

const replacementIncludes = {
  items: {
    include: { document: true },
    orderBy: { id: "asc" as const },
  },
}

export const replacementResolvers = {
  Mutation: {
    /**
     * Registra un acto de reemplazo entre documentos (BLOQUE 03B, B5).
     *
     * **Reemplazar es superar**: los documentos reemplazados quedan obsoletos en
     * el mismo acto. No son dos decisiones —el documento superado deja de
     * representar nada vigente en el instante en que otro lo hace—, y es el
     * mismo hecho que un nivel más abajo ocurre al aprobar una revisión, que
     * supersede a la anterior.
     *
     * Es un ACTO y no un par de referencias: agrupa los que salen y los que
     * entran, con su motivo. Sin esa agrupación, una reorganización de dos
     * documentos en dos es indistinguible de dos reemplazos separados.
     *
     * La relación es N:M, y con ella quedan expresados tres hechos que hoy no
     * tienen forma de registrarse: la recodificación (1:1), la unificación de
     * dos en uno (N:1) y la división de uno en dos (1:N). **Qué clase de
     * reemplazo es se DERIVA de la cardinalidad** y no se tipifica: un
     * indicador sería un dato calculable capaz de contradecir a los que lo
     * originan.
     */
    replaceDocuments: async (
      _: any,
      {
        input,
      }: {
        input: {
          replacedIds: number[]
          replacingIds: number[]
          reason: string
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_OBSOLETE],
        context,
      })
      logger.info("replaceDocuments", { userId })

      const { replacedIds, replacingIds, reason } = input

      if (!reason?.trim()) {
        throw new GraphQLError("El reemplazo exige motivo.", {
          extensions: { code: "BAD_USER_INPUT" },
        })
      }
      if (replacedIds.length === 0 || replacingIds.length === 0) {
        throw new GraphQLError(
          "El acto exige al menos un documento reemplazado y uno que lo reemplace.",
          { extensions: { code: "BAD_USER_INPUT" } },
        )
      }

      const solapados = replacedIds.filter((id) => replacingIds.includes(id))
      if (solapados.length > 0) {
        throw new GraphQLError(
          "Un documento no puede reemplazarse a sí mismo.",
          { extensions: { code: "BAD_USER_INPUT" } },
        )
      }

      // La membresía se verifica sobre cada documento del acto, y no sobre uno
      // representativo: el acto los toca a todos.
      for (const id of [...replacedIds, ...replacingIds]) {
        await assertObjectAccess({
          intent: "write",
          userId,
          objectType: DocObjectType.DOCUMENT,
          objectId: id,
          context,
          notFoundMessage: "Documento no encontrado",
        })
      }

      try {
        return await context.orm.$transaction(async (tx) => {
          const documentos = await tx.document.findMany({
            where: { id: { in: [...replacedIds, ...replacingIds] } },
            select: {
              id: true,
              code: true,
              module: true,
              docProjectId: true,
              obsoletedAt: true,
            },
          })

          if (documentos.length !== replacedIds.length + replacingIds.length) {
            throw new GraphQLError("Algún documento del acto no existe.", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          // Los documentos de un acto COMPARTEN ÁMBITO. Reemplazar es un hecho
          // interno a un proyecto, o interno al régimen de publicación; lo que
          // cruza de uno a otro no es reemplazo sino promoción, que es otra cosa
          // y no pertenece a este módulo (B10).
          const ambito = (d: (typeof documentos)[number]) =>
            d.docProjectId === null ? `module:${d.module}` : `project:${d.docProjectId}`
          const ambitos = new Set(documentos.map(ambito))
          if (ambitos.size > 1) {
            throw new GraphQLError(
              "Los documentos de un acto de reemplazo comparten ámbito. Pasar de un proyecto al régimen de publicación no es reemplazar sino promover.",
              { extensions: { code: "BAD_USER_INPUT" } },
            )
          }

          const yaObsoleto = documentos.find(
            (d) => replacedIds.includes(d.id) && d.obsoletedAt,
          )
          if (yaObsoleto) {
            throw new GraphQLError(
              `El documento ${yaObsoleto.code} ya está obsoleto.`,
              { extensions: { code: "CONFLICT" } },
            )
          }

          const acto = await tx.docReplacement.create({
            data: {
              reason: reason.trim(),
              createdById: userId,
              items: {
                create: [
                  ...replacedIds.map((documentId) => ({
                    documentId,
                    role: DocReplacementRole.REPLACED,
                  })),
                  ...replacingIds.map((documentId) => ({
                    documentId,
                    role: DocReplacementRole.REPLACING,
                  })),
                ],
              },
            },
            include: replacementIncludes,
          })

          // La obsolescencia se REGISTRA y no se deriva, porque tiene dos
          // causas y ninguna se deduce de la otra. Lo que se deriva es cuál.
          const ahora = new Date()
          await tx.document.updateMany({
            where: { id: { in: replacedIds } },
            data: {
              obsoletedAt: ahora,
              obsoletedById: userId,
              obsoleteReason: reason.trim(),
              updatedById: userId,
            },
          })

          // El objeto del evento es el ACTO y no uno de los documentos: elegir
          // cuál sería arbitrario, y el acto es lo que tiene identidad propia.
          await emitAuditEvent(tx, {
            action: AuditAction.ReplaceDocuments,
            objectId: acto.id,
            actorId: userId,
            meta: {
              replacementId: acto.id,
              replacedIds,
              replacingIds,
              reason: reason.trim(),
            },
          })
          await emitWorkflowEvents(
            tx,
            replacedIds.map((documentId) => ({
              name: WorkflowEvent.DocumentObsoleted,
              objectId: documentId,
              fromState: null,
              toState: "OBSOLETE",
              actorId: userId,
            })),
          )

          return acto
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "REPLACE_DOCUMENTS",
          messages: {
            notFound: "Algún documento del acto no existe.",
            default: "Error al registrar el reemplazo.",
          },
        })
      }
    },
  },
}
