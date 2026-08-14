import assert from "node:assert/strict"
import test from "node:test"
import { DocFileRole } from "../generated/prisma/enums.js"
import {
  hasChanges,
  incompleteReason,
  preloadFrom,
  type CopyFile,
} from "./workingCopy.js"

const archivo = (
  fileKey: string,
  role: DocFileRole,
  checksum = "a".repeat(64),
): CopyFile => ({
  role,
  fileKey,
  fileName: `${fileKey}.bin`,
  fileSize: 10,
  mimeType: "application/octet-stream",
  checksum,
})

const pdf = archivo("plano.pdf", DocFileRole.DELIVERABLE)
const dwg = archivo("plano.dwg", DocFileRole.SOURCE, "b".repeat(64))

// --- Precarga (BLOQUE 03B, B12) ---

test("abrir precarga los archivos de la versión vigente", () => {
  assert.deepEqual(preloadFrom([pdf, dwg]), [pdf, dwg])
})

test("sin versión vigente el conjunto arranca vacío", () => {
  // El documento nace sin archivo: la elaboración existe para producirlo.
  assert.deepEqual(preloadFrom(null), [])
  assert.deepEqual(preloadFrom(undefined), [])
})

test("la precarga proyecta la forma del conjunto y descarta lo de la fila", () => {
  // Los archivos llegan como registros de la versión, con su id y su versionId.
  // Arrastrarlos haría que la copia intentara nacer con la identidad de otro, y
  // el error aparecería recién al escribir en base.
  const desdeLaBase = [
    { id: 99, versionId: 7, createdAt: new Date(), ...pdf },
  ] as unknown as CopyFile[]

  assert.deepEqual(Object.keys(preloadFrom(desdeLaBase)[0]).sort(), [
    "checksum",
    "fileKey",
    "fileName",
    "fileSize",
    "mimeType",
    "role",
  ])
})

test("la precarga copia y no comparte referencias con el origen", () => {
  const origen = [pdf]
  const copia = preloadFrom(origen)
  copia[0].fileName = "otro.pdf"

  assert.equal(origen[0].fileName, pdf.fileName)
})

// --- Confirmar exige al menos un cambio (B12) ---

test("sin tocar nada no hay nada que confirmar", () => {
  // La versión solo existe con contenido nuevo: el principio del §4 se hace
  // cumplir solo, sin una regla que lo enuncie aparte.
  assert.equal(hasChanges([pdf, dwg], preloadFrom([pdf, dwg])), false)
})

test("reemplazar el entregable es un cambio", () => {
  const corregido = { ...pdf, checksum: "c".repeat(64) }

  assert.equal(hasChanges([pdf, dwg], [corregido, dwg]), true)
})

test("adjuntar un archivo es un cambio", () => {
  const memoria = archivo("memoria.xlsx", DocFileRole.SUPPORT)

  assert.equal(hasChanges([pdf], [pdf, memoria]), true)
})

test("quitar un archivo es un cambio", () => {
  assert.equal(hasChanges([pdf, dwg], [pdf]), true)
})

test("cambiar el rol de un archivo es un cambio, aunque el contenido no cambie", () => {
  // El rol es lo que el sistema interpreta: qué se revisa y qué acompaña.
  const comoRespaldo = { ...dwg, role: DocFileRole.SUPPORT }

  assert.equal(hasChanges([pdf, dwg], [pdf, comoRespaldo]), true)
})

test("sustituir un archivo por otro distinto es un cambio, con la misma cantidad", () => {
  const otro = archivo("croquis.pdf", DocFileRole.SOURCE, dwg.checksum)

  assert.equal(hasChanges([pdf, dwg], [pdf, otro]), true)
})

test("el orden en que llegan los archivos no cuenta como cambio", () => {
  assert.equal(hasChanges([pdf, dwg], [dwg, pdf]), false)
})

test("arrastrar la fuente sin volver a subirla no es un cambio", () => {
  // Un archivo que no cambió conserva su fileKey y su checksum: lo que se crea
  // al confirmar es el registro del conjunto, no el objeto almacenado.
  const corregido = { ...pdf, checksum: "c".repeat(64) }
  const nuevo = [corregido, { ...dwg }]

  assert.equal(hasChanges([pdf, dwg], nuevo), true)
  assert.equal(nuevo[1].fileKey, dwg.fileKey)
  assert.equal(nuevo[1].checksum, dwg.checksum)
})

// --- Qué hace falta para confirmar (B6, B7) ---

test("el conjunto vacío no se confirma", () => {
  assert.equal(incompleteReason([]), "EMPTY")
})

test("un conjunto sin entregable no se confirma", () => {
  // Al menos uno con rol DELIVERABLE: el entregable es lo que se revisa y se
  // marca, y un conjunto sin él no es una emisión.
  assert.equal(incompleteReason([dwg]), "NO_DELIVERABLE")
  assert.equal(
    incompleteReason([dwg, archivo("memoria.xlsx", DocFileRole.SUPPORT)]),
    "NO_DELIVERABLE",
  )
})

test("con un entregable alcanza, y admite varios", () => {
  assert.equal(incompleteReason([pdf]), null)
  assert.equal(incompleteReason([pdf, dwg]), null)
  assert.equal(
    incompleteReason([pdf, archivo("planilla.pdf", DocFileRole.DELIVERABLE)]),
    null,
  )
})
