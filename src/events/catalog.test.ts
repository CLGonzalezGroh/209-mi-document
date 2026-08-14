import assert from "node:assert/strict"
import test from "node:test"
import { DocObjectType } from "../generated/prisma/enums.js"
import {
  AUDIT_ACTIONS,
  DOC_OBJECT_READ_PERMISSION,
  AUDIT_ACTION_OBJECT,
  WORKFLOW_EVENTS,
  WORKFLOW_EVENT_OBJECT,
} from "./catalog.js"

test("el catálogo de acciones no tiene duplicados", () => {
  assert.equal(new Set(AUDIT_ACTIONS).size, AUDIT_ACTIONS.length)
})

test("el catálogo de transiciones no tiene duplicados", () => {
  assert.equal(new Set(WORKFLOW_EVENTS).size, WORKFLOW_EVENTS.length)
})

test("cada acción declara su tipo de objeto y ninguno sobra", () => {
  for (const action of AUDIT_ACTIONS) {
    assert.ok(
      AUDIT_ACTION_OBJECT[action],
      `la acción ${action} no declara tipo de objeto`,
    )
  }
  assert.deepEqual(
    Object.keys(AUDIT_ACTION_OBJECT).sort(),
    [...AUDIT_ACTIONS].sort(),
  )
})

test("cada transición declara su tipo de objeto y ninguno sobra", () => {
  for (const name of WORKFLOW_EVENTS) {
    assert.ok(
      WORKFLOW_EVENT_OBJECT[name],
      `la transición ${name} no declara tipo de objeto`,
    )
  }
  assert.deepEqual(
    Object.keys(WORKFLOW_EVENT_OBJECT).sort(),
    [...WORKFLOW_EVENTS].sort(),
  )
})

test("los tipos de objeto declarados existen en el enum del modelo", () => {
  const valid = new Set(Object.values(DocObjectType))
  for (const objectType of Object.values(AUDIT_ACTION_OBJECT)) {
    assert.ok(valid.has(objectType))
  }
  for (const objectType of Object.values(WORKFLOW_EVENT_OBJECT)) {
    assert.ok(valid.has(objectType))
  }
})

test("las acciones se nombran en imperativo y las transiciones en participio (B5)", () => {
  const pascalCase = /^[A-Z][A-Za-z]+$/

  for (const action of AUDIT_ACTIONS) {
    assert.match(action, pascalCase, `${action} no es PascalCase`)
    assert.doesNotMatch(
      action,
      /(ed|ing)$/,
      `${action} debería ser un verbo en imperativo`,
    )
  }

  // Participios irregulares admitidos. Un nombre nuevo que no termine en "ed"
  // debe incorporarse aquí de forma deliberada, no pasar de forma silenciosa.
  const irregulares = new Set<string>([])

  for (const name of WORKFLOW_EVENTS) {
    assert.match(name, pascalCase, `${name} no es PascalCase`)
    assert.ok(
      /ed$/.test(name) || irregulares.has(name),
      `${name} debería terminar en participio, o declararse como irregular`,
    )
  }
})

test("cada tipo de objeto declara el permiso que exige leer su traza", () => {
  for (const objectType of Object.values(DocObjectType)) {
    assert.ok(
      DOC_OBJECT_READ_PERMISSION[objectType],
      `el tipo ${objectType} no declara permiso de lectura`,
    )
  }
  assert.deepEqual(
    Object.keys(DOC_OBJECT_READ_PERMISSION).sort(),
    Object.values(DocObjectType).sort(),
  )
})

test("el catálogo cubre las escrituras relevadas más lo que agregaron los bloques 02 y 03", () => {
  // Línea base del Bloque 01: 25 escrituras a DocumentSysLog en el subsistema
  // de Gestión Documental, que aquel bloque sustituyó por eventos.
  //
  // El Bloque 02 suma 3 acciones sobre objetos que antes no existían:
  // DeclareProjectSettings, AssignProjectMember y RevokeProjectMember. No son
  // escrituras que se hayan dejado de registrar en otro lado, sino trazabilidad
  // nueva del contexto de proyecto.
  //
  // El Bloque 03 retira 2 y suma 9, de 28 a 35:
  //
  //   − InitiateReview       la operación desaparece: someter pasó a ser
  //                          completar el paso de elaboración (B1)
  //   − SwitchRevisionScheme el esquema dejó de persistirse (B13)
  //   + DefineWorkflow, SubmitRevision, AcknowledgeStep, ReassignStep
  //   + AbandonRevision
  //   + CreateWorkflowTemplate, UpdateWorkflowTemplate, DeleteWorkflowTemplate
  //   + DeclareDocSettings
  //
  // El Bloque 03B suma 8, de 35 a 43. Son actos que antes no existían o que se
  // separan de `UpdateDocument` porque no son ediciones:
  //
  //   + UpdateRevisionMetadata  la identificación se edita en la revisión (B1)
  //   + CorrectDocumentCode     es la IDENTIDAD cambiando, y sin evento sería
  //                             inexplicable en una auditoría posterior (B4)
  //   + ReplaceDocuments, ObsoleteDocument   el fin de la vida útil (B5)
  //   + OpenWorkingCopy, UpdateWorkingCopy, ConfirmWorkingCopy,
  //     DiscardWorkingCopy                   el ciclo de la copia (B12)
  assert.equal(AUDIT_ACTIONS.length, 43)
})
