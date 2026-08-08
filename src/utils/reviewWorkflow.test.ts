import assert from "node:assert/strict"
import test from "node:test"
import { StepStatus, StepType } from "../generated/prisma/enums.js"
import {
  completesWorkflow,
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
  // Comportamiento vigente y causa de H-04: el paso ACKNOWLEDGE queda pendiente
  // de forma permanente. Se conserva sin modificar en este bloque.
  const steps = [
    step(1, 1, StepStatus.PENDING),
    step(2, 2, StepStatus.PENDING, StepType.ACKNOWLEDGE),
  ]

  assert.equal(completesWorkflow(steps, 1), true)
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