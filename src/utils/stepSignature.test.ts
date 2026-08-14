import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import { DocFileRole, StepStatus, StepType } from "../generated/prisma/enums.js"
import {
  buildSignature,
  buildSignaturePayload,
  orderSignedFiles,
  SIGNATURE_ALGORITHM,
  SIGNATURE_PAYLOAD_VERSION,
  signsStep,
  verifySignature,
  type SignatureInput,
} from "./stepSignature.js"

const input = (overrides: Partial<SignatureInput> = {}): SignatureInput => ({
  step: { id: 10, stepType: StepType.APPROVE, stepOrder: 4 },
  workflowId: 5,
  revision: {
    id: 3,
    revisionCode: "B",
    title: "Plano de conexionado",
    documentClassId: 2,
    documentTypeId: 4,
  },
  version: {
    id: 7,
    versionNumber: 2,
    files: [
      {
        role: DocFileRole.DELIVERABLE,
        fileKey: "documents/2026/plano.pdf",
        fileName: "plano.pdf",
        checksum: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      },
      {
        role: DocFileRole.SOURCE,
        fileKey: "documents/2026/plano.dwg",
        fileName: "plano.dwg",
        checksum: "1f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      },
    ],
  },
  document: { id: 1, code: "C-DR-001" },
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
  // La identificación viaja con la REVISIÓN, que es donde vive (BLOQUE 03B, B1)
  assert.equal(payload.revision.title, "Plano de conexionado")
  assert.equal(payload.revision.documentClassId, 2)
  // La versión acredita el CONJUNTO completo, no un archivo (B8)
  assert.equal(payload.version.versionNumber, 2)
  assert.equal(payload.version.files.length, 2)
  assert.equal(payload.version.files[0].checksum.length, 64)
  // El documento aporta lo suyo: su identidad, que no cambia (B3)
  assert.equal(payload.document.code, "C-DR-001")
  assert.equal(payload.payloadVersion, SIGNATURE_PAYLOAD_VERSION)
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
    input({ version: { ...input().version, id: 8, versionNumber: 3 } }),
  )

  assert.notEqual(primera.hash, segunda.hash)
})

test("cambiar la metadata de la revisión cambia la firma", () => {
  // Es lo que vuelve verificable el congelamiento de B6.
  const original = buildSignature(input())
  const retitulado = buildSignature(
    input({ revision: { ...input().revision, title: "Otro título" } }),
  )

  assert.notEqual(original.hash, retitulado.hash)
})

// --- El conjunto de archivos (BLOQUE 03B, B8) ---

test("sustituir la fuente cambia la firma, aunque nadie la revise", () => {
  // La custodia del editable importa PORQUE es la fuente del entregable: si
  // pudiera sustituirse sin producir versión nueva, la correspondencia entre uno
  // y otro sería una afirmación sin evidencia.
  const original = buildSignature(input())
  const files = input().version.files.map((f) =>
    f.role === DocFileRole.SOURCE ? { ...f, checksum: "otro" } : f,
  )
  const conOtraFuente = buildSignature(
    input({ version: { ...input().version, files } }),
  )

  assert.notEqual(original.hash, conOtraFuente.hash)
})

test("quitar un archivo del conjunto cambia la firma", () => {
  const original = buildSignature(input())
  const soloEntregable = buildSignature(
    input({
      version: {
        ...input().version,
        files: input().version.files.filter(
          (f) => f.role === DocFileRole.DELIVERABLE,
        ),
      },
    }),
  )

  assert.notEqual(original.hash, soloEntregable.hash)
})

test("el orden en que la consulta devuelve los archivos no altera la firma", () => {
  // `canonicalize` ordena las claves de los objetos pero CONSERVA el orden de
  // los arreglos: sin fijarlo, el mismo conjunto produciría hashes distintos
  // según cómo hubiera venido de la base.
  const enOrden = buildSignature(input())
  const alReves = buildSignature(
    input({
      version: { ...input().version, files: [...input().version.files].reverse() },
    }),
  )

  assert.equal(enOrden.hash, alReves.hash)
})

test("los archivos se ordenan por rol y después por fileKey", () => {
  const desordenados = [
    { role: "SOURCE", fileKey: "b", fileName: "b.dwg", checksum: "1" },
    { role: "DELIVERABLE", fileKey: "z", fileName: "z.pdf", checksum: "2" },
    { role: "DELIVERABLE", fileKey: "a", fileName: "a.pdf", checksum: "3" },
  ]

  assert.deepEqual(
    orderSignedFiles(desordenados).map((f) => f.fileKey),
    ["a", "z", "b"],
  )
})

test("ordenar no muta el arreglo recibido", () => {
  const files = [...input().version.files].reverse()
  const antes = files.map((f) => f.fileKey)
  orderSignedFiles(files)

  assert.deepEqual(files.map((f) => f.fileKey), antes)
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
    payload: firma.payload.replace("Plano de conexionado", "Otro plano!!!"),
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

test("una firma en el formato anterior sigue verificándose", () => {
  // Verificar es recalcular el hash SOBRE EL PAYLOAD GUARDADO, y no
  // reconstruirlo desde las entidades. Por eso el cambio de forma no invalida lo
  // firmado antes: `payloadVersion` distingue con qué reglas se leyó cada uno.
  const v1 = JSON.stringify({
    payloadVersion: 1,
    action: StepStatus.APPROVED,
    document: { code: "C-DR-001", title: "Plano de conexionado" },
  })
  const hash = createHash("sha256").update(v1, "utf8").digest("hex")

  assert.deepEqual(
    verifySignature({ algorithm: SIGNATURE_ALGORITHM, payload: v1, hash }),
    { valid: true },
  )
})
