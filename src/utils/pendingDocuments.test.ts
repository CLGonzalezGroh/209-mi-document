import assert from "node:assert/strict"
import test from "node:test"
import { DocumentRole, RevisionStatus } from "../generated/prisma/enums.js"
import { isPending, type PendingSnapshot } from "./pendingDocuments.js"

/**
 * El documento pendiente (BLOQUE 04, B13).
 *
 * No hay documento esperado: hay documento, y pendiente es el que no salió.
 */

let secuencia = 0

const rev = (
  status: RevisionStatus,
  emitted: boolean,
  code = "A",
): PendingSnapshot => ({
  id: ++secuencia,
  revisionCode: code,
  status,
  createdAt: new Date(2026, 0, secuencia),
  emitted,
})

const { ISSUER, RECEIVER, INTERNAL } = DocumentRole
const { DRAFT, IN_REVIEW, APPROVED, ABANDONED, REJECTED } = RevisionStatus

// --- Modo Emisor: aprobada y sin emitir ---

test("en modo Emisor pende la revisión aprobada que no salió", () => {
  assert.equal(isPending(ISSUER, [rev(APPROVED, false)]), true)
})

test("emitida deja de pender", () => {
  assert.equal(isPending(ISSUER, [rev(APPROVED, true)]), false)
})

test("lo que todavía no se aprobó es trabajo en curso, no deuda", () => {
  // Es la puerta de B3 acotando el conjunto, y lo que hace que la lista de
  // pendientes y la de candidatos sean la misma consulta.
  assert.equal(isPending(ISSUER, [rev(DRAFT, false)]), false)
  assert.equal(isPending(ISSUER, [rev(IN_REVIEW, false)]), false)
})

// --- Modo Receptor: entregada o no, sin exigir aprobación ---

test("en modo Receptor pende lo que el contratista no entregó", () => {
  // No hay aprobación interna que exigir: sube documentación ya aprobada por
  // sus propios medios.
  assert.equal(isPending(RECEIVER, [rev(DRAFT, false)]), true)
  assert.equal(isPending(RECEIVER, [rev(DRAFT, true)]), false)
})

// --- Modo Interno: no aplica ---

test("sin contraparte no hay nada pendiente de salir", () => {
  assert.equal(isPending(INTERNAL, [rev(APPROVED, false)]), false)
  assert.equal(isPending(null, [rev(APPROVED, false)]), false)
})

// --- Se mira la revisión EN CURSO ---

test("después de un rechazo el documento vuelve a pender", () => {
  // Mirar "ninguna revisión salió" sería más simple y estaría mal: el documento
  // debe la revisión siguiente y dejaría de figurar para siempre por haber
  // salido una vez.
  const revisiones = [
    rev(REJECTED, true, "A"),
    rev(DRAFT, false, "B"),
  ]

  assert.equal(isPending(RECEIVER, revisiones), true)
})

test("la revisión emitida más reciente manda sobre las anteriores", () => {
  const revisiones = [
    rev(APPROVED, false, "A"),
    rev(APPROVED, true, "B"),
  ]

  assert.equal(isPending(ISSUER, revisiones), false)
})

test("las abandonadas no cuentan como revisión en curso", () => {
  const revisiones = [
    rev(APPROVED, false, "A"),
    rev(ABANDONED, false, "B"),
  ]

  // La abandonada es la última por fecha, pero no está viva: manda la A, que
  // sigue sin salir.
  assert.equal(isPending(ISSUER, revisiones), true)
})

test("un documento sin revisiones vivas no pende", () => {
  assert.equal(isPending(ISSUER, []), false)
  assert.equal(isPending(ISSUER, [rev(ABANDONED, false)]), false)
})
