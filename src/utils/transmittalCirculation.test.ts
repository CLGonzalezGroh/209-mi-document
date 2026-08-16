import assert from "node:assert/strict"
import test from "node:test"
import {
  DocumentRole,
  TransmittalNature,
} from "../generated/prisma/enums.js"
import {
  TransmittalDirection,
  directionOf,
  emitsOutward,
  natureViolation,
  nextTransmittalCode,
  responseLinkViolation,
} from "./transmittalCirculation.js"

/**
 * Circulación del transmittal (BLOQUE 04, B1 y B2).
 *
 * Tres reglas que la compilación no puede verificar: que el sentido se derive
 * bien de las seis combinaciones de rol y naturaleza, que las imposibles no
 * puedan crearse, y que el código sucesor sea el del proyecto.
 */

const { ISSUER, RECEIVER, INTERNAL } = DocumentRole
const { EMISSION, RESPONSE } = TransmittalNature

// --- El sentido, derivado ---

test("en modo Emisor la emisión sale y la respuesta entra", () => {
  assert.equal(directionOf(ISSUER, EMISSION), TransmittalDirection.OUTGOING)
  assert.equal(directionOf(ISSUER, RESPONSE), TransmittalDirection.INCOMING)
})

test("en modo Receptor la emisión entra, y no hay respuesta", () => {
  assert.equal(directionOf(RECEIVER, EMISSION), TransmittalDirection.INCOMING)
  assert.equal(directionOf(RECEIVER, RESPONSE), null)
})

test("en modo Interno no hay transmittal de ninguna naturaleza", () => {
  assert.equal(directionOf(INTERNAL, EMISSION), null)
  assert.equal(directionOf(INTERNAL, RESPONSE), null)
})

test("el sentido es nulo exactamente donde la naturaleza es inválida", () => {
  // Las dos tablas deben coincidir: un sentido nulo sin violación dejaría un
  // transmittal creable cuyo sentido nadie puede establecer.
  for (const role of Object.values(DocumentRole)) {
    for (const nature of Object.values(TransmittalNature)) {
      assert.equal(
        directionOf(role, nature) === null,
        natureViolation(role, nature) !== null,
        `${role} + ${nature}`,
      )
    }
  }
})

// --- La puerta de emisión depende del rol, no de la naturaleza ---

test("solo el rol Emisor emite hacia afuera", () => {
  // Es la condición de la puerta dura de B3: exige aprobación INTERNA, y en modo
  // Receptor no ocurre ninguna dentro del sistema.
  assert.equal(emitsOutward(ISSUER), true)
  assert.equal(emitsOutward(RECEIVER), false)
  assert.equal(emitsOutward(INTERNAL), false)
})

// --- El vínculo con la emisión que se contesta ---

const emision = (projectId: number) => ({ projectId, nature: EMISSION })

test("la respuesta exige declarar la emisión que contesta", () => {
  assert.match(
    responseLinkViolation(RESPONSE, null, 7) ?? "",
    /debe declarar la emisión/,
  )
  assert.equal(responseLinkViolation(RESPONSE, emision(7), 7), null)
})

test("la emisión no responde a nada", () => {
  assert.equal(responseLinkViolation(EMISSION, null, 7), null)
  assert.match(
    responseLinkViolation(EMISSION, emision(7), 7) ?? "",
    /no responde a otro transmittal/,
  )
})

test("no se contesta una emisión de otro proyecto", () => {
  assert.match(
    responseLinkViolation(RESPONSE, emision(9), 7) ?? "",
    /otro proyecto/,
  )
})

test("no se contesta una respuesta", () => {
  assert.match(
    responseLinkViolation(RESPONSE, { projectId: 7, nature: RESPONSE }, 7) ?? "",
    /Solo se contesta una emisión/,
  )
})

// --- El código ---

test("el primer código del proyecto es TR-001", () => {
  assert.equal(nextTransmittalCode(null), "TR-001")
})

test("el sucesor incrementa y conserva el relleno", () => {
  assert.equal(nextTransmittalCode("TR-001"), "TR-002")
  assert.equal(nextTransmittalCode("TR-009"), "TR-010")
  assert.equal(nextTransmittalCode("TR-099"), "TR-100")
})

test("por encima de mil el código crece y deja de estar rellenado", () => {
  // El relleno es de tres dígitos: TR-1000 es correcto y más largo. Es la razón
  // por la que el último del proyecto se busca por `id` y no por `code`, que
  // ordenaría TR-1000 antes que TR-999.
  assert.equal(nextTransmittalCode("TR-999"), "TR-1000")
  assert.equal(nextTransmittalCode("TR-1000"), "TR-1001")
})
