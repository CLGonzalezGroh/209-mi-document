import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import { prisma } from "../lib/prisma.js"
import {
  DocFileRole,
  DocObjectType,
  DocProjectSide,
  DocumentRole,
  ModuleType,
  RevisionScheme,
  StepStatus,
  StepType,
  WorkflowStatus,
} from "../generated/prisma/enums.js"
import { resolveObjectContext } from "./objectContext.js"

/**
 * Derivación del contexto de cada tipo de objeto, contra la base.
 *
 * `projectId` y `module` se DERIVAN del objeto afectado y no los informa quien
 * emite (BLOQUE 02, B9). El derivador tiene además un segundo consumidor que
 * debe coincidir: la resolución del proyecto para la segunda capa de
 * autorización (B7). Una derivación equivocada no rompe la compilación —el
 * `Record` solo exige que exista la función—, de modo que la única evidencia
 * posible es esta.
 *
 * BLOQUE 03 suma tres tipos, y la prueba pasa a cubrir **los trece**.
 *
 * Requiere la base local (`npm run test:object-context-db`).
 */

const PROYECTO = -424404
const CODIGO = "TEST-CONTEXT"

const creados: {
  documentId: number
  revisionId: number
  versionId: number
  workflowId: number
  stepId: number
  signatureId: number
  templateId: number
  settingsId: number
  memberId: number
  transmittalId: number
  classId: number
  typeId: number
  publicadoId: number
} = {} as any

const limpiar = async () => {
  await prisma.transmittal.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.document.deleteMany({ where: { code: { startsWith: CODIGO } } })
  await prisma.docWorkflowTemplate.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.docProjectMember.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.docProjectSettings.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.documentType.deleteMany({ where: { code: `${CODIGO}-T` } })
  await prisma.documentClass.deleteMany({ where: { code: `${CODIGO}-C` } })
}

before(async () => {
  await limpiar()

  const clase = await prisma.documentClass.create({
    data: { name: `${CODIGO} clase`, code: `${CODIGO}-C`, module: ModuleType.QUALITY },
  })
  const tipo = await prisma.documentType.create({
    data: {
      name: `${CODIGO} tipo`,
      code: `${CODIGO}-T`,
      module: ModuleType.QUALITY,
      classId: clase.id,
    },
  })

  const documento = await prisma.document.create({
    data: {
      code: `${CODIGO}-1`,
      currentTitle: "Documento de contexto",
      module: ModuleType.PROJECTS,
      projectId: PROYECTO,
      currentDocumentTypeId: tipo.id,
      createdById: 1,
      revisions: {
        create: {
          revisionCode: "A",
          assignedOrganizerId: 1,
          title: "Documento de contexto",
          documentTypeId: tipo.id,
          createdById: 1,
          versions: {
            create: {
              versionNumber: 1,
              createdById: 1,
              files: {
                create: {
                  role: DocFileRole.DELIVERABLE,
                  fileKey: "k",
                  fileName: "f.pdf",
                  fileSize: 1,
                  mimeType: "application/pdf",
                  checksum: "cc".repeat(32),
                },
              },
            },
          },
          workflows: {
            create: {
              status: WorkflowStatus.IN_PROGRESS,
              initiatedById: 1,
              steps: {
                create: {
                  stepOrder: 1,
                  stepType: StepType.ASSIGN,
                  assignedToId: 1,
                  status: StepStatus.PENDING,
                },
              },
            },
          },
        },
      },
    },
    include: {
      revisions: {
        include: { versions: true, workflows: { include: { steps: true } } },
      },
    },
  })

  // El régimen de publicación: sin proyecto, con módulo (BLOQUE 02, B1)
  const publicado = await prisma.document.create({
    data: {
      code: `${CODIGO}-PUB`,
      currentTitle: "Documento publicado",
      module: ModuleType.QUALITY,
      currentDocumentTypeId: tipo.id,
      createdById: 1,
    },
  })

  const revision = documento.revisions[0]
  const workflow = revision.workflows[0]
  const step = workflow.steps[0]

  const firma = await prisma.docStepSignature.create({
    data: {
      stepId: step.id,
      payload: '{"prueba":1}',
      hash: "h",
      createdById: 1,
    },
  })

  const plantilla = await prisma.docWorkflowTemplate.create({
    data: {
      name: `${CODIGO} plantilla`,
      projectId: PROYECTO,
      createdById: 1,
      steps: {
        create: { stepOrder: 1, stepType: StepType.APPROVE },
      },
    },
  })

  const settings = await prisma.docSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, revisionScheme: RevisionScheme.ALPHA },
  })

  const projectSettings = await prisma.docProjectSettings.create({
    data: {
      projectId: PROYECTO,
      documentRole: DocumentRole.INTERNAL,
      createdById: 1,
    },
  })

  const miembro = await prisma.docProjectMember.create({
    data: {
      projectId: PROYECTO,
      userId: 1,
      side: DocProjectSide.HOST,
      assignedById: 1,
    },
  })

  const transmittal = await prisma.transmittal.create({
    data: {
      code: `${CODIGO}-TR`,
      projectId: PROYECTO,
      issuedTo: "Cliente",
      issuedById: 1,
    },
  })

  Object.assign(creados, {
    documentId: documento.id,
    publicadoId: publicado.id,
    revisionId: revision.id,
    versionId: revision.versions[0].id,
    workflowId: workflow.id,
    stepId: step.id,
    signatureId: firma.id,
    templateId: plantilla.id,
    settingsId: settings.id,
    projectSettingsId: projectSettings.id,
    memberId: miembro.id,
    transmittalId: transmittal.id,
    classId: clase.id,
    typeId: tipo.id,
  })
})

after(async () => {
  await limpiar()
  await prisma.$disconnect()
})

const contextoDe = (objectType: DocObjectType, objectId: number) =>
  resolveObjectContext(prisma, objectType, objectId)

// --- La cadena documental: el contexto sale del documento ---

test("el documento aporta su proyecto y su módulo", async () => {
  assert.deepEqual(await contextoDe(DocObjectType.DOCUMENT, creados.documentId), {
    projectId: PROYECTO,
    module: ModuleType.PROJECTS,
  })
})

test("el documento publicado no tiene proyecto, y por eso el módulo importa", async () => {
  // Es el único eje disponible cuando no hay proyecto: sin `module`, toda su
  // traza quedaría en una masa indistinguible.
  assert.deepEqual(
    await contextoDe(DocObjectType.DOCUMENT, creados.publicadoId),
    { projectId: null, module: ModuleType.QUALITY },
  )
})

test("revisión, versión, circuito y paso derivan del documento", async () => {
  const esperado = { projectId: PROYECTO, module: ModuleType.PROJECTS }

  assert.deepEqual(
    await contextoDe(DocObjectType.DOCUMENT_REVISION, creados.revisionId),
    esperado,
  )
  assert.deepEqual(
    await contextoDe(DocObjectType.DOCUMENT_VERSION, creados.versionId),
    esperado,
  )
  assert.deepEqual(
    await contextoDe(DocObjectType.REVIEW_WORKFLOW, creados.workflowId),
    esperado,
  )
  assert.deepEqual(
    await contextoDe(DocObjectType.REVIEW_STEP, creados.stepId),
    esperado,
  )
})

test("la firma deriva del paso, un nivel más en la misma cadena", async () => {
  // BLOQUE 03, B7: la firma cuelga del paso, de modo que su contexto es el del
  // circuito. Es el tipo de objeto nuevo con la cadena más larga.
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_STEP_SIGNATURE, creados.signatureId),
    { projectId: PROYECTO, module: ModuleType.PROJECTS },
  )
})

// --- Los objetos que llevan su propio contexto ---

test("el transmittal lleva su proyecto y su módulo es siempre PROJECTS", async () => {
  // No es un valor fijado a mano como el que denunciaba H-24: es lo que el
  // modelo afirma, declarado en un solo lugar.
  assert.deepEqual(
    await contextoDe(DocObjectType.TRANSMITTAL, creados.transmittalId),
    { projectId: PROYECTO, module: ModuleType.PROJECTS },
  )
})

test("los catálogos no pertenecen a ningún proyecto", async () => {
  assert.deepEqual(
    await contextoDe(DocObjectType.DOCUMENT_CLASS, creados.classId),
    { projectId: null, module: ModuleType.QUALITY },
  )
  assert.deepEqual(
    await contextoDe(DocObjectType.DOCUMENT_TYPE, creados.typeId),
    { projectId: null, module: ModuleType.QUALITY },
  )
})

test("la configuración y la membresía del proyecto no tienen módulo", async () => {
  // Son contexto del proyecto, no documentación.
  assert.deepEqual(
    await contextoDe(
      DocObjectType.DOC_PROJECT_SETTINGS,
      (creados as any).projectSettingsId,
    ),
    { projectId: PROYECTO, module: null },
  )
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_PROJECT_MEMBER, creados.memberId),
    { projectId: PROYECTO, module: null },
  )
})

test("la plantilla lleva su proyecto en el alcance y no declara módulo", async () => {
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_WORKFLOW_TEMPLATE, creados.templateId),
    { projectId: PROYECTO, module: null },
  )
})

test("la configuración del despliegue no tiene ni proyecto ni módulo", async () => {
  // Es exactamente lo que la vuelve el último escalón de la precedencia.
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_SETTINGS, creados.settingsId),
    { projectId: null, module: null },
  )
})

// --- La distinción que la autorización necesita ---

test("un objeto inexistente devuelve null y no contexto vacío", async () => {
  // La autorización debe distinguir "no pertenece a ningún proyecto" —que
  // autoriza por permiso global— de "no existe" —que debe cortar con NOT_FOUND—.
  // Confundirlos autorizaría operaciones sobre objetos inexistentes.
  for (const objectType of Object.values(DocObjectType)) {
    assert.equal(
      await contextoDe(objectType, -999999),
      null,
      `${objectType} debería devolver null para un objeto inexistente`,
    )
  }
})

test("los trece tipos de objeto tienen derivador", async () => {
  // Ninguno queda sin regla: es la prueba que BLOQUE 01 exige y que cada tipo
  // nuevo debe seguir pasando.
  for (const objectType of Object.values(DocObjectType)) {
    await assert.doesNotReject(
      () => contextoDe(objectType, -999999),
      `${objectType} no tiene derivador de contexto`,
    )
  }
  assert.equal(Object.values(DocObjectType).length, 13)
})
