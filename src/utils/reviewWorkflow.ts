import { StepStatus, StepType } from "../generated/prisma/enums.js"

/**
 * Lógica del circuito de revisión, extraída del resolver para poder probarla
 * sin base de datos.
 *
 * BLOQUE 03 corrige lo que BLOQUE 01 se limitó a reproducir. El circuito abarca
 * ahora el ciclo completo —armado, elaboración, revisión, aprobación y toma de
 * conocimiento (B1)— y la partición entre pasos que deciden y pasos que se
 * cumplen deja de vivir escondida dentro de `completesWorkflow` (B8).
 */

export type ReviewStepSnapshot = {
  id: number
  stepOrder: number
  stepType: StepType
  status: StepStatus
}

/**
 * Pasos que DECIDEN: son los únicos que pueden rechazar y los únicos que
 * cuentan para completar el circuito.
 */
export const DECIDING_STEP_TYPES: readonly StepType[] = [
  StepType.REVIEW,
  StepType.APPROVE,
]

/**
 * Pasos que SE CUMPLEN: no emiten juicio, de modo que su estado terminal es
 * COMPLETED. Dejarlos en APPROVED diría que alguien aprobó el armado.
 */
export const FULFILLING_STEP_TYPES: readonly StepType[] = [
  StepType.ASSIGN,
  StepType.PREPARE,
  StepType.ACKNOWLEDGE,
]

/** Si el paso emite juicio. Cumplir y juzgar son cosas distintas (B8). */
export const isDecidingStep = (stepType: StepType): boolean =>
  DECIDING_STEP_TYPES.includes(stepType)

/**
 * Estado terminal con que se resuelve favorablemente un paso de este tipo:
 * APPROVED para los que deciden, COMPLETED para los que se cumplen.
 */
export const favorableStatusFor = (stepType: StepType): StepStatus =>
  isDecidingStep(stepType) ? StepStatus.APPROVED : StepStatus.COMPLETED

/** Estados en que un paso ya fue resuelto y por lo tanto no se reasigna (B9). */
const RESOLVED_STATUSES: readonly StepStatus[] = [
  StepStatus.COMPLETED,
  StepStatus.APPROVED,
  StepStatus.REJECTED,
  StepStatus.SKIPPED,
]

/**
 * Si el paso admite reasignación (B9).
 *
 * Alcanza a los pendientes, incluido el vigente. Un paso resuelto no se
 * reasigna: su firma acredita quién lo resolvió, y reasignarlo la dejaría sin
 * correspondencia.
 */
export const isReassignable = (status: StepStatus): boolean =>
  !RESOLVED_STATUSES.includes(status)

/**
 * Indica si resolver `resolvedStepId` completa el circuito.
 *
 * **Cuentan solo los pasos que deciden**, por tipo y no por excepción. Los que
 * se cumplen quedan fuera del cálculo:
 *
 * - ASSIGN y PREPARE ya ocurrieron cuando el circuito llega a decidirse;
 * - ACKNOWLEDGE se resuelve DESPUÉS de que el circuito cierre (B10): el acuse
 *   comunica un documento ya aprobado, de modo que bloquear la aprobación
 *   invertiría su función.
 *
 * La diferencia con BLOQUE 01 no es el resultado para ACKNOWLEDGE, que ya
 * quedaba excluido, sino que ahora la regla está declarada y alcanza también a
 * los dos tipos nuevos.
 */
export const completesWorkflow = (
  steps: ReviewStepSnapshot[],
  resolvedStepId: number,
): boolean => {
  const deciding = steps.filter((s) => isDecidingStep(s.stepType))
  if (deciding.length === 0) return false

  const favorable = deciding.filter(
    (s) => s.id === resolvedStepId || s.status === StepStatus.APPROVED,
  )
  return favorable.length === deciding.length
}

/**
 * Paso vigente: el primero pendiente por orden.
 *
 * Es el que gobierna quién puede registrar una versión (B5) y cuál es el turno
 * del circuito. Nulo cuando no queda ninguno pendiente, que es lo que impide
 * agregar versiones a una revisión aprobada: sin paso vigente no hay quien las
 * produzca, y la firma dejaría de acreditar la última versión.
 */
export const currentStep = <T extends ReviewStepSnapshot>(
  steps: T[],
): T | null =>
  [...steps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .find((s) => s.status === StepStatus.PENDING) ?? null

/**
 * Pasos de toma de conocimiento todavía pendientes.
 *
 * Viven precisamente en circuitos ya cerrados, que es el conjunto que
 * `pendingReviewSteps` excluye hoy y la razón por la que quedan pendientes para
 * siempre (B10, H-04).
 */
export const pendingAcknowledgeSteps = (
  steps: ReviewStepSnapshot[],
): ReviewStepSnapshot[] =>
  steps.filter(
    (s) =>
      s.stepType === StepType.ACKNOWLEDGE && s.status === StepStatus.PENDING,
  )

/**
 * Pasos que un rechazo deja en `SKIPPED`: los posteriores al rechazado que
 * siguen pendientes.
 */
export const stepsSkippedByRejection = (
  steps: ReviewStepSnapshot[],
  rejectedStepOrder: number,
): ReviewStepSnapshot[] =>
  steps.filter(
    (s) => s.stepOrder > rejectedStepOrder && s.status === StepStatus.PENDING,
  )

/**
 * Pasos que una cancelación deja en `SKIPPED`: todos los pendientes.
 *
 * Los ya resueltos conservan su estado y su firma (B11): la cancelación se
 * admite en cualquier punto porque nada se elimina.
 */
export const stepsSkippedByCancellation = (
  steps: ReviewStepSnapshot[],
): ReviewStepSnapshot[] =>
  steps.filter((s) => s.status === StepStatus.PENDING)
