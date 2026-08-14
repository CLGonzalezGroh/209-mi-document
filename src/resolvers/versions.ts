import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import {
  holdsPermission,
  userAuthorization,
} from "../utils/userAuthorization.js"
import { assertObjectAccess } from "../utils/projectAuthorization.js"
import {
  DocFileRole,
  DocObjectType,
  RevisionStatus,
  WorkflowStatus,
} from "../generated/prisma/enums.js"
import { handleError } from "../utils/handleError.js"
import { AuditAction } from "../events/catalog.js"
import { emitAuditEvent } from "../events/emit.js"
import { currentStep } from "../utils/reviewWorkflow.js"

const versionIncludes = {
  files: true,
  revision: {
    include: {
      document: true,
    },
  },
}

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("versions")

export const versionResolvers = {
  Mutation: {
    /**
     * Registra una versión (BLOQUE 03, B4 y B5).
     *
     * **Una versión es un archivo**: no existe sin archivo nuevo, y una vez
     * registrada no se modifica ni se elimina —tampoco su comentario—. Es la
     * única operación sobre versiones que el módulo tiene, y ahora eso es regla
     * y no omisión (H-34).
     *
     * **La produce quien tiene el paso vigente.** No es una restricción de
     * identidad sino de momento: la elabora el elaborador, la marca el revisor,
     * la marca el aprobador. El permiso especial habilita hacerlo por otro.
     */
    /**
     * @deprecated Reemplazada por la copia de trabajo (BLOQUE 03B, B12).
     *
     * Se conserva mientras el contrato la exponga: registrar un archivo suelto
     * es el caso de un conjunto de uno, y no hay motivo para romper a quien la
     * invoque antes de que la fase G retire el campo. Internamente ya escribe el
     * conjunto, con el archivo como entregable.
     *
     * No la use en código nuevo: `confirmWorkingCopy` recibe el conjunto
     * completo en un solo acto y hace exactamente lo mismo para un archivo.
     */
    registerVersion: async (
      _: any,
      {
        revisionId,
        input,
      }: {
        revisionId: number
        input: {
          fileKey: string
          fileName: string
          fileSize: number
          mimeType: string
          // Obligatorio en toda versión (B4, H-27). Hoy lo calcula quien invoca
          // la API: mi-fileserver no ve los bytes por diseño.
          checksum: string
          comment?: string
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CREATE],
        context,
      })
      logger.info("registerVersion", { userId })

      // La versión se registra dentro de una revisión: el proyecto es el suyo
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: revisionId,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      if (!input.checksum?.trim()) {
        throw new GraphQLError(
          "Toda versión exige checksum: es lo que la firma acredita como contenido.",
          { extensions: { code: "BAD_USER_INPUT" } },
        )
      }

      try {
        const revision = await context.orm.documentRevision.findFirst({
          where: { id: revisionId },
          include: {
            versions: { orderBy: { versionNumber: "desc" }, take: 1 },
            workflows: {
              where: { status: WorkflowStatus.IN_PROGRESS },
              include: { steps: true },
            },
          },
        })

        if (!revision) {
          throw new GraphQLError("Revisión no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        // DRAFT e IN_REVIEW: registrar una versión durante el circuito es el
        // caso normal —el revisor marca el archivo—, y no cambia el estado de
        // la revisión. Solo el rechazo la devuelve a DRAFT (B5).
        if (
          revision.status !== RevisionStatus.DRAFT &&
          revision.status !== RevisionStatus.IN_REVIEW
        ) {
          throw new GraphQLError(
            "Solo se registran versiones mientras la revisión está en curso.",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        // Una revisión aprobada no tiene paso vigente, y es lo que impide que la
        // firma quede acreditando una versión que dejó de ser la última.
        const abierto = revision.workflows[0]
        const vigente = abierto ? currentStep(abierto.steps) : null

        if (!vigente) {
          throw new GraphQLError(
            "La revisión no tiene un paso en curso que produzca la versión.",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        if (vigente.assignedToId !== userId) {
          const esAdmin = await holdsPermission({
            permission: PERMISSIONS.DOCUMENTS_WORKFLOW_ADMIN_UPDATE,
            context,
          })
          if (!esAdmin) {
            throw new GraphQLError(
              "La versión la registra quien tiene asignado el paso en curso.",
              { extensions: { code: "FORBIDDEN" } },
            )
          }
        }

        const nextVersionNumber = (revision.versions[0]?.versionNumber ?? 0) + 1

        const version = await context.orm.$transaction(async (tx) => {
          // La versión es un CONJUNTO de archivos (BLOQUE 03B, B6). Esta
          // operación conserva su forma de un archivo y lo registra como
          // entregable, que es lo que era. La copia de trabajo con sus seis
          // operaciones la reemplaza en la fase E (B12).
          const created = await tx.documentVersion.create({
            data: {
              revisionId,
              versionNumber: nextVersionNumber,
              comment: input.comment,
              createdById: userId,
              files: {
                create: {
                  role: DocFileRole.DELIVERABLE,
                  fileKey: input.fileKey,
                  fileName: input.fileName,
                  fileSize: input.fileSize,
                  mimeType: input.mimeType,
                  checksum: input.checksum,
                },
              },
            },
            include: versionIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.RegisterVersion,
            objectId: created.id,
            actorId: userId,
            meta: {
              revisionId,
              versionNumber: nextVersionNumber,
              stepId: vigente.id,
              stepType: vigente.stepType,
              onBehalfOf:
                vigente.assignedToId === userId ? null : vigente.assignedToId,
            },
          })

          return created
        })

        return version
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "REGISTER_VERSION",
          messages: {
            notFound: "La revisión no existe.",
            uniqueConstraint:
              "Ya existe una versión con ese número para esta revisión.",
            default: "Error al registrar la versión.",
          },
        })
      }
    },
  },
}
