import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import {
  assertObjectAccess,
  projectScopeAuthorization,
} from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import {
  DocObjectType,
  RevisionStatus,
  WorkflowStatus,
  StepStatus,
  StepType,
} from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import {
  emitAuditEvent,
  emitWorkflowEvents,
  type WorkflowEventInput,
} from "../events/emit.js"
import {
  completesWorkflow,
  stepsSkippedByCancellation,
  stepsSkippedByRejection,
} from "../utils/reviewWorkflow.js"
import { createHash } from "crypto"

const workflowIncludes = {
  revision: {
    include: {
      document: true,
    },
  },
  steps: {
    orderBy: { stepOrder: "asc" as const },
  },
}

const stepIncludes = {
  workflow: {
    include: {
      revision: {
        include: {
          document: true,
        },
      },
      steps: {
        orderBy: { stepOrder: "asc" as const },
      },
    },
  },
}

/**
 * Genera un hash de firma para trazabilidad ISO 9001.
 * SHA-256(stepId + userId + timestamp + action)
 */
function generateSignatureHash(
  stepId: number,
  userId: number,
  action: string,
): string {
  const timestamp = new Date().toISOString()
  const data = `${stepId}-${userId}-${timestamp}-${action}`
  return createHash("sha256").update(data).digest("hex")
}

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("workflows")

export const workflowResolvers = {
  Query: {
    pendingReviewSteps: async (
      _: any,
      { userId: targetUserId }: { userId: number },
      context: ResolverContext,
    ) => {
      // Listado sin proyecto en los argumentos: la segunda capa filtra (B7).
      // El paso alcanza su proyecto a través de workflow → revisión → documento,
      // de modo que el alcance se anida en lugar de aplicarse a la raíz.
      const { userId, scope } = await projectScopeAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_LIST],
        context,
        includeWithoutProject: true,
      })
      logger.info("pendingReviewSteps", { userId })

      try {
        const steps = await context.orm.reviewStep.findMany({
          where: {
            assignedToId: targetUserId,
            status: StepStatus.PENDING,
            workflow: {
              status: {
                in: [WorkflowStatus.PENDING, WorkflowStatus.IN_PROGRESS],
              },
              revision: { document: scope },
            },
          },
          include: stepIncludes,
          orderBy: { createdAt: "asc" },
        })

        return steps
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_PENDING_REVIEW_STEPS",
          messages: {
            default: "Error al obtener los pasos pendientes de revisión.",
          },
        })
      }
    },

    workflowsByStatus: async (
      _: any,
      { status }: { status: WorkflowStatus },
      context: ResolverContext,
    ) => {
      // Listado sin proyecto en los argumentos: la segunda capa filtra (B7).
      const { userId, scope } = await projectScopeAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_LIST],
        context,
        includeWithoutProject: true,
      })
      logger.info("workflowsByStatus", { userId })

      try {
        const workflows = await context.orm.reviewWorkflow.findMany({
          where: { status, revision: { document: scope } },
          include: workflowIncludes,
          orderBy: { createdAt: "desc" },
        })

        return workflows
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_WORKFLOWS_BY_STATUS",
          messages: {
            default: "Error al obtener los workflows.",
          },
        })
      }
    },
  },

  Mutation: {
    initiateReview: async (
      _: any,
      {
        revisionId,
        input,
      }: {
        revisionId: number
        input: {
          steps: Array<{
            stepOrder: number
            stepType: StepType
            assignedToId: number
          }>
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_CREATE],
        context,
      })
      logger.info("initiateReview", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: revisionId,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      try {
        // Verificar que la revisión existe y está en DRAFT
        const revision = await context.orm.documentRevision.findFirst({
          where: { id: revisionId },
          include: { workflow: true },
        })

        if (!revision) {
          throw new GraphQLError("Revisión no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (revision.status !== RevisionStatus.DRAFT) {
          throw new GraphQLError(
            "Solo se puede iniciar un workflow en revisiones en estado DRAFT.",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        if (revision.workflow) {
          throw new GraphQLError(
            "Esta revisión ya tiene un workflow de revisión asociado.",
            { extensions: { code: "CONFLICT" } },
          )
        }

        if (!input.steps || input.steps.length === 0) {
          throw new GraphQLError(
            "Debe incluir al menos un paso en el workflow.",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        // Crear workflow con steps y actualizar estado de la revisión
        const workflow = await context.orm.$transaction(async (tx) => {
          // Crear el workflow
          const wf = await tx.reviewWorkflow.create({
            data: {
              revisionId,
              status: WorkflowStatus.IN_PROGRESS,
              initiatedById: userId,
              steps: {
                create: input.steps.map((step) => ({
                  stepOrder: step.stepOrder,
                  stepType: step.stepType,
                  assignedToId: step.assignedToId,
                  status: StepStatus.PENDING,
                })),
              },
            },
            include: workflowIncludes,
          })

          // Actualizar estado de la revisión
          await tx.documentRevision.update({
            where: { id: revisionId },
            data: {
              status: RevisionStatus.IN_REVIEW,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.InitiateReview,
            objectId: wf.id,
            actorId: userId,
            meta: { revisionId, stepsCount: input.steps.length },
          })
          await emitWorkflowEvents(tx, [
            {
              name: WorkflowEvent.WorkflowStarted,
              objectId: wf.id,
              toState: WorkflowStatus.IN_PROGRESS,
              actorId: userId,
            },
            {
              name: WorkflowEvent.RevisionSubmitted,
              objectId: revisionId,
              fromState: RevisionStatus.DRAFT,
              toState: RevisionStatus.IN_REVIEW,
              actorId: userId,
            },
          ])

          return wf
        })

        return workflow
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "INITIATE_REVIEW",
          messages: {
            notFound: "La revisión no existe.",
            default: "Error al iniciar el workflow de revisión.",
          },
        })
      }
    },

    approveStep: async (
      _: any,
      { stepId, comments }: { stepId: number; comments?: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_UPDATE],
        context,
      })
      logger.info("approveStep", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.REVIEW_STEP,
        objectId: stepId,
        context,
        notFoundMessage: "Paso no encontrado",
      })

      try {
        // Obtener el step con su workflow
        const step = await context.orm.reviewStep.findFirst({
          where: { id: stepId },
          include: {
            workflow: {
              include: {
                steps: {
                  orderBy: { stepOrder: "asc" },
                },
                revision: true,
              },
            },
          },
        })

        if (!step) {
          throw new GraphQLError("Paso de revisión no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (step.status !== StepStatus.PENDING) {
          throw new GraphQLError("Este paso ya fue evaluado.", {
            extensions: { code: "BAD_REQUEST" },
          })
        }

        // Verificar que es el turno de este step (todos los anteriores deben estar aprobados)
        const previousSteps = step.workflow.steps.filter(
          (s) => s.stepOrder < step.stepOrder,
        )
        const allPreviousApproved = previousSteps.every(
          (s) =>
            s.status === StepStatus.APPROVED || s.status === StepStatus.SKIPPED,
        )

        if (!allPreviousApproved) {
          throw new GraphQLError(
            "Los pasos anteriores deben completarse antes de evaluar este.",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        // Generar signatureHash
        const signatureHash = generateSignatureHash(stepId, userId, "APPROVED")

        const result = await context.orm.$transaction(async (tx) => {
          // Aprobar el step
          const updatedStep = await tx.reviewStep.update({
            where: { id: stepId },
            data: {
              status: StepStatus.APPROVED,
              comments,
              completedAt: new Date(),
              signatureHash,
            },
            include: stepIncludes,
          })

          const transitions: WorkflowEventInput[] = [
            {
              name: WorkflowEvent.StepApproved,
              objectId: stepId,
              fromState: StepStatus.PENDING,
              toState: StepStatus.APPROVED,
              actorId: userId,
            },
          ]

          // Si no quedan pasos pendientes (excepto ACKNOWLEDGE), el workflow está completo
          if (completesWorkflow(step.workflow.steps, stepId)) {
            // Completar workflow
            await tx.reviewWorkflow.update({
              where: { id: step.workflow.id },
              data: {
                status: WorkflowStatus.COMPLETED,
                completedAt: new Date(),
              },
            })

            // Aprobar la revisión
            await tx.documentRevision.update({
              where: { id: step.workflow.revisionId },
              data: {
                status: RevisionStatus.APPROVED,
                approvedAt: new Date(),
                approvedById: userId,
                updatedById: userId,
              },
            })

            // Revisiones anteriores que quedarán SUPERSEDED: se identifican antes
            // de actualizarlas para poder emitir una transición por cada una.
            const supersededWhere = {
              documentId: step.workflow.revision.documentId,
              id: { not: step.workflow.revisionId },
              status: RevisionStatus.APPROVED,
            }
            const superseded = await tx.documentRevision.findMany({
              where: supersededWhere,
              select: { id: true },
            })

            // Marcar revisiones anteriores como SUPERSEDED
            await tx.documentRevision.updateMany({
              where: supersededWhere,
              data: {
                status: RevisionStatus.SUPERSEDED,
              },
            })

            transitions.push(
              {
                name: WorkflowEvent.WorkflowCompleted,
                objectId: step.workflow.id,
                fromState: step.workflow.status,
                toState: WorkflowStatus.COMPLETED,
                actorId: userId,
              },
              {
                name: WorkflowEvent.RevisionApproved,
                objectId: step.workflow.revisionId,
                fromState: RevisionStatus.IN_REVIEW,
                toState: RevisionStatus.APPROVED,
                actorId: userId,
              },
              ...superseded.map((r) => ({
                name: WorkflowEvent.RevisionSuperseded,
                objectId: r.id,
                fromState: RevisionStatus.APPROVED,
                toState: RevisionStatus.SUPERSEDED,
                actorId: userId,
              })),
            )
          }

          await emitAuditEvent(tx, {
            action: AuditAction.ApproveStep,
            objectId: stepId,
            actorId: userId,
            meta: { workflowId: step.workflow.id, comments: comments ?? null },
          })
          await emitWorkflowEvents(tx, transitions)

          return updatedStep
        })

        return result
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "APPROVE_STEP",
          messages: {
            notFound: "El paso de revisión no existe.",
            default: "Error al aprobar el paso de revisión.",
          },
        })
      }
    },

    rejectStep: async (
      _: any,
      { stepId, comments }: { stepId: number; comments: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_UPDATE],
        context,
      })
      logger.info("rejectStep", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.REVIEW_STEP,
        objectId: stepId,
        context,
        notFoundMessage: "Paso no encontrado",
      })

      try {
        const step = await context.orm.reviewStep.findFirst({
          where: { id: stepId },
          include: {
            workflow: {
              include: {
                steps: {
                  orderBy: { stepOrder: "asc" },
                },
              },
            },
          },
        })

        if (!step) {
          throw new GraphQLError("Paso de revisión no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (step.status !== StepStatus.PENDING) {
          throw new GraphQLError("Este paso ya fue evaluado.", {
            extensions: { code: "BAD_REQUEST" },
          })
        }

        const signatureHash = generateSignatureHash(stepId, userId, "REJECTED")

        const skipped = stepsSkippedByRejection(step.workflow.steps, step.stepOrder)

        const result = await context.orm.$transaction(async (tx) => {
          // Rechazar el step
          const updatedStep = await tx.reviewStep.update({
            where: { id: stepId },
            data: {
              status: StepStatus.REJECTED,
              comments,
              completedAt: new Date(),
              signatureHash,
            },
            include: stepIncludes,
          })

          // Marcar steps posteriores como SKIPPED
          await tx.reviewStep.updateMany({
            where: {
              workflowId: step.workflow.id,
              stepOrder: { gt: step.stepOrder },
              status: StepStatus.PENDING,
            },
            data: {
              status: StepStatus.SKIPPED,
            },
          })

          // Rechazar workflow
          await tx.reviewWorkflow.update({
            where: { id: step.workflow.id },
            data: {
              status: WorkflowStatus.REJECTED,
              completedAt: new Date(),
            },
          })

          // Volver la revisión a DRAFT
          await tx.documentRevision.update({
            where: { id: step.workflow.revisionId },
            data: {
              status: RevisionStatus.DRAFT,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.RejectStep,
            objectId: stepId,
            actorId: userId,
            meta: { workflowId: step.workflow.id, comments },
          })
          await emitWorkflowEvents(tx, [
            {
              name: WorkflowEvent.StepRejected,
              objectId: stepId,
              fromState: StepStatus.PENDING,
              toState: StepStatus.REJECTED,
              actorId: userId,
            },
            ...skipped.map((s) => ({
              name: WorkflowEvent.StepSkipped,
              objectId: s.id,
              fromState: StepStatus.PENDING,
              toState: StepStatus.SKIPPED,
              actorId: userId,
            })),
            {
              name: WorkflowEvent.WorkflowRejected,
              objectId: step.workflow.id,
              fromState: step.workflow.status,
              toState: WorkflowStatus.REJECTED,
              actorId: userId,
            },
            {
              name: WorkflowEvent.RevisionReturned,
              objectId: step.workflow.revisionId,
              fromState: RevisionStatus.IN_REVIEW,
              toState: RevisionStatus.DRAFT,
              actorId: userId,
            },
          ])

          return updatedStep
        })

        return result
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "REJECT_STEP",
          messages: {
            notFound: "El paso de revisión no existe.",
            default: "Error al rechazar el paso de revisión.",
          },
        })
      }
    },

    cancelWorkflow: async (
      _: any,
      { workflowId, reason }: { workflowId: number; reason: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_CREATE],
        context,
      })
      logger.info("cancelWorkflow", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.REVIEW_WORKFLOW,
        objectId: workflowId,
        context,
        notFoundMessage: "Workflow no encontrado",
      })

      try {
        const workflow = await context.orm.reviewWorkflow.findFirst({
          where: { id: workflowId },
          include: {
            steps: true,
          },
        })

        if (!workflow) {
          throw new GraphQLError("Workflow no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (
          workflow.status === WorkflowStatus.COMPLETED ||
          workflow.status === WorkflowStatus.REJECTED
        ) {
          throw new GraphQLError(
            "No se puede cancelar un workflow que ya fue completado o rechazado.",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const skipped = stepsSkippedByCancellation(workflow.steps)

        const result = await context.orm.$transaction(async (tx) => {
          // Marcar steps pendientes como SKIPPED
          await tx.reviewStep.updateMany({
            where: {
              workflowId,
              status: StepStatus.PENDING,
            },
            data: {
              status: StepStatus.SKIPPED,
            },
          })

          // Cancelar workflow (rejected con razón)
          const updatedWorkflow = await tx.reviewWorkflow.update({
            where: { id: workflowId },
            data: {
              status: WorkflowStatus.REJECTED,
              completedAt: new Date(),
            },
            include: workflowIncludes,
          })

          // Volver la revisión a DRAFT
          await tx.documentRevision.update({
            where: { id: workflow.revisionId },
            data: {
              status: RevisionStatus.DRAFT,
              updatedById: userId,
            },
          })

          // La cancelación no tiene estado propio: se registra como rechazo del
          // workflow, y el motivo queda en la acción de auditoría (H-05, D-17).
          await emitAuditEvent(tx, {
            action: AuditAction.CancelWorkflow,
            objectId: workflowId,
            actorId: userId,
            meta: { revisionId: workflow.revisionId, reason },
          })
          await emitWorkflowEvents(tx, [
            ...skipped.map((s) => ({
              name: WorkflowEvent.StepSkipped,
              objectId: s.id,
              fromState: StepStatus.PENDING,
              toState: StepStatus.SKIPPED,
              actorId: userId,
            })),
            {
              name: WorkflowEvent.WorkflowRejected,
              objectId: workflowId,
              fromState: workflow.status,
              toState: WorkflowStatus.REJECTED,
              actorId: userId,
            },
            {
              name: WorkflowEvent.RevisionReturned,
              objectId: workflow.revisionId,
              fromState: RevisionStatus.IN_REVIEW,
              toState: RevisionStatus.DRAFT,
              actorId: userId,
            },
          ])

          return updatedWorkflow
        })

        return result
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CANCEL_WORKFLOW",
          messages: {
            notFound: "El workflow no existe.",
            default: "Error al cancelar el workflow.",
          },
        })
      }
    },
  },
}
