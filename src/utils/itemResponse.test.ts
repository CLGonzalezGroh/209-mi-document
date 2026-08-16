import assert from "node:assert/strict"
import test from "node:test"
import {
  DocumentRole,
  PurposeCode,
  TransmittalNature,
  TransmittalStatus,
} from "../generated/prisma/enums.js"
import {
  canAcknowledge,
  carrierViolation,
  responseProgress,
  statusAfterResponse,
  wasIssued,
  wasTranscribed,
} from "./itemResponse.js"

/**
 * Reglas de la respuesta de la contraparte (BLOQUE 04, B5 y B7).
 */

// --- Solo se responde lo que salió ---

test("un transmittal en borrador no admite respuesta", () => {
  // D-18: no se admiten respuestas sobre documentos que no fueron emitidos.
  assert.equal(wasIssued(TransmittalStatus.DRAFT), false)
})

test("emitido, acusado, respondido y cerrado sí la admiten", () => {
  // Cerrar declara que se dejó de esperar, no que se dejó de escuchar (B10).
  for (const status of [
    TransmittalStatus.ISSUED,
    TransmittalStatus.ACKNOWLEDGED,
    TransmittalStatus.RESPONDED,
    TransmittalStatus.CLOSED,
  ]) {
    assert.equal(wasIssued(status), true, status)
  }
})

// --- El sobre en que la respuesta viajó ---

const sobre = (
  nature: TransmittalNature,
  respondsToTransmittalId: number | null,
) => ({ nature, respondsToTransmittalId })

test("el sobre debe ser un transmittal de respuesta", () => {
  assert.match(
    carrierViolation(sobre(TransmittalNature.EMISSION, 5), 5) ?? "",
    /no es un transmittal de respuesta/,
  )
})

test("el sobre debe contestar la emisión por la que ese documento salió", () => {
  // Sin esa condición, un remito podría transportar la calificación de
  // documentos que nunca contestó.
  assert.match(
    carrierViolation(sobre(TransmittalNature.RESPONSE, 9), 5) ?? "",
    /no contesta la emisión/,
  )
  assert.equal(carrierViolation(sobre(TransmittalNature.RESPONSE, 5), 5), null)
})

// --- Autoría diferenciada, derivada ---

test("la transcripción se deriva de que exista un autor distinto", () => {
  assert.equal(wasTranscribed("Ing. Pérez, del cliente"), true)
  assert.equal(wasTranscribed(null), false)
  assert.equal(wasTranscribed(undefined), false)
  assert.equal(wasTranscribed("   "), false)
})

// --- El estado del transmittal acompaña, y no espera ---

test("la primera respuesta lleva el transmittal a respondido", () => {
  // Las respuestas son parciales y no bloquean: cada documento respondido
  // reinicia su propio ciclo con independencia de los demás (D-18).
  assert.equal(
    statusAfterResponse(TransmittalStatus.ISSUED),
    TransmittalStatus.RESPONDED,
  )
  assert.equal(
    statusAfterResponse(TransmittalStatus.ACKNOWLEDGED),
    TransmittalStatus.RESPONDED,
  )
})

test("una respuesta posterior no vuelve a transicionar, y no reabre lo cerrado", () => {
  assert.equal(statusAfterResponse(TransmittalStatus.RESPONDED), null)
  assert.equal(statusAfterResponse(TransmittalStatus.CLOSED), null)
})

// --- El acuse de recibo (B8) ---

const acuse = (
  role: DocumentRole,
  nature: TransmittalNature = TransmittalNature.EMISSION,
  status: TransmittalStatus = TransmittalStatus.ISSUED,
) => canAcknowledge(role, nature, status)

test("el acuse solo existe en modo Emisor", () => {
  // En modo Receptor el contratista carga el transmittal dentro del sistema: no
  // hay nada que acusar. Declararlo evita implementar un estado que ahí no
  // significa nada, que es el defecto de H-12 al otro lado.
  assert.equal(acuse(DocumentRole.ISSUER), null)
  assert.match(acuse(DocumentRole.RECEIVER) ?? "", /solo existe en modo Emisor/)
  assert.match(acuse(DocumentRole.INTERNAL) ?? "", /solo existe en modo Emisor/)
})

test("se acusa recibo de una emisión, no de una respuesta", () => {
  assert.match(
    acuse(DocumentRole.ISSUER, TransmittalNature.RESPONSE) ?? "",
    /no de una respuesta/,
  )
})

test("no se acusa lo que no salió, ni lo que ya fue acusado", () => {
  assert.match(
    acuse(DocumentRole.ISSUER, TransmittalNature.EMISSION, TransmittalStatus.DRAFT) ?? "",
    /todavía no se emitió/,
  )
  assert.match(
    acuse(
      DocumentRole.ISSUER,
      TransmittalNature.EMISSION,
      TransmittalStatus.ACKNOWLEDGED,
    ) ?? "",
    /ya fue acusado o respondido/,
  )
})

// --- El avance de las respuestas (B10) ---

const item = (purposeCode: PurposeCode, hasResponse: boolean) => ({
  purposeCode,
  hasResponse,
})

test("el avance cuenta solo lo que espera calificación", () => {
  // Faltan 3 de las 5 que esperaban respuesta, no 3 de 8: una lista de
  // pendientes que incluye lo que nadie va a contestar no sirve para nada.
  const items = [
    item(PurposeCode.FOR_APPROVAL, true),
    item(PurposeCode.FOR_APPROVAL, false),
    item(PurposeCode.FOR_REVIEW, true),
    item(PurposeCode.FOR_REVIEW, false),
    item(PurposeCode.FOR_APPROVAL, false),
    item(PurposeCode.FOR_INFORMATION, false),
    item(PurposeCode.FOR_CONSTRUCTION, false),
    item(PurposeCode.AS_BUILT, false),
  ]

  assert.deepEqual(responseProgress(items), {
    expected: 5,
    answered: 2,
    pending: 3,
  })
})

test("un transmittal enteramente informativo no espera nada", () => {
  assert.deepEqual(
    responseProgress([
      item(PurposeCode.FOR_INFORMATION, false),
      item(PurposeCode.AS_BUILT, false),
    ]),
    { expected: 0, answered: 0, pending: 0 },
  )
})

