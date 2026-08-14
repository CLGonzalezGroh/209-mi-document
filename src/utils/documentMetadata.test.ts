import assert from "node:assert/strict"
import test from "node:test"
import { RevisionStatus } from "../generated/prisma/enums.js"
import {
  metadataMatches,
  metadataOfCurrentRevision,
  obsolescenceCause,
} from "./documentMetadata.js"

const revision = (
  id: number,
  status: RevisionStatus,
  title: string,
  fecha: string,
  documentClassId: number | null = 2,
) => ({
  id,
  revisionCode: String(id),
  status,
  createdAt: new Date(fecha),
  title,
  documentTypeId: 4,
  documentClassId,
})

// --- La copia refleja la revisión EN CURSO (BLOQUE 03B, B2) ---

test("la copia toma la metadata de la última revisión viva", () => {
  const metadata = metadataOfCurrentRevision([
    revision(1, RevisionStatus.APPROVED, "Título aprobado", "2026-01-01"),
    revision(2, RevisionStatus.DRAFT, "Título corregido", "2026-02-01"),
  ])

  assert.deepEqual(metadata, {
    title: "Título corregido",
    documentTypeId: 4,
    documentClassId: 2,
  })
})

test("abandonar la revisión devuelve la metadata anterior, sin guardar nada", () => {
  // La propiedad que el bloque persigue, y sale sola: la abandonada deja de ser
  // la última viva y el cálculo cae en la que estaba antes. No hay que revertir
  // nada porque nunca se sobrescribió el origen.
  const aprobada = revision(1, RevisionStatus.APPROVED, "Título aprobado", "2026-01-01")

  const conBorrador = metadataOfCurrentRevision([
    aprobada,
    revision(2, RevisionStatus.DRAFT, "Título corregido", "2026-02-01"),
  ])
  const trasAbandonar = metadataOfCurrentRevision([
    aprobada,
    revision(2, RevisionStatus.ABANDONED, "Título corregido", "2026-02-01"),
  ])

  assert.equal(conBorrador?.title, "Título corregido")
  assert.equal(trasAbandonar?.title, "Título aprobado")
})

test("la revisión abandonada no aporta metadata aunque sea la más nueva", () => {
  const metadata = metadataOfCurrentRevision([
    revision(1, RevisionStatus.APPROVED, "Vigente", "2026-01-01"),
    revision(2, RevisionStatus.ABANDONED, "Descartada", "2026-03-01"),
  ])

  assert.equal(metadata?.title, "Vigente")
})

test("sin revisiones vivas no hay metadata que declarar", () => {
  assert.equal(metadataOfCurrentRevision([]), null)
  assert.equal(
    metadataOfCurrentRevision([
      revision(1, RevisionStatus.ABANDONED, "Descartada", "2026-01-01"),
    ]),
    null,
  )
})

test("la comparación distingue la clase nula de la clase puesta", () => {
  const base = { title: "T", documentTypeId: 4, documentClassId: null }

  assert.equal(metadataMatches(base, { ...base }), true)
  assert.equal(metadataMatches(base, { ...base, documentClassId: 2 }), false)
  assert.equal(metadataMatches(base, { ...base, title: "Otro" }), false)
})

// --- La causa de la obsolescencia se DERIVA (B5) ---

test("el documento que no está obsoleto no tiene causa", () => {
  assert.equal(obsolescenceCause({ obsoletedAt: null, replacementItems: [] }), null)
})

test("figurar como reemplazado en un acto es la causa por reemplazo", () => {
  assert.equal(
    obsolescenceCause({
      obsoletedAt: new Date(),
      replacementItems: [{ role: "REPLACED" }],
    }),
    "REPLACEMENT",
  )
})

test("obsoleto sin figurar en ningún acto es fuera de alcance", () => {
  // La segunda causa: el documento dejó de tener sentido y nada lo reemplaza.
  // Es la que impide derivar la obsolescencia de la existencia de un reemplazo.
  assert.equal(
    obsolescenceCause({ obsoletedAt: new Date(), replacementItems: [] }),
    "OUT_OF_SCOPE",
  )
})

test("haber reemplazado a otro no vuelve obsoleto al que reemplaza", () => {
  // El papel importa: `REPLACING` es el que supera, y sigue vigente.
  assert.equal(
    obsolescenceCause({
      obsoletedAt: new Date(),
      replacementItems: [{ role: "REPLACING" }],
    }),
    "OUT_OF_SCOPE",
  )
})

test("un documento que reemplazó y después fue reemplazado lo está por reemplazo", () => {
  assert.equal(
    obsolescenceCause({
      obsoletedAt: new Date(),
      replacementItems: [{ role: "REPLACING" }, { role: "REPLACED" }],
    }),
    "REPLACEMENT",
  )
})
