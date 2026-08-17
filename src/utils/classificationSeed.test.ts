import assert from "node:assert/strict"
import test from "node:test"
import {
  planClassificationSeed,
  typeKey,
  type SeedSourceClass,
  type SeedSourceType,
} from "./classificationSeed.js"

/**
 * La siembra del catálogo plano (BLOQUE 02C, B2), sin base.
 *
 * Lo que estas pruebas fijan es la **identidad**: una clase es su código, y un
 * tipo su código dentro de su clase. De ahí sale que sembrar sea incremental e
 * idempotente, y que un tipo arrastre su clase.
 */

let siguienteId = 1

const clase = (
  code: string,
  extra: Partial<SeedSourceClass> = {},
): SeedSourceClass => ({
  id: siguienteId++,
  code,
  name: `Clase ${code}`,
  description: null,
  sortOrder: 0,
  terminatedAt: null,
  ...extra,
})

const tipo = (
  code: string,
  classId: number | null,
  extra: Partial<SeedSourceType> = {},
): SeedSourceType => ({
  id: siguienteId++,
  code,
  name: `Tipo ${code}`,
  classId,
  description: null,
  requiresFormalReview: false,
  terminatedAt: null,
  ...extra,
})

const vacio = { classCodes: [], typeKeys: [] }

test("copia clases y tipos en un acto, con las clases primero", () => {
  const civil = clase("CIVIL")
  const plan = planClassificationSeed({
    source: { classes: [civil], types: [tipo("PLANO", civil.id)] },
    destination: vacio,
  })

  assert.equal(plan.classSteps.length, 1)
  assert.equal(plan.typeSteps.length, 1)
  assert.equal(plan.typeSteps[0].classCode, "CIVIL")
})

test("el tipo lleva el CÓDIGO de su clase y no su identificador", () => {
  // Es lo que permite resolverlo en el destino, donde la clase copiada tiene
  // otro identificador que todavía no existe cuando el plan se arma.
  const civil = clase("CIVIL")
  const plan = planClassificationSeed({
    source: { classes: [civil], types: [tipo("PLANO", civil.id)] },
    destination: vacio,
  })

  assert.equal(plan.typeSteps[0].classCode, "CIVIL")
  assert.equal("classId" in plan.typeSteps[0], false)
})

test("un tipo sin clase viaja sin clase", () => {
  const plan = planClassificationSeed({
    source: { classes: [], types: [tipo("NOTA", null)] },
    destination: vacio,
  })

  assert.equal(plan.typeSteps.length, 1)
  assert.equal(plan.typeSteps[0].classCode, null)
})

test("sembrar dos veces no duplica", () => {
  const civil = clase("CIVIL")
  const source = { classes: [civil], types: [tipo("PLANO", civil.id)] }

  const primera = planClassificationSeed({ source, destination: vacio })

  const segunda = planClassificationSeed({
    source,
    destination: {
      classCodes: primera.classSteps.map((c) => c.code),
      typeKeys: primera.typeSteps.map((t) => typeKey(t.classCode, t.code)),
    },
  })

  assert.equal(segunda.classSteps.length, 0)
  assert.equal(segunda.typeSteps.length, 0)
  assert.equal(segunda.alreadyPresent, 2)
})

test("una fuente parcialmente solapada agrega solo lo que falta", () => {
  const civil = clase("CIVIL")
  const elec = clase("ELEC")
  const plan = planClassificationSeed({
    source: {
      classes: [civil, elec],
      types: [tipo("PLANO", civil.id), tipo("PLANO", elec.id)],
    },
    destination: { classCodes: ["CIVIL"], typeKeys: [typeKey("CIVIL", "PLANO")] },
  })

  assert.deepEqual(
    plan.classSteps.map((c) => c.code),
    ["ELEC"],
  )
  assert.deepEqual(
    plan.typeSteps.map((t) => `${t.classCode}/${t.code}`),
    ["ELEC/PLANO"],
  )
  assert.equal(plan.alreadyPresent, 2)
})

test("el mismo código de tipo bajo dos clases son dos entradas", () => {
  // La identidad del tipo es su código DENTRO de su clase: sin la clase en la
  // clave, la segunda se leería como duplicada y no viajaría.
  const civil = clase("CIVIL")
  const elec = clase("ELEC")
  const plan = planClassificationSeed({
    source: {
      classes: [civil, elec],
      types: [tipo("PLANO", civil.id), tipo("PLANO", elec.id)],
    },
    destination: vacio,
  })

  assert.equal(plan.typeSteps.length, 2)
  assert.equal(plan.alreadyPresent, 0)
})

test("el tipo arrastra su clase cuando el destino no la tiene", () => {
  const civil = clase("CIVIL")
  const plan = planClassificationSeed({
    source: { classes: [civil], types: [tipo("PLANO", civil.id)] },
    destination: { classCodes: [], typeKeys: [] },
  })

  // La clase viaja aunque el destino no la pidiera: un tipo sin su clase es el
  // huérfano que B1 descarta.
  assert.deepEqual(
    plan.classSteps.map((c) => c.code),
    ["CIVIL"],
  )
})

test("el tipo cuelga de la clase que el destino YA tenía", () => {
  const civil = clase("CIVIL")
  const plan = planClassificationSeed({
    source: { classes: [civil], types: [tipo("PLANO", civil.id)] },
    destination: { classCodes: ["CIVIL"], typeKeys: [] },
  })

  assert.equal(plan.classSteps.length, 0)
  assert.equal(plan.typeSteps[0].classCode, "CIVIL")
  assert.equal(plan.alreadyPresent, 1)
})

// --- Lo vigente (B2, tercera regla) ---

test("una clase dada de baja no se copia", () => {
  const plan = planClassificationSeed({
    source: {
      classes: [clase("VIEJA", { terminatedAt: new Date() })],
      types: [],
    },
    destination: vacio,
  })

  assert.equal(plan.classSteps.length, 0)
  assert.equal(plan.skippedTerminated, 1)
})

test("un tipo cuya clase está dada de baja tampoco se copia", () => {
  // La clase no viaja, de modo que el tipo no tendría de qué colgar. Es la misma
  // regla que en el árbol descarta la rama sin ascendencia vigente.
  const vieja = clase("VIEJA", { terminatedAt: new Date() })
  const plan = planClassificationSeed({
    source: { classes: [vieja], types: [tipo("PLANO", vieja.id)] },
    destination: vacio,
  })

  assert.equal(plan.typeSteps.length, 0)
  assert.equal(plan.skippedTerminated, 2)
})

test("un tipo cuya clase no está en lo que la fuente ve no se copia", () => {
  // La clase existe en algún lado, pero no en la vista de la fuente: la entrada
  // no es reconstruible desde ahí.
  const plan = planClassificationSeed({
    source: { classes: [], types: [tipo("PLANO", 9999)] },
    destination: vacio,
  })

  assert.equal(plan.typeSteps.length, 0)
  assert.equal(plan.skippedTerminated, 1)
})

test("un tipo dado de baja no se copia aunque su clase esté vigente", () => {
  const civil = clase("CIVIL")
  const plan = planClassificationSeed({
    source: {
      classes: [civil],
      types: [tipo("PLANO", civil.id, { terminatedAt: new Date() })],
    },
    destination: vacio,
  })

  assert.equal(plan.classSteps.length, 1)
  assert.equal(plan.typeSteps.length, 0)
  assert.equal(plan.skippedTerminated, 1)
})

// --- El orden ---

test("el plan es determinista", () => {
  const a = clase("BBB")
  const b = clase("AAA")
  const plan = planClassificationSeed({
    source: {
      classes: [a, b],
      types: [tipo("ZZZ", a.id), tipo("AAA", b.id)],
    },
    destination: vacio,
  })

  assert.deepEqual(
    plan.classSteps.map((c) => c.code),
    ["AAA", "BBB"],
  )
  assert.deepEqual(
    plan.typeSteps.map((t) => t.code),
    ["AAA", "ZZZ"],
  )
})

test("los atributos de la entrada viajan con ella", () => {
  const civil = clase("CIVIL", { description: "Obra civil", sortOrder: 7 })
  const plan = planClassificationSeed({
    source: {
      classes: [civil],
      types: [
        tipo("PLANO", civil.id, {
          description: "Plano de obra",
          requiresFormalReview: true,
        }),
      ],
    },
    destination: vacio,
  })

  assert.equal(plan.classSteps[0].description, "Obra civil")
  assert.equal(plan.classSteps[0].sortOrder, 7)
  assert.equal(plan.typeSteps[0].description, "Plano de obra")
  assert.equal(plan.typeSteps[0].requiresFormalReview, true)
})
