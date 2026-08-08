import assert from "node:assert/strict"
import test, { after } from "node:test"
import { prisma } from "../lib/prisma.js"
import { DocObjectType } from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "./catalog.js"
import { emitAuditEvent, emitWorkflowEvent, emitWorkflowEvents } from "./emit.js"

/**
 * Verificación de persistencia de los eventos de dominio.
 *
 * Requiere la base local (`npm run test:events-db`). A diferencia del resto de
 * las pruebas del bloque, no ejercita funciones puras sino la escritura real y
 * la garantía transaccional de B3.
 *
 * Se usa un objectId fuera de rango para no interferir con datos existentes, y
 * se limpian los registros al terminar.
 */

const OBJECT_ID = -424242

const limpiar = async () => {
  await prisma.docAuditEvent.deleteMany({ where: { objectId: OBJECT_ID } })
  await prisma.docWorkflowEvent.deleteMany({ where: { objectId: OBJECT_ID } })
}

after(async () => {
  await limpiar()
  await prisma.$disconnect()
})

test("la acción se persiste con el tipo de objeto derivado del catálogo", async () => {
  await limpiar()

  await emitAuditEvent(prisma, {
    action: AuditAction.IssueTransmittal,
    objectId: OBJECT_ID,
    actorId: 7,
    meta: { code: "TR-001", items: 3 },
  })

  const [evento] = await prisma.docAuditEvent.findMany({
    where: { objectId: OBJECT_ID },
  })

  assert.equal(evento.action, AuditAction.IssueTransmittal)
  assert.equal(evento.objectType, DocObjectType.TRANSMITTAL)
  assert.equal(evento.createdById, 7)
  assert.deepEqual(evento.meta, { code: "TR-001", items: 3 })
})

test("la transición se persiste con ambos estados", async () => {
  await limpiar()

  await emitWorkflowEvent(prisma, {
    name: WorkflowEvent.RevisionApproved,
    objectId: OBJECT_ID,
    fromState: "IN_REVIEW",
    toState: "APPROVED",
    actorId: 7,
  })

  const [evento] = await prisma.docWorkflowEvent.findMany({
    where: { objectId: OBJECT_ID },
  })

  assert.equal(evento.name, WorkflowEvent.RevisionApproved)
  assert.equal(evento.objectType, DocObjectType.DOCUMENT_REVISION)
  assert.equal(evento.fromState, "IN_REVIEW")
  assert.equal(evento.toState, "APPROVED")
})

test("un evento del sistema se persiste sin actor", async () => {
  await limpiar()

  await emitAuditEvent(prisma, {
    action: AuditAction.CreateDocument,
    objectId: OBJECT_ID,
  })

  const [evento] = await prisma.docAuditEvent.findMany({
    where: { objectId: OBJECT_ID },
  })

  assert.equal(evento.createdById, null)
})

test("varias transiciones se persisten en una sola operación", async () => {
  await limpiar()

  await emitWorkflowEvents(prisma, [
    { name: WorkflowEvent.StepApproved, objectId: OBJECT_ID, toState: "APPROVED" },
    { name: WorkflowEvent.WorkflowCompleted, objectId: OBJECT_ID, toState: "COMPLETED" },
  ])

  const eventos = await prisma.docWorkflowEvent.findMany({
    where: { objectId: OBJECT_ID },
    orderBy: { id: "asc" },
  })

  assert.equal(eventos.length, 2)
  assert.deepEqual(
    eventos.map((e) => e.objectType),
    [DocObjectType.REVIEW_STEP, DocObjectType.REVIEW_WORKFLOW],
  )
})

test("B3: si la transacción falla, el evento no queda registrado", async () => {
  await limpiar()

  await assert.rejects(
    prisma.$transaction(async (tx) => {
      await emitAuditEvent(tx, {
        action: AuditAction.ApproveStep,
        objectId: OBJECT_ID,
        actorId: 7,
      })
      await emitWorkflowEvent(tx, {
        name: WorkflowEvent.StepApproved,
        objectId: OBJECT_ID,
        toState: "APPROVED",
        actorId: 7,
      })
      throw new Error("fallo posterior al cambio de estado")
    }),
    /fallo posterior/,
  )

  assert.equal(
    await prisma.docAuditEvent.count({ where: { objectId: OBJECT_ID } }),
    0,
  )
  assert.equal(
    await prisma.docWorkflowEvent.count({ where: { objectId: OBJECT_ID } }),
    0,
  )
})

test("B3: si la transacción confirma, el evento queda registrado", async () => {
  await limpiar()

  await prisma.$transaction(async (tx) => {
    await emitAuditEvent(tx, {
      action: AuditAction.ApproveStep,
      objectId: OBJECT_ID,
      actorId: 7,
    })
    await emitWorkflowEvent(tx, {
      name: WorkflowEvent.StepApproved,
      objectId: OBJECT_ID,
      toState: "APPROVED",
      actorId: 7,
    })
  })

  assert.equal(
    await prisma.docAuditEvent.count({ where: { objectId: OBJECT_ID } }),
    1,
  )
  assert.equal(
    await prisma.docWorkflowEvent.count({ where: { objectId: OBJECT_ID } }),
    1,
  )
})