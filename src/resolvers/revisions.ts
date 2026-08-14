import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { assertObjectAccess } from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import {
  DocObjectType,
  RevisionStatus,
  RevisionScheme,
  StepStatus,
  WorkflowStatus,
} from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import {
  emitAuditEvent,
  emitWorkflowEvent,
  emitWorkflowEvents,
  type WorkflowEventInput,
} from "../events/emit.js"
import { planRevision, REVISION_PLAN_MESSAGE } from "../utils/revisionSetup.js"
import {
  initialSteps,
  stepsForRejectionRetry,
} from "../utils/workflowTemplate.js"
import { stepsSkippedByCancellation } from "../utils/reviewWorkflow.js"
import { metadataOfCurrentRevision } from "../utils/documentMetadata.js"

// Una revisión tiene VARIOS circuitos sucesivos (D-11, B2), ordenados por
// creación: el vigente es el que está IN_PROGRESS y se deriva, no se almacena.
const revisionIncludes = {
  document: {
    include: {
      currentDocumentType: true,
    },
  },
  documentType: true,
  documentClass: true,
  versions: {
    include: { files: true },
    orderBy: { versionNumber: "desc" as const },
  },
  workflows: {
    include: {
      steps: {
        orderBy: { stepOrder: "asc" as const },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
}

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("revisions")

/** Estados en que la revisión sigue viva y no admite otra en paralelo. */
const REVISION_ABIERTA: RevisionStatus[] = [
  RevisionStatus.DRAFT,
  RevisionStatus.IN_REVIEW,
]

export const revisionResolvers = {
  Query: {
    revisionById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_READ],
        context,
      })
      logger.info("revisionById", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: id,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      try {
        const revision = await context.orm.documentRevision.findFirst({
          where: { id },
          include: revisionIncludes,
        })

        if (!revision) {
          throw new GraphQLError("Revisión no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return revision
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_REVISION_BY_ID",
          messages: {
            notFound: "La revisión solicitada no existe o no está disponible.",
            default: "Error al obtener la revisión.",
          },
        })
      }
    },
  },

  Mutation: {
    createRevision: async (
      _: any,
      {
        documentId,
        input,
      }: {
        documentId: number
        input: {
          // Esquema con que se propone el código. No se persiste (B13).
          revisionScheme?: RevisionScheme
          revisionCode?: string
          assignedOrganizerId?: number
          // El archivo dejó de ser obligatorio (H-20). Sigue siendo admisible.
          initialVersion?: {
            fileKey: string
            fileName: string
            fileSize: number
            mimeType: string
            checksum: string
            comment?: string
          }
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CREATE],
        context,
      })
      logger.info("createRevision", { userId })

      // La revisión se abre sobre un documento: el proyecto es el del documento
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT,
        objectId: documentId,
        context,
        notFoundMessage: "Documento no encontrado",
      })

      try {
        const revision = await context.orm.$transaction(async (tx) => {
          const document = await tx.document.findFirst({
            where: { id: documentId },
            select: {
              id: true,
              code: true,
              projectId: true,
              currentTitle: true,
              currentDocumentClassId: true,
              currentDocumentTypeId: true,
            },
          })

          if (!document) {
            throw new GraphQLError("Documento no encontrado", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          // Una revisión abierta por documento. La abortada no cuenta: dejó de
          // estar en curso y su código volvió a quedar disponible (B12).
          const abierta = await tx.documentRevision.findFirst({
            where: { documentId, status: { in: REVISION_ABIERTA } },
            select: { id: true, revisionCode: true },
          })

          if (abierta) {
            throw new GraphQLError(
              `Ya existe una revisión en curso (${abierta.revisionCode}). Debe completarla o abandonarla antes de abrir otra.`,
              { extensions: { code: "CONFLICT" } },
            )
          }

          const planned = await planRevision(tx, {
            documentId,
            scope: {
              projectId: document.projectId,
              documentClassId: document.currentDocumentClassId,
              documentTypeId: document.currentDocumentTypeId,
            },
            chosenScheme: input.revisionScheme ?? null,
            informedCode: input.revisionCode ?? null,
            informedOrganizerId: input.assignedOrganizerId ?? null,
          })

          if (!planned.ok) {
            throw new GraphQLError(REVISION_PLAN_MESSAGE[planned.reason], {
              extensions: { code: "BAD_USER_INPUT" },
            })
          }
          const { revisionCode, organizerId, templateId } = planned.plan

          // La revisión nace con su circuito en armado, igual que en el alta:
          // no hay revisión sin circuito (B3).
          const created = await tx.documentRevision.create({
            data: {
              documentId,
              revisionCode,
              status: RevisionStatus.DRAFT,
              assignedOrganizerId: organizerId,
              // La identificación se COPIA de la revisión anterior (BLOQUE 03B,
              // B1). La copia del documento es justamente la de la revisión en
              // curso, y acá no hay ninguna abierta: refleja la última no
              // abandonada, que es la fuente correcta y evita una consulta más.
              title: document.currentTitle,
              documentTypeId: document.currentDocumentTypeId,
              documentClassId: document.currentDocumentClassId,
              createdById: userId,
              updatedById: userId,
              ...(input.initialVersion && {
                versions: {
                  create: {
                    versionNumber: 1,
                    ...input.initialVersion,
                    createdById: userId,
                  },
                },
              }),
              workflows: {
                create: {
                  status: WorkflowStatus.IN_PROGRESS,
                  initiatedById: userId,
                  templateId,
                  steps: {
                    create: initialSteps(organizerId).map((s) => ({
                      ...s,
                      status: StepStatus.PENDING,
                    })),
                  },
                },
              },
            },
            include: revisionIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CreateRevision,
            objectId: created.id,
            actorId: userId,
            meta: {
              documentId,
              documentCode: document.code,
              revisionCode,
              assignedOrganizerId: organizerId,
              templateId,
            },
          })
          await emitWorkflowEvents(tx, [
            {
              name: WorkflowEvent.RevisionCreated,
              objectId: created.id,
              toState: RevisionStatus.DRAFT,
              actorId: userId,
            },
            {
              name: WorkflowEvent.WorkflowStarted,
              objectId: created.workflows[0].id,
              toState: WorkflowStatus.IN_PROGRESS,
              actorId: userId,
            },
          ])

          return created
        })

        return revision
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_REVISION",
          messages: {
            uniqueConstraint:
              "Ya existe una revisión con ese código para este documento.",
            notFound: "El documento no existe.",
            default: "Error al crear la revisión.",
          },
        })
      }
    },


    /**
     * Edita la identificación de la revisión (BLOQUE 03B, B1 y B2).
     *
     * El título, la clase y el tipo viven en la revisión porque están impresos
     * en el rótulo del archivo, y lo impreso pertenece a la emisión que lo
     * produjo. Editarlos acá es lo que vuelve **estructural** el congelamiento:
     * una revisión aprobada no se modifica, y con eso la regla deja de
     * necesitar enunciado propio.
     *
     * La copia del documento se replica en el mismo acto. Su único escritor es
     * esta transición, que es lo que impide que se desincronice.
     */
    updateRevisionMetadata: async (
      _: any,
      {
        revisionId,
        input,
      }: {
        revisionId: number
        input: {
          title?: string
          documentTypeId?: number
          documentClassId?: number | null
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_UPDATE],
        context,
      })
      logger.info("updateRevisionMetadata", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: revisionId,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      if (
        input.title === undefined &&
        input.documentTypeId === undefined &&
        input.documentClassId === undefined
      ) {
        throw new GraphQLError("No se informó ningún cambio.", {
          extensions: { code: "BAD_USER_INPUT" },
        })
      }

      if (input.title !== undefined && !input.title.trim()) {
        throw new GraphQLError("El título no puede quedar vacío.", {
          extensions: { code: "BAD_USER_INPUT" },
        })
      }

      try {
        const result = await context.orm.$transaction(async (tx) => {
          const revision = await tx.documentRevision.findFirst({
            where: { id: revisionId },
            select: {
              id: true,
              documentId: true,
              revisionCode: true,
              status: true,
              title: true,
              documentTypeId: true,
              documentClassId: true,
            },
          })

          if (!revision) {
            throw new GraphQLError("Revisión no encontrada", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          // El congelamiento no es una precondición añadida: es que una revisión
          // aprobada no se modifica. Corregir exige abrir la siguiente, que
          // vuelve a habilitar la edición sobre ella.
          if (!REVISION_ABIERTA.includes(revision.status)) {
            throw new GraphQLError(
              "La identificación de una revisión que ya no está en curso no se edita. Abrir la revisión siguiente vuelve a habilitarla.",
              { extensions: { code: "CONFLICT" } },
            )
          }

          const antes = {
            title: revision.title,
            documentTypeId: revision.documentTypeId,
            documentClassId: revision.documentClassId,
          }
          const despues = {
            title: input.title?.trim() ?? antes.title,
            documentTypeId: input.documentTypeId ?? antes.documentTypeId,
            documentClassId:
              input.documentClassId === undefined
                ? antes.documentClassId
                : input.documentClassId,
          }

          const updated = await tx.documentRevision.update({
            where: { id: revisionId },
            data: { ...despues, updatedById: userId },
            include: revisionIncludes,
          })

          // Réplica a la copia del documento. Se recalcula desde las revisiones
          // en lugar de copiar lo que se acaba de escribir: si la editada no
          // fuera la que está en curso, copiar a ciegas dejaría al documento
          // declarando algo que su revisión en curso no dice.
          const revisiones = await tx.documentRevision.findMany({
            where: { documentId: revision.documentId },
            select: {
              id: true,
              revisionCode: true,
              status: true,
              createdAt: true,
              title: true,
              documentTypeId: true,
              documentClassId: true,
            },
          })
          const copia = metadataOfCurrentRevision(revisiones)
          if (copia) {
            await tx.document.update({
              where: { id: revision.documentId },
              data: {
                currentTitle: copia.title,
                currentDocumentTypeId: copia.documentTypeId,
                currentDocumentClassId: copia.documentClassId,
                updatedById: userId,
              },
            })
          }

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateRevisionMetadata,
            objectId: revisionId,
            actorId: userId,
            meta: {
              revisionCode: revision.revisionCode,
              antes,
              despues,
            },
          })

          return updated
        })

        return result
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_REVISION_METADATA",
          messages: {
            notFound: "La revisión no existe.",
            default: "Error al editar la identificación de la revisión.",
          },
        })
      }
    },

    /**
     * Abandona la revisión (BLOQUE 03, B11).
     *
     * Es un acto distinto de cancelar el circuito: acá la revisión deja de tener
     * sentido y no va a emitirse, de modo que **no sobrevive**. Si tiene un
     * circuito abierto, se cancela con ella.
     *
     * Solo se aborta una revisión NO aprobada: aprobada, es el documento vigente
     * y lo que corresponde es abrir la siguiente. Como la emisión exige
     * aprobación (D-18), una revisión abortada nunca fue emitida.
     *
     * No hace falta restituir la revisión anterior: la supersesión ocurre al
     * aprobarse la sucesora, y una abortada nunca se aprueba. La anterior nunca
     * dejó de estar vigente.
     */
    abandonRevision: async (
      _: any,
      { revisionId, reason }: { revisionId: number; reason: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_UPDATE],
        context,
      })
      logger.info("abandonRevision", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: revisionId,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      if (!reason?.trim()) {
        throw new GraphQLError("Debe indicarse el motivo del abandono.", {
          extensions: { code: "BAD_USER_INPUT" },
        })
      }

      try {
        const result = await context.orm.$transaction(async (tx) => {
          const revision = await tx.documentRevision.findFirst({
            where: { id: revisionId },
            include: {
              workflows: { include: { steps: true } },
            },
          })

          if (!revision) {
            throw new GraphQLError("Revisión no encontrada", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          if (!REVISION_ABIERTA.includes(revision.status)) {
            throw new GraphQLError(
              "Solo se abandona una revisión en curso. Una revisión aprobada es el documento vigente: lo que corresponde es abrir la siguiente.",
              { extensions: { code: "BAD_REQUEST" } },
            )
          }

          const now = new Date()
          const transitions: WorkflowEventInput[] = []

          // El circuito abierto se cancela con la revisión. Los pasos ya
          // resueltos conservan su estado y su firma: nada se elimina, que es
          // lo que permite abandonar en cualquier punto.
          const abierto = revision.workflows.find(
            (w) => w.status === WorkflowStatus.IN_PROGRESS,
          )

          if (abierto) {
            const skipped = stepsSkippedByCancellation(abierto.steps)

            await tx.reviewStep.updateMany({
              where: { workflowId: abierto.id, status: StepStatus.PENDING },
              data: { status: StepStatus.SKIPPED },
            })
            await tx.reviewWorkflow.update({
              where: { id: abierto.id },
              data: {
                status: WorkflowStatus.CANCELLED,
                completedAt: now,
                cancelledAt: now,
                cancelledById: userId,
                cancelReason: reason,
              },
            })

            transitions.push(
              ...skipped.map((s) => ({
                name: WorkflowEvent.StepSkipped,
                objectId: s.id,
                fromState: StepStatus.PENDING,
                toState: StepStatus.SKIPPED,
                actorId: userId,
              })),
              {
                name: WorkflowEvent.WorkflowCancelled,
                objectId: abierto.id,
                fromState: abierto.status,
                toState: WorkflowStatus.CANCELLED,
                actorId: userId,
              },
            )
          }

          const updated = await tx.documentRevision.update({
            where: { id: revisionId },
            data: {
              status: RevisionStatus.ABANDONED,
              abandonedAt: now,
              abandonedById: userId,
              abandonReason: reason,
              updatedById: userId,
            },
            include: revisionIncludes,
          })

          transitions.push({
            name: WorkflowEvent.RevisionAbandoned,
            objectId: revisionId,
            fromState: revision.status,
            toState: RevisionStatus.ABANDONED,
            actorId: userId,
          })

          // La metadata vuelve sola (BLOQUE 03B, B2): la abandonada deja de ser
          // la última viva y la copia se recalcula sobre la que estaba antes.
          // No se revierte nada, porque nunca se sobrescribió el origen.
          const revisiones = await tx.documentRevision.findMany({
            where: { documentId: revision.documentId },
            select: {
              id: true,
              revisionCode: true,
              status: true,
              createdAt: true,
              title: true,
              documentTypeId: true,
              documentClassId: true,
            },
          })
          const copia = metadataOfCurrentRevision(
            revisiones.map((r) =>
              r.id === revisionId
                ? { ...r, status: RevisionStatus.ABANDONED }
                : r,
            ),
          )
          if (copia) {
            await tx.document.update({
              where: { id: revision.documentId },
              data: {
                currentTitle: copia.title,
                currentDocumentTypeId: copia.documentTypeId,
                currentDocumentClassId: copia.documentClassId,
                updatedById: userId,
              },
            })
          }

          await emitAuditEvent(tx, {
            action: AuditAction.AbandonRevision,
            objectId: revisionId,
            actorId: userId,
            meta: {
              revisionCode: revision.revisionCode,
              reason,
              cancelledWorkflowId: abierto?.id ?? null,
            },
          })
          await emitWorkflowEvents(tx, transitions)

          return updated
        })

        return result
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CANCEL_REVISION",
          messages: {
            notFound: "La revisión no existe.",
            default: "Error al abandonar la revisión.",
          },
        })
      }
    },
  },
}
