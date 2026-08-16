import assert from "node:assert/strict"
import test from "node:test"
import {
  DocFileRole,
  DocumentRole,
  PurposeCode,
  RevisionStatus,
} from "../generated/prisma/enums.js"
import {
  assertApprovedForEmission,
  expectedFileRoles,
  expectsQualification,
  missingFileRoles,
  notApprovedFor,
  requiresApprovedRevision,
} from "./emissionPurpose.js"

/**
 * Puerta de emisión y reglas del propósito (BLOQUE 04, B3 y B4).
 *
 * Una es puerta y la otra advertencia, y la diferencia es estructural: una
 * puerta solo puede ser dura si existe una manera legal de satisfacerla.
 */

const revision = (id: number, status: RevisionStatus) => ({
  id,
  revisionCode: `R${id}`,
  status,
})

// --- La puerta (B3) ---

test("solo el rol Emisor exige aprobación interna", () => {
  // No es una excepción a la regla sino su consecuencia: la puerta exige
  // aprobación INTERNA, y en modo Receptor no ocurre ninguna dentro del sistema.
  assert.equal(requiresApprovedRevision(DocumentRole.ISSUER), true)
  assert.equal(requiresApprovedRevision(DocumentRole.RECEIVER), false)
  assert.equal(requiresApprovedRevision(DocumentRole.INTERNAL), false)
})

test("en modo Emisor toda revisión no aprobada traba la emisión", () => {
  const revisiones = [
    revision(1, RevisionStatus.APPROVED),
    revision(2, RevisionStatus.DRAFT),
    revision(3, RevisionStatus.IN_REVIEW),
    revision(4, RevisionStatus.ABANDONED),
  ]

  assert.deepEqual(
    notApprovedFor(DocumentRole.ISSUER, revisiones).map((r) => r.id),
    [2, 3, 4],
  )
})

test("en modo Receptor ninguna traba, porque no hubo circuito interno", () => {
  const revisiones = [
    revision(1, RevisionStatus.DRAFT),
    revision(2, RevisionStatus.IN_REVIEW),
  ]

  assert.deepEqual(notApprovedFor(DocumentRole.RECEIVER, revisiones), [])
})

test("el rechazo nombra las revisiones que faltan aprobar", () => {
  assert.throws(
    () =>
      assertApprovedForEmission(DocumentRole.ISSUER, [
        revision(1, RevisionStatus.APPROVED),
        revision(2, RevisionStatus.DRAFT),
      ]),
    /R2 \(DRAFT\)/,
  )
})

test("la puerta no depende del propósito", () => {
  // D-18 lo fija sin excepción: la función del módulo es garantizar la calidad
  // de lo que sale, cualquiera sea el motivo del envío.
  for (const purpose of Object.values(PurposeCode)) {
    assert.throws(
      () =>
        assertApprovedForEmission(DocumentRole.ISSUER, [
          revision(1, RevisionStatus.DRAFT),
        ]),
      /Solo se emiten revisiones aprobadas/,
      purpose,
    )
  }
})

// --- Primera regla del propósito: qué se espera de vuelta (B4) ---

test("solo aprobación y revisión esperan calificación", () => {
  assert.equal(expectsQualification(PurposeCode.FOR_APPROVAL), true)
  assert.equal(expectsQualification(PurposeCode.FOR_REVIEW), true)

  assert.equal(expectsQualification(PurposeCode.FOR_INFORMATION), false)
  assert.equal(expectsQualification(PurposeCode.FOR_CONSTRUCTION), false)
  assert.equal(expectsQualification(PurposeCode.AS_BUILT), false)
})

// --- Segunda regla del propósito: qué archivos se esperan (B4) ---

test("la emisión final espera además el editable", () => {
  assert.deepEqual(expectedFileRoles(PurposeCode.FOR_CONSTRUCTION), [
    DocFileRole.DELIVERABLE,
    DocFileRole.SOURCE,
  ])
  assert.deepEqual(expectedFileRoles(PurposeCode.AS_BUILT), [
    DocFileRole.DELIVERABLE,
    DocFileRole.SOURCE,
  ])
})

test("las demás emisiones esperan solo el entregable", () => {
  for (const purpose of [
    PurposeCode.FOR_APPROVAL,
    PurposeCode.FOR_REVIEW,
    PurposeCode.FOR_INFORMATION,
  ]) {
    assert.deepEqual(expectedFileRoles(purpose), [DocFileRole.DELIVERABLE])
  }
})

test("falta lo que el propósito espera y el conjunto no trae", () => {
  assert.deepEqual(
    missingFileRoles(PurposeCode.FOR_CONSTRUCTION, [DocFileRole.DELIVERABLE]),
    [DocFileRole.SOURCE],
  )
  assert.deepEqual(
    missingFileRoles(PurposeCode.FOR_CONSTRUCTION, [
      DocFileRole.DELIVERABLE,
      DocFileRole.SOURCE,
    ]),
    [],
  )
  assert.deepEqual(missingFileRoles(PurposeCode.FOR_APPROVAL, []), [
    DocFileRole.DELIVERABLE,
  ])
})

test("el respaldo no cuenta como entregable ni como fuente", () => {
  assert.deepEqual(
    missingFileRoles(PurposeCode.FOR_CONSTRUCTION, [DocFileRole.SUPPORT]),
    [DocFileRole.DELIVERABLE, DocFileRole.SOURCE],
  )
})
