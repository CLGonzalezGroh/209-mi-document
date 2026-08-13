import assert from "node:assert/strict"
import test from "node:test"
import { StepStatus, StepType } from "../generated/prisma/enums.js"
import {
  completesWorkflow,
  favorableStatusFor,
  isDecidingStep,
  isReassignable,
  pendingAcknowledgeSteps,
  stepsSkippedByCancellation,
  stepsSkippedByRejection,
  type ReviewStepSnapshot,
} from "./reviewWorkflow.js"

const step = (
  id: number,
  stepOrder: number,
  status: StepStatus,
  stepType: StepType = StepType.REVIEW,
): ReviewStepSnapshot => ({ id, stepOrder, status, stepType })

test("un circuito de un solo paso se completa al aprobarlo", () => {
  const steps = [step(1, 1, StepStatus.PENDING)]

  assert.equal(completesWorkflow(steps, 1), true)
})

test("no se completa mientras queden pasos decisivos pendientes", () => {
  const steps = [
    step(1, 1, StepStatus.PENDING),
    step(2, 2, StepStatus.PENDING),
  ]

  assert.equal(completesWorkflow(steps, 1), false)
})

test("se completa al aprobar el último paso decisivo", () => {
  const steps = [
    step(1, 1, StepStatus.APPROVED),
    step(2, 2, StepStatus.PENDING),
  ]

  assert.equal(completesWorkflow(steps, 2), true)
})

test("los pasos de toma de conocimiento no impiden completar el circuito", () => {
  // Sigue sin impedirlo, pero ya no por omisión: el acuse comunica un documento
  // ya aprobado (B10), de modo que bloquear la aprobación invertiría su función.
  // Lo que cambia respecto de BLOQUE 01 es que ahora se resuelve después, con
  // operación propia y estado terminal, en lugar de quedar pendiente para siempre.
  const steps = [
    step(1, 1, StepStatus.PENDING),
    step(2, 2, StepStatus.PENDING, StepType.ACKNOWLEDGE),
  ]

  assert.equal(completesWorkflow(steps, 1), true)
})

// --- La partición de B8: pasos que deciden y pasos que se cumplen ---

test("solo REVIEW y APPROVE emiten juicio", () => {
  assert.equal(isDecidingStep(StepType.REVIEW), true)
  assert.equal(isDecidingStep(StepType.APPROVE), true)
  assert.equal(isDecidingStep(StepType.ASSIGN), false)
  assert.equal(isDecidingStep(StepType.PREPARE), false)
  assert.equal(isDecidingStep(StepType.ACKNOWLEDGE), false)
})

test("el paso que se cumple termina en COMPLETED y el que decide en APPROVED", () => {
  // Dejar el armado en APPROVED diría que alguien aprobó el armado.
  assert.equal(favorableStatusFor(StepType.ASSIGN), StepStatus.COMPLETED)
  assert.equal(favorableStatusFor(StepType.PREPARE), StepStatus.COMPLETED)
  assert.equal(favorableStatusFor(StepType.ACKNOWLEDGE), StepStatus.COMPLETED)
  assert.equal(favorableStatusFor(StepType.APPROVE), StepStatus.APPROVED)
  assert.equal(favorableStatusFor(StepType.REVIEW), StepStatus.APPROVED)
})

test("el armado y la elaboración tampoco cuentan para completar el circuito", () => {
  // Ya ocurrieron cuando el circuito llega a decidirse: si contaran, aprobar el
  // único paso de aprobación no cerraría el circuito.
  const steps = [
    step(1, 1, StepStatus.COMPLETED, StepType.ASSIGN),
    step(2, 2, StepStatus.COMPLETED, StepType.PREPARE),
    step(3, 3, StepStatus.PENDING, StepType.APPROVE),
  ]

  assert.equal(completesWorkflow(steps, 3), true)
})

test("un circuito sin ningún paso que decida no se completa", () => {
  // No debería existir: el armado designa al menos un paso de aprobación (B1),
  // y la operación que arma el circuito debe exigirlo. Acá queda declarado que,
  // de construirse uno así, el circuito no cierra solo.
  const steps = [
    step(1, 1, StepStatus.COMPLETED, StepType.ASSIGN),
    step(2, 2, StepStatus.PENDING, StepType.ACKNOWLEDGE),
  ]

  assert.equal(completesWorkflow(steps, 2), false)
})

test("los acuses pendientes se identifican para poder resolverlos después", () => {
  // Viven en circuitos ya cerrados, que es el conjunto que pendingReviewSteps
  // excluye hoy y la razón por la que quedan pendientes para siempre (H-04).
  const steps = [
    step(1, 1, StepStatus.APPROVED, StepType.APPROVE),
    step(2, 2, StepStatus.PENDING, StepType.ACKNOWLEDGE),
    step(3, 3, StepStatus.COMPLETED, StepType.ACKNOWLEDGE),
  ]

  assert.deepEqual(
    pendingAcknowledgeSteps(steps).map((s) => s.id),
    [2],
  )
})

// --- Reasignación (B9) ---

test("se reasigna el paso pendiente y no el que ya fue resuelto", () => {
  // Un paso resuelto conserva la firma de quien lo resolvió: reasignarlo la
  // dejaría sin correspondencia.
  assert.equal(isReassignable(StepStatus.PENDING), true)
  assert.equal(isReassignable(StepStatus.COMPLETED), false)
  assert.equal(isReassignable(StepStatus.APPROVED), false)
  assert.equal(isReassignable(StepStatus.REJECTED), false)
  assert.equal(isReassignable(StepStatus.SKIPPED), false)
})

test("un paso rechazado previo impide completar el circuito", () => {
  const steps = [
    step(1, 1, StepStatus.REJECTED),
    step(2, 2, StepStatus.PENDING),
  ]

  assert.equal(completesWorkflow(steps, 2), false)
})

test("el rechazo saltea los pasos posteriores pendientes, no los anteriores", () => {
  const steps = [
    step(1, 1, StepStatus.APPROVED),
    step(2, 2, StepStatus.PENDING),
    step(3, 3, StepStatus.PENDING),
    step(4, 4, StepStatus.SKIPPED),
  ]

  assert.deepEqual(
    stepsSkippedByRejection(steps, 2).map((s) => s.id),
    [3],
  )
})

test("la cancelación saltea todos los pasos pendientes", () => {
  const steps = [
    step(1, 1, StepStatus.APPROVED),
    step(2, 2, StepStatus.PENDING),
    step(3, 3, StepStatus.PENDING),
  ]

  assert.deepEqual(
    stepsSkippedByCancellation(steps).map((s) => s.id),
    [2, 3],
  )
})