import assert from "node:assert/strict"
import test from "node:test"
import { DocLocationOrigin } from "../generated/prisma/enums.js"
import { planSeed, type SeedSourceNode } from "./catalogSeed.js"

/**
 * Siembra por copia del catálogo de ubicación (BLOQUE 02B, B2).
 *
 * Lo que la compilación no puede verificar: que la identidad del nodo sea su
 * ruta, que el orden ponga los padres antes que los hijos, que sembrar dos veces
 * no duplique, que una fuente solapada cuelgue lo que falta de lo que ya está, y
 * que lo dado de baja no viaje.
 *
 * El árbol de la fuente:
 *
 *   Planta Urea
 *     Área 100
 *       Unidad 110
 *     Área 200
 *   Planta Amoníaco
 */

const nodo = (
  id: number,
  path: string,
  parentId: number | null = null,
  extra: Partial<SeedSourceNode> = {},
): SeedSourceNode => ({
  id,
  parentId,
  code: `C${id}`,
  name: path.split(" / ").pop()!,
  path,
  sortOrder: 0,
  externalOrigin: null,
  externalRef: null,
  terminatedAt: null,
  ...extra,
})

const fuente: SeedSourceNode[] = [
  nodo(1, "Planta Urea"),
  nodo(2, "Planta Urea / Área 100", 1),
  nodo(3, "Planta Urea / Área 100 / Unidad 110", 2),
  nodo(4, "Planta Urea / Área 200", 1),
  nodo(5, "Planta Amoníaco"),
]

// --- El destino vacío ---

test("un destino vacío recibe el árbol completo", () => {
  const plan = planSeed({ source: fuente, destinationPaths: [] })

  assert.equal(plan.steps.length, 5)
  assert.equal(plan.alreadyPresent, 0)
  assert.equal(plan.skippedTerminated, 0)
})

test("el padre siempre queda antes que sus hijos", () => {
  const plan = planSeed({ source: fuente, destinationPaths: [] })

  const posicion = new Map(plan.steps.map((s, i) => [s.path, i]))
  for (const paso of plan.steps) {
    if (paso.parentPath === null) continue
    assert.ok(
      posicion.get(paso.parentPath)! < posicion.get(paso.path)!,
      `${paso.path} se crea antes que su padre`,
    )
  }
})

test("cada paso declara la ruta de su padre, no su identificador", () => {
  // Es lo que permite colgar de un nodo que el destino ya tenía y de uno que la
  // propia siembra crea unos pasos antes, sin distinguir los dos casos.
  const plan = planSeed({ source: fuente, destinationPaths: [] })

  const unidad = plan.steps.find((s) => s.path.endsWith("Unidad 110"))
  assert.equal(unidad?.parentPath, "Planta Urea / Área 100")

  const raiz = plan.steps.find((s) => s.path === "Planta Urea")
  assert.equal(raiz?.parentPath, null)
})

// --- La idempotencia ---

test("sembrar sobre un destino que ya lo ve todo no agrega nada", () => {
  // Es el caso de sembrar el árbol del despliegue en un proyecto que hereda: ya
  // lo ve, y crear copias propias lo taparía con duplicados.
  const plan = planSeed({
    source: fuente,
    destinationPaths: fuente.map((n) => n.path),
  })

  assert.deepEqual(plan.steps, [])
  assert.equal(plan.alreadyPresent, 5)
})

test("una fuente solapada agrega solo lo que falta, colgándolo de lo que ya está", () => {
  const plan = planSeed({
    source: fuente,
    destinationPaths: ["Planta Urea", "Planta Urea / Área 100"],
  })

  assert.deepEqual(
    plan.steps.map((s) => s.path),
    [
      "Planta Amoníaco",
      "Planta Urea / Área 200",
      "Planta Urea / Área 100 / Unidad 110",
    ],
  )
  assert.equal(plan.alreadyPresent, 2)

  // La unidad cuelga del área que el destino ya tenía: el plan no la recrea.
  const unidad = plan.steps.find((s) => s.path.endsWith("Unidad 110"))
  assert.equal(unidad?.parentPath, "Planta Urea / Área 100")
})

test("la identidad es la ruta y no el código", () => {
  // Dos nodos con el mismo código en plantas distintas son dos nodos, y el
  // destino que ya tiene uno recibe el otro.
  const conCodigoRepetido: SeedSourceNode[] = [
    nodo(1, "Planta Urea"),
    nodo(2, "Planta Amoníaco"),
    { ...nodo(3, "Planta Urea / 100", 1), code: "100" },
    { ...nodo(4, "Planta Amoníaco / 100", 2), code: "100" },
  ]

  const plan = planSeed({
    source: conCodigoRepetido,
    destinationPaths: ["Planta Urea", "Planta Urea / 100"],
  })

  assert.deepEqual(
    plan.steps.map((s) => s.path),
    ["Planta Amoníaco", "Planta Amoníaco / 100"],
  )
})

// --- Lo dado de baja ---

test("un nodo dado de baja no se copia", () => {
  const conBaja = fuente.map((n) =>
    n.id === 5 ? { ...n, terminatedAt: new Date(2026, 0, 1) } : n,
  )

  const plan = planSeed({ source: conBaja, destinationPaths: [] })

  assert.equal(plan.steps.length, 4)
  assert.equal(plan.skippedTerminated, 1)
  assert.equal(
    plan.steps.some((s) => s.path === "Planta Amoníaco"),
    false,
  )
})

test("la descendencia de un nodo dado de baja tampoco viaja", () => {
  // La rama no tendría de qué colgar: sembrar el hijo sin el padre lo convertiría
  // en una raíz que nadie pidió.
  const conBaja = fuente.map((n) =>
    n.id === 2 ? { ...n, terminatedAt: new Date(2026, 0, 1) } : n,
  )

  const plan = planSeed({ source: conBaja, destinationPaths: [] })

  assert.deepEqual(
    plan.steps.map((s) => s.path).sort(),
    ["Planta Amoníaco", "Planta Urea", "Planta Urea / Área 200"],
  )
  // El área dada de baja y su unidad.
  assert.equal(plan.skippedTerminated, 2)
})

// --- Lo que viaja con el nodo ---

test("el orden y la referencia externa viajan con el nodo", () => {
  // La referencia identifica el MISMO objeto real —el mismo activo, el mismo
  // registro externo—, de modo que copiar el nodo sin ella perdería el vínculo.
  const conReferencia = [
    nodo(1, "Planta Urea", null, {
      sortOrder: 30,
      externalOrigin: DocLocationOrigin.ASSETS,
      externalRef: "TAG-110",
    }),
  ]

  const [paso] = planSeed({ source: conReferencia, destinationPaths: [] }).steps

  assert.equal(paso.sortOrder, 30)
  assert.equal(paso.externalOrigin, DocLocationOrigin.ASSETS)
  assert.equal(paso.externalRef, "TAG-110")
  assert.equal(paso.code, "C1")
})

test("el plan es determinista: dos corridas iguales dan la misma secuencia", () => {
  const desordenada = [...fuente].reverse()

  assert.deepEqual(
    planSeed({ source: fuente, destinationPaths: [] }).steps.map((s) => s.path),
    planSeed({ source: desordenada, destinationPaths: [] }).steps.map((s) => s.path),
  )
})

test("un ascendiente que la fuente no ve corta la rama", () => {
  // No debería ocurrir con una vista resuelta, y si ocurre la rama no es
  // reconstruible: se cuenta como no copiable en lugar de colgarse de la nada.
  const huerfano = [nodo(9, "Planta Ajena / Área 900", 99)]

  const plan = planSeed({ source: huerfano, destinationPaths: [] })

  assert.deepEqual(plan.steps, [])
  assert.equal(plan.skippedTerminated, 1)
})
