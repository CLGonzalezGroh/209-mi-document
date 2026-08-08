import assert from "node:assert/strict"
import test from "node:test"
import { DocObjectType } from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "./catalog.js"
import {
  buildAuditEvent,
  buildWorkflowEvent,
  emitWorkflowEvents,
} from "./emit.js"

test("el evento de auditoría deriva el tipo de objeto de la acción", () => {
  const event = buildAuditEvent({
    action: AuditAction.IssueTransmittal,
    objectId: 12,
    actorId: 3,
  })

  assert.equal(event.action, AuditAction.IssueTransmittal)
  assert.equal(event.objectType, DocObjectType.TRANSMITTAL)
  assert.equal(event.objectId, 12)
  assert.equal(event.createdById, 3)
})

test("el actor ausente se registra como nulo, no como indefinido", () => {
  const event = buildAuditEvent({ action: AuditAction.CreateDocument, objectId: 1 })

  assert.equal(event.createdById, null)
})

test("meta se omite cuando no se informa y se conserva cuando sí", () => {
  const sinMeta = buildAuditEvent({ action: AuditAction.UpdateDocument, objectId: 1 })
  assert.ok(!("meta" in sinMeta))

  const conMeta = buildAuditEvent({
    action: AuditAction.UpdateDocument,
    objectId: 1,
    meta: { title: "Nuevo título" },
  })
  assert.deepEqual(conMeta.meta, { title: "Nuevo título" })
})

test("la transición deriva el tipo de objeto y conserva ambos estados", () => {
  const event = buildWorkflowEvent({
    name: WorkflowEvent.RevisionSubmitted,
    objectId: 7,
    fromState: "DRAFT",
    toState: "IN_REVIEW",
    actorId: 5,
  })

  assert.equal(event.objectType, DocObjectType.DOCUMENT_REVISION)
  assert.equal(event.fromState, "DRAFT")
  assert.equal(event.toState, "IN_REVIEW")
  assert.equal(event.createdById, 5)
})

test("un alta no tiene estado previo", () => {
  const event = buildWorkflowEvent({
    name: WorkflowEvent.RevisionCreated,
    objectId: 9,
    toState: "DRAFT",
    actorId: 5,
  })

  assert.equal(event.fromState, null)
  assert.equal(event.toState, "DRAFT")
})

test("emitir un conjunto vacío de transiciones no toca la base", async () => {
  // La guarda permite que un resolver arme la lista de transiciones sin
  // condicionar la llamada. Se pasa un cliente nulo: si la guarda faltara,
  // la prueba fallaría al intentar usarlo.
  await emitWorkflowEvents(null as any, [])
})

test("una acción puede producir varias transiciones sobre objetos distintos (B4)", () => {
  // approveStep que completa el circuito: aprueba el paso, completa el workflow,
  // aprueba la revisión y deja en SUPERSEDED a la anterior.
  const events = [
    buildWorkflowEvent({ name: WorkflowEvent.StepApproved, objectId: 40, fromState: "PENDING", toState: "APPROVED" }),
    buildWorkflowEvent({ name: WorkflowEvent.WorkflowCompleted, objectId: 20, fromState: "IN_PROGRESS", toState: "COMPLETED" }),
    buildWorkflowEvent({ name: WorkflowEvent.RevisionApproved, objectId: 10, fromState: "IN_REVIEW", toState: "APPROVED" }),
    buildWorkflowEvent({ name: WorkflowEvent.RevisionSuperseded, objectId: 9, fromState: "APPROVED", toState: "SUPERSEDED" }),
  ]

  assert.deepEqual(
    events.map((e) => e.objectType),
    [
      DocObjectType.REVIEW_STEP,
      DocObjectType.REVIEW_WORKFLOW,
      DocObjectType.DOCUMENT_REVISION,
      DocObjectType.DOCUMENT_REVISION,
    ],
  )
})
