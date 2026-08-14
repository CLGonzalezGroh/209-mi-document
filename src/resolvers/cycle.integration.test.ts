import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { ResolverContext } from "../types.js"
import {
  DocFileRole,
  DocProjectSide,
  DocumentRole,
  ModuleType,
  RevisionScheme,
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
import { resolverTypes } from "./resolversTypes/index.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { verifySignature } from "../utils/stepSignature.js"

/**
 * Los cuatro recorridos completos del ciclo interno (BLOQUE 03).
 *
 * Sobre el arnés de integración de BLOQUE 02: contexto real, token firmado y
 * primera capa validada contra `mi-admin`. Es la evidencia que ni la
 * compilación ni las pruebas puras pueden dar.
 *
 * Requisitos, por eso vive en un script aparte (`test:block03-integration`):
 *  - `mi-admin` corriendo en ADMIN_API_URL;
 *  - el usuario de prueba con el rol documental completo;
 *  - la base local del módulo.
 */

const USER_ID = 3
const ROLE_IDS = [1, 16] // view + doc-full
const ROLE_IDS_BASICO = [1, 15] // view + doc-basic: SIN el permiso especial de B9
const OTRO_USUARIO = 1
const PROYECTO = -424406
const CODIGO = "TEST-BLOCK03"

let context: ResolverContext
let contextoBasico: ResolverContext
let documentTypeId: number

const limpiar = async () => {
  await prisma.document.deleteMany({ where: { code: { startsWith: CODIGO } } })
  await prisma.docWorkflowTemplate.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.docProjectMember.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.docProjectSettings.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.docAuditEvent.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.docWorkflowEvent.deleteMany({ where: { projectId: PROYECTO } })
}

before(async () => {
  await limpiar()

  const token = jwt.sign(
    { id: USER_ID, roles: ROLE_IDS },
    process.env.AUTH_JWT_SECRET as string,
    { expiresIn: "1h" },
  )
  context = { orm: prisma, token: `Bearer ${token}` } as ResolverContext

  const tokenBasico = jwt.sign(
    { id: USER_ID, roles: ROLE_IDS_BASICO },
    process.env.AUTH_JWT_SECRET as string,
    { expiresIn: "1h" },
  )
  contextoBasico = {
    orm: prisma,
    token: `Bearer ${tokenBasico}`,
  } as ResolverContext

  const tipo = await prisma.documentType.findFirstOrThrow({ select: { id: true } })
  documentTypeId = tipo.id

  await projectSettingsResolvers.Mutation.declareDocProjectSettings(
    null,
    {
      input: {
        projectId: PROYECTO,
        documentRole: DocumentRole.ISSUER,
        counterpartyName: "Cliente de prueba",
        defaultOrganizerId: USER_ID,
      },
    },
    context,
  )
  await projectMemberResolvers.Mutation.assignDocProjectMember(
    null,
    {
      input: { projectId: PROYECTO, userId: USER_ID, side: DocProjectSide.HOST },
    },
    context,
  )
})

after(async () => {
  await limpiar()
  await prisma.$disconnect()
})

// --- Ayudas ---

const crear = (sufijo: string, initialVersion?: any) =>
  documentResolvers.Mutation.createDocument(
    null,
    {
      input: {
        code: `${CODIGO}-${sufijo}`,
        title: `Documento ${sufijo}`,
        module: ModuleType.PROJECTS,
        projectId: PROYECTO,
        documentTypeId,
        ...(initialVersion && { initialVersion }),
      },
    },
    context,
  ) as Promise<any>

const archivo = (n: number) => ({
  fileKey: `k${n}`,
  fileName: `plano-v${n}.pdf`,
  fileSize: 10 + n,
  mimeType: "application/pdf",
  checksum: `${n}`.repeat(64),
})

const armar = (workflowId: number, pasos: StepType[]) =>
  workflowResolvers.Mutation.defineWorkflow(
    null,
    {
      workflowId,
      input: {
        preparerId: USER_ID,
        steps: pasos.map((stepType, i) => ({
          stepOrder: i + 1,
          stepType,
          assignedToId: USER_ID,
        })),
      },
    },
    context,
  ) as Promise<any>

const pasoDe = (workflowId: number, stepType: StepType) =>
  prisma.reviewStep.findFirstOrThrow({
    where: { workflowId, stepType, status: StepStatus.PENDING },
  })

const circuitoAbierto = (revisionId: number) =>
  prisma.reviewWorkflow.findFirstOrThrow({
    where: { revisionId, status: WorkflowStatus.IN_PROGRESS },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  })

const codigoDeError = async (fn: () => Promise<unknown>): Promise<string> => {
  try {
    await fn()
    return "SIN_ERROR"
  } catch (error: any) {
    return error?.extensions?.code ?? "DESCONOCIDO"
  }
}

// ════════════════════════════════════════════════════════════
// RECORRIDO 1 — Documento nuevo
// ════════════════════════════════════════════════════════════

test("recorrido 1: documento nuevo, de alta a toma de conocimiento", async () => {
  const doc = await crear("R1")
  const revision = doc.revisions[0]

  // Alta: sin archivo, con armador y circuito en armado (H-20, B3)
  assert.equal(revision.revisionCode, "A")
  assert.equal(revision.assignedOrganizerId, USER_ID)
  assert.equal(revision.versions.length, 0)
  assert.equal(revision.workflows.length, 1)
  assert.equal(revision.workflows[0].steps[0].stepType, StepType.ASSIGN)

  // Armado: materializa los pasos siguientes y cumple sin juzgar (B1, B8)
  const armado = await armar(revision.workflows[0].id, [
    StepType.REVIEW,
    StepType.APPROVE,
    StepType.ACKNOWLEDGE,
  ])
  assert.deepEqual(
    armado.steps.map((s: any) => s.stepType),
    [
      StepType.ASSIGN,
      StepType.PREPARE,
      StepType.REVIEW,
      StepType.APPROVE,
      StepType.ACKNOWLEDGE,
    ],
  )
  assert.equal(armado.steps[0].status, StepStatus.COMPLETED)

  // Elaboración: la primera versión la registra el elaborador en su paso (B5)
  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revision.id, input: archivo(1) },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )
  assert.equal(
    (await prisma.documentRevision.findUniqueOrThrow({ where: { id: revision.id } }))
      .status,
    RevisionStatus.IN_REVIEW,
  )

  // Revisión y aprobación
  const abierto = await circuitoAbierto(revision.id)
  for (const tipo of [StepType.REVIEW, StepType.APPROVE]) {
    const paso = await pasoDe(abierto.id, tipo)
    await workflowResolvers.Mutation.approveStep(
      null,
      { stepId: paso.id },
      context,
    )
  }

  const aprobada = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(aprobada.status, RevisionStatus.APPROVED)
  assert.equal(
    (await prisma.reviewWorkflow.findUniqueOrThrow({ where: { id: abierto.id } }))
      .status,
    WorkflowStatus.COMPLETED,
  )

  // El acuse cierra DESPUÉS, con operación propia (B10, H-04)
  const acuse = await pasoDe(abierto.id, StepType.ACKNOWLEDGE)
  await workflowResolvers.Mutation.acknowledgeStep(
    null,
    { stepId: acuse.id },
    context,
  )
  assert.equal(
    (await prisma.reviewStep.findUniqueOrThrow({ where: { id: acuse.id } })).status,
    StepStatus.COMPLETED,
  )
})

// ════════════════════════════════════════════════════════════
// RECORRIDO 2 — Documento preexistente
// ════════════════════════════════════════════════════════════

test("recorrido 2: documento preexistente, con el archivo adjunto en el alta", async () => {
  // El proyecto que parte de un documento ya elaborado: el archivo deja de ser
  // obligatorio, no admisible (B5).
  const doc = await crear("R2", archivo(1))
  const revision = doc.revisions[0]

  assert.equal(revision.versions.length, 1)
  assert.equal(revision.versions[0].versionNumber, 1)
  // La versión es un CONJUNTO (BLOQUE 03B, B6): el archivo del alta entra como
  // entregable, que es lo que era cuando la versión ERA un archivo.
  assert.equal(revision.versions[0].files.length, 1)
  assert.equal(revision.versions[0].files[0].role, DocFileRole.DELIVERABLE)
  assert.equal(revision.versions[0].files[0].checksum.length, 64)

  const armado = await armar(revision.workflows[0].id, [
    StepType.REVIEW,
    StepType.APPROVE,
  ])

  // El elaborador incorpora el cambio del proyecto sobre el archivo que ya estaba
  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revision.id, input: archivo(2) },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )

  for (const tipo of [StepType.REVIEW, StepType.APPROVE]) {
    const paso = await pasoDe(armado.id, tipo)
    await workflowResolvers.Mutation.approveStep(
      null,
      { stepId: paso.id },
      context,
    )
  }

  // La vigente es la última, y coincide con la aprobada
  const versiones = await prisma.documentVersion.findMany({
    where: { revisionId: revision.id },
    orderBy: { versionNumber: "desc" },
  })
  assert.equal(versiones[0].versionNumber, 2)

  const firmaAprobacion = await prisma.docStepSignature.findFirstOrThrow({
    where: { step: { workflowId: armado.id, stepType: StepType.APPROVE } },
  })
  const payload = JSON.parse(firmaAprobacion.payload)
  assert.equal(payload.version.versionNumber, 2)
  assert.equal(payload.document.code, `${CODIGO}-R2`)
})

// ════════════════════════════════════════════════════════════
// RECORRIDO 3 — Rechazo (H-01)
// ════════════════════════════════════════════════════════════

test("recorrido 3: el rechazo devuelve el trabajo sin consumir revisión", async () => {
  const doc = await crear("R3")
  const revision = doc.revisions[0]
  const primero = await armar(revision.workflows[0].id, [
    StepType.REVIEW,
    StepType.APPROVE,
  ])

  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revision.id, input: archivo(1) },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )

  // El revisor marca el archivo y rechaza: la versión es su marca (B5)
  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revision.id, input: archivo(2) },
    context,
  )
  const revisor = await pasoDe(primero.id, StepType.REVIEW)
  await workflowResolvers.Mutation.rejectStep(
    null,
    { stepId: revisor.id, comments: "Falta el conexionado de la página 5" },
    context,
  )

  // Circuito nuevo desde la elaboración, con el mismo elenco COPIADO
  const circuitos = await prisma.reviewWorkflow.findMany({
    where: { revisionId: revision.id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  })
  assert.equal(circuitos.length, 2)
  assert.equal(circuitos[0].status, WorkflowStatus.REJECTED)
  assert.deepEqual(
    circuitos[1].steps.map((s) => s.stepType),
    [StepType.PREPARE, StepType.REVIEW, StepType.APPROVE],
  )
  assert.deepEqual(
    circuitos[1].steps.map((s) => s.id !== undefined),
    [true, true, true],
  )
  assert.equal(
    (await prisma.documentRevision.findUniqueOrThrow({ where: { id: revision.id } }))
      .status,
    RevisionStatus.DRAFT,
  )

  // Reasignar en el circuito nuevo NO altera la historia del anterior (B1, B9)
  const nuevoRevisor = await pasoDe(circuitos[1].id, StepType.REVIEW)
  await workflowResolvers.Mutation.reassignStep(
    null,
    { stepId: nuevoRevisor.id, assignedToId: 1, reason: "Redistribución" },
    context,
  )
  const viejoRevisor = await prisma.reviewStep.findUniqueOrThrow({
    where: { id: revisor.id },
  })
  assert.equal(viejoRevisor.assignedToId, USER_ID)

  // Corrección y aprobación: la revisión sigue siendo A
  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revision.id, input: archivo(3) },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )
  await workflowResolvers.Mutation.reassignStep(
    null,
    { stepId: nuevoRevisor.id, assignedToId: USER_ID, reason: "Vuelve" },
    context,
  )
  for (const tipo of [StepType.REVIEW, StepType.APPROVE]) {
    const paso = await pasoDe(circuitos[1].id, tipo)
    await workflowResolvers.Mutation.approveStep(null, { stepId: paso.id }, context)
  }

  const final = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(final.status, RevisionStatus.APPROVED)
  assert.equal(final.revisionCode, "A")

  // El rechazo dejó su firma, y documenta qué se objetó
  const firmaRechazo = await prisma.docStepSignature.findFirstOrThrow({
    where: { stepId: revisor.id },
  })
  assert.equal(JSON.parse(firmaRechazo.payload).action, StepStatus.REJECTED)
  assert.deepEqual(verifySignature(firmaRechazo), { valid: true })
})

// ════════════════════════════════════════════════════════════
// RECORRIDO 4 — Abandono (B11, B12)
// ════════════════════════════════════════════════════════════

test("recorrido 4: abandonar a mitad de circuito y recuperar el código", async () => {
  const doc = await crear("R4")
  const revA = doc.revisions[0]

  // A aprobada, para tener historia
  const wfA = await armar(revA.workflows[0].id, [StepType.APPROVE])
  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revA.id, input: archivo(1) },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revA.id },
    context,
  )
  await workflowResolvers.Mutation.approveStep(
    null,
    { stepId: (await pasoDe(wfA.id, StepType.APPROVE)).id },
    context,
  )

  // B se abre, avanza y se abandona con un paso ya firmado
  const revB: any = await revisionResolvers.Mutation.createRevision(
    null,
    { documentId: doc.id, input: {} },
    context,
  )
  assert.equal(revB.revisionCode, "B")

  const wfB = await armar(revB.workflows[0].id, [
    StepType.REVIEW,
    StepType.APPROVE,
  ])
  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revB.id, input: archivo(2) },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revB.id },
    context,
  )
  const firmadas = await prisma.docStepSignature.count({
    where: { step: { workflowId: wfB.id } },
  })
  assert.equal(firmadas, 1, "la elaboración ya firmó")

  await revisionResolvers.Mutation.abandonRevision(
    null,
    { revisionId: revB.id, reason: "El cliente retiró el requerimiento" },
    context,
  )

  const abandonada = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revB.id },
  })
  assert.equal(abandonada.status, RevisionStatus.ABANDONED)
  assert.equal(abandonada.abandonedById, USER_ID)
  assert.ok(abandonada.abandonReason)

  // El circuito abierto se canceló con ella, y la firma sobrevive
  const circuitoB = await prisma.reviewWorkflow.findUniqueOrThrow({
    where: { id: wfB.id },
  })
  assert.equal(circuitoB.status, WorkflowStatus.CANCELLED)
  assert.equal(
    await prisma.docStepSignature.count({ where: { step: { workflowId: wfB.id } } }),
    1,
    "nada se elimina: la firma del paso resuelto sobrevive",
  )

  // Y la siguiente vuelve a proponerse como B, no como C
  const revB2: any = await revisionResolvers.Mutation.createRevision(
    null,
    { documentId: doc.id, input: {} },
    context,
  )
  assert.equal(revB2.revisionCode, "B")

  // Y se completa: el ciclo A ▸ B abandonada ▸ B nueva termina aprobado
  const wfB2 = await armar(revB2.workflows[0].id, [StepType.APPROVE])
  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revB2.id, input: archivo(3) },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revB2.id },
    context,
  )
  await workflowResolvers.Mutation.approveStep(
    null,
    { stepId: (await pasoDe(wfB2.id, StepType.APPROVE)).id },
    context,
  )
  assert.equal(
    (await prisma.documentRevision.findUniqueOrThrow({ where: { id: revB2.id } }))
      .status,
    RevisionStatus.APPROVED,
  )
  // Al aprobarse, A queda superada
  assert.equal(
    (await prisma.documentRevision.findUniqueOrThrow({ where: { id: revA.id } }))
      .status,
    RevisionStatus.SUPERSEDED,
  )

  // La anterior nunca dejó de estar vigente hasta que la sucesora se aprobó
  const documento = await prisma.document.findUniqueOrThrow({
    where: { id: doc.id },
    include: { revisions: true },
  })
  const current = await resolverTypes.Document.currentRevision(documento)
  const last = await resolverTypes.Document.lastRevision(documento)
  assert.equal((current as any)?.id, revB2.id)
  assert.equal((last as any)?.id, revB2.id)
  // Ninguna de las dos considera la abandonada
  assert.notEqual((current as any)?.id, revB.id)
})

// ════════════════════════════════════════════════════════════
// Precondiciones y criterios sueltos
// ════════════════════════════════════════════════════════════

test("un documento sin revisión formal llega a aprobado con un solo paso (H-02)", async () => {
  const doc = await crear("MIN")
  const revision = doc.revisions[0]

  // El workflow mínimo de D-03 deja de ser un objeto: es un armado que designa
  // un único paso de aprobación.
  const wf = await armar(revision.workflows[0].id, [StepType.APPROVE])
  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revision.id, input: archivo(1) },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )
  await workflowResolvers.Mutation.approveStep(
    null,
    { stepId: (await pasoDe(wf.id, StepType.APPROVE)).id },
    context,
  )

  assert.equal(
    (await prisma.documentRevision.findUniqueOrThrow({ where: { id: revision.id } }))
      .status,
    RevisionStatus.APPROVED,
  )
})

test("un circuito sin paso que decida no se arma", async () => {
  const doc = await crear("NODEC")
  const revision = doc.revisions[0]

  assert.equal(
    await codigoDeError(() =>
      armar(revision.workflows[0].id, [StepType.ACKNOWLEDGE]),
    ),
    "BAD_USER_INPUT",
  )
})

test("la estructura del circuito es inmutable una vez armada", async () => {
  const doc = await crear("INM")
  const revision = doc.revisions[0]
  await armar(revision.workflows[0].id, [StepType.APPROVE])

  assert.equal(
    await codigoDeError(() =>
      armar(revision.workflows[0].id, [StepType.APPROVE]),
    ),
    "CONFLICT",
  )
})

test("un paso resuelto no se reasigna", async () => {
  const doc = await crear("REAS")
  const revision = doc.revisions[0]
  const wf = await armar(revision.workflows[0].id, [StepType.APPROVE])
  const armado = await prisma.reviewStep.findFirstOrThrow({
    where: { workflowId: wf.id, stepType: StepType.ASSIGN },
  })

  assert.equal(
    await codigoDeError(() =>
      workflowResolvers.Mutation.reassignStep(
        null,
        { stepId: armado.id, assignedToId: 1, reason: "tarde" },
        context,
      ),
    ),
    "BAD_REQUEST",
  )
})

test("una revisión aprobada no admite versiones nuevas", async () => {
  // Sin paso vigente no hay quien las produzca: es lo que impide que la firma
  // quede acreditando una versión que dejó de ser la última (B5).
  const aprobada = await prisma.documentRevision.findFirstOrThrow({
    where: {
      document: { code: `${CODIGO}-MIN` },
      status: RevisionStatus.APPROVED,
    },
  })

  assert.equal(
    await codigoDeError(() =>
      versionResolvers.Mutation.registerVersion(
        null,
        { revisionId: aprobada.id, input: archivo(9) },
        context,
      ),
    ),
    "BAD_REQUEST",
  )
})

test("con la revisión aprobada la metadata no se edita, y la siguiente la habilita", async () => {
  const doc = await prisma.document.findFirstOrThrow({
    where: { code: `${CODIGO}-MIN` },
  })

  assert.equal(
    await codigoDeError(() =>
      documentResolvers.Mutation.updateDocument(
        null,
        { id: doc.id, input: { title: "Otro título" } },
        context,
      ),
    ),
    "CONFLICT",
  )

  await revisionResolvers.Mutation.createRevision(
    null,
    { documentId: doc.id, input: {} },
    context,
  )

  const editado: any = await documentResolvers.Mutation.updateDocument(
    null,
    { id: doc.id, input: { title: "Título corregido" } },
    context,
  )
  // El documento conserva la metadata como COPIA, nombrada por su lectura
  // (BLOQUE 03B, B2): `currentTitle` es la de la revisión en curso.
  assert.equal(editado.currentTitle, "Título corregido")
})

test("el código informado se rechaza bajo un esquema calculado, y se exige bajo texto libre", async () => {
  // H-09: bajo ALPHA y NUMERIC el sistema calcula el código y rechaza el
  // informado; bajo FREE_TEXT lo ingresa el usuario y es obligatorio.
  const alta = (sufijo: string, input: any) =>
    documentResolvers.Mutation.createDocument(
      null,
      {
        input: {
          code: `${CODIGO}-${sufijo}`,
          title: `Documento ${sufijo}`,
          module: ModuleType.PROJECTS,
          projectId: PROYECTO,
          documentTypeId,
          ...input,
        },
      },
      context,
    ) as Promise<any>

  assert.equal(
    await codigoDeError(() => alta("COD1", { initialRevisionCode: "Z" })),
    "BAD_USER_INPUT",
  )

  assert.equal(
    await codigoDeError(() =>
      alta("COD2", { revisionScheme: RevisionScheme.FREE_TEXT }),
    ),
    "BAD_USER_INPUT",
  )

  const libre = await alta("COD3", {
    revisionScheme: RevisionScheme.FREE_TEXT,
    initialRevisionCode: "Rev-1",
  })
  assert.equal(libre.revisions[0].revisionCode, "Rev-1")

  // El esquema NO se persiste: la revisión siguiente se propone por inferencia,
  // y un código de texto libre no revela esquema, de modo que cae al del proyecto.
  const numerado = await alta("COD4", {
    revisionScheme: RevisionScheme.NUMERIC,
  })
  assert.equal(numerado.revisions[0].revisionCode, "0")
})

test("someter exige al menos una versión", async () => {
  const doc = await crear("SIN")
  const revision = doc.revisions[0]
  await armar(revision.workflows[0].id, [StepType.APPROVE])

  assert.equal(
    await codigoDeError(() =>
      workflowResolvers.Mutation.submitRevision(
        null,
        { revisionId: revision.id },
        context,
      ),
    ),
    "BAD_REQUEST",
  )
})

test("cancelar el circuito conserva la revisión y la rearma desde el armado", async () => {
  const doc = await crear("CANC")
  const revision = doc.revisions[0]
  const wf = await armar(revision.workflows[0].id, [StepType.APPROVE])

  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revision.id, input: archivo(1) },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )
  await workflowResolvers.Mutation.cancelWorkflow(
    null,
    { workflowId: wf.id, reason: "Quedó mal armado: falta el jefe de especialidad" },
    context,
  )

  const cancelado = await prisma.reviewWorkflow.findUniqueOrThrow({
    where: { id: wf.id },
  })
  assert.equal(cancelado.status, WorkflowStatus.CANCELLED)
  assert.ok(cancelado.cancelReason)
  assert.equal(cancelado.cancelledById, USER_ID)

  // La revisión sobrevive, vuelve a borrador y se rearma desde el armado
  const sobreviviente = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(sobreviviente.status, RevisionStatus.DRAFT)

  const nuevo = await circuitoAbierto(revision.id)
  assert.equal(nuevo.steps.length, 1)
  assert.equal(nuevo.steps[0].stepType, StepType.ASSIGN)
  assert.equal(nuevo.steps[0].assignedToId, revision.assignedOrganizerId)

  // Y la cancelación es distinguible del rechazo en la traza (H-05)
  const transiciones = await prisma.docWorkflowEvent.findMany({
    where: { objectId: wf.id },
    select: { name: true },
  })
  const nombres = transiciones.map((t) => t.name)
  assert.ok(nombres.includes(WorkflowEvent.WorkflowCancelled))
  assert.ok(!nombres.includes(WorkflowEvent.WorkflowRejected))
})

test("los pendientes ajenos exigen el permiso especial y los propios no (H-07)", async () => {
  // El usuario de prueba TIENE el permiso, de modo que lo que se verifica es
  // que la consulta acote por usuario y admita el argumento.
  const propios: any = await workflowResolvers.Query.pendingReviewSteps(
    null,
    {},
    context,
  )
  assert.ok(propios.every((s: any) => s.assignedToId === USER_ID))

  const ajenos: any = await workflowResolvers.Query.pendingReviewSteps(
    null,
    { userId: 1 },
    context,
  )
  assert.ok(ajenos.every((s: any) => s.assignedToId === 1))
})

test("la traza registra las acciones nuevas del ciclo", async () => {
  const acciones = await prisma.docAuditEvent.findMany({
    where: { projectId: PROYECTO },
    select: { action: true },
    distinct: ["action"],
  })
  const nombres = acciones.map((a) => a.action)

  for (const esperada of [
    AuditAction.CreateDocument,
    AuditAction.CreateRevision,
    AuditAction.DefineWorkflow,
    AuditAction.SubmitRevision,
    AuditAction.RegisterVersion,
    AuditAction.ApproveStep,
    AuditAction.RejectStep,
    AuditAction.AcknowledgeStep,
    AuditAction.ReassignStep,
    AuditAction.CancelWorkflow,
    AuditAction.AbandonRevision,
  ]) {
    assert.ok(nombres.includes(esperada), `falta la acción ${esperada}`)
  }
})

test("la delegación exige permiso y motivo, y queda dentro de lo firmado (H-03)", async () => {
  // El paso lo resuelve quien lo tiene asignado. Actuar por otro es un acto
  // distinto: exige el permiso especial Y motivo, que es lo que lo vuelve
  // trazable y no solo permitido (B9).
  const doc = await crear("DELEG")
  const revision = doc.revisions[0]
  const wf = await armar(revision.workflows[0].id, [StepType.APPROVE])

  await versionResolvers.Mutation.registerVersion(
    null,
    { revisionId: revision.id, input: archivo(1) },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )

  // El paso de aprobación pasa a otra persona
  const aprobacion = await pasoDe(wf.id, StepType.APPROVE)
  await workflowResolvers.Mutation.reassignStep(
    null,
    {
      stepId: aprobacion.id,
      assignedToId: OTRO_USUARIO,
      reason: "El aprobador designado está de licencia",
    },
    context,
  )

  // Sin el permiso especial, resolverlo por otro se rechaza
  assert.equal(
    await codigoDeError(() =>
      workflowResolvers.Mutation.approveStep(
        null,
        { stepId: aprobacion.id, delegationReason: "urgencia" },
        contextoBasico,
      ),
    ),
    "FORBIDDEN",
  )

  // Con el permiso pero sin motivo, tampoco
  assert.equal(
    await codigoDeError(() =>
      workflowResolvers.Mutation.approveStep(
        null,
        { stepId: aprobacion.id },
        context,
      ),
    ),
    "BAD_USER_INPUT",
  )

  // Con permiso y motivo, se resuelve y queda registrado quién lo hizo
  await workflowResolvers.Mutation.approveStep(
    null,
    { stepId: aprobacion.id, delegationReason: "Cierre de mes: firma el jefe" },
    context,
  )

  const resuelto = await prisma.reviewStep.findUniqueOrThrow({
    where: { id: aprobacion.id },
  })
  assert.equal(resuelto.assignedToId, OTRO_USUARIO)
  assert.equal(resuelto.resolvedById, USER_ID)
  assert.ok(resuelto.delegationReason)

  // Y la divergencia viaja dentro del payload firmado
  const firma = await prisma.docStepSignature.findFirstOrThrow({
    where: { stepId: aprobacion.id },
  })
  const payload = JSON.parse(firma.payload)
  assert.equal(payload.actor.assignedToId, OTRO_USUARIO)
  assert.equal(payload.actor.resolvedById, USER_ID)
  assert.equal(payload.actor.delegationReason, "Cierre de mes: firma el jefe")
  assert.deepEqual(verifySignature(firma), { valid: true })
})

test("consultar pendientes ajenos sin el permiso especial se rechaza (H-07)", async () => {
  // Los propios se consultan siempre; los de otro exigen el permiso.
  const propios: any = await workflowResolvers.Query.pendingReviewSteps(
    null,
    {},
    contextoBasico,
  )
  assert.ok(Array.isArray(propios))

  assert.equal(
    await codigoDeError(() =>
      workflowResolvers.Query.pendingReviewSteps(
        null,
        { userId: OTRO_USUARIO },
        contextoBasico,
      ),
    ),
    "FORBIDDEN",
  )
})

test("el alta propone la plantilla resuelta por alcance, y el armado puede no seguirla", async () => {
  // La plantilla PROPONE y el armado DEFINE (B3).
  const plantilla = await prisma.docWorkflowTemplate.create({
    data: {
      name: `${CODIGO} plantilla de proyecto`,
      projectId: PROYECTO,
      createdById: USER_ID,
      steps: {
        create: [
          { stepOrder: 1, stepType: StepType.REVIEW },
          { stepOrder: 2, stepType: StepType.APPROVE },
        ],
      },
    },
  })

  const doc = await crear("PLANT")
  const revision = doc.revisions[0]

  // El circuito nace referenciando la plantilla que le corresponde por alcance
  assert.equal(revision.workflows[0].templateId, plantilla.id)

  // Y el armado puede cambiarla: acá se arma con un solo paso de aprobación
  const armado = await armar(revision.workflows[0].id, [StepType.APPROVE])
  assert.deepEqual(
    armado.steps.map((s: any) => s.stepType),
    [StepType.ASSIGN, StepType.PREPARE, StepType.APPROVE],
  )

  // Cambiar la plantilla después no altera el circuito ya materializado
  await prisma.docWorkflowTemplate.update({
    where: { id: plantilla.id },
    data: { terminatedAt: new Date() },
  })
  const intacto = await prisma.reviewStep.count({
    where: { workflowId: armado.id },
  })
  assert.equal(intacto, 3)
})
