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
  //   − RegisterVersion         se retira con su operación: la versión dejó de
  //                             ser un archivo y pasó a ser un conjunto (B6)
  //
  // El Bloque 04 suma 4 en su fase 1, de 42 a 46: el ciclo del catálogo de
  // calificaciones. Tiene traza propia porque es configuración del CONTRATO, y
  // quién agregó o dio de baja una calificación explica por qué una respuesta
  // pudo registrarse con ese valor (B11).
  //
  //   + CreateQualification, UpdateQualification
  //   + TerminateQualification, ActivateQualification
  //
  // Y 2 en su fase 3, de 46 a 48: agregar y quitar un documento del transmittal
  // mientras está en borrador (B9). Quitar libera la revisión para otra carpeta,
  // y sin registro esa liberación sería inexplicable después.
  //
  //   + AddTransmittalItem, RemoveTransmittalItem
  //
  // Y en su fase 4 retira 1 y suma 2, de 48 a 49:
  //
  //   − RespondTransmittal    la operación desaparece: responder dejó de ser un
  //                           acto sobre el transmittal, que actualizaba sus
  //                           ítems en lote, y pasó a ser un acto sobre el
  //                           DOCUMENTO emitido (B5)
  //   + RegisterItemResponse, CorrectItemResponse
  //
  // Y 1 en su fase 5, de 49 a 50: el acuse de recibo, que le da operación al
  // estado que H-12 denunciaba sin ninguna (B8).
  //
  //   + AcknowledgeTransmittal
  //
  // La fase 6 no suma acciones: el circuito del rol Receptor usa las que ya
  // existen —aprobar y rechazar un paso— y lo que cambia es su desenlace. Sí
  // suma una transición, `RevisionRejected`, porque el hecho es otro: la
  // revisión concluye en lugar de volver al elaborador (B12).
  //
  // BLOQUE 02B suma 6 en su fase 1, de 50 a 56: el catálogo de ubicación física
  // con su ciclo de vida completo, más el movimiento, que tiene acción propia
  // porque reescribe la ruta de toda una rama y sin registro los cambios de
  // nodos que nadie tocó serían inexplicables después (B6).
  //
  //   + CreateLocation, UpdateLocation, MoveLocation
  //   + TerminateLocation, ActivateLocation, DeleteLocation
  //
  // Y 1 en su fase 2, de 56 a 57: declarar el alcance de un catálogo, que cambia
  // qué entradas tiene disponibles un proyecto SIN TOCAR ninguna entrada (B1).
  //
  //   + DeclareCatalogScope
  //
  // Y 1 en su fase 3, de 57 a 58: la siembra por copia. Existe además de las
  // creaciones que produce, y por un caso que ellas no cubren: una siembra que no
  // agrega nada no dejaría rastro (B2).
  //
  //   + SeedLocations
  //
  // Y 1 en la fase 3 de BLOQUE 02C, de 58 a 59: la siembra de la clasificación.
  // Es acción propia y no reúso de la anterior, porque siembra OTRO catálogo:
  // una sola acción para los dos dejaría la traza sin decir cuál se sembró.
  //
  //   + SeedClassification
  assert.equal(AUDIT_ACTIONS.length, 59)
})
