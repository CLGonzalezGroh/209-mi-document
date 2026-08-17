import assert from "node:assert/strict"
import test from "node:test"
import {
  PATH_SEPARATOR,
  composePath,
  subtreeIds,
  subtreePaths,
  wouldCycle,
  type LocationNode,
} from "./locationPath.js"

/**
 * Rutas del catálogo de ubicación (BLOQUE 02B, B6).
 *
 * Tres reglas que la compilación no puede verificar: que la ruta se componga con
 * la ascendencia, que renombrar o mover un nodo alcance a toda su descendencia y
 * solo a ella, y que un movimiento no pueda convertir el árbol en un grafo con
 * ciclos.
 *
 * El árbol de las pruebas es el del dominio:
 *
 *   1 Planta Urea
 *     2 Área 100
 *       4 Unidad 110
 *       5 Unidad 120
 *     3 Área 200
 *   6 Planta Amoníaco
 */

const arbol: LocationNode[] = [
  { id: 1, parentId: null, name: "Planta Urea" },
  { id: 2, parentId: 1, name: "Área 100" },
  { id: 3, parentId: 1, name: "Área 200" },
  { id: 4, parentId: 2, name: "Unidad 110" },
  { id: 5, parentId: 2, name: "Unidad 120" },
  { id: 6, parentId: null, name: "Planta Amoníaco" },
]

// --- La composición de la ruta ---

test("un nodo raíz es su nombre; uno anidado lleva la ruta de su padre", () => {
  assert.equal(composePath(null, "Planta Urea"), "Planta Urea")
  assert.equal(
    composePath("Planta Urea", "Área 100"),
    `Planta Urea${PATH_SEPARATOR}Área 100`,
  )
})

test("el separador es el mismo que usa digitalización", () => {
  assert.equal(PATH_SEPARATOR, " / ")
})

// --- Renombrar ---

test("renombrar un nodo intermedio reescribe su rama completa", () => {
  const renombrado = arbol.map((n) =>
    n.id === 2 ? { ...n, name: "Área 100 - Síntesis" } : n,
  )

  const rutas = subtreePaths({
    rootId: 2,
    parentPath: "Planta Urea",
    nodes: renombrado,
  })

  assert.deepEqual(
    [...rutas.entries()].sort((a, b) => a[0] - b[0]),
    [
      [2, "Planta Urea / Área 100 - Síntesis"],
      [4, "Planta Urea / Área 100 - Síntesis / Unidad 110"],
      [5, "Planta Urea / Área 100 - Síntesis / Unidad 120"],
    ],
  )
})

test("el recálculo alcanza a la descendencia y a nadie más", () => {
  const rutas = subtreePaths({ rootId: 2, parentPath: "Planta Urea", nodes: arbol })

  // El padre, el hermano y la otra raíz quedan afuera: escribirlos sería
  // reescribir rutas que no cambiaron.
  assert.equal(rutas.has(1), false)
  assert.equal(rutas.has(3), false)
  assert.equal(rutas.has(6), false)
})

test("una hoja se recalcula sola", () => {
  const rutas = subtreePaths({
    rootId: 4,
    parentPath: "Planta Urea / Área 100",
    nodes: arbol,
  })

  assert.deepEqual([...rutas.entries()], [
    [4, "Planta Urea / Área 100 / Unidad 110"],
  ])
})

test("un nodo que no existe no produce rutas", () => {
  const rutas = subtreePaths({ rootId: 99, parentPath: null, nodes: arbol })

  assert.equal(rutas.size, 0)
})

// --- Mover ---

test("mover una rama la reescribe bajo su nuevo padre", () => {
  const movido = arbol.map((n) => (n.id === 2 ? { ...n, parentId: 6 } : n))

  const rutas = subtreePaths({
    rootId: 2,
    parentPath: "Planta Amoníaco",
    nodes: movido,
  })

  assert.deepEqual(
    [...rutas.entries()].sort((a, b) => a[0] - b[0]),
    [
      [2, "Planta Amoníaco / Área 100"],
      [4, "Planta Amoníaco / Área 100 / Unidad 110"],
      [5, "Planta Amoníaco / Área 100 / Unidad 120"],
    ],
  )
})

test("mover una rama a la raíz le quita la ascendencia", () => {
  const movido = arbol.map((n) => (n.id === 2 ? { ...n, parentId: null } : n))

  const rutas = subtreePaths({ rootId: 2, parentPath: null, nodes: movido })

  assert.equal(rutas.get(2), "Área 100")
  assert.equal(rutas.get(4), "Área 100 / Unidad 110")
})

// --- Ciclos ---

test("colgar un nodo de su propio descendiente es un ciclo", () => {
  assert.equal(wouldCycle(1, 4, arbol), true)
  assert.equal(wouldCycle(2, 5, arbol), true)
})

test("colgar un nodo de sí mismo es un ciclo", () => {
  assert.equal(wouldCycle(2, 2, arbol), true)
})

test("mover a otra rama, a la raíz o a un ascendiente distinto no cicla", () => {
  assert.equal(wouldCycle(2, 6, arbol), false)
  assert.equal(wouldCycle(2, null, arbol), false)
  assert.equal(wouldCycle(4, 3, arbol), false)
})

test("un ciclo preexistente en los datos no cuelga la verificación", () => {
  // Dos nodos que se apuntan entre sí: no debería existir, y si existe el
  // recorrido tiene que terminar igual.
  const roto = [
    { id: 10, parentId: 11 },
    { id: 11, parentId: 10 },
    { id: 12, parentId: null },
  ]

  assert.equal(wouldCycle(12, 10, roto), false)
})

test("el recálculo tampoco cuelga con un ciclo preexistente", () => {
  const roto: LocationNode[] = [
    { id: 10, parentId: 11, name: "A" },
    { id: 11, parentId: 10, name: "B" },
  ]

  const rutas = subtreePaths({ rootId: 10, parentPath: null, nodes: roto })

  assert.equal(rutas.get(10), "A")
  assert.equal(rutas.get(11), "A / B")
})

// --- La rama, como conjunto de identificadores ---

test("la rama incluye el nodo y toda su descendencia", () => {
  // Quien pregunta por un área pregunta por lo que hay dentro: los documentos de
  // sus unidades cuentan.
  assert.deepEqual(subtreeIds(arbol, 2).sort(), [2, 4, 5])
})

test("una hoja es su propia rama", () => {
  assert.deepEqual(subtreeIds(arbol, 4), [4])
})

test("la rama de la raíz es su árbol y no el catálogo entero", () => {
  assert.deepEqual(subtreeIds(arbol, 1).sort(), [1, 2, 3, 4, 5])
  // La otra raíz queda afuera.
  assert.equal(subtreeIds(arbol, 1).includes(6), false)
})

test("un nodo inexistente no devuelve nada, y no devuelve todo", () => {
  // Es la diferencia entre un filtro que no encuentra y un filtro que se
  // desactiva solo.
  assert.deepEqual(subtreeIds(arbol, 99), [])
})
