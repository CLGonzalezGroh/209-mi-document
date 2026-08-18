import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { parse } from "graphql"
import type { EnumTypeDefinitionNode } from "graphql"
import { resolvers } from "./index.js"
import * as prismaEnums from "../generated/prisma/enums.js"

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
 * Antes que nada, el contrato tiene que ser SDL válido.
 *
 * Lo agrega `BLOQUE 04`, fase 8, después de que un error de sintaxis llegara
 * hasta `rover subgraph check`: una descripción quedó separada del tipo que
 * describía, y **ninguna de las verificaciones anteriores lo vio**. `tsc` no lee
 * el `.graphql`, y el resto de esta suite lo recorre con expresiones regulares,
 * que no distinguen SDL válido de texto parecido a SDL.
 *
 * Es barato y corre en la suite pura: el error deja de necesitar credenciales y
 * red para aparecer.
 */
test("el contrato es SDL sintácticamente válido", () => {
  assert.doesNotThrow(() => parse(contrato))
})

test("y la verificación detecta el defecto que la motivó", () => {
  // Una descripción separada del tipo que describe: dos descripciones seguidas.
  // Si esto no fallara, la prueba anterior no estaría verificando nada.
  assert.throws(() =>
    parse(`
      "Descripción huérfana"
      "Otra descripción"
      enum Ejemplo { UNO }
    `),
  )
})

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

/**
 * Las enumeraciones del contrato dicen lo mismo que las del modelo.
 *
 * Lo agrega `BLOQUE 02C`, fase 6, después de que el control de contrato del
 * despliegue encontrara lo que esta suite no veía: `DocCatalogKind` cambió de
 * tres valores a dos en `schema.prisma`, y el `.graphql` conservó los tres
 * viejos. **Ninguna verificación anterior podía verlo** — `tsc` no lee el
 * contrato, y las pruebas de arriba comparan operaciones y campos, no valores.
 *
 * La consecuencia era peor que una inconsistencia de documentación: el valor
 * nuevo no era enviable —el contrato no lo aceptaba— y los dos retirados sí,
 * hacia una base que ya no los tenía. La operación quedaba inalcanzable por
 * GraphQL, y las pruebas de integración no lo notaban porque llaman al resolver
 * directamente.
 *
 * Se comparan solo las enumeraciones que existen de los dos lados con el mismo
 * nombre: el contrato tiene además las variantes `...Input`, y el modelo tiene
 * enumeraciones que no se exponen.
 */
const enumsDelContrato = new Map(
  (parse(contrato).definitions.filter(
    (d) => d.kind === "EnumTypeDefinition",
  ) as EnumTypeDefinitionNode[]).map((d) => [
    d.name.value,
    (d.values ?? []).map((v) => v.name.value).sort(),
  ]),
)

const enumsDelModelo = new Map(
  Object.entries(prismaEnums as Record<string, unknown>)
    .filter(([, v]) => typeof v === "object" && v !== null)
    .map(([k, v]) => [k, Object.keys(v as object).sort()]),
)

test("las enumeraciones del contrato coinciden con las del modelo", () => {
  const compartidas = [...enumsDelModelo.keys()].filter((n) =>
    enumsDelContrato.has(n),
  )

  // Si esta lista quedara vacía, la prueba no verificaría nada.
  assert.ok(compartidas.length > 10, "no se encontraron enumeraciones compartidas")

  const divergentes = compartidas.filter(
    (n) =>
      JSON.stringify(enumsDelContrato.get(n)) !==
      JSON.stringify(enumsDelModelo.get(n)),
  )

  assert.deepEqual(
    divergentes.map((n) => ({
      enumeracion: n,
      contrato: enumsDelContrato.get(n),
      modelo: enumsDelModelo.get(n),
    })),
    [],
  )
})

test("y la variante Input de una enumeración también coincide", () => {
  // Las `...Input` existen porque el contrato federado no admite reusar la
  // enumeración de salida como entrada. Divergen del mismo modo y sin ruido.
  const conInput = [...enumsDelContrato.keys()].filter(
    (n) => n.endsWith("Input") && enumsDelModelo.has(n.replace(/Input$/, "")),
  )

  assert.ok(conInput.length > 0, "no se encontraron variantes Input")

  const divergentes = conInput.filter(
    (n) =>
      JSON.stringify(enumsDelContrato.get(n)) !==
      JSON.stringify(enumsDelModelo.get(n.replace(/Input$/, ""))),
  )

  assert.deepEqual(divergentes, [])
})
