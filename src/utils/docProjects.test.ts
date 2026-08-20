import assert from "node:assert/strict"
import test from "node:test"
import { DocProjectSide, DocumentRole } from "../generated/prisma/enums.js"
import { assertCounterparty, counterpartyViolation, sideLabel } from "./docProjects.js"

// Reglas de la contraparte del contrato (BLOQUE 02, B4; BLOQUE 02D, B4).

/** Id de una Company de mi-admin. La contraparte es una referencia (B4). */
const EMPRESA = -424801

test("Emisor y Receptor exigen contraparte", () => {
  for (const role of [DocumentRole.ISSUER, DocumentRole.RECEIVER]) {
    assert.equal(counterpartyViolation(role, EMPRESA), null, `falló en ${role}`)
    assert.ok(counterpartyViolation(role, null), `falló en ${role}`)
    assert.ok(counterpartyViolation(role, undefined), `falló en ${role}`)
  }
})

test("una referencia está o no está: no hay contraparte en blanco", () => {
  // Con el nombre libre había un tercer estado —texto vacío— que la invariante
  // tenía que descartar a mano. Una referencia no lo admite: es un id o es
  // nulo, y eso es exactamente lo que hace más barata la regla (BLOQUE 02D, B4).
  assert.ok(counterpartyViolation(DocumentRole.ISSUER, null))
  assert.equal(counterpartyViolation(DocumentRole.ISSUER, EMPRESA), null)
})

test("Interno prohíbe la contraparte, porque por definición no la tiene", () => {
  assert.equal(counterpartyViolation(DocumentRole.INTERNAL, null), null)
  assert.equal(counterpartyViolation(DocumentRole.INTERNAL, undefined), null)
  assert.ok(counterpartyViolation(DocumentRole.INTERNAL, EMPRESA))
})

test("la variante que corta lanza BAD_USER_INPUT", () => {
  assert.doesNotThrow(() => assertCounterparty(DocumentRole.INTERNAL, null))
  assert.throws(
    () => assertCounterparty(DocumentRole.INTERNAL, EMPRESA),
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
