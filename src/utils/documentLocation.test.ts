import assert from "node:assert/strict"
import test from "node:test"
import { DocScopeMode } from "../generated/prisma/enums.js"
import {
  LOCATION_MESSAGE,
  checkLocation,
  type LocationRejection,
} from "./documentLocation.js"

/**
 * La ubicación del documento (BLOQUE 02B, B3 y B4).
 *
 * Lo que la compilación no puede verificar: que el atributo sea opcional por
 * defecto, que la obligatoriedad no pueda exigir lo que la habilitación prohíbe,
 * que el nodo elegido esté dentro del alcance del documento, y que el régimen de
 * publicación use el árbol del despliegue y solo él.
 */

const PROYECTO = 77
const OTRO = 88

const vigente = (docProjectId: number | null) => ({ docProjectId, terminatedAt: null })
const dadaDeBaja = (docProjectId: number | null) => ({
  docProjectId,
  terminatedAt: new Date(2026, 0, 1),
})

const OPCIONAL = { enabled: true, required: false }
const EXIGIDA = { enabled: true, required: true }
const APAGADA = { enabled: false, required: false }

const enProyecto = (mode: DocScopeMode = DocScopeMode.INHERIT) => ({
  docProjectId: PROYECTO,
  mode,
})
const publicado = { docProjectId: null, mode: DocScopeMode.INHERIT }

const motivo = (check: ReturnType<typeof checkLocation>): LocationRejection | null =>
  check.ok ? null : check.reason

// --- Opcional por defecto ---

test("un documento sin ubicación es válido con la configuración por defecto", () => {
  assert.equal(
    checkLocation({ chosen: null, settings: OPCIONAL, scope: enProyecto() }).ok,
    true,
  )
})

test("el proyecto puede exigirla", () => {
  assert.equal(
    motivo(checkLocation({ chosen: null, settings: EXIGIDA, scope: enProyecto() })),
    "REQUIRED",
  )
})

test("con el atributo deshabilitado, no se exige aunque esté marcada como obligatoria", () => {
  // Exigir lo que no se puede declarar sería una contradicción, no una regla
  // estricta. Es la combinación que una pantalla puede producir sin querer.
  assert.equal(
    checkLocation({
      chosen: null,
      settings: { enabled: false, required: true },
      scope: enProyecto(),
    }).ok,
    true,
  )
})

test("con el atributo deshabilitado no se declara ubicación", () => {
  assert.equal(
    motivo(
      checkLocation({
        chosen: vigente(null),
        settings: APAGADA,
        scope: enProyecto(),
      }),
    ),
    "DISABLED",
  )
})

// --- El alcance ---

test("un proyecto que hereda elige del despliegue y de lo propio", () => {
  assert.equal(
    checkLocation({
      chosen: vigente(null),
      settings: OPCIONAL,
      scope: enProyecto(),
    }).ok,
    true,
  )
  assert.equal(
    checkLocation({
      chosen: vigente(PROYECTO),
      settings: OPCIONAL,
      scope: enProyecto(),
    }).ok,
    true,
  )
})

test("un proyecto con catálogo propio no elige del despliegue", () => {
  assert.equal(
    motivo(
      checkLocation({
        chosen: vigente(null),
        settings: OPCIONAL,
        scope: enProyecto(DocScopeMode.OWN),
      }),
    ),
    "OUT_OF_SCOPE",
  )
  assert.equal(
    checkLocation({
      chosen: vigente(PROYECTO),
      settings: OPCIONAL,
      scope: enProyecto(DocScopeMode.OWN),
    }).ok,
    true,
  )
})

test("ningún modo admite el nodo de otro proyecto", () => {
  for (const mode of Object.values(DocScopeMode)) {
    assert.equal(
      motivo(
        checkLocation({
          chosen: vigente(OTRO),
          settings: OPCIONAL,
          scope: enProyecto(mode),
        }),
      ),
      "OUT_OF_SCOPE",
      `el modo ${mode} admitió un nodo ajeno`,
    )
  }
})

test("el régimen de publicación usa el árbol del despliegue, y solo él", () => {
  // Sin proyecto no se hereda de ninguno, porque no pertenece a ninguno.
  assert.equal(
    checkLocation({ chosen: vigente(null), settings: OPCIONAL, scope: publicado }).ok,
    true,
  )
  assert.equal(
    motivo(
      checkLocation({
        chosen: vigente(PROYECTO),
        settings: OPCIONAL,
        scope: publicado,
      }),
    ),
    "OUT_OF_SCOPE",
  )
})

// --- La baja lógica ---

test("un nodo dado de baja no se elige", () => {
  assert.equal(
    motivo(
      checkLocation({
        chosen: dadaDeBaja(null),
        settings: OPCIONAL,
        scope: enProyecto(),
      }),
    ),
    "TERMINATED",
  )
})

test("la baja se verifica antes que el alcance: el motivo no confunde dos causas", () => {
  // Un nodo ajeno Y dado de baja informa la razón que el usuario puede corregir
  // eligiendo otro, y no la que sugiere un problema de configuración.
  assert.equal(
    motivo(
      checkLocation({
        chosen: dadaDeBaja(OTRO),
        settings: OPCIONAL,
        scope: enProyecto(),
      }),
    ),
    "TERMINATED",
  )
})

// --- Los mensajes ---

test("cada rechazo declara su mensaje", () => {
  const motivos: LocationRejection[] = [
    "DISABLED",
    "REQUIRED",
    "OUT_OF_SCOPE",
    "TERMINATED",
  ]

  for (const r of motivos) {
    assert.ok(LOCATION_MESSAGE[r], `${r} no declara mensaje`)
  }
  assert.deepEqual(Object.keys(LOCATION_MESSAGE).sort(), [...motivos].sort())
})
