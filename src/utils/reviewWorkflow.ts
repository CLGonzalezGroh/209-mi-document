import { StepStatus, StepType } from "../generated/prisma/enums.js"

/**
 * Lógica del circuito de revisión, extraída del resolver para poder probarla
 * sin base de datos.
 *
 * Reproduce el comportamiento vigente sin modificarlo: el Bloque 01 sustituye el
 * registro, no las reglas. Las correcciones del ciclo corresponden a BLOCK_03.
 */

export type ReviewStepSnapshot = {
  id: number
  stepOrder: number
  stepType: StepType
  status: StepStatus
}

/**
 * Indica si aprobar `approvedStepId` completa el circuito.
 *
 * Los pasos de tipo `ACKNOWLEDGE` quedan excluidos del cálculo, de modo que el
 * workflow puede completarse con pasos de toma de conocimiento aún pendientes.
 * Es el comportamiento actual y la causa de H-04; se conserva tal cual.
 */
export const completesWorkflow = (
  steps: ReviewStepSnapshot[],
  approvedStepId: number,
): boolean => {
  const decisive = steps.filter((s) => s.stepType !== StepType.ACKNOWLEDGE)
  const approved = decisive.filter(
    (s) => s.id === approvedStepId || s.status === StepStatus.APPROVED,
  )
  return approved.length === decisive.length
}

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

/** Pasos que una cancelación deja en `SKIPPED`: todos los pendientes. */
export const stepsSkippedByCancellation = (
  steps: ReviewStepSnapshot[],
): ReviewStepSnapshot[] =>
  steps.filter((s) => s.status === StepStatus.PENDING)