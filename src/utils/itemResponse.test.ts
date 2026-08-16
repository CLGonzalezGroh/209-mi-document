import assert from "node:assert/strict"
import test from "node:test"
import {
  TransmittalNature,
  TransmittalStatus,
} from "../generated/prisma/enums.js"
import {
  carrierViolation,
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
