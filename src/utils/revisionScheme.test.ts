import assert from "node:assert/strict"
import test from "node:test"
import { RevisionScheme, RevisionStatus } from "../generated/prisma/enums.js"
import {
  decideRevisionCode,
  firstRevisionCode,
  inferRevisionScheme,
  lastLiveRevision,
  nextRevisionCode,
  proposeRevisionCode,
  type RevisionSnapshot,
} from "./revisionScheme.js"

const revision = (
  id: number,
  revisionCode: string,
  status: RevisionStatus,
  createdAt: string,
): RevisionSnapshot => ({
  id,
  revisionCode,
  status,
  createdAt: new Date(createdAt),
})

// --- Sucesor ---

test("la primera revisión depende del esquema, y bajo FREE_TEXT no se propone", () => {
  assert.equal(firstRevisionCode(RevisionScheme.ALPHA), "A")
  assert.equal(firstRevisionCode(RevisionScheme.NUMERIC), "0")
  assert.equal(firstRevisionCode(RevisionScheme.FREE_TEXT), null)
})

test("el sucesor alfabético desborda a dos letras", () => {
  assert.equal(nextRevisionCode("A", RevisionScheme.ALPHA), "B")
  assert.equal(nextRevisionCode("Z", RevisionScheme.ALPHA), "AA")
  assert.equal(nextRevisionCode("AZ", RevisionScheme.ALPHA), "BA")
  assert.equal(nextRevisionCode("ZZ", RevisionScheme.ALPHA), "AAA")
})

test("el sucesor numérico continúa la cuenta", () => {
  assert.equal(nextRevisionCode("0", RevisionScheme.NUMERIC), "1")
  assert.equal(nextRevisionCode("9", RevisionScheme.NUMERIC), "10")
})

test("bajo FREE_TEXT no hay secuencia que continuar", () => {
  assert.equal(nextRevisionCode("Rev-1", RevisionScheme.FREE_TEXT), null)
})

// --- Inferencia ---

test("el esquema se infiere de la forma del código", () => {
  assert.equal(inferRevisionScheme("A"), RevisionScheme.ALPHA)
  assert.equal(inferRevisionScheme("AB"), RevisionScheme.ALPHA)
  assert.equal(inferRevisionScheme("0"), RevisionScheme.NUMERIC)
  assert.equal(inferRevisionScheme("12"), RevisionScheme.NUMERIC)
})

test("un código que el sistema no generó no revela esquema", () => {
  // Bajo FREE_TEXT lo escribe el usuario: no hay secuencia que inferir.
  assert.equal(inferRevisionScheme("Rev-1"), null)
  assert.equal(inferRevisionScheme("1A"), null)
  assert.equal(inferRevisionScheme(""), null)
})

// --- Última revisión viva ---

test("la última revisión es la última por creación y no por código", () => {
  // H-10: con el cambio de esquema la secuencia queda A, B, C, 0, 1, de modo
  // que ordenar por código devolvería "C".
  const revisions = [
    revision(1, "A", RevisionStatus.SUPERSEDED, "2026-01-01"),
    revision(2, "B", RevisionStatus.SUPERSEDED, "2026-02-01"),
    revision(3, "C", RevisionStatus.SUPERSEDED, "2026-03-01"),
    revision(4, "0", RevisionStatus.SUPERSEDED, "2026-04-01"),
    revision(5, "1", RevisionStatus.APPROVED, "2026-05-01"),
  ]

  assert.equal(lastLiveRevision(revisions)?.revisionCode, "1")
})

test("las revisiones abortadas no cuentan como última", () => {
  const revisions = [
    revision(1, "A", RevisionStatus.APPROVED, "2026-01-01"),
    revision(2, "B", RevisionStatus.ABANDONED, "2026-02-01"),
  ]

  assert.equal(lastLiveRevision(revisions)?.revisionCode, "A")
})

test("un documento con todas sus revisiones abortadas no tiene última", () => {
  const revisions = [
    revision(1, "A", RevisionStatus.ABANDONED, "2026-01-01"),
    revision(2, "A", RevisionStatus.ABANDONED, "2026-02-01"),
  ]

  assert.equal(lastLiveRevision(revisions), null)
})

test("dos revisiones creadas en el mismo instante desempatan por alta", () => {
  const revisions = [
    revision(1, "A", RevisionStatus.SUPERSEDED, "2026-01-01"),
    revision(2, "B", RevisionStatus.DRAFT, "2026-01-01"),
  ]

  assert.equal(lastLiveRevision(revisions)?.id, 2)
})

// --- Código propuesto ---

test("la primera revisión se propone según el esquema del proyecto", () => {
  assert.equal(
    proposeRevisionCode({
      lastCode: null,
      chosenScheme: null,
      fallbackScheme: RevisionScheme.NUMERIC,
    }),
    "0",
  )
})

test("la revisión siguiente continúa el esquema que su código revela", () => {
  assert.equal(
    proposeRevisionCode({
      lastCode: "B",
      chosenScheme: null,
      fallbackScheme: RevisionScheme.NUMERIC,
    }),
    "C",
  )
})

test("cambiar de esquema reinicia la secuencia", () => {
  // El comportamiento que H-10 describía como el buscado: de C a NUMERIC da 0.
  assert.equal(
    proposeRevisionCode({
      lastCode: "C",
      chosenScheme: RevisionScheme.NUMERIC,
      fallbackScheme: RevisionScheme.ALPHA,
    }),
    "0",
  )
})

test("elegir el mismo esquema que el código revela continúa la secuencia", () => {
  assert.equal(
    proposeRevisionCode({
      lastCode: "C",
      chosenScheme: RevisionScheme.ALPHA,
      fallbackScheme: RevisionScheme.NUMERIC,
    }),
    "D",
  )
})

test("bajo FREE_TEXT no se propone código", () => {
  assert.equal(
    proposeRevisionCode({
      lastCode: "C",
      chosenScheme: RevisionScheme.FREE_TEXT,
      fallbackScheme: RevisionScheme.ALPHA,
    }),
    null,
  )
})

test("un código anterior de texto libre arranca la secuencia del esquema elegido", () => {
  assert.equal(
    proposeRevisionCode({
      lastCode: "Rev-1",
      chosenScheme: RevisionScheme.ALPHA,
      fallbackScheme: RevisionScheme.NUMERIC,
    }),
    "A",
  )
})

// --- Validación del código (H-09) ---

test("bajo ALPHA el sistema calcula el código y rechaza el informado", () => {
  const decision = decideRevisionCode({
    scheme: RevisionScheme.ALPHA,
    informedCode: "Z",
    proposedCode: "B",
    liveCodes: ["A"],
  })

  assert.deepEqual(decision, { ok: false, reason: "CODE_NOT_ACCEPTED" })
})

test("informar el mismo código que el sistema propone es admisible", () => {
  const decision = decideRevisionCode({
    scheme: RevisionScheme.ALPHA,
    informedCode: "B",
    proposedCode: "B",
    liveCodes: ["A"],
  })

  assert.deepEqual(decision, { ok: true, code: "B" })
})

test("omitir el código toma el propuesto", () => {
  const decision = decideRevisionCode({
    scheme: RevisionScheme.NUMERIC,
    informedCode: null,
    proposedCode: "1",
    liveCodes: ["0"],
  })

  assert.deepEqual(decision, { ok: true, code: "1" })
})

test("bajo FREE_TEXT el código lo ingresa el usuario", () => {
  assert.deepEqual(
    decideRevisionCode({
      scheme: RevisionScheme.FREE_TEXT,
      informedCode: null,
      proposedCode: null,
      liveCodes: [],
    }),
    { ok: false, reason: "CODE_REQUIRED" },
  )

  assert.deepEqual(
    decideRevisionCode({
      scheme: RevisionScheme.FREE_TEXT,
      informedCode: "  Rev-1  ",
      proposedCode: null,
      liveCodes: [],
    }),
    { ok: true, code: "Rev-1" },
  )
})

test("bajo FREE_TEXT el código no se repite entre las revisiones vivas", () => {
  const decision = decideRevisionCode({
    scheme: RevisionScheme.FREE_TEXT,
    informedCode: "Rev-1",
    proposedCode: null,
    liveCodes: ["Rev-1"],
  })

  assert.deepEqual(decision, { ok: false, reason: "CODE_TAKEN" })
})

test("un código que solo usan revisiones abortadas vuelve a estar disponible", () => {
  // B12: sobre A puede abrirse B, abortarse y abrirse otra vez B. Las abortadas
  // no llegan a `liveCodes`, que es lo que el índice parcial sostiene en la base.
  const decision = decideRevisionCode({
    scheme: RevisionScheme.ALPHA,
    informedCode: null,
    proposedCode: "B",
    liveCodes: ["A"],
  })

  assert.deepEqual(decision, { ok: true, code: "B" })
})
