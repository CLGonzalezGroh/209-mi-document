import assert from "node:assert/strict"
import test from "node:test"
import { DocumentRole, StepType } from "../generated/prisma/enums.js"
import {
  hasPreparationStep,
  initialSteps,
  materializeSteps,
  resolveTemplate,
  stepsForRejectionRetry,
  type TemplateSnapshot,
} from "./workflowTemplate.js"

const template = (
  id: number,
  docProjectId: number | null,
  documentClassId: number | null,
  documentTypeId: number | null,
  terminatedAt: Date | null = null,
): TemplateSnapshot => ({
  id,
  docProjectId,
  documentClassId,
  documentTypeId,
  terminatedAt,
})

const documento = { docProjectId: 7, documentClassId: 2, documentTypeId: 4 }

// --- Resolución por alcance (B3) ---

test("gana la plantilla más específica: tipo sobre clase sobre proyecto", () => {
  const templates = [
    template(1, 7, null, null),
    template(2, 7, 2, null),
    template(3, 7, 2, 4),
  ]

  assert.equal(resolveTemplate(templates, documento)?.id, 3)
})

test("sin plantilla de tipo, gana la de clase", () => {
  const templates = [template(1, 7, null, null), template(2, 7, 2, null)]

  assert.equal(resolveTemplate(templates, documento)?.id, 2)
})

test("la plantilla del proyecto con clase y tipo nulos es su default", () => {
  const templates = [template(1, 7, null, null)]

  assert.equal(resolveTemplate(templates, documento)?.id, 1)
})

test("una plantilla de otro proyecto, clase o tipo no aplica", () => {
  const templates = [
    template(1, 99, null, null),
    template(2, 7, 3, null),
    template(3, 7, 2, 9),
  ]

  assert.equal(resolveTemplate(templates, documento), null)
})

test("la plantilla sin proyecto alcanza a los documentos del régimen de publicación", () => {
  const templates = [template(1, null, null, null)]

  assert.equal(
    resolveTemplate(templates, {
      docProjectId: null,
      documentClassId: null,
      documentTypeId: null,
    })?.id,
    1,
  )
})

test("una plantilla dada de baja no propone circuito", () => {
  const templates = [
    template(1, 7, null, null),
    template(2, 7, 2, 4, new Date("2026-01-01")),
  ]

  assert.equal(resolveTemplate(templates, documento)?.id, 1)
})

test("un documento sin plantilla alcanzable no recibe propuesta", () => {
  assert.equal(resolveTemplate([], documento), null)
})

// --- Pasos iniciales (B3) ---

test("el circuito nace solo con el armado", () => {
  // Los siguientes no se materializan antes porque hasta el armado no tienen
  // actor, y assignedToId no admite nulo.
  const steps = initialSteps(20)

  assert.deepEqual(steps, [
    { stepOrder: 1, stepType: StepType.ASSIGN, assignedToId: 20 },
  ])
})

// --- Materialización del armado ---

const revisores = [
  { stepOrder: 10, stepType: StepType.REVIEW, assignedToId: 31 },
  { stepOrder: 20, stepType: StepType.APPROVE, assignedToId: 32 },
]

test("el armado materializa elaboración y elenco, renumerando de forma contigua", () => {
  const result = materializeSteps(
    { preparerId: 30, steps: revisores },
    { role: DocumentRole.ISSUER },
  )

  assert.equal(result.ok, true)
  assert.deepEqual(result.ok && result.steps, [
    { stepOrder: 2, stepType: StepType.PREPARE, assignedToId: 30 },
    { stepOrder: 3, stepType: StepType.REVIEW, assignedToId: 31 },
    { stepOrder: 4, stepType: StepType.APPROVE, assignedToId: 32 },
  ])
})

test("el circuito mínimo es un único paso de aprobación", () => {
  // D-03 deja de necesitar regla propia: es un armado que designa un solo paso.
  const result = materializeSteps(
    {
      preparerId: 30,
      steps: [{ stepOrder: 1, stepType: StepType.APPROVE, assignedToId: 32 }],
    },
    { role: DocumentRole.INTERNAL },
  )

  assert.equal(result.ok, true)
  assert.equal(result.ok && result.steps.length, 2)
})

test("el rol Receptor arma sin paso de elaboración", () => {
  // Allí el documento llega ya elaborado desde afuera (B16).
  assert.equal(hasPreparationStep(DocumentRole.RECEIVER), false)
  assert.equal(hasPreparationStep(DocumentRole.ISSUER), true)
  assert.equal(hasPreparationStep(DocumentRole.INTERNAL), true)

  const result = materializeSteps(
    { preparerId: null, steps: revisores },
    { role: DocumentRole.RECEIVER },
  )

  assert.equal(result.ok, true)
  assert.equal(result.ok && result.steps[0].stepType, StepType.REVIEW)
})

test("en Emisor e Interno el elaborador es obligatorio", () => {
  const result = materializeSteps(
    { preparerId: null, steps: revisores },
    { role: DocumentRole.ISSUER },
  )

  assert.deepEqual(result, { ok: false, reason: "PREPARER_REQUIRED" })
})

test("en Receptor no se admite designar elaborador", () => {
  const result = materializeSteps(
    { preparerId: 30, steps: revisores },
    { role: DocumentRole.RECEIVER },
  )

  assert.deepEqual(result, { ok: false, reason: "PREPARER_NOT_ALLOWED" })
})

test("el armado y la elaboración no se declaran como pasos comunes", () => {
  // Los pone el sistema: admitirlos permitiría dos armados en el mismo circuito.
  const result = materializeSteps(
    {
      preparerId: 30,
      steps: [{ stepOrder: 1, stepType: StepType.ASSIGN, assignedToId: 31 }],
    },
    { role: DocumentRole.ISSUER },
  )

  assert.deepEqual(result, { ok: false, reason: "STRUCTURAL_STEP_IN_TEMPLATE" })
})

test("un circuito sin ningún paso que decida no se arma", () => {
  // Sin REVIEW ni APPROVE no tendría con qué completarse, y la revisión quedaría
  // trabada: es la precondición que el borde de completesWorkflow reclamaba.
  const result = materializeSteps(
    {
      preparerId: 30,
      steps: [
        { stepOrder: 1, stepType: StepType.ACKNOWLEDGE, assignedToId: 31 },
      ],
    },
    { role: DocumentRole.ISSUER },
  )

  assert.deepEqual(result, { ok: false, reason: "NO_DECIDING_STEP" })
})

test("un paso preasignado por la plantilla que nadie designó no se materializa", () => {
  const result = materializeSteps(
    {
      preparerId: 30,
      steps: [
        { stepOrder: 1, stepType: StepType.REVIEW, assignedToId: null },
        { stepOrder: 2, stepType: StepType.APPROVE, assignedToId: 32 },
      ],
    },
    { role: DocumentRole.ISSUER },
  )

  assert.deepEqual(result, { ok: false, reason: "STEP_WITHOUT_ACTOR" })
})

// --- Reinstanciación por rechazo (B1) ---

test("el rechazo abre un circuito desde la elaboración con el mismo elenco", () => {
  const anterior = [
    { stepOrder: 1, stepType: StepType.ASSIGN, assignedToId: 20 },
    { stepOrder: 2, stepType: StepType.PREPARE, assignedToId: 30 },
    { stepOrder: 3, stepType: StepType.REVIEW, assignedToId: 31 },
    { stepOrder: 4, stepType: StepType.APPROVE, assignedToId: 32 },
  ]

  // El armado no se repite: el trabajo vuelve al elaborador sin rearmar nada.
  assert.deepEqual(stepsForRejectionRetry(anterior), [
    { stepOrder: 1, stepType: StepType.PREPARE, assignedToId: 30 },
    { stepOrder: 2, stepType: StepType.REVIEW, assignedToId: 31 },
    { stepOrder: 3, stepType: StepType.APPROVE, assignedToId: 32 },
  ])
})
