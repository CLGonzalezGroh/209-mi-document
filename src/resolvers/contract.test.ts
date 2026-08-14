import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { resolvers } from "./index.js"

/**
 * El contrato y los resolvers dicen lo mismo (BLOQUE 03B, fase G).
 *
 * Es el defecto que ninguna de las dos verificaciones habituales encuentra:
 * `tsc` no sabe qué declara el `.graphql`, y `rover subgraph check` compara el
 * esquema contra las **operaciones registradas** —que pueden ser cero—, no
 * contra la implementación.
 *
 * Las dos direcciones importan y fallan distinto. Una operación declarada sin
 * resolver devuelve `null` en ejecución, en silencio; un resolver sin declarar
 * es inalcanzable, y su ausencia se descubre cuando alguien intenta usarlo.
 */

const contrato = readFileSync("./schema.graphql", { encoding: "utf-8" })

/**
 * Los campos de un tipo raíz, leídos del contrato.
 *
 * Lleva la profundidad de paréntesis: los argumentos de una operación multilínea
 * se declaran con la misma forma `nombre: Tipo` que un campo, y contarlos daría
 * un falso faltante por cada uno.
 */
const camposDe = (tipo: "Query" | "Mutation"): string[] => {
  const inicio = contrato.indexOf(`type ${tipo} {`)
  assert.notEqual(inicio, -1, `el contrato no declara type ${tipo}`)

  const cuerpo = contrato.slice(inicio)
  const lineas = cuerpo.slice(0, cuerpo.indexOf("\n}")).split("\n")

  const campos: string[] = []
  let profundidad = 0
  let enBloque = false

  for (const linea of lineas) {
    const comillas = (linea.match(/"""/g) ?? []).length
    if (comillas % 2 === 1) enBloque = !enBloque
    if (enBloque || comillas > 0) continue

    if (profundidad === 0) {
      const campo = linea.match(/^  ([a-zA-Z][a-zA-Z0-9]*)\s*[(:]/)?.[1]
      if (campo) campos.push(campo)
    }

    profundidad += (linea.match(/\(/g) ?? []).length
    profundidad -= (linea.match(/\)/g) ?? []).length
  }

  return [...new Set(campos)]
}

for (const tipo of ["Query", "Mutation"] as const) {
  test(`toda ${tipo} declarada tiene resolver`, () => {
    const implementados = new Set(Object.keys(resolvers[tipo] ?? {}))
    const faltantes = camposDe(tipo).filter((n) => !implementados.has(n))

    assert.deepEqual(
      faltantes,
      [],
      `declaradas sin resolver: devolverían null en silencio`,
    )
  })

  test(`todo resolver de ${tipo} está declarado`, () => {
    const declarados = new Set(camposDe(tipo))
    const huerfanos = Object.keys(resolvers[tipo] ?? {}).filter(
      (n) => !declarados.has(n),
    )

    assert.deepEqual(
      huerfanos,
      [],
      `resolvers sin declarar: son inalcanzables desde el contrato`,
    )
  })
}

test("el contrato expone las operaciones que el bloque incorpora", () => {
  const mutaciones = new Set(camposDe("Mutation"))

  for (const esperada of [
    "updateRevisionMetadata",
    "correctDocumentCode",
    "replaceDocuments",
    "obsoleteDocument",
    "openWorkingCopy",
    "putWorkingCopyFile",
    "removeWorkingCopyFile",
    "confirmWorkingCopy",
    "discardWorkingCopy",
  ]) {
    assert.ok(mutaciones.has(esperada), `falta ${esperada}`)
  }
})

test("el contrato no declara los campos que el bloque movió de nivel", () => {
  // La identificación vive en la revisión (B1) y el archivo en el conjunto (B6).
  // Dejar los nombres viejos declarados haría que un consumidor los pidiera y
  // recibiera null sin enterarse de que el dato se mudó.
  const documento = contrato.slice(
    contrato.indexOf("type Document @key"),
    contrato.indexOf("type DocumentRevision @key"),
  )

  for (const retirado of ["\n  title:", "\n  documentType:", "\n  documentClass:"]) {
    assert.ok(
      !documento.includes(retirado),
      `Document todavía declara ${retirado.trim()}`,
    )
  }

  const version = contrato.slice(
    contrato.indexOf("type DocumentVersion @key"),
    contrato.indexOf("type DocVersionFile"),
  )
  for (const retirado of ["fileKey", "checksum", "mimeType"]) {
    assert.ok(
      !version.includes(retirado),
      `DocumentVersion todavía declara ${retirado}`,
    )
  }
})
