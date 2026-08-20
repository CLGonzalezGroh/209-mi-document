import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import {
  holdsPermission,
  userAuthorization,
} from "../utils/userAuthorization.js"
import {
  assertObjectAccess,
  projectScopeAuthorization,
} from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import type { Prisma } from "../generated/prisma/client.js"
import {
  DocFileRole,
  DocObjectType,
  DocumentRole,
  QualificationEffect,
  RevisionStatus,
  WorkflowStatus,
  StepStatus,
  StepType,
} from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { assertIssued } from "../utils/itemResponse.js"
import { resolveScope } from "../utils/qualifications.js"
import {
  assertOutcomeMatches,
  assertQualificationRequirement,
  concludesRevision,
  terminalStatusFor,
} from "../utils/receiverCircuit.js"
import {
  emitAuditEvent,
  emitWorkflowEvents,
  type WorkflowEventInput,
} from "../events/emit.js"
import {
  completesWorkflow,
  currentStep,
  favorableStatusFor,
  isDecidingStep,
  isReassignable,
  stepsSkippedByCancellation,
  stepsSkippedByRejection,
} from "../utils/reviewWorkflow.js"
import {
  buildSignature,
  signsStep,
  type SignatureAction,
} from "../utils/stepSignature.js"
import {
  initialSteps,
  materializeSteps,
  stepsForRejectionRetry,
} from "../utils/workflowTemplate.js"
import { projectDefaults } from "../utils/revisionSetup.js"

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
  signature: true,
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

/** Todo lo que una resolución de paso necesita leer, en una sola consulta. */
const stepContext = {
  signature: true,
  workflow: {
    include: {
      steps: { orderBy: { stepOrder: "asc" as const } },
      revision: {
        include: {
          document: true,
          versions: {
            include: { files: { orderBy: { fileKey: "asc" as const } } },
            orderBy: { versionNumber: "desc" as const },
            take: 1,
          },
        },
      },
    },
  },
}

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("workflows")

type LoadedStep = Prisma.ReviewStepGetPayload<{ include: typeof stepContext }>

const loadStep = async (context: ResolverContext, stepId: number) => {
  const step = await context.orm.reviewStep.findFirst({
    where: { id: stepId },
    include: stepContext,
  })

  if (!step) {
    throw new GraphQLError("Paso de revisión no encontrado", {
      extensions: { code: "NOT_FOUND" },
    })
  }
  return step
}

/**
 * Quién resuelve efectivamente el paso (BLOQUE 03, B9).
 *
 * Cierra H-03, donde nadie verificaba que el actor fuera el asignado. Resolver
 * el paso de otro exige el permiso especial **y motivo**: es lo que vuelve la
 * delegación trazable y no solo permitida.
 *
 * La divergencia entre asignado y quien resolvió se DERIVA de los dos campos;
 * no se guarda un indicador que pueda contradecirlos.
 */
const resolveActor = async (
  step: { assignedToId: number },
  userId: number,
  context: ResolverContext,
  delegationReason: string | undefined,
): Promise<{ resolvedById: number; delegationReason: string | null }> => {
  if (step.assignedToId === userId) {
    return { resolvedById: userId, delegationReason: null }
  }

  const esAdmin = await holdsPermission({
    permission: PERMISSIONS.DOCUMENTS_WORKFLOW_ADMIN_UPDATE,
    context,
  })

  if (!esAdmin) {
    throw new GraphQLError(
      "El paso lo resuelve quien lo tiene asignado. Actuar por otro exige el permiso de administración del circuito.",
      { extensions: { code: "FORBIDDEN" } },
    )
  }

  if (!delegationReason?.trim()) {
    throw new GraphQLError(
      "Resolver el paso de otra persona exige indicar el motivo.",
      { extensions: { code: "BAD_USER_INPUT" } },
    )
  }

  return { resolvedById: userId, delegationReason: delegationReason.trim() }
}

/** El turno del circuito: todos los anteriores deben estar resueltos. */
const assertTurn = (step: LoadedStep) => {
  if (step.status !== StepStatus.PENDING) {
    throw new GraphQLError("Este paso ya fue resuelto.", {
      extensions: { code: "BAD_REQUEST" },
    })
  }

  const vigente = currentStep(step.workflow.steps)
  if (vigente?.id !== step.id) {
    throw new GraphQLError(
      "Los pasos anteriores deben resolverse antes que este.",
      { extensions: { code: "BAD_REQUEST" } },
    )
  }
}

/**
 * Resolver un paso exige NO tener copia de trabajo abierta (BLOQUE 03B, B12).
 *
 * Declarar que se terminó mientras una iteración sigue abierta es una
 * contradicción, y evita además que una revisión llegue a aprobarse con trabajo
 * colgando —lo que dejaría a la firma acreditando una versión que el autor
 * todavía estaba corrigiendo—.
 */
const assertNoOpenWorkingCopy = async (
  context: ResolverContext,
  revisionId: number,
) => {
  const abierta = await context.orm.docWorkingCopy.findFirst({
    where: { revisionId, confirmedAt: null, discardedAt: null },
    select: { id: true },
  })

  if (abierta) {
    throw new GraphQLError(
      "La revisión tiene una copia de trabajo abierta. Confírmela o descártela antes de resolver el paso.",
      { extensions: { code: "CONFLICT" } },
    )
  }
}

/**
 * Persiste la firma del paso (BLOQUE 03, B7).
 *
 * Firman los pasos que actúan sobre una versión. `ASSIGN` no: al completarse
 * puede no existir todavía ninguna versión, de modo que no habría objeto que
 * acreditar, y su evidencia es el evento de auditoría.
 */
const persistSignature = async (
  tx: Prisma.TransactionClient,
  {
    step,
    action,
    resolvedById,
    delegationReason,
    signedAt,
  }: {
    step: LoadedStep
    action: SignatureAction
    resolvedById: number
    delegationReason: string | null
    signedAt: Date
  },
) => {
  if (!signsStep(step.stepType)) return

  const version = step.workflow.revision.versions[0]
  if (!version) {
    throw new GraphQLError(
      "No se puede firmar: la revisión no tiene ninguna versión que acreditar.",
      { extensions: { code: "BAD_REQUEST" } },
    )
  }

  // El entregable es lo que se revisa y se marca (BLOQUE 03B, B7). La fase D
  // lleva el payload a v2 con la LISTA completa de archivos; hasta entonces
  // acredita el primer entregable, que es exactamente lo que acreditaba cuando
  // la versión era un archivo.
  const deliverable =
    version.files.find((f) => f.role === DocFileRole.DELIVERABLE) ??
    version.files[0]
  if (!deliverable) {
    throw new GraphQLError(
      "No se puede firmar: la versión vigente no tiene ningún archivo.",
      { extensions: { code: "BAD_REQUEST" } },
    )
  }

  const revision = step.workflow.revision
  const document = revision.document
  const signature = buildSignature({
    step: {
      id: step.id,
      stepType: step.stepType,
      stepOrder: step.stepOrder,
    },
    workflowId: step.workflowId,
    // La identificación viaja con la REVISIÓN, que es donde vive (BLOQUE 03B,
    // B1). El documento aporta lo suyo: su identidad, que no cambia (B3).
    revision: {
      id: revision.id,
      revisionCode: revision.revisionCode,
      title: revision.title,
      documentClassId: revision.documentClassId,
      documentTypeId: revision.documentTypeId,
    },
    // El conjunto COMPLETO, incluida la fuente que nadie revisó: que hayan sido
    // firmados juntos es lo que sostiene su correspondencia (B8).
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      files: version.files.map((f) => ({
        role: f.role,
        fileKey: f.fileKey,
        fileName: f.fileName,
        checksum: f.checksum,
      })),
    },
    document: {
      id: document.id,
      code: document.code,
    },
    assignedToId: step.assignedToId,
    resolvedById,
    delegationReason,
    action,
    signedAt,
  })

  await tx.docStepSignature.create({
    data: {
      stepId: step.id,
      algorithm: signature.algorithm,
      payload: signature.payload,
      hash: signature.hash,
      createdById: resolvedById,
    },
  })
}

/**
 * Rol documental del proyecto al que pertenece la revisión (BLOQUE 04, B12).
 *
 * Es lo único que el circuito necesita saber del rol: si su conclusión devuelve
 * el trabajo o cierra la revisión. Un proyecto sin rol declarado no puede tener
 * documentos con contraparte, de modo que se trata como Interno — el caso en que
 * el ciclo termina al aprobar.
 */
const roleOfRevision = async (
  context: ResolverContext,
  revisionId: number,
): Promise<DocumentRole> => {
  const revision = await context.orm.documentRevision.findUniqueOrThrow({
    where: { id: revisionId },
    select: { document: { select: { docProjectId: true } } },
  })

  if (revision.document.docProjectId === null) return DocumentRole.INTERNAL

  const settings = await context.orm.docProject.findUnique({
    where: { id: revision.document.docProjectId },
    select: { documentRole: true },
  })

  return settings?.documentRole ?? DocumentRole.INTERNAL
}

/**
 * Datos que la calificación necesita para registrarse como respuesta.
 *
 * Se resuelven ANTES de abrir la transacción, con las mismas dos validaciones
 * que la vía transcripta: que la calificación pertenezca al catálogo vigente del
 * proyecto (B11) y que el documento haya llegado por un ítem de transmittal
 * —sin emisión no hay nada que responder—.
 */
const prepareQualification = async (
  context: ResolverContext,
  revisionId: number,
  qualificationId: number,
  apruebaElPaso: boolean,
): Promise<{
  itemId: number
  qualificationId: number
  effect: QualificationEffect
}> => {
  const item = await context.orm.transmittalItem.findFirst({
    where: { documentRevisionId: revisionId },
    select: {
      id: true,
      transmittal: { select: { docProjectId: true, status: true } },
    },
  })

  if (!item) {
    throw new GraphQLError(
      "Este documento no llegó por un transmittal: no hay emisión que calificar",
      { extensions: { code: "BAD_REQUEST" } },
    )
  }

  assertIssued(item.transmittal.status)

  const catalogo = await context.orm.docQualification.findMany({
    where: {
      OR: [{ docProjectId: item.transmittal.docProjectId }, { docProjectId: null }],
    },
    select: { id: true, docProjectId: true, terminatedAt: true, effect: true },
  })

  const elegida = resolveScope(catalogo, item.transmittal.docProjectId)
    .filter((q) => q.terminatedAt === null)
    .find((q) => q.id === qualificationId)

  if (!elegida) {
    throw new GraphQLError(
      "Esa calificación no pertenece al catálogo vigente del proyecto",
      { extensions: { code: "BAD_USER_INPUT" } },
    )
  }

  // El desenlace del paso se DERIVA del efecto (D-22), y por eso la operación
  // elegida tiene que coincidir con él: sin esta verificación el circuito podría
  // quedar diciendo lo contrario que la respuesta que la contraparte lee.
  assertOutcomeMatches(elegida.effect, apruebaElPaso)

  return { itemId: item.id, qualificationId, effect: elegida.effect }
}

/**
 * Registra la calificación como respuesta del ítem, dentro de la transacción que
 * resuelve el paso.
 *
 * En modo Receptor la calificación la **produce el circuito** en lugar de
 * transcribirla el control documental, pero queda en el mismo lugar: el ítem por
 * el que el documento llegó. Es lo que la vuelve legible por el contratista.
 *
 * `respondedBy` va vacío a propósito: quien responde es la planta, que sí es
 * usuaria del sistema, de modo que la autoría la da `registeredById` y la
 * divergencia derivada es correctamente falsa.
 */
const registrarCalificacion = async (
  tx: Prisma.TransactionClient,
  respuesta: { itemId: number; qualificationId: number },
  userId: number,
  comments: string | undefined,
): Promise<void> => {
  await tx.docTransmittalResponse.create({
    data: {
      transmittalItemId: respuesta.itemId,
      qualificationId: respuesta.qualificationId,
      comments,
      respondedAt: new Date(),
      registeredById: userId,
      updatedById: userId,
    },
  })
}

export const workflowResolvers = {
  Query: {
    /**
     * Bandeja de trabajo del usuario (BLOQUE 03, B9 y B10).
     *
     * Devuelve los pasos del **usuario autenticado** (H-07). El argumento es
     * opcional: informado y distinto, exige el permiso especial. Sigue acotado
     * por membresía —el permiso habilita ver pendientes ajenos, no proyectos
     * ajenos— y las dos capas se acumulan.
     */
    pendingReviewSteps: async (
      _: any,
      { userId: targetUserId }: { userId?: number },
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

      if (targetUserId !== undefined && targetUserId !== userId) {
        const esAdmin = await holdsPermission({
          permission: PERMISSIONS.DOCUMENTS_WORKFLOW_ADMIN_UPDATE,
          context,
        })
        if (!esAdmin) {
          throw new GraphQLError(
            "Consultar los pendientes de otra persona exige el permiso de administración del circuito.",
            { extensions: { code: "FORBIDDEN" } },
          )
        }
      }

      try {
        const steps = await context.orm.reviewStep.findMany({
          where: {
            assignedToId: targetUserId ?? userId,
            status: StepStatus.PENDING,
            // NO se filtra por estado del circuito, y es deliberado (B10): los
            // acuses viven en circuitos ya cerrados, que es exactamente el
            // conjunto que la versión anterior excluía —la razón por la que
            // quedaban pendientes para siempre (H-04)—. El rechazo y la
            // cancelación dejan sus pasos en SKIPPED, de modo que el estado del
            // paso ya alcanza para no listar circuitos muertos.
            workflow: { revision: { document: scope } },
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
    /**
     * Completa el armado (BLOQUE 03, B1 y B3).
     *
     * Es la primera mitad de lo que era `initiateReview`: designa al elaborador
     * y a los revisores, y **materializa los pasos siguientes**, que hasta acá
     * no existían porque no tenían actor.
     *
     * Desde que se completa, la estructura del circuito es inmutable (B9): no se
     * agregan, quitan ni reordenan pasos. Lo único editable es el actor, y
     * corregir la estructura exige cancelar y rearmar (B11).
     */
    defineWorkflow: async (
      _: any,
      {
        workflowId,
        input,
      }: {
        workflowId: number
        input: {
          preparerId?: number
          steps: Array<{
            stepOrder: number
            stepType: StepType
            assignedToId: number
          }>
          delegationReason?: string
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_CREATE],
        context,
      })
      logger.info("defineWorkflow", { userId })

      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.REVIEW_WORKFLOW,
        objectId: workflowId,
        context,
        notFoundMessage: "Circuito no encontrado",
      })

      const workflow = await context.orm.reviewWorkflow.findFirst({
        where: { id: workflowId },
        include: {
          steps: { orderBy: { stepOrder: "asc" } },
          revision: { include: { document: true } },
        },
      })

      if (!workflow) {
        throw new GraphQLError("Circuito no encontrado", {
          extensions: { code: "NOT_FOUND" },
        })
      }

      const armado = workflow.steps.find(
        (s) => s.stepType === StepType.ASSIGN && s.status === StepStatus.PENDING,
      )

      if (!armado || workflow.status !== WorkflowStatus.IN_PROGRESS) {
        throw new GraphQLError(
          "El circuito ya fue armado. Corregir su estructura exige cancelarlo y rearmarlo.",
          { extensions: { code: "CONFLICT" } },
        )
      }

      const actor = await resolveActor(
        armado,
        userId,
        context,
        input.delegationReason,
      )

      try {
        const result = await context.orm.$transaction(async (tx) => {
          // El rol del proyecto decide si hay paso de elaboración: en Receptor
          // no lo hay, porque el documento llega ya elaborado desde afuera (B16).
          const { documentRole } = await projectDefaults(
            tx,
            workflow.revision.document.docProjectId,
          )

          const materialized = materializeSteps(
            {
              preparerId: input.preparerId ?? null,
              steps: input.steps,
            },
            { role: documentRole },
          )

          if (!materialized.ok) {
            throw new GraphQLError(MATERIALIZATION_MESSAGE[materialized.reason], {
              extensions: { code: "BAD_USER_INPUT" },
            })
          }

          await tx.reviewStep.createMany({
            data: materialized.steps.map((s) => ({
              workflowId,
              stepOrder: s.stepOrder,
              stepType: s.stepType,
              assignedToId: s.assignedToId,
              status: StepStatus.PENDING,
            })),
          })

          // El armado se CUMPLE, no se aprueba (B8), y no firma (B7).
          await tx.reviewStep.update({
            where: { id: armado.id },
            data: {
              status: StepStatus.COMPLETED,
              completedAt: new Date(),
              resolvedById: actor.resolvedById,
              delegationReason: actor.delegationReason,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.DefineWorkflow,
            objectId: armado.id,
            actorId: userId,
            meta: {
              workflowId,
              revisionId: workflow.revisionId,
              preparerId: input.preparerId ?? null,
              stepsCount: materialized.steps.length,
              onBehalfOf: actor.delegationReason
                ? armado.assignedToId
                : null,
            },
          })
          const transiciones: WorkflowEventInput[] = [
            {
              name: WorkflowEvent.StepCompleted,
              objectId: armado.id,
              fromState: StepStatus.PENDING,
              toState: StepStatus.COMPLETED,
              actorId: userId,
            },
          ]

          // En modo Receptor **armar es confirmar la recepción** (BLOQUE 04,
          // B12): el documento llegó elaborado desde afuera, no hay paso de
          // elaboración que completar, y por lo tanto tampoco hay someter. La
          // revisión queda en revisión en el mismo acto.
          //
          // Sin esto, la revisión quedaría en borrador con un circuito armado y
          // ninguna operación capaz de moverla: `submitRevision` completa un
          // paso que en este rol no existe.
          if (concludesRevision(documentRole)) {
            await tx.documentRevision.update({
              where: { id: workflow.revisionId },
              data: { status: RevisionStatus.IN_REVIEW, updatedById: userId },
            })
            transiciones.push({
              name: WorkflowEvent.RevisionSubmitted,
              objectId: workflow.revisionId,
              fromState: RevisionStatus.DRAFT,
              toState: RevisionStatus.IN_REVIEW,
              actorId: userId,
            })
          }

          await emitWorkflowEvents(tx, transiciones)

          return tx.reviewWorkflow.findFirst({
            where: { id: workflowId },
            include: workflowIncludes,
          })
        })

        return result
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DEFINE_WORKFLOW",
          messages: {
            notFound: "El circuito no existe.",
            default: "Error al definir el circuito.",
          },
        })
      }
    },

    /**
     * Completa la elaboración y somete la revisión (BLOQUE 03, B1).
     *
     * Es la segunda mitad de `initiateReview`. Someter dejó de ser "crear el
     * circuito" y pasó a ser "completar el paso de elaboración", que es lo que
     * efectivamente ocurre.
     *
     * **Exige al menos una versión con checksum**: es la precondición que
     * reemplaza a la del alta, ahora que el documento nace sin archivo (H-20).
     */
    submitRevision: async (
      _: any,
      {
        revisionId,
        comments,
        delegationReason,
      }: { revisionId: number; comments?: string; delegationReason?: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_UPDATE],
        context,
      })
      logger.info("submitRevision", { userId })

      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: revisionId,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      const revision = await context.orm.documentRevision.findFirst({
        where: { id: revisionId },
        include: {
          versions: { select: { id: true } },
          workflows: {
            where: { status: WorkflowStatus.IN_PROGRESS },
            include: { steps: { orderBy: { stepOrder: "asc" } } },
          },
        },
      })

      if (!revision) {
        throw new GraphQLError("Revisión no encontrada", {
          extensions: { code: "NOT_FOUND" },
        })
      }

      const abierto = revision.workflows[0]
      const vigente = abierto ? currentStep(abierto.steps) : null

      // Someter es declarar que la elaboración terminó (BLOQUE 03B, B12)
      await assertNoOpenWorkingCopy(context, revisionId)

      if (!vigente || vigente.stepType !== StepType.PREPARE) {
        throw new GraphQLError(
          "Solo se somete una revisión cuyo paso en curso es la elaboración.",
          { extensions: { code: "BAD_REQUEST" } },
        )
      }

      if (revision.versions.length === 0) {
        throw new GraphQLError(
          "Someter exige al menos una versión: es lo que se pone a revisión.",
          { extensions: { code: "BAD_REQUEST" } },
        )
      }

      const step = await loadStep(context, vigente.id)
      const actor = await resolveActor(step, userId, context, delegationReason)

      try {
        const result = await context.orm.$transaction(async (tx) => {
          const now = new Date()

          const updated = await tx.reviewStep.update({
            where: { id: step.id },
            data: {
              // La elaboración se CUMPLE, no se aprueba (B8), pero SÍ firma:
              // quien elabora firma lo que entrega (B7).
              status: StepStatus.COMPLETED,
              comments,
              completedAt: now,
              resolvedById: actor.resolvedById,
              delegationReason: actor.delegationReason,
            },
            include: stepIncludes,
          })

          await persistSignature(tx, {
            step,
            action: StepStatus.COMPLETED,
            resolvedById: actor.resolvedById,
            delegationReason: actor.delegationReason,
            signedAt: now,
          })

          await tx.documentRevision.update({
            where: { id: revisionId },
            data: { status: RevisionStatus.IN_REVIEW, updatedById: userId },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.SubmitRevision,
            objectId: step.id,
            actorId: userId,
            meta: {
              revisionId,
              workflowId: abierto.id,
              versions: revision.versions.length,
            },
          })
          await emitWorkflowEvents(tx, [
            {
              name: WorkflowEvent.StepCompleted,
              objectId: step.id,
              fromState: StepStatus.PENDING,
              toState: StepStatus.COMPLETED,
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

          return updated
        })

        return result
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "SUBMIT_REVISION",
          messages: {
            notFound: "La revisión no existe.",
            default: "Error al someter la revisión.",
          },
        })
      }
    },

    /**
     * Aprueba un paso que decide (BLOQUE 03, B7 y B8).
     *
     * Solo `REVIEW` y `APPROVE`: los que se cumplen tienen operación propia
     * —`defineWorkflow`, `submitRevision` y `acknowledgeStep`—, porque aprobar
     * un armado no es lo que ocurre.
     */
    approveStep: async (
      _: any,
      {
        stepId,
        comments,
        delegationReason,
        qualificationId,
      }: {
        stepId: number
        comments?: string
        delegationReason?: string
        qualificationId?: number
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_UPDATE],
        context,
      })
      logger.info("approveStep", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio
      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.REVIEW_STEP,
        objectId: stepId,
        context,
        notFoundMessage: "Paso no encontrado",
      })

      const step = await loadStep(context, stepId)

      if (!isDecidingStep(step.stepType)) {
        throw new GraphQLError(
          "Este paso se cumple, no se aprueba: tiene su propia operación.",
          { extensions: { code: "BAD_REQUEST" } },
        )
      }

      assertTurn(step)
      await assertNoOpenWorkingCopy(context, step.workflow.revisionId)
      const actor = await resolveActor(step, userId, context, delegationReason)

      // La calificación es la CONCLUSIÓN del circuito en modo Receptor (B12):
      // se exige cuando esta aprobación lo cierra, y se prohíbe fuera de ese rol.
      const cierra = completesWorkflow(step.workflow.steps, stepId)
      const rol = await roleOfRevision(context, step.workflow.revisionId)
      assertQualificationRequirement(rol, cierra, qualificationId)

      const respuesta = qualificationId
        ? await prepareQualification(
            context,
            step.workflow.revisionId,
            qualificationId,
            true,
          )
        : null

      try {
        const result = await context.orm.$transaction(async (tx) => {
          const now = new Date()

          const updatedStep = await tx.reviewStep.update({
            where: { id: stepId },
            data: {
              status: favorableStatusFor(step.stepType),
              comments,
              completedAt: now,
              resolvedById: actor.resolvedById,
              delegationReason: actor.delegationReason,
            },
            include: stepIncludes,
          })

          await persistSignature(tx, {
            step,
            action: StepStatus.APPROVED,
            resolvedById: actor.resolvedById,
            delegationReason: actor.delegationReason,
            signedAt: now,
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

          // El circuito cierra con los pasos que DECIDEN. Los acuses se
          // resuelven después, con operación propia (B10).
          if (cierra) {
            // En modo Receptor la conclusión del circuito ES la respuesta de la
            // planta: se registra sobre el ítem por el que ese documento llegó,
            // que es el único lugar donde los dos modos la leen igual (B5).
            if (respuesta) {
              await registrarCalificacion(tx, respuesta, userId, comments)
            }

            await tx.reviewWorkflow.update({
              where: { id: step.workflowId },
              data: { status: WorkflowStatus.COMPLETED, completedAt: now },
            })

            await tx.documentRevision.update({
              where: { id: step.workflow.revisionId },
              data: {
                status: RevisionStatus.APPROVED,
                approvedAt: now,
                approvedById: userId,
                updatedById: userId,
              },
            })

            // Revisiones anteriores que quedarán SUPERSEDED: se identifican
            // antes de actualizarlas para emitir una transición por cada una.
            const supersededWhere = {
              documentId: step.workflow.revision.documentId,
              id: { not: step.workflow.revisionId },
              status: RevisionStatus.APPROVED,
            }
            const superseded = await tx.documentRevision.findMany({
              where: supersededWhere,
              select: { id: true },
            })

            await tx.documentRevision.updateMany({
              where: supersededWhere,
              data: { status: RevisionStatus.SUPERSEDED },
            })

            transitions.push(
              {
                name: WorkflowEvent.WorkflowCompleted,
                objectId: step.workflowId,
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
            meta: {
              workflowId: step.workflowId,
              comments: comments ?? null,
              onBehalfOf: actor.delegationReason ? step.assignedToId : null,
            },
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

    /**
     * Rechaza un paso y **reinstancia el circuito desde la elaboración**
     * (BLOQUE 03, B1). Es lo que cierra H-01: el documento rechazado tiene
     * salida sin consumir una revisión nueva.
     *
     * El elenco se **copia y no se referencia**: reasignar un paso del circuito
     * nuevo no debe alterar la historia del anterior.
     */
    rejectStep: async (
      _: any,
      {
        stepId,
        comments,
        delegationReason,
        qualificationId,
      }: {
        stepId: number
        comments: string
        delegationReason?: string
        qualificationId?: number
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_UPDATE],
        context,
      })
      logger.info("rejectStep", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio
      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.REVIEW_STEP,
        objectId: stepId,
        context,
        notFoundMessage: "Paso no encontrado",
      })

      const step = await loadStep(context, stepId)

      if (!isDecidingStep(step.stepType)) {
        throw new GraphQLError(
          "Solo los pasos de revisión y aprobación pueden rechazar.",
          { extensions: { code: "BAD_REQUEST" } },
        )
      }

      assertTurn(step)
      await assertNoOpenWorkingCopy(context, step.workflow.revisionId)
      const actor = await resolveActor(step, userId, context, delegationReason)

      // Un rechazo SIEMPRE concluye el circuito, de modo que en modo Receptor
      // siempre lleva calificación (B12).
      const rol = await roleOfRevision(context, step.workflow.revisionId)
      assertQualificationRequirement(rol, true, qualificationId)

      const respuesta = qualificationId
        ? await prepareQualification(
            context,
            step.workflow.revisionId,
            qualificationId,
            false,
          )
        : null

      // En modo Receptor el rechazo CONCLUYE la revisión en lugar de devolverla:
      // el elaborador está afuera y no hay a quién devolverle el trabajo (B12).
      const concluye = concludesRevision(rol)

      try {
        const result = await context.orm.$transaction(async (tx) => {
          const now = new Date()
          const skipped = stepsSkippedByRejection(
            step.workflow.steps,
            step.stepOrder,
          )

          const updatedStep = await tx.reviewStep.update({
            where: { id: stepId },
            data: {
              status: StepStatus.REJECTED,
              comments,
              completedAt: now,
              resolvedById: actor.resolvedById,
              delegationReason: actor.delegationReason,
            },
            include: stepIncludes,
          })

          // El rechazo firma igual que la aprobación —de hecho su evidencia
          // importa más, porque documenta qué se objetó (B7).
          await persistSignature(tx, {
            step,
            action: StepStatus.REJECTED,
            resolvedById: actor.resolvedById,
            delegationReason: actor.delegationReason,
            signedAt: now,
          })

          await tx.reviewStep.updateMany({
            where: {
              workflowId: step.workflowId,
              stepOrder: { gt: step.stepOrder },
              status: StepStatus.PENDING,
            },
            data: { status: StepStatus.SKIPPED },
          })

          await tx.reviewWorkflow.update({
            where: { id: step.workflowId },
            data: { status: WorkflowStatus.REJECTED, completedAt: now },
          })

          if (respuesta) {
            await registrarCalificacion(tx, respuesta, userId, comments)
          }

          await tx.documentRevision.update({
            where: { id: step.workflow.revisionId },
            data: {
              status: concluye ? terminalStatusFor(false) : RevisionStatus.DRAFT,
              updatedById: userId,
            },
          })

          // Circuito nuevo desde la elaboración, con el mismo elenco copiado.
          // El armado no se repite: el trabajo vuelve al elaborador sin rearmar
          // nada, que es el caso frecuente.
          //
          // En modo Receptor no hay circuito sucesor: la emisión siguiente llega
          // con revisión nueva, en un transmittal nuevo (D-10).
          const heredados = concluye
            ? []
            : stepsForRejectionRetry(step.workflow.steps)
          const nuevo = concluye
            ? null
            : await tx.reviewWorkflow.create({
            data: {
              revisionId: step.workflow.revisionId,
              status: WorkflowStatus.IN_PROGRESS,
              initiatedById: userId,
              templateId: step.workflow.templateId,
              steps: {
                create: heredados.map((s) => ({
                  stepOrder: s.stepOrder,
                  stepType: s.stepType,
                  assignedToId: s.assignedToId,
                  status: StepStatus.PENDING,
                })),
              },
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.RejectStep,
            objectId: stepId,
            actorId: userId,
            meta: {
              workflowId: step.workflowId,
              comments,
              retryWorkflowId: nuevo?.id ?? null,
              qualificationId: qualificationId ?? null,
              onBehalfOf: actor.delegationReason ? step.assignedToId : null,
            },
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
              objectId: step.workflowId,
              fromState: step.workflow.status,
              toState: WorkflowStatus.REJECTED,
              actorId: userId,
            },
            // La transición nombra lo que ocurrió: devolver el trabajo, o
            // concluir la revisión porque no hay a quién devolvérselo.
            {
              name: concluye
                ? WorkflowEvent.RevisionRejected
                : WorkflowEvent.RevisionReturned,
              objectId: step.workflow.revisionId,
              fromState: RevisionStatus.IN_REVIEW,
              toState: concluye ? RevisionStatus.REJECTED : RevisionStatus.DRAFT,
              actorId: userId,
            },
            ...(nuevo
              ? [
                  {
                    name: WorkflowEvent.WorkflowStarted,
                    objectId: nuevo.id,
                    toState: WorkflowStatus.IN_PROGRESS,
                    actorId: userId,
                  },
                ]
              : []),
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

    /**
     * Cierra un paso de toma de conocimiento (BLOQUE 03, B10).
     *
     * Se resuelve **después** de que el circuito cerró: el acuse comunica un
     * documento ya aprobado, de modo que bloquear la aprobación invertiría su
     * función y cerrarlo de oficio lo convertiría en un registro vacío.
     *
     * Sin permiso propio: es la resolución de un paso asignado, como aprobar.
     */
    acknowledgeStep: async (
      _: any,
      {
        stepId,
        comments,
        delegationReason,
      }: { stepId: number; comments?: string; delegationReason?: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_UPDATE],
        context,
      })
      logger.info("acknowledgeStep", { userId })

      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.REVIEW_STEP,
        objectId: stepId,
        context,
        notFoundMessage: "Paso no encontrado",
      })

      const step = await loadStep(context, stepId)

      if (step.stepType !== StepType.ACKNOWLEDGE) {
        throw new GraphQLError(
          "Esta operación cierra pasos de toma de conocimiento.",
          { extensions: { code: "BAD_REQUEST" } },
        )
      }

      if (step.status !== StepStatus.PENDING) {
        throw new GraphQLError("Este paso ya fue resuelto.", {
          extensions: { code: "BAD_REQUEST" },
        })
      }

      // No se exige turno: el acuse no compite con los pasos que deciden, y
      // precisamente por eso se resuelve cuando el circuito ya cerró.
      const actor = await resolveActor(step, userId, context, delegationReason)

      try {
        const result = await context.orm.$transaction(async (tx) => {
          const now = new Date()

          const updated = await tx.reviewStep.update({
            where: { id: stepId },
            data: {
              status: StepStatus.COMPLETED,
              comments,
              completedAt: now,
              resolvedById: actor.resolvedById,
              delegationReason: actor.delegationReason,
            },
            include: stepIncludes,
          })

          // Quien toma conocimiento firma lo que vio (B7).
          await persistSignature(tx, {
            step,
            action: StepStatus.COMPLETED,
            resolvedById: actor.resolvedById,
            delegationReason: actor.delegationReason,
            signedAt: now,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.AcknowledgeStep,
            objectId: stepId,
            actorId: userId,
            meta: {
              workflowId: step.workflowId,
              comments: comments ?? null,
              onBehalfOf: actor.delegationReason ? step.assignedToId : null,
            },
          })
          await emitWorkflowEvents(tx, [
            {
              name: WorkflowEvent.StepCompleted,
              objectId: stepId,
              fromState: StepStatus.PENDING,
              toState: StepStatus.COMPLETED,
              actorId: userId,
            },
          ])

          return updated
        })

        return result
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACKNOWLEDGE_STEP",
          messages: {
            notFound: "El paso de revisión no existe.",
            default: "Error al registrar la toma de conocimiento.",
          },
        })
      }
    },

    /**
     * Reasigna un paso pendiente (BLOQUE 03, B9).
     *
     * Convive con la firma delegada y resuelve otra cosa: la delegación resuelve
     * el **momento**, la reasignación la **conducción** —el revisor que no está,
     * o la redistribución de carga de trabajo—.
     *
     * **No altera el circuito**: cambia el actor, nunca el tipo del paso, su
     * orden ni cuántos son. Es acción de auditoría y no transición de estado,
     * porque el paso sigue `PENDING`: el historial de asignados queda en la
     * traza, sin columna nueva.
     */
    reassignStep: async (
      _: any,
      {
        stepId,
        assignedToId,
        reason,
      }: { stepId: number; assignedToId: number; reason: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_ADMIN_UPDATE],
        context,
      })
      logger.info("reassignStep", { userId })

      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.REVIEW_STEP,
        objectId: stepId,
        context,
        notFoundMessage: "Paso no encontrado",
      })

      if (!reason?.trim()) {
        throw new GraphQLError("Debe indicarse el motivo de la reasignación.", {
          extensions: { code: "BAD_USER_INPUT" },
        })
      }

      const step = await loadStep(context, stepId)

      if (!isReassignable(step.status)) {
        throw new GraphQLError(
          "Un paso resuelto no se reasigna: su firma acredita quién lo resolvió.",
          { extensions: { code: "BAD_REQUEST" } },
        )
      }

      if (step.assignedToId === assignedToId) {
        throw new GraphQLError("El paso ya está asignado a esa persona.", {
          extensions: { code: "BAD_USER_INPUT" },
        })
      }

      try {
        const result = await context.orm.$transaction(async (tx) => {
          const updated = await tx.reviewStep.update({
            where: { id: stepId },
            data: { assignedToId },
            include: stepIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.ReassignStep,
            objectId: stepId,
            actorId: userId,
            meta: {
              workflowId: step.workflowId,
              from: step.assignedToId,
              to: assignedToId,
              reason: reason.trim(),
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
          logName: "REASSIGN_STEP",
          messages: {
            notFound: "El paso de revisión no existe.",
            default: "Error al reasignar el paso.",
          },
        })
      }
    },

    /**
     * Cancela el circuito (BLOQUE 03, B11).
     *
     * Distinto de abandonar la revisión: acá **la revisión sobrevive**, vuelve a
     * `DRAFT` y se rearma desde el armado. Cubre lo que la reasignación no
     * alcanza —cómo está armado el circuito y qué se sometió—, porque los pasos
     * no se editan.
     *
     * Se cancela **en cualquier punto, aun con pasos ya firmados**: exigir que
     * ninguna firma exista obligaría a completar un circuito que ya se sabe
     * inútil, o a simular un rechazo que nadie emitió. El riesgo que motivaba la
     * restricción no se reabre porque nada se elimina: los pasos resueltos
     * conservan su estado y su firma.
     */
    cancelWorkflow: async (
      _: any,
      { workflowId, reason }: { workflowId: number; reason: string },
      context: ResolverContext,
    ) => {
      // Pasa de WORKFLOW_CREATE a WORKFLOW_UPDATE: es la parte de H-22 que este
      // bloque toca. Cancelar es resolver el circuito, no crear uno.
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_UPDATE],
        context,
      })
      logger.info("cancelWorkflow", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio
      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.REVIEW_WORKFLOW,
        objectId: workflowId,
        context,
        notFoundMessage: "Circuito no encontrado",
      })

      if (!reason?.trim()) {
        throw new GraphQLError("Debe indicarse el motivo de la cancelación.", {
          extensions: { code: "BAD_USER_INPUT" },
        })
      }

      try {
        const result = await context.orm.$transaction(async (tx) => {
          const workflow = await tx.reviewWorkflow.findFirst({
            where: { id: workflowId },
            include: { steps: true, revision: true },
          })

          if (!workflow) {
            throw new GraphQLError("Circuito no encontrado", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          if (workflow.status !== WorkflowStatus.IN_PROGRESS) {
            throw new GraphQLError(
              "Solo se cancela un circuito abierto.",
              { extensions: { code: "BAD_REQUEST" } },
            )
          }

          const now = new Date()
          const skipped = stepsSkippedByCancellation(workflow.steps)

          await tx.reviewStep.updateMany({
            where: { workflowId, status: StepStatus.PENDING },
            data: { status: StepStatus.SKIPPED },
          })

          // Estado propio, con el motivo EN EL MODELO y no en el meta de un
          // evento: es lo que vuelve la cancelación distinguible del rechazo
          // (H-05). Antes emitía la transición de rechazo.
          const updatedWorkflow = await tx.reviewWorkflow.update({
            where: { id: workflowId },
            data: {
              status: WorkflowStatus.CANCELLED,
              completedAt: now,
              cancelledAt: now,
              cancelledById: userId,
              cancelReason: reason.trim(),
            },
            include: workflowIncludes,
          })

          const volvioADraft =
            workflow.revision.status === RevisionStatus.IN_REVIEW

          if (volvioADraft) {
            await tx.documentRevision.update({
              where: { id: workflow.revisionId },
              data: { status: RevisionStatus.DRAFT, updatedById: userId },
            })
          }

          // La revisión sobrevive y se rearma desde el armado, con el armador
          // que la revisión designó. Cancelar es, precisamente, volver al armado.
          const nuevo = await tx.reviewWorkflow.create({
            data: {
              revisionId: workflow.revisionId,
              status: WorkflowStatus.IN_PROGRESS,
              initiatedById: userId,
              templateId: workflow.templateId,
              steps: {
                create: initialSteps(
                  workflow.revision.assignedOrganizerId,
                ).map((s) => ({ ...s, status: StepStatus.PENDING })),
              },
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CancelWorkflow,
            objectId: workflowId,
            actorId: userId,
            meta: {
              revisionId: workflow.revisionId,
              reason: reason.trim(),
              retryWorkflowId: nuevo.id,
            },
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
              name: WorkflowEvent.WorkflowCancelled,
              objectId: workflowId,
              fromState: workflow.status,
              toState: WorkflowStatus.CANCELLED,
              actorId: userId,
            },
            ...(volvioADraft
              ? [
                  {
                    name: WorkflowEvent.RevisionReturned,
                    objectId: workflow.revisionId,
                    fromState: RevisionStatus.IN_REVIEW,
                    toState: RevisionStatus.DRAFT,
                    actorId: userId,
                  },
                ]
              : []),
            {
              name: WorkflowEvent.WorkflowStarted,
              objectId: nuevo.id,
              toState: WorkflowStatus.IN_PROGRESS,
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
            notFound: "El circuito no existe.",
            default: "Error al cancelar el circuito.",
          },
        })
      }
    },
  },
}

/** Mensaje de cada motivo por el que un armado no se materializa (B3). */
const MATERIALIZATION_MESSAGE = {
  PREPARER_REQUIRED:
    "Debe designarse el elaborador: es el paso que produce el documento.",
  PREPARER_NOT_ALLOWED:
    "En el rol Receptor el documento llega ya elaborado y el circuito no tiene paso de elaboración.",
  STRUCTURAL_STEP_IN_TEMPLATE:
    "El armado y la elaboración los pone el sistema y no se declaran como pasos del circuito.",
  NO_DECIDING_STEP:
    "El circuito exige al menos un paso de revisión o de aprobación: sin ellos no tendría con qué completarse.",
  STEP_WITHOUT_ACTOR: "Todos los pasos del circuito deben quedar designados.",
} as const
