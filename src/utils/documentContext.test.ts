import assert from "node:assert/strict"
import test from "node:test"
import { ModuleType } from "../generated/prisma/enums.js"
import { assertDocumentContext, documentContextViolation } from "./documentContext.js"

// Invariante del contexto de un documento (BLOQUE 02, B1).

test("un documento de proyecto exige proyecto", () => {
  assert.equal(documentContextViolation(ModuleType.PROJECTS, 42), null)
  assert.ok(documentContextViolation(ModuleType.PROJECTS, null))
  assert.ok(documentContextViolation(ModuleType.PROJECTS, undefined))
})

test("un documento de otro módulo no lleva proyecto", () => {
  assert.equal(documentContextViolation(ModuleType.QUALITY, null), null)
  assert.equal(documentContextViolation(ModuleType.QUALITY, undefined), null)
  assert.ok(documentContextViolation(ModuleType.QUALITY, 42))
})

test("el nulo es el régimen de publicación en todos los módulos no-proyecto", () => {
  for (const module of [
    ModuleType.QUALITY,
    ModuleType.TAGS,
    ModuleType.OPERATIONS,
    ModuleType.MANAGEMENT,
    ModuleType.COMERCIAL,
  ]) {
    assert.equal(documentContextViolation(module, null), null, `falló en ${module}`)
  }
})

test("la variante que corta lanza BAD_USER_INPUT", () => {
  assert.doesNotThrow(() => assertDocumentContext(ModuleType.PROJECTS, 42))
  assert.throws(
    () => assertDocumentContext(ModuleType.PROJECTS, null),
    (error: any) => error.extensions?.code === "BAD_USER_INPUT",
  )
})
