import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { asegurarContratos, borrarContratos } from "../utils/testContracts.js"
import { ResolverContext } from "../types.js"
import {
  DocFileRole,
  DocObjectType,
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
import { replacementResolvers } from "./replacements.js"
import { workingCopyResolvers } from "./workingCopies.js"
import { docProjectsResolvers } from "./docProjects.js"
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

/** Empresas de prueba: la contraparte es una referencia a Company (B4). */
const EMPRESA_A = -424801
const EMPRESA_B = -424802

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
  await prisma.docWorkflowTemplate.deleteMany({ where: { docProjectId: PROYECTO } })
  await prisma.docProjectMember.deleteMany({ where: { docProjectId: PROYECTO } })
  await prisma.docProject.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.docAuditEvent.deleteMany({ where: { docProjectId: PROYECTO } })
  await prisma.docWorkflowEvent.deleteMany({ where: { docProjectId: PROYECTO } })
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

  // El contrato existe antes de declararlo, con id igual a la constante (ver
  // testContracts): la mutación hace upsert por código y cae sobre esta fila.
  await asegurarContratos(prisma, [PROYECTO], DocumentRole.ISSUER)

  await docProjectsResolvers.Mutation.declareDocProject(
    null,
    {
      input: {
        code: `T-${PROYECTO}`,
        name: "Contrato de prueba",
        projectId: PROYECTO,
        documentRole: DocumentRole.ISSUER,
        counterpartyId: EMPRESA_A,
        defaultOrganizerId: USER_ID,
      },
    },
    context,
  )
  await projectMemberResolvers.Mutation.assignDocProjectMember(
    null,
    {
      input: { docProjectId: PROYECTO, userId: USER_ID, side: DocProjectSide.HOST },
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
        docProjectId: PROYECTO,
        documentTypeId,
        ...(initialVersion && { initialVersion }),
      },
    },
    context,
  ) as Promise<any>

/**
 * Registra una versión por el atajo de `confirmWorkingCopy`: el conjunto completo
 * en un solo acto, sin copia abierta previa (BLOQUE 03B, B12).
 */
const registrar = (revisionId: number, n: number, comment?: string) =>
  workingCopyResolvers.Mutation.confirmWorkingCopy(
    null,
    {
      revisionId,
      input: {
        ...(comment && { comment }),
        files: [{ ...archivo(n), role: DocFileRole.DELIVERABLE }],
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
  await registrar(revision.id, 1)
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
  await registrar(revision.id, 2)
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

  await registrar(revision.id, 1)
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )

  // El revisor marca el archivo y rechaza: la versión es su marca (B5)
  await registrar(revision.id, 2)
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
  await registrar(revision.id, 3)
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
  await registrar(revA.id, 1)
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
  await registrar(revB.id, 2)
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
  await registrar(revB2.id, 3)
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
  await registrar(revision.id, 1)
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
      registrar(aprobada.id, 9),
    ),
    "BAD_REQUEST",
  )
})

test("la identificación se edita en la revisión, y la aprobada ya no la admite", async () => {
  // El congelamiento dejó de ser una precondición y pasó a ser estructura
  // (BLOQUE 03B, B1): una revisión aprobada no se modifica, y con eso la regla
  // no necesita enunciado propio.
  const doc = await prisma.document.findFirstOrThrow({
    where: { code: `${CODIGO}-MIN` },
    include: { revisions: { orderBy: { createdAt: "desc" } } },
  })
  const aprobada = doc.revisions[0]

  assert.equal(
    await codigoDeError(() =>
      revisionResolvers.Mutation.updateRevisionMetadata(
        null,
        { revisionId: aprobada.id, input: { title: "Otro título" } },
        context,
      ),
    ),
    "CONFLICT",
  )

  // Lo administrativo NO se congela: la descripción no aparece en ningún rótulo
  const conDescripcion: any = await documentResolvers.Mutation.updateDocument(
    null,
    { id: doc.id, input: { description: "Corregida con la revisión aprobada" } },
    context,
  )
  assert.equal(conDescripcion.description, "Corregida con la revisión aprobada")

  // Abrir la siguiente vuelve a habilitar la identificación
  const siguiente: any = await revisionResolvers.Mutation.createRevision(
    null,
    { documentId: doc.id, input: {} },
    context,
  )
  // La revisión nueva NACE con la metadata copiada de la anterior (B1)
  assert.equal(siguiente.title, aprobada.title)

  const editada: any = await revisionResolvers.Mutation.updateRevisionMetadata(
    null,
    { revisionId: siguiente.id, input: { title: "Título corregido" } },
    context,
  )
  assert.equal(editada.title, "Título corregido")

  // La copia del documento se replica en el mismo acto (B2)
  const conCopia = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })
  assert.equal(conCopia.currentTitle, "Título corregido")
  // Y la revisión aprobada conserva la suya: es lo que dice su rótulo
  const intacta = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: aprobada.id },
  })
  assert.equal(intacta.title, aprobada.title)
})

test("abandonar la revisión devuelve la metadata, sin revertir nada", async () => {
  // La propiedad que el bloque perseguía: la abandonada deja de ser la última
  // viva y la copia se recalcula sobre la que estaba antes (B2).
  const doc = await prisma.document.findFirstOrThrow({
    where: { code: `${CODIGO}-MIN` },
    include: { revisions: { orderBy: { createdAt: "desc" } } },
  })
  const enCurso = doc.revisions[0]
  const anterior = doc.revisions[1]

  await revisionResolvers.Mutation.abandonRevision(
    null,
    { revisionId: enCurso.id, reason: "se desiste de la corrección" },
    context,
  )

  const despues = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })
  assert.equal(despues.currentTitle, anterior.title)
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
          docProjectId: PROYECTO,
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

  await registrar(revision.id, 1)
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
    where: { docProjectId: PROYECTO },
    select: { action: true },
    distinct: ["action"],
  })
  const nombres = acciones.map((a) => a.action)

  for (const esperada of [
    AuditAction.CreateDocument,
    AuditAction.CreateRevision,
    AuditAction.DefineWorkflow,
    AuditAction.SubmitRevision,
    AuditAction.ConfirmWorkingCopy,
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

  await registrar(revision.id, 1)
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
      docProjectId: PROYECTO,
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

// ════════════════════════════════════════════════════════════
// BLOQUE 03B — Código, reemplazo, obsolescencia y copia de trabajo
// ════════════════════════════════════════════════════════════

test("el código se corrige mientras nada salió, y después ya no", async () => {
  // La ventana es "sin ninguna revisión aprobada": la condición material de que
  // nada salió (BLOQUE 03B, B4). Es más precisa que "antes de la primera
  // revisión" —si la primera se abandona, sigue sin haberse aprobado nada—.
  const doc: any = await crear("COD")

  const corregido: any = await documentResolvers.Mutation.correctDocumentCode(
    null,
    { id: doc.id, code: `${CODIGO}-COD-BIS` },
    context,
  )
  assert.equal(corregido.code, `${CODIGO}-COD-BIS`)

  // Abandonar la primera y abrir otra NO cierra la ventana
  await revisionResolvers.Mutation.abandonRevision(
    null,
    { revisionId: doc.revisions[0].id, reason: "se rehace" },
    context,
  )
  const segunda: any = await revisionResolvers.Mutation.createRevision(
    null,
    { documentId: doc.id, input: {} },
    context,
  )
  const otraVez: any = await documentResolvers.Mutation.correctDocumentCode(
    null,
    { id: doc.id, code: `${CODIGO}-COD-TER` },
    context,
  )
  assert.equal(otraVez.code, `${CODIGO}-COD-TER`)

  // Aprobar cierra la ventana para siempre
  const armado = await armar(segunda.workflows[0].id, [StepType.APPROVE])
  await registrar(segunda.id, 1)
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: segunda.id },
    context,
  )
  const aprobacion = await pasoDe(armado.id, StepType.APPROVE)
  await workflowResolvers.Mutation.approveStep(null, { stepId: aprobacion.id }, context)

  assert.equal(
    await codigoDeError(() =>
      documentResolvers.Mutation.correctDocumentCode(
        null,
        { id: doc.id, code: `${CODIGO}-COD-NO` },
        context,
      ),
    ),
    "CONFLICT",
  )
})

test("reemplazar supera: los reemplazados quedan obsoletos en el mismo acto", async () => {
  // Unificación N:1, una de las tres cardinalidades que la misma relación
  // expresa (BLOQUE 03B, B5).
  const uno: any = await crear("RE1")
  const dos: any = await crear("RE2")
  const nuevo: any = await crear("RE3")

  const acto: any = await replacementResolvers.Mutation.replaceDocuments(
    null,
    {
      input: {
        replacedIds: [uno.id, dos.id],
        replacingIds: [nuevo.id],
        reason: "los dos planos pasan a ser uno",
      },
    },
    context,
  )

  assert.equal(acto.items.length, 3)
  assert.equal(acto.reason, "los dos planos pasan a ser uno")

  const [a, b, c] = await Promise.all(
    [uno.id, dos.id, nuevo.id].map((id) =>
      prisma.document.findUniqueOrThrow({ where: { id } }),
    ),
  )
  assert.ok(a.obsoletedAt)
  assert.ok(b.obsoletedAt)
  // El que reemplaza NO queda obsoleto: es el que supera
  assert.equal(c.obsoletedAt, null)
})

test("el acto de reemplazo exige ámbito compartido", async () => {
  // Lo que cruza de un proyecto al régimen de publicación no es reemplazo sino
  // promoción, que es otra cosa y pertenece al módulo de activos (B10).
  const deProyecto: any = await crear("AMB1")
  const publicado: any = await documentResolvers.Mutation.createDocument(
    null,
    {
      input: {
        code: `${CODIGO}-AMB2`,
        title: "Documento publicado",
        module: ModuleType.QUALITY,
        documentTypeId,
        // Sin proyecto no hay configuración que aporte el armador por defecto
        assignedOrganizerId: USER_ID,
      },
    },
    context,
  )

  assert.equal(
    await codigoDeError(() =>
      replacementResolvers.Mutation.replaceDocuments(
        null,
        {
          input: {
            replacedIds: [deProyecto.id],
            replacingIds: [publicado.id],
            reason: "promoción mal expresada",
          },
        },
        context,
      ),
    ),
    "BAD_USER_INPUT",
  )
})

test("un documento queda obsoleto por fuera de alcance, sin que nada lo reemplace", async () => {
  // La segunda causa (B5): es la que impide derivar la obsolescencia de la
  // existencia de un reemplazo.
  const doc: any = await crear("OBS")

  const obsoleto: any = await documentResolvers.Mutation.obsoleteDocument(
    null,
    { id: doc.id, reason: "salió del alcance del proyecto" },
    context,
  )

  assert.ok(obsoleto.obsoletedAt)
  assert.equal(obsoleto.obsoleteReason, "salió del alcance del proyecto")
  const items = await prisma.docReplacementItem.findMany({
    where: { documentId: doc.id },
  })
  assert.equal(items.length, 0)

  // Declarar obsoleto exige motivo, y no se repite
  assert.equal(
    await codigoDeError(() =>
      documentResolvers.Mutation.obsoleteDocument(
        null,
        { id: doc.id, reason: "otra vez" },
        context,
      ),
    ),
    "CONFLICT",
  )
})

test("la copia de trabajo precarga, arrastra la fuente y produce una versión", async () => {
  // El caso corriente de ingeniería: se corrige el PDF y el DWG viaja solo,
  // conservando su fileKey y su checksum, sin volver a subirse (B12).
  const doc: any = await crear("WC")
  const revision = doc.revisions[0]
  await armar(revision.workflows[0].id, [StepType.APPROVE])

  // Primera versión: entregable y fuente juntos, por el atajo de un solo acto
  const primera: any = await workingCopyResolvers.Mutation.confirmWorkingCopy(
    null,
    {
      revisionId: revision.id,
      input: {
        files: [
          { ...archivo(1), role: DocFileRole.DELIVERABLE },
          {
            fileKey: "k1.dwg",
            fileName: "plano-v1.dwg",
            fileSize: 20,
            mimeType: "image/vnd.dwg",
            checksum: "d".repeat(64),
            role: DocFileRole.SOURCE,
          },
        ],
      },
    },
    context,
  )
  assert.equal(primera.versionNumber, 1)
  assert.equal(primera.files.length, 2)

  // Abrir precarga los dos archivos de la versión vigente
  const copia: any = await workingCopyResolvers.Mutation.openWorkingCopy(
    null,
    { revisionId: revision.id },
    context,
  )
  assert.equal(copia.files.length, 2)

  // Una segunda copia abierta se rechaza
  assert.equal(
    await codigoDeError(() =>
      workingCopyResolvers.Mutation.openWorkingCopy(
        null,
        { revisionId: revision.id },
        context,
      ),
    ),
    "CONFLICT",
  )

  // Sin tocar nada no hay nada que confirmar
  assert.equal(
    await codigoDeError(() =>
      workingCopyResolvers.Mutation.confirmWorkingCopy(
        null,
        { revisionId: revision.id },
        context,
      ),
    ),
    "BAD_REQUEST",
  )

  // Se corrige SOLO el entregable
  await workingCopyResolvers.Mutation.putWorkingCopyFile(
    null,
    {
      revisionId: revision.id,
      input: { ...archivo(1), checksum: "e".repeat(64), role: DocFileRole.DELIVERABLE },
    },
    context,
  )

  const segunda: any = await workingCopyResolvers.Mutation.confirmWorkingCopy(
    null,
    { revisionId: revision.id, input: { comment: "conexionado corregido" } },
    context,
  )

  assert.equal(segunda.versionNumber, 2)
  assert.equal(segunda.files.length, 2)
  const fuente = segunda.files.find((f: any) => f.role === DocFileRole.SOURCE)
  // La fuente viajó sola, con su key y su checksum intactos
  assert.equal(fuente.fileKey, "k1.dwg")
  assert.equal(fuente.checksum, "d".repeat(64))

  // La copia quedó confirmada y apunta a la versión que produjo
  const cerrada = await prisma.docWorkingCopy.findUniqueOrThrow({
    where: { id: copia.id },
  })
  assert.equal(cerrada.versionId, segunda.id)
  assert.ok(cerrada.confirmedAt)
})

test("un conjunto sin entregable no se confirma, y descartar no consume numeración", async () => {
  const doc: any = await crear("WC2")
  const revision = doc.revisions[0]
  await armar(revision.workflows[0].id, [StepType.APPROVE])

  assert.equal(
    await codigoDeError(() =>
      workingCopyResolvers.Mutation.confirmWorkingCopy(
        null,
        {
          revisionId: revision.id,
          input: {
            files: [
              {
                fileKey: "solo.dwg",
                fileName: "solo.dwg",
                fileSize: 1,
                mimeType: "image/vnd.dwg",
                checksum: "f".repeat(64),
                role: DocFileRole.SOURCE,
              },
            ],
          },
        },
        context,
      ),
    ),
    "BAD_USER_INPUT",
  )

  await workingCopyResolvers.Mutation.openWorkingCopy(
    null,
    { revisionId: revision.id },
    context,
  )
  await workingCopyResolvers.Mutation.putWorkingCopyFile(
    null,
    { revisionId: revision.id, input: { ...archivo(7), role: DocFileRole.DELIVERABLE } },
    context,
  )
  await workingCopyResolvers.Mutation.discardWorkingCopy(
    null,
    { revisionId: revision.id, reason: "se rehace desde cero" },
    context,
  )

  // Descartar no produce versión: la numeración interna no salta
  const versiones = await prisma.documentVersion.count({
    where: { revisionId: revision.id },
  })
  assert.equal(versiones, 0)

  // Y descartada la primera, se puede abrir otra
  const otra: any = await workingCopyResolvers.Mutation.openWorkingCopy(
    null,
    { revisionId: revision.id },
    context,
  )
  assert.ok(otra.id)
})

test("resolver un paso con una copia abierta se rechaza", async () => {
  // Declarar que se terminó mientras una iteración sigue abierta es una
  // contradicción, y evita que la revisión se apruebe con trabajo colgando (B12).
  const doc: any = await crear("WC3")
  const revision = doc.revisions[0]
  const armado = await armar(revision.workflows[0].id, [StepType.APPROVE])

  await workingCopyResolvers.Mutation.confirmWorkingCopy(
    null,
    {
      revisionId: revision.id,
      input: { files: [{ ...archivo(3), role: DocFileRole.DELIVERABLE }] },
    },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )

  // El aprobador abre una copia para marcar el archivo, y no la cierra
  await workingCopyResolvers.Mutation.openWorkingCopy(
    null,
    { revisionId: revision.id },
    context,
  )

  const aprobacion = await pasoDe(armado.id, StepType.APPROVE)
  assert.equal(
    await codigoDeError(() =>
      workflowResolvers.Mutation.approveStep(null, { stepId: aprobacion.id }, context),
    ),
    "CONFLICT",
  )

  // Descartada, el paso se resuelve
  await workingCopyResolvers.Mutation.discardWorkingCopy(
    null,
    { revisionId: revision.id, reason: "sin observaciones" },
    context,
  )
  const resuelto: any = await workflowResolvers.Mutation.approveStep(
    null,
    { stepId: aprobacion.id },
    context,
  )
  assert.equal(resuelto.status, StepStatus.APPROVED)
})

test("la firma acredita el conjunto completo, incluida la fuente que nadie revisó", async () => {
  const firma = await prisma.docStepSignature.findFirstOrThrow({
    where: { step: { workflow: { revision: { document: { code: `${CODIGO}-WC3` } } } } },
  })
  const payload = JSON.parse(firma.payload)

  assert.equal(payload.payloadVersion, 2)
  assert.ok(payload.version.files.length >= 1)
  // La identificación viaja con la revisión (B1); el código, con el documento (B3)
  assert.ok(payload.revision.title)
  assert.equal(payload.document.code, `${CODIGO}-WC3`)
  assert.deepEqual(verifySignature(firma), { valid: true })
})

test("la traza registra las acciones y transiciones de la titularidad por nivel", async () => {
  const acciones = (
    await prisma.docAuditEvent.findMany({
      where: { docProjectId: PROYECTO },
      select: { action: true },
      distinct: ["action"],
    })
  ).map((a) => a.action)

  for (const esperada of [
    AuditAction.UpdateRevisionMetadata,
    AuditAction.CorrectDocumentCode,
    AuditAction.ObsoleteDocument,
    AuditAction.OpenWorkingCopy,
    AuditAction.UpdateWorkingCopy,
    AuditAction.ConfirmWorkingCopy,
    AuditAction.DiscardWorkingCopy,
  ]) {
    assert.ok(acciones.includes(esperada), `falta la acción ${esperada}`)
  }

  const transiciones = (
    await prisma.docWorkflowEvent.findMany({
      where: { docProjectId: PROYECTO },
      select: { name: true },
      distinct: ["name"],
    })
  ).map((t) => t.name)

  assert.ok(transiciones.includes(WorkflowEvent.DocumentObsoleted))
  assert.ok(transiciones.includes(WorkflowEvent.VersionRegistered))
})

test("el acto de reemplazo cuelga de sí mismo y no de un documento cualquiera", async () => {
  // Toca varios documentos: colgar su traza de uno obligaría a elegir cuál, y la
  // elección sería arbitraria (BLOQUE 03B, fase F).
  const evento = await prisma.docAuditEvent.findFirstOrThrow({
    where: { action: AuditAction.ReplaceDocuments, docProjectId: PROYECTO },
  })

  assert.equal(evento.objectType, DocObjectType.DOC_REPLACEMENT)
  const acto = await prisma.docReplacement.findUniqueOrThrow({
    where: { id: evento.objectId! },
    include: { items: true },
  })
  assert.equal(acto.items.length, 3)

  // Y el contexto se derivó de los documentos que agrupa, no se informó a mano
  assert.equal(evento.docProjectId, PROYECTO)
  assert.equal(evento.module, ModuleType.PROJECTS)
})

test("la copia de trabajo deja su traza en la revisión, con su contexto", async () => {
  // No tiene tipo de objeto propio: no es un objeto del dominio sino el conjunto
  // en preparación de esa revisión, y lo que se consulta es qué le pasó a ella.
  const evento = await prisma.docAuditEvent.findFirstOrThrow({
    where: { action: AuditAction.ConfirmWorkingCopy, docProjectId: PROYECTO },
  })

  assert.equal(evento.objectType, DocObjectType.DOCUMENT_REVISION)
  assert.equal(evento.docProjectId, PROYECTO)
  const meta = evento.meta as any
  assert.ok(meta.versionId)
  assert.ok(meta.archivos >= 1)
})

// ════════════════════════════════════════════════════════════
// BLOQUE 03B — Criterios de aceptación sin cubrir por los recorridos
// ════════════════════════════════════════════════════════════

test("la firma acredita los dos checksum, y el respaldo entra sin contar como entregable", async () => {
  // Criterios 5 y 16. La custodia del editable importa PORQUE es la fuente del
  // entregable: que hayan sido firmados juntos es lo que sostiene que se
  // correspondan. El respaldo viaja igual, y no cuenta para el mínimo.
  const doc: any = await crear("TRES")
  const revision = doc.revisions[0]
  const armado = await armar(revision.workflows[0].id, [StepType.APPROVE])

  await workingCopyResolvers.Mutation.confirmWorkingCopy(
    null,
    {
      revisionId: revision.id,
      input: {
        files: [
          { ...archivo(1), role: DocFileRole.DELIVERABLE },
          {
            fileKey: "tres.dwg",
            fileName: "plano.dwg",
            fileSize: 20,
            mimeType: "image/vnd.dwg",
            checksum: "a".repeat(64),
            role: DocFileRole.SOURCE,
          },
          {
            fileKey: "tres.xlsx",
            fileName: "memoria.xlsx",
            fileSize: 5,
            mimeType: "application/vnd.ms-excel",
            checksum: "b".repeat(64),
            role: DocFileRole.SUPPORT,
          },
        ],
      },
    },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: revision.id },
    context,
  )
  const aprobacion = await pasoDe(armado.id, StepType.APPROVE)
  await workflowResolvers.Mutation.approveStep(null, { stepId: aprobacion.id }, context)

  const firma = await prisma.docStepSignature.findFirstOrThrow({
    where: { stepId: aprobacion.id },
  })
  const payload = JSON.parse(firma.payload)

  assert.equal(payload.version.files.length, 3)
  const roles = payload.version.files.map((f: any) => f.role)
  assert.deepEqual(roles, ["DELIVERABLE", "SOURCE", "SUPPORT"])
  for (const esperado of ["1".repeat(64), "a".repeat(64), "b".repeat(64)]) {
    assert.ok(
      payload.version.files.some((f: any) => f.checksum === esperado),
      `falta el checksum ${esperado.slice(0, 4)}…`,
    )
  }
  assert.deepEqual(verifySignature(firma), { valid: true })
})

test("los listados y filtros resuelven sobre el documento, sin join a la revisión", async () => {
  // Criterio 9. Es para lo que la copia existe: si el filtro tuviera que ir a la
  // revisión, la copia no compraría nada.
  const listado: any = await documentResolvers.Query.documents(
    null,
    { filter: { documentTypeId, query: "TEST-BLOCK03-TRES" } },
    context,
  )

  assert.ok(listado.items.length >= 1)
  assert.ok(listado.items.every((d: any) => d.currentDocumentTypeId === documentTypeId))
})

test("currentTitle es el de la revisión en curso, y la vigente conserva el suyo", async () => {
  // Criterio 10. Las dos lecturas conviven y ninguna se confunde con la otra.
  const doc: any = await crear("DOS-LECTURAS")
  const primera = doc.revisions[0]
  const armado = await armar(primera.workflows[0].id, [StepType.APPROVE])

  await workingCopyResolvers.Mutation.confirmWorkingCopy(
    null,
    {
      revisionId: primera.id,
      input: { files: [{ ...archivo(1), role: DocFileRole.DELIVERABLE }] },
    },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(
    null,
    { revisionId: primera.id },
    context,
  )
  const paso = await pasoDe(armado.id, StepType.APPROVE)
  await workflowResolvers.Mutation.approveStep(null, { stepId: paso.id }, context)

  const segunda: any = await revisionResolvers.Mutation.createRevision(
    null,
    { documentId: doc.id, input: {} },
    context,
  )
  await revisionResolvers.Mutation.updateRevisionMetadata(
    null,
    { revisionId: segunda.id, input: { title: "Título de la B" } },
    context,
  )

  const guardado = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })
  assert.equal(guardado.currentTitle, "Título de la B")

  const vigente: any = await resolverTypes.Document.currentRevision({ id: doc.id })
  assert.equal(vigente.title, `Documento DOS-LECTURAS`)
})

test("el acto de reemplazo se consulta desde cualquiera de los documentos que toca", async () => {
  // Criterio 11. El acto tiene identidad propia y ninguno de los tres lo
  // representa: se llega desde todos.
  const uno: any = await crear("CONS1")
  const dos: any = await crear("CONS2")
  const nuevo: any = await crear("CONS3")

  const acto: any = await replacementResolvers.Mutation.replaceDocuments(
    null,
    {
      input: {
        replacedIds: [uno.id, dos.id],
        replacingIds: [nuevo.id],
        reason: "unificación consultable",
      },
    },
    context,
  )

  for (const id of [uno.id, dos.id, nuevo.id]) {
    const items: any = await resolverTypes.Document.replacementItems({ id })
    assert.equal(items.length, 1)
    assert.equal(items[0].replacementId, acto.id)
  }
})

test("un documento obsoleto se lee entero y no admite revisiones nuevas", async () => {
  // Criterios 12 y 13. Lo que la obsolescencia conserva es exactamente lo que la
  // baja lógica destruiría, y el código sigue tomado: es lo que impide que el
  // reemplazo se vuelva una vía indirecta para reutilizar un identificador.
  const doc = await prisma.document.findFirstOrThrow({
    where: { code: `${CODIGO}-CONS1` },
    include: { revisions: { include: { versions: true } } },
  })
  assert.ok(doc.obsoletedAt)
  assert.equal(doc.revisions.length, 1)

  assert.equal(
    await codigoDeError(() =>
      revisionResolvers.Mutation.createRevision(
        null,
        { documentId: doc.id, input: {} },
        context,
      ),
    ),
    "CONFLICT",
  )

  // El código sigue tomado: darlo de alta otra vez en el mismo ámbito se rechaza
  assert.equal(
    await codigoDeError(() => crear("CONS1")),
    "CONFLICT",
  )
})

test("la causa de la obsolescencia se lee derivada, y distingue las dos", async () => {
  // Criterio 15. La causa no se guarda: figurar como reemplazado la determina.
  const reemplazado = await prisma.document.findFirstOrThrow({
    where: { code: `${CODIGO}-CONS1` },
  })
  const fueraDeAlcance = await prisma.document.findFirstOrThrow({
    where: { code: `${CODIGO}-OBS` },
  })
  const vigente = await prisma.document.findFirstOrThrow({
    where: { code: `${CODIGO}-CONS3` },
  })

  assert.equal(
    await resolverTypes.Document.obsolescenceCause(reemplazado),
    "REPLACEMENT",
  )
  assert.equal(
    await resolverTypes.Document.obsolescenceCause(fueraDeAlcance),
    "OUT_OF_SCOPE",
  )
  // El que reemplaza no está obsoleto, aunque figure en el acto
  assert.equal(await resolverTypes.Document.obsolescenceCause(vigente), null)
})

test("cada acto terminal deja su propio estado, y ninguno produce el del otro", async () => {
  // Criterio 17. Es la colisión que el bloque vino a deshacer: el circuito se
  // cancela, la revisión se abandona.
  const doc: any = await crear("TERMINAL")
  const revision = doc.revisions[0]
  const armado = await armar(revision.workflows[0].id, [StepType.APPROVE])

  await workflowResolvers.Mutation.cancelWorkflow(
    null,
    { workflowId: armado.id, reason: "mal armado" },
    context,
  )

  const circuito = await prisma.reviewWorkflow.findUniqueOrThrow({
    where: { id: armado.id },
  })
  const sobrevive = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(circuito.status, WorkflowStatus.CANCELLED)
  // La revisión SOBREVIVE y vuelve a borrador: cancelar no es abandonar
  assert.equal(sobrevive.status, RevisionStatus.DRAFT)
  assert.equal(sobrevive.abandonedAt, null)

  await revisionResolvers.Mutation.abandonRevision(
    null,
    { revisionId: revision.id, reason: "ya no tiene sentido" },
    context,
  )
  const abandonada = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(abandonada.status, RevisionStatus.ABANDONED)
  assert.ok(abandonada.abandonedAt)

  // El estado del circuito no aparece nunca en la revisión, ni al revés
  const estados = await prisma.documentRevision.findMany({
    where: { document: { code: { startsWith: CODIGO } } },
    select: { status: true },
    distinct: ["status"],
  })
  assert.ok(!estados.map((e) => String(e.status)).includes("CANCELLED"))
})

test("confirmar el conjunto completo de una vez equivale a la secuencia incremental", async () => {
  // Criterio 24. No son dos modelos sino la misma transición, con y sin
  // acumulación previa: el atajo es lo que necesita un cliente automático.
  const conjunto = [
    { ...archivo(4), role: DocFileRole.DELIVERABLE },
    {
      fileKey: "equiv.dwg",
      fileName: "equiv.dwg",
      fileSize: 3,
      mimeType: "image/vnd.dwg",
      checksum: "c".repeat(64),
      role: DocFileRole.SOURCE,
    },
  ]

  const deUnaVez: any = await crear("EQ1")
  await armar(deUnaVez.revisions[0].workflows[0].id, [StepType.APPROVE])
  const atajo: any = await workingCopyResolvers.Mutation.confirmWorkingCopy(
    null,
    { revisionId: deUnaVez.revisions[0].id, input: { files: conjunto } },
    context,
  )

  const incremental: any = await crear("EQ2")
  await armar(incremental.revisions[0].workflows[0].id, [StepType.APPROVE])
  const revisionId = incremental.revisions[0].id
  await workingCopyResolvers.Mutation.openWorkingCopy(null, { revisionId }, context)
  for (const file of conjunto) {
    await workingCopyResolvers.Mutation.putWorkingCopyFile(
      null,
      { revisionId, input: file },
      context,
    )
  }
  const acumulado: any = await workingCopyResolvers.Mutation.confirmWorkingCopy(
    null,
    { revisionId },
    context,
  )

  const forma = (v: any) =>
    v.files
      .map((f: any) => `${f.role}:${f.fileKey}:${f.checksum}`)
      .sort()
      .join("|")

  assert.equal(atajo.versionNumber, acumulado.versionNumber)
  assert.equal(forma(atajo), forma(acumulado))
})
