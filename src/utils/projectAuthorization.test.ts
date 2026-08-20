import assert from "node:assert/strict"
import test from "node:test"
import { applyProjectScope, buildProjectScope } from "./projectAuthorization.js"

// Criterio de alcance para listados (BLOQUE 02, B7).
// Se prueba la parte pura: dado un conjunto de membresías vigentes, qué filtro
// corresponde. La consulta a la base y el rechazo por membresía se verifican en
// la suite de persistencia.

test("acota a los proyectos con membresía vigente", () => {
  assert.deepEqual(buildProjectScope([7, 3], { includeWithoutProject: false }), {
    docProjectId: { in: [3, 7] },
  })
})

test("sin membresías no alcanza ningún documento en circulación", () => {
  assert.deepEqual(buildProjectScope([], { includeWithoutProject: false }), {
    docProjectId: { in: [] },
  })
})

test("incorpora los documentos sin proyecto cuando se lo pide", () => {
  assert.deepEqual(buildProjectScope([5], { includeWithoutProject: true }), {
    OR: [{ docProjectId: { in: [5] } }, { docProjectId: null }],
  })
})

test("sin membresías alcanza igual el régimen de publicación", () => {
  // Un usuario sin ningún proyecto sigue viendo los documentos publicados, que
  // no circulan y se gobiernan solo por el permiso global (B1).
  assert.deepEqual(buildProjectScope([], { includeWithoutProject: true }), {
    OR: [{ docProjectId: { in: [] } }, { docProjectId: null }],
  })
})

test("los transmittals y workflows nunca incorporan el caso sin proyecto", () => {
  // Ambos pertenecen siempre a un proyecto, de modo que el filtro no debe
  // abrirles la puerta del régimen de publicación.
  const scope = buildProjectScope([1, 2], { includeWithoutProject: false })
  assert.ok(!("OR" in scope))
})

test("deduplica y ordena los proyectos, para que el filtro sea estable", () => {
  assert.deepEqual(buildProjectScope([9, 2, 9, 2, 4], { includeWithoutProject: false }), {
    docProjectId: { in: [2, 4, 9] },
  })
})

test("no muta el arreglo recibido", () => {
  const ids = [3, 1, 2]
  buildProjectScope(ids, { includeWithoutProject: false })
  assert.deepEqual(ids, [3, 1, 2])
})

// Incorporación del alcance a un `where` existente.

test("el alcance no pisa un OR preexistente del resolver", () => {
  // `documents` usa OR para la búsqueda por texto y el alcance también lo usa
  // cuando incorpora el régimen de publicación. Escribirlos a nivel raíz haría
  // que uno reemplace al otro, y el resultado podría AMPLIARSE en lugar de
  // restringirse. Es el error que este combinador existe para impedir.
  const where = { OR: [{ code: { contains: "PL" } }], terminatedAt: null }
  const scope = buildProjectScope([4], { includeWithoutProject: true })

  const resultado = applyProjectScope(where, scope)

  assert.deepEqual(resultado.OR, [{ code: { contains: "PL" } }])
  assert.equal(resultado.terminatedAt, null)
  assert.deepEqual(resultado.AND, [scope])
})

test("acumula sobre un AND preexistente en lugar de reemplazarlo", () => {
  const previo = { documentTypeId: 1 }
  const scope = buildProjectScope([4], { includeWithoutProject: false })

  assert.deepEqual(applyProjectScope({ AND: [previo] }, scope).AND, [previo, scope])
})

test("normaliza un AND que no venía como arreglo", () => {
  const previo = { documentTypeId: 1 }
  const scope = buildProjectScope([4], { includeWithoutProject: false })

  assert.deepEqual(applyProjectScope({ AND: previo }, scope).AND, [previo, scope])
})

test("no muta el where recibido", () => {
  const where = { terminatedAt: null }
  applyProjectScope(where, buildProjectScope([1], { includeWithoutProject: false }))
  assert.deepEqual(where, { terminatedAt: null })
})
