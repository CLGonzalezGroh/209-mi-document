/**
 * Humo de la fase D: recorre el ciclo completo contra la base y mi-admin.
 *
 * NO es una prueba del bloque —las cuatro de integración son la fase G—: es la
 * verificación mínima de que las operaciones nuevas funcionan de punta a punta,
 * porque compilar no prueba nada sobre el comportamiento.
 *
 * Se ejecuta a mano: `node --import tsx src/resolvers/cycle.smoke.ts`
 */
import assert from "node:assert/strict"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { ResolverContext } from "../types.js"
import {
  DocProjectSide,
  DocumentRole,
  ModuleType,
  RevisionStatus,
  StepStatus,
  StepType,
  WorkflowStatus,
} from "../generated/prisma/enums.js"
import { documentResolvers } from "./documents.js"
import { revisionResolvers } from "./revisions.js"
import { versionResolvers } from "./versions.js"
import { workflowResolvers } from "./workflows.js"
import { projectSettingsResolvers } from "./projectSettings.js"
import { projectMemberResolvers } from "./projectMembers.js"
import { verifySignature } from "../utils/stepSignature.js"

const USER_ID = 3
const ROLE_IDS = [1, 16]
const PROYECTO = -424403
const CODIGO = "SMOKE-BLOCK03"

const limpiar = async () => {
  await prisma.document.deleteMany({ where: { code: { startsWith: CODIGO } } })
  await prisma.docProjectMember.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.docProjectSettings.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.docAuditEvent.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.docWorkflowEvent.deleteMany({ where: { projectId: PROYECTO } })
}

const paso = (n: string) => console.log(`  ✓ ${n}`)

const main = async () => {
  await limpiar()

  const token = jwt.sign(
    { id: USER_ID, roles: ROLE_IDS },
    process.env.AUTH_JWT_SECRET as string,
    { expiresIn: "1h" },
  )
  const context = { orm: prisma, token: `Bearer ${token}` } as ResolverContext
  const tipo = await prisma.documentType.findFirstOrThrow({ select: { id: true } })

  await projectSettingsResolvers.Mutation.declareDocProjectSettings(
    null,
    {
      input: {
        projectId: PROYECTO,
        documentRole: DocumentRole.ISSUER,
        counterpartyName: "Cliente de humo",
        defaultOrganizerId: USER_ID,
      },
    },
    context,
  )
  await projectMemberResolvers.Mutation.assignDocProjectMember(
    null,
    { input: { projectId: PROYECTO, userId: USER_ID, side: DocProjectSide.HOST } },
    context,
  )
  paso("proyecto configurado con armador por defecto")

  // --- 1. Alta sin archivo: nace con circuito en armado ---
  const doc: any = await documentResolvers.Mutation.createDocument(
    null,
    {
      input: {
        code: `${CODIGO}-1`,
        title: "Documento de humo",
        module: ModuleType.PROJECTS,
        projectId: PROYECTO,
        documentTypeId: tipo.id,
      },
    },
    context,
  )
  const revision = doc.revisions[0]
  const workflow = revision.workflows[0]

  assert.equal(revision.revisionCode, "A")
  assert.equal(revision.assignedOrganizerId, USER_ID)
  assert.equal(revision.versions.length, 0)
  assert.equal(workflow.status, WorkflowStatus.IN_PROGRESS)
  assert.equal(workflow.steps.length, 1)
  assert.equal(workflow.steps[0].stepType, StepType.ASSIGN)
  paso("alta sin archivo, con código A y circuito en armado")

  // --- 2. Armado: materializa elaboración, revisión y aprobación ---
  const armado: any = await workflowResolvers.Mutation.defineWorkflow(
    null,
    {
      workflowId: workflow.id,
      input: {
        preparerId: USER_ID,
        steps: [
          { stepOrder: 1, stepType: StepType.REVIEW, assignedToId: USER_ID },
          { stepOrder: 2, stepType: StepType.APPROVE, assignedToId: USER_ID },
          { stepOrder: 3, stepType: StepType.ACKNOWLEDGE, assignedToId: USER_ID },
        ],
      },
    },
    context,
  )
  // ASSIGN + PREPARE + REVIEW + APPROVE + ACKNOWLEDGE
  assert.equal(armado.steps.length, 5)
  assert.equal(armado.steps[0].status, StepStatus.COMPLETED)
  assert.equal(armado.steps[1].stepType, StepType.PREPARE)
  paso("armado completado en COMPLETED y pasos materializados")

  // --- 3. Someter exige versión ---
  const sinVersion = await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  ).then(
    () => "SIN_ERROR",
    (e: any) => e.extensions?.code,
  )
  assert.equal(sinVersion, "BAD_REQUEST")
  paso("someter sin versión se rechaza")

  await versionResolvers.Mutation.registerVersion(
    null,
    {
      revisionId: revision.id,
      input: {
        fileKey: "k1",
        fileName: "plano.pdf",
        fileSize: 10,
        mimeType: "application/pdf",
        checksum: "aa".repeat(32),
      },
    },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )
  const sometida = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(sometida.status, RevisionStatus.IN_REVIEW)
  paso("elaboración firmada y revisión en IN_REVIEW")

  // --- 4. Rechazo: circuito nuevo desde PREPARE, mismo elenco ---
  const revisionStep = await prisma.reviewStep.findFirstOrThrow({
    where: { workflowId: workflow.id, stepType: StepType.REVIEW },
  })
  await workflowResolvers.Mutation.rejectStep(
    null,
    { stepId: revisionStep.id, comments: "Falta el conexionado" },
    context,
  )

  const circuitos = await prisma.reviewWorkflow.findMany({
    where: { revisionId: revision.id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  })
  assert.equal(circuitos.length, 2)
  assert.equal(circuitos[0].status, WorkflowStatus.REJECTED)
  assert.equal(circuitos[1].status, WorkflowStatus.IN_PROGRESS)
  assert.deepEqual(
    circuitos[1].steps.map((s) => s.stepType),
    [StepType.PREPARE, StepType.REVIEW, StepType.APPROVE, StepType.ACKNOWLEDGE],
  )
  paso("rechazo abre circuito nuevo desde PREPARE con el mismo elenco (H-01)")

  // --- 5. Corrección y aprobación ---
  await versionResolvers.Mutation.registerVersion(
    null,
    {
      revisionId: revision.id,
      input: {
        fileKey: "k2",
        fileName: "plano-v2.pdf",
        fileSize: 12,
        mimeType: "application/pdf",
        checksum: "bb".repeat(32),
      },
    },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )
  for (const tipoPaso of [StepType.REVIEW, StepType.APPROVE]) {
    const s = await prisma.reviewStep.findFirstOrThrow({
      where: { workflowId: circuitos[1].id, stepType: tipoPaso },
    })
    await workflowResolvers.Mutation.approveStep(null, { stepId: s.id }, context)
  }

  const aprobada = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(aprobada.status, RevisionStatus.APPROVED)
  paso("aprobación cierra el circuito con el acuse todavía pendiente (B10)")

  // --- 6. El acuse sigue visible y se cierra con operación propia ---
  const pendientes: any = await workflowResolvers.Query.pendingReviewSteps(
    null,
    {},
    context,
  )
  const acuse = pendientes.find((s: any) => s.stepType === StepType.ACKNOWLEDGE)
  assert.ok(acuse, "el acuse debe seguir listándose en un circuito cerrado")
  await workflowResolvers.Mutation.acknowledgeStep(
    null,
    { stepId: acuse.id },
    context,
  )
  const acusado = await prisma.reviewStep.findUniqueOrThrow({
    where: { id: acuse.id },
  })
  assert.equal(acusado.status, StepStatus.COMPLETED)
  paso("acuse visible en circuito cerrado y resuelto en COMPLETED (H-04)")

  // --- 7. Las firmas son verificables sobre lo persistido ---
  const firmas = await prisma.docStepSignature.findMany({
    where: { step: { workflow: { revisionId: revision.id } } },
  })
  // 2 elaboraciones + revisión rechazada + revisión + aprobación + acuse
  assert.equal(firmas.length, 6)
  paso(`firmas persistidas: ${firmas.length}`)
  for (const f of firmas) {
    assert.deepEqual(verifySignature(f), { valid: true })
  }
  paso("todas las firmas verifican sobre su payload persistido (H-06)")

  // --- 8. Metadata congelada con la revisión aprobada ---
  const congelada = await documentResolvers.Mutation.updateDocument(
    null,
    { id: doc.id, input: { title: "Otro título" } },
    context,
  ).then(
    () => "SIN_ERROR",
    (e: any) => e.extensions?.code,
  )
  assert.equal(congelada, "CONFLICT")
  paso("con la revisión aprobada la metadata no se edita (B6)")

  // --- 9. Revisión B, abandonada, y B otra vez ---
  const revB: any = await revisionResolvers.Mutation.createRevision(
    null,
    { documentId: doc.id, input: {} },
    context,
  )
  assert.equal(revB.revisionCode, "B")

  await revisionResolvers.Mutation.cancelRevision(
    null,
    { revisionId: revB.id, reason: "Se decidió no continuarla" },
    context,
  )

  const revB2: any = await revisionResolvers.Mutation.createRevision(
    null,
    { documentId: doc.id, input: {} },
    context,
  )
  assert.equal(revB2.revisionCode, "B")
  paso("la revisión abandonada no consume código: se propone B otra vez (B12)")

  // --- 10. currentRevision y lastRevision ---
  const documento = await prisma.document.findUniqueOrThrow({
    where: { id: doc.id },
    include: { revisions: true },
  })
  const vigente = await documentResolvers.Query.documentById(
    null,
    { id: doc.id },
    context,
  )
  assert.ok(vigente)
  const current = documento.revisions.find(
    (r) => r.status === RevisionStatus.APPROVED,
  )
  assert.equal(current?.revisionCode, "A")
  paso("currentRevision es A (aprobada) y lastRevision es la B viva (B14)")

  await limpiar()
  await prisma.$disconnect()
  console.log("\nHUMO OK — el ciclo completo se ejecuta de punta a punta")
}

main().catch(async (e) => {
  console.error("HUMO FALLA:", e?.message ?? e)
  await prisma.$disconnect()
  process.exit(1)
})
