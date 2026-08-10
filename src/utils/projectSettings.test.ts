import assert from "node:assert/strict"
import test from "node:test"
import { DocProjectSide, DocumentRole } from "../generated/prisma/enums.js"
import { assertCounterparty, counterpartyViolation, sideLabel } from "./projectSettings.js"

// Reglas de la configuración documental del proyecto (BLOQUE 02, B4).

test("Emisor y Receptor exigen contraparte", () => {
  for (const role of [DocumentRole.ISSUER, DocumentRole.RECEIVER]) {
    assert.equal(counterpartyViolation(role, "Acme"), null, `falló en ${role}`)
    assert.ok(counterpartyViolation(role, null), `falló en ${role}`)
    assert.ok(counterpartyViolation(role, undefined), `falló en ${role}`)
  }
})

test("un nombre en blanco no cuenta como contraparte declarada", () => {
  assert.ok(counterpartyViolation(DocumentRole.ISSUER, "   "))
})

test("Interno prohíbe la contraparte, porque por definición no la tiene", () => {
  assert.equal(counterpartyViolation(DocumentRole.INTERNAL, null), null)
  assert.equal(counterpartyViolation(DocumentRole.INTERNAL, undefined), null)
  assert.ok(counterpartyViolation(DocumentRole.INTERNAL, "Acme"))
})

test("la variante que corta lanza BAD_USER_INPUT", () => {
  assert.doesNotThrow(() => assertCounterparty(DocumentRole.INTERNAL, null))
  assert.throws(
    () => assertCounterparty(DocumentRole.INTERNAL, "Acme"),
    (error: any) => error.extensions?.code === "BAD_USER_INPUT",
  )
})

// Rótulo del lado según el rol del proyecto (D-15).

test("el rótulo del lado lo aporta el rol del proyecto", () => {
  assert.equal(sideLabel(DocumentRole.ISSUER, DocProjectSide.HOST), "Ingeniería")
  assert.equal(sideLabel(DocumentRole.ISSUER, DocProjectSide.COUNTERPARTY), "Cliente")
  assert.equal(sideLabel(DocumentRole.RECEIVER, DocProjectSide.HOST), "Planta")
  assert.equal(sideLabel(DocumentRole.RECEIVER, DocProjectSide.COUNTERPARTY), "Contratista")
})

test("en un proyecto interno no hay contraparte que nombrar", () => {
  assert.equal(sideLabel(DocumentRole.INTERNAL, DocProjectSide.HOST), "Interno")
  assert.equal(sideLabel(DocumentRole.INTERNAL, DocProjectSide.COUNTERPARTY), "Interno")
})
