import assert from "node:assert/strict"
import test from "node:test"
import { QualificationEffect } from "../generated/prisma/enums.js"
import {
  approvesStep,
  enablesUse,
  hasOwnCatalog,
  requiresNewRevision,
  resolveScope,
} from "./qualifications.js"

/**
 * Catálogo de calificaciones (BLOQUE 04, B11).
 *
 * Dos reglas puras que la compilación no puede verificar: que las dos preguntas
 * de D-22 se deriven bien del efecto, y que el proyecto REEMPLACE al despliegue
 * en lugar de heredarlo.
 */

const entrada = (id: number, projectId: number | null) => ({ id, projectId })

// --- El efecto y sus dos lecturas ---

test("el efecto responde las dos preguntas de D-22", () => {
  assert.equal(enablesUse(QualificationEffect.ACCEPTED), true)
  assert.equal(requiresNewRevision(QualificationEffect.ACCEPTED), false)

  assert.equal(enablesUse(QualificationEffect.ACCEPTED_WITH_COMMENTS), true)
  assert.equal(
    requiresNewRevision(QualificationEffect.ACCEPTED_WITH_COMMENTS),
    true,
  )

  assert.equal(enablesUse(QualificationEffect.REJECTED), false)
  assert.equal(requiresNewRevision(QualificationEffect.REJECTED), true)
})

test("la cuarta combinación no existe: ningún efecto deja de habilitar sin obligar", () => {
  const imposible = Object.values(QualificationEffect).filter(
    (e) => !enablesUse(e) && !requiresNewRevision(e),
  )

  assert.deepEqual(imposible, [])
})

test("el desenlace del paso es binario y lo deriva el efecto", () => {
  assert.equal(approvesStep(QualificationEffect.ACCEPTED), true)
  assert.equal(approvesStep(QualificationEffect.ACCEPTED_WITH_COMMENTS), true)
  assert.equal(approvesStep(QualificationEffect.REJECTED), false)
})

// --- El alcance ---

test("sin catálogo propio, el proyecto resuelve el del despliegue", () => {
  const catalogo = [entrada(1, null), entrada(2, null)]

  assert.deepEqual(
    resolveScope(catalogo, 77).map((e) => e.id),
    [1, 2],
  )
})

test("con catálogo propio, el proyecto REEMPLAZA al despliegue y no lo hereda", () => {
  const catalogo = [entrada(1, null), entrada(2, null), entrada(3, 77)]

  // Tres del despliegue más una propia serían cuatro si heredara. Son una.
  assert.deepEqual(
    resolveScope(catalogo, 77).map((e) => e.id),
    [3],
  )
})

test("el catálogo propio de un proyecto no alcanza a otro", () => {
  const catalogo = [entrada(1, null), entrada(3, 77)]

  assert.deepEqual(
    resolveScope(catalogo, 99).map((e) => e.id),
    [1],
  )
})

test("el alcance nulo resuelve solo las del despliegue", () => {
  const catalogo = [entrada(1, null), entrada(3, 77)]

  assert.deepEqual(
    resolveScope(catalogo, null).map((e) => e.id),
    [1],
  )
})

test("declarar catálogo propio no depende de que la entrada esté vigente", () => {
  // La baja lógica se filtra DESPUÉS de resolver el alcance. Si decidiera el
  // alcance, dar de baja la última calificación propia devolvería el proyecto al
  // catálogo del despliegue y le cambiaría en silencio los valores disponibles.
  const catalogo = [entrada(1, null), entrada(3, 77)]

  assert.equal(hasOwnCatalog(catalogo, 77), true)
  assert.equal(hasOwnCatalog(catalogo, 99), false)
  assert.deepEqual(
    resolveScope(catalogo, 77).map((e) => e.id),
    [3],
  )
})
