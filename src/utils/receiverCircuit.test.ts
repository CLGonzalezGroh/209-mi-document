import assert from "node:assert/strict"
import test from "node:test"
import {
  DocumentRole,
  QualificationEffect,
  RevisionStatus,
} from "../generated/prisma/enums.js"
import {
  concludesRevision,
  outcomeMismatch,
  qualificationRequirement,
  stepOutcomeOf,
  terminalStatusFor,
} from "./receiverCircuit.js"

/**
 * El circuito del rol Receptor (BLOQUE 04, B12).
 *
 * Las dos diferencias del rol se desprenden de un solo hecho: allí la
 * elaboración no ocurre dentro del sistema.
 */

// --- La conclusión ---

test("solo el rol Receptor concluye la revisión en lugar de devolverla", () => {
  // En Emisor e Interno el rechazo devuelve el trabajo al elaborador y abre un
  // circuito nuevo. Acá el elaborador está afuera.
  assert.equal(concludesRevision(DocumentRole.RECEIVER), true)
  assert.equal(concludesRevision(DocumentRole.ISSUER), false)
  assert.equal(concludesRevision(DocumentRole.INTERNAL), false)
  assert.equal(concludesRevision(null), false)
})

test("la revisión rechazada por la contraparte tiene estado propio", () => {
  // No es ABANDONED, que libera el código: esta salió y la contraparte la
  // recibió con él.
  assert.equal(terminalStatusFor(true), RevisionStatus.APPROVED)
  assert.equal(terminalStatusFor(false), RevisionStatus.REJECTED)
  assert.notEqual(terminalStatusFor(false), RevisionStatus.ABANDONED)
})

// --- Cuándo se exige la calificación ---

const exigencia = (
  role: DocumentRole,
  concluye: boolean,
  id: number | undefined,
) => qualificationRequirement(role, concluye, id)

test("en modo Receptor la conclusión exige calificación", () => {
  assert.match(
    exigencia(DocumentRole.RECEIVER, true, undefined) ?? "",
    /concluye con la calificación/,
  )
  assert.equal(exigencia(DocumentRole.RECEIVER, true, 7), null)
})

test("un paso intermedio no la lleva: todavía no hay respuesta que dar", () => {
  assert.equal(exigencia(DocumentRole.RECEIVER, false, undefined), null)
  assert.match(
    exigencia(DocumentRole.RECEIVER, false, 7) ?? "",
    /no en un paso intermedio/,
  )
})

test("fuera del modo Receptor la calificación no la produce el circuito", () => {
  // En Emisor la produce el cliente y la transcribe el control documental.
  for (const role of [DocumentRole.ISSUER, DocumentRole.INTERNAL]) {
    assert.equal(exigencia(role, true, undefined), null)
    assert.match(
      exigencia(role, true, 7) ?? "",
      /solo la produce el circuito en modo Receptor/,
    )
  }
})

// --- El desenlace se deriva del efecto ---

test("el efecto decide si el paso aprueba o rechaza", () => {
  assert.equal(stepOutcomeOf(QualificationEffect.ACCEPTED), true)
  assert.equal(stepOutcomeOf(QualificationEffect.ACCEPTED_WITH_COMMENTS), true)
  assert.equal(stepOutcomeOf(QualificationEffect.REJECTED), false)
})

test("la operación elegida no puede contradecir al efecto", () => {
  // Sin esta verificación el desenlace no se derivaría del efecto: el circuito
  // podría decir lo contrario que la respuesta que la contraparte lee.
  assert.equal(outcomeMismatch(QualificationEffect.ACCEPTED, true), null)
  assert.equal(outcomeMismatch(QualificationEffect.REJECTED, false), null)

  assert.match(
    outcomeMismatch(QualificationEffect.REJECTED, true) ?? "",
    /no puede aprobarse con ella/,
  )
  assert.match(
    outcomeMismatch(QualificationEffect.ACCEPTED_WITH_COMMENTS, false) ?? "",
    /no puede rechazarse con ella/,
  )
})
