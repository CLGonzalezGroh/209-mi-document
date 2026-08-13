import assert from "node:assert/strict"
import test from "node:test"
import { StepStatus, StepType } from "../generated/prisma/enums.js"
import {
  buildSignature,
  buildSignaturePayload,
  SIGNATURE_ALGORITHM,
  signsStep,
  verifySignature,
  type SignatureInput,
} from "./stepSignature.js"

const input = (overrides: Partial<SignatureInput> = {}): SignatureInput => ({
  step: { id: 10, stepType: StepType.APPROVE, stepOrder: 4 },
  workflowId: 5,
  revision: { id: 3, revisionCode: "B" },
  version: {
    id: 7,
    versionNumber: 2,
    fileKey: "documents/2026/plano.pdf",
    checksum: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  },
  document: {
    id: 1,
    code: "C-DR-001",
    title: "Plano de conexionado",
    documentClassId: 2,
    documentTypeId: 4,
  },
  assignedToId: 20,
  resolvedById: 20,
  delegationReason: null,
  action: StepStatus.APPROVED,
  signedAt: new Date("2026-08-12T15:30:00.000Z"),
  ...overrides,
})

// --- Qué pasos firman (B7) ---

test("el armado no firma y los cuatro pasos que actúan sobre una versión sí", () => {
  // ASSIGN puede completarse cuando todavía no existe ninguna versión, de modo
  // que no habría objeto que acreditar.
  assert.equal(signsStep(StepType.ASSIGN), false)
  assert.equal(signsStep(StepType.PREPARE), true)
  assert.equal(signsStep(StepType.REVIEW), true)
  assert.equal(signsStep(StepType.APPROVE), true)
  assert.equal(signsStep(StepType.ACKNOWLEDGE), true)
})

// --- Payload ---

test("el payload lleva los insumos que la firma acredita", () => {
  const payload = JSON.parse(buildSignaturePayload(input()))

  assert.equal(payload.step.id, 10)
  assert.equal(payload.workflowId, 5)
  assert.equal(payload.revision.revisionCode, "B")
  // La versión: es lo que la firma acredita como contenido.
  assert.equal(payload.version.versionNumber, 2)
  assert.equal(payload.version.checksum.length, 64)
  // La metadata del documento: la firma acredita también la identificación (B6).
  assert.equal(payload.document.code, "C-DR-001")
  assert.equal(payload.document.title, "Plano de conexionado")
  // Quién estaba asignado y quién resolvió (B9).
  assert.equal(payload.actor.assignedToId, 20)
  assert.equal(payload.actor.resolvedById, 20)
  assert.equal(payload.action, StepStatus.APPROVED)
  assert.equal(payload.signedAt, "2026-08-12T15:30:00.000Z")
})

test("la serialización es canónica: las claves quedan ordenadas", () => {
  // Sin orden estable, el mismo contenido construido de otra forma produciría
  // otro hash y la verificación posterior dejaría de ser concluyente.
  const payload = buildSignaturePayload(input())

  assert.ok(payload.startsWith('{"action":'))
  const keys = Object.keys(JSON.parse(payload))
  assert.deepEqual(keys, [...keys].sort())
})

test("la delegación queda dentro de lo firmado", () => {
  const payload = JSON.parse(
    buildSignaturePayload(
      input({ resolvedById: 33, delegationReason: "Revisor de licencia" }),
    ),
  )

  assert.equal(payload.actor.assignedToId, 20)
  assert.equal(payload.actor.resolvedById, 33)
  assert.equal(payload.actor.delegationReason, "Revisor de licencia")
})

// --- Hash ---

test("el mismo contenido produce el mismo hash", () => {
  assert.equal(buildSignature(input()).hash, buildSignature(input()).hash)
})

test("el rechazo firma distinto que la aprobación", () => {
  // El rechazo firma igual que la aprobación, y su evidencia documenta qué se
  // objetó: la acción forma parte de lo firmado.
  const aprobacion = buildSignature(input({ action: StepStatus.APPROVED }))
  const rechazo = buildSignature(input({ action: StepStatus.REJECTED }))

  assert.notEqual(aprobacion.hash, rechazo.hash)
})

test("una versión distinta produce una firma distinta", () => {
  const primera = buildSignature(input())
  const segunda = buildSignature(
    input({
      version: { ...input().version, id: 8, versionNumber: 3, checksum: "otro" },
    }),
  )

  assert.notEqual(primera.hash, segunda.hash)
})

test("cambiar la metadata del documento cambia la firma", () => {
  // Es lo que vuelve verificable el congelamiento de B6.
  const original = buildSignature(input())
  const retitulado = buildSignature(
    input({ document: { ...input().document, title: "Otro título" } }),
  )

  assert.notEqual(original.hash, retitulado.hash)
})

// --- Verificación posterior ---

test("una firma intacta se verifica sobre sus propios datos persistidos", () => {
  const firma = buildSignature(input())

  assert.equal(firma.algorithm, SIGNATURE_ALGORITHM)
  assert.deepEqual(verifySignature(firma), { valid: true })
})

test("alterar el payload guardado invalida la firma", () => {
  // Es lo que H-06 no permitía detectar: sin los insumos persistidos, el hash no
  // acreditaba nada verificable.
  const firma = buildSignature(input())
  const adulterada = {
    ...firma,
    payload: firma.payload.replace("Plano de conexionado", "Otro plano"),
  }

  const resultado = verifySignature(adulterada)
  assert.equal(resultado.valid, false)
  assert.equal(resultado.valid === false && resultado.reason, "HASH_MISMATCH")
})

test("un algoritmo que no es el del módulo no se verifica", () => {
  const firma = { ...buildSignature(input()), algorithm: "MD5" }

  assert.deepEqual(verifySignature(firma), {
    valid: false,
    reason: "UNSUPPORTED_ALGORITHM",
  })
})
