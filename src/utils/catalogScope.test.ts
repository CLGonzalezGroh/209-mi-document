import assert from "node:assert/strict"
import test from "node:test"
import { DocScopeMode } from "../generated/prisma/enums.js"
import {
  crossScopeChildren,
  effectiveMode,
  parentScopeAdmitted,
  scopeWhere,
  visibleEntries,
} from "./catalogScope.js"

/**
 * Alcance por proyecto de los catálogos documentales (BLOQUE 02B, B1).
 *
 * Lo que la compilación no puede verificar: que la ausencia de declaración sea
 * heredar, que heredar sume y no reemplace —al contrario de las calificaciones—,
 * que el criterio de consulta coincida con el filtro en memoria, y las dos
 * invariantes de cruce del árbol.
 */

const PROYECTO = 77
const OTRO = 88

const entrada = (id: number, docProjectId: number | null) => ({ id, docProjectId })

// --- El modo efectivo ---

test("sin declaración, el proyecto hereda", () => {
  // Es lo que vuelve aditiva la incorporación del mecanismo: todo proyecto
  // existente hereda y nada cambia hasta que alguien declare lo contrario.
  assert.equal(effectiveMode(null), DocScopeMode.INHERIT)
  assert.equal(effectiveMode(undefined), DocScopeMode.INHERIT)
})

test("el modo declarado gana sobre el default", () => {
  assert.equal(effectiveMode(DocScopeMode.OWN), DocScopeMode.OWN)
  assert.equal(effectiveMode(DocScopeMode.INHERIT), DocScopeMode.INHERIT)
})

// --- La resolución ---

const catalogo = [
  entrada(1, null),
  entrada(2, null),
  entrada(3, PROYECTO),
  entrada(4, OTRO),
]

test("heredar SUMA lo propio a lo del despliegue", () => {
  // Es la diferencia deliberada con las calificaciones, donde lo propio
  // reemplaza: acá ampliar es el caso normal de una planta.
  assert.deepEqual(
    visibleEntries(catalogo, {
      docProjectId: PROYECTO,
      mode: DocScopeMode.INHERIT,
    }).map((e) => e.id),
    [1, 2, 3],
  )
})

test("catálogo propio no ve nada del despliegue", () => {
  assert.deepEqual(
    visibleEntries(catalogo, {
      docProjectId: PROYECTO,
      mode: DocScopeMode.OWN,
    }).map((e) => e.id),
    [3],
  )
})

test("ningún modo alcanza el catálogo de otro proyecto", () => {
  for (const mode of Object.values(DocScopeMode)) {
    const ajenas = visibleEntries(catalogo, { docProjectId: PROYECTO, mode }).filter(
      (e) => e.docProjectId === OTRO,
    )
    assert.deepEqual(ajenas, [], `el modo ${mode} filtra el catálogo ajeno`)
  }
})

test("un proyecto con catálogo propio y sin entradas ve la lista vacía", () => {
  // Y no cae al despliegue: declarar propio es declarar que no se hereda, no que
  // se herede mientras no haya nada. Es el caso que la fase 3 vuelve manejable
  // con la siembra por copia.
  assert.deepEqual(
    visibleEntries([entrada(1, null)], {
      docProjectId: PROYECTO,
      mode: DocScopeMode.OWN,
    }),
    [],
  )
})

test("el criterio de consulta coincide con el filtro en memoria", () => {
  // Los dos existen para no traer de la base lo que se va a descartar, y deben
  // decir lo mismo. Acá se compara la forma; que la base la interprete igual lo
  // verifica la prueba de persistencia.
  assert.deepEqual(
    scopeWhere({ docProjectId: PROYECTO, mode: DocScopeMode.OWN }),
    { docProjectId: PROYECTO },
  )
  assert.deepEqual(
    scopeWhere({ docProjectId: PROYECTO, mode: DocScopeMode.INHERIT }),
    { OR: [{ docProjectId: PROYECTO }, { docProjectId: null }] },
  )
})

// --- Las invariantes de cruce ---

test("un nodo del proyecto cuelga del despliegue: eso es ampliar", () => {
  assert.equal(
    parentScopeAdmitted({ childScope: PROYECTO, parentScope: null }),
    true,
  )
})

test("un nodo del despliegue no cuelga de uno de proyecto", () => {
  // Volvería el árbol global dependiente de un proyecto: quien mira el catálogo
  // del despliegue vería una rama ajena.
  assert.equal(
    parentScopeAdmitted({ childScope: null, parentScope: PROYECTO }),
    false,
  )
})

test("un proyecto no cuelga del árbol de otro proyecto", () => {
  assert.equal(
    parentScopeAdmitted({ childScope: PROYECTO, parentScope: OTRO }),
    false,
  )
})

test("dentro del mismo alcance siempre se admite", () => {
  assert.equal(parentScopeAdmitted({ childScope: null, parentScope: null }), true)
  assert.equal(
    parentScopeAdmitted({ childScope: PROYECTO, parentScope: PROYECTO }),
    true,
  )
})

// --- Lo que impide declarar catálogo propio ---

const nodo = (
  id: number,
  docProjectId: number | null,
  parentId: number | null = null,
) => ({ id, docProjectId, parentId })

test("declarar propio se impide si un nodo del proyecto cuelga del despliegue", () => {
  const arbol = [
    nodo(1, null), // Planta, del despliegue
    nodo(2, null, 1), // Área, del despliegue
    nodo(3, PROYECTO, 2), // Unidad que agregó el proyecto: ampliación
  ]

  assert.deepEqual(
    crossScopeChildren(arbol, PROYECTO).map((n) => n.id),
    [3],
  )
})

test("un proyecto con árbol propio y desconectado puede declarar propio", () => {
  const arbol = [
    nodo(1, null),
    nodo(2, PROYECTO), // Raíz propia
    nodo(3, PROYECTO, 2), // Cuelga de su propia raíz
  ]

  assert.deepEqual(crossScopeChildren(arbol, PROYECTO), [])
})

test("la ampliación de otro proyecto no impide declarar la propia", () => {
  const arbol = [nodo(1, null), nodo(2, OTRO, 1), nodo(3, PROYECTO)]

  assert.deepEqual(crossScopeChildren(arbol, PROYECTO), [])
  assert.deepEqual(
    crossScopeChildren(arbol, OTRO).map((n) => n.id),
    [2],
  )
})

test("un catálogo sin ampliaciones no impide nada", () => {
  assert.deepEqual(crossScopeChildren([nodo(1, null), nodo(2, null, 1)], PROYECTO), [])
})
