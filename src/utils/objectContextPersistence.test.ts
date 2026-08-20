import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import { prisma } from "../lib/prisma.js"
import {
  DocCatalogKind,
  DocFileRole,
  DocObjectType,
  DocProjectSide,
  DocumentRole,
  ModuleType,
  PurposeCode,
  QualificationEffect,
  TransmittalNature,
  DocScopeMode,
  RevisionScheme,
  StepStatus,
  StepType,
  WorkflowStatus,
} from "../generated/prisma/enums.js"
import { resolveObjectContext } from "./objectContext.js"
import { asegurarContratos, borrarContratos } from "./testContracts.js"

/**
 * Derivación del contexto de cada tipo de objeto, contra la base.
 *
 * `docProjectId` y `module` se DERIVAN del objeto afectado y no los informa quien
 * emite (BLOQUE 02, B9). El derivador tiene además un segundo consumidor que
 * debe coincidir: la resolución del proyecto para la segunda capa de
 * autorización (B7). Una derivación equivocada no rompe la compilación —el
 * `Record` solo exige que exista la función—, de modo que la única evidencia
 * posible es esta.
 *
 * BLOQUE 03 suma tres tipos y BLOQUE 03B uno, y la prueba pasa a cubrir **los
 * catorce**.
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
  qualificationId: number
  responseId: number
  memberId: number
  transmittalId: number
  classId: number
  typeId: number
  publicadoId: number
  locationId: number
  ampliacionId: number
  scopeId: number
} = {} as any

const limpiar = async () => {
  // La ampliación antes que su padre: la clave del árbol es RESTRICT.
  await prisma.docLocation.deleteMany({
    where: { code: { startsWith: `${CODIGO}-L` }, parentId: { not: null } },
  })
  await prisma.docLocation.deleteMany({
    where: { code: { startsWith: `${CODIGO}-L` } },
  })
  await prisma.docCatalogScope.deleteMany({ where: { docProjectId: PROYECTO } })
  await prisma.transmittal.deleteMany({ where: { docProjectId: PROYECTO } })
  await prisma.document.deleteMany({ where: { code: { startsWith: CODIGO } } })
  await prisma.docWorkflowTemplate.deleteMany({ where: { docProjectId: PROYECTO } })
  await prisma.docQualification.deleteMany({ where: { docProjectId: PROYECTO } })
  await prisma.docProjectMember.deleteMany({ where: { docProjectId: PROYECTO } })
  await borrarContratos(prisma, [PROYECTO])
  await prisma.documentType.deleteMany({ where: { code: `${CODIGO}-T` } })
  await prisma.documentClass.deleteMany({ where: { code: `${CODIGO}-C` } })
}

before(async () => {
  await limpiar()

  // El id del contrato ES la constante: así el resto de la prueba puede seguir
  // usándola como alcance sin hilvanar el id devuelto por cada llamada. Va
  // primero porque todo lo que sigue le cuelga con clave foránea.
  await asegurarContratos(prisma, [PROYECTO])

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
      docProjectId: PROYECTO,
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
      docProjectId: PROYECTO,
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

  const docProject = { id: PROYECTO }

  const miembro = await prisma.docProjectMember.create({
    data: {
      docProjectId: PROYECTO,
      userId: 1,
      side: DocProjectSide.HOST,
      assignedById: 1,
    },
  })

  const transmittal = await prisma.transmittal.create({
    data: {
      code: `${CODIGO}-TR`,
      docProjectId: PROYECTO,
      nature: TransmittalNature.EMISSION,
      issuedById: 1,
    },
  })

  const calificacion = await prisma.docQualification.create({
    data: {
      docProjectId: PROYECTO,
      code: `${CODIGO}-Q`,
      label: "Aprobado (cliente)",
      effect: QualificationEffect.ACCEPTED,
      createdById: 1,
    },
  })

  // La respuesta cuelga del ítem, y el ítem del transmittal: es la cadena por
  // la que su contexto se deriva (BLOQUE 04, B5).
  const item = await prisma.transmittalItem.create({
    data: {
      transmittalId: transmittal.id,
      documentRevisionId: revision.id,
      purposeCode: PurposeCode.FOR_APPROVAL,
    },
  })

  // Ubicación: un nodo del despliegue y una ampliación del proyecto colgada de él
  const ubicacion = await prisma.docLocation.create({
    data: {
      code: `${CODIGO}-L`,
      name: "Planta de contexto",
      path: "Planta de contexto",
      createdById: 1,
    },
  })
  const ampliacion = await prisma.docLocation.create({
    data: {
      code: `${CODIGO}-LA`,
      name: "Unidad del proyecto",
      path: "Planta de contexto / Unidad del proyecto",
      parentId: ubicacion.id,
      docProjectId: PROYECTO,
      createdById: 1,
    },
  })
  const alcance = await prisma.docCatalogScope.create({
    data: {
      module: ModuleType.PROJECTS,
      docProjectId: PROYECTO,
      catalog: DocCatalogKind.LOCATION,
      mode: DocScopeMode.INHERIT,
      createdById: 1,
    },
  })

  const respuesta = await prisma.docTransmittalResponse.create({
    data: {
      transmittalItemId: item.id,
      qualificationId: calificacion.id,
      registeredById: 1,
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
    qualificationId: calificacion.id,
    responseId: respuesta.id,
    docProjectId: docProject.id,
    memberId: miembro.id,
    transmittalId: transmittal.id,
    classId: clase.id,
    typeId: tipo.id,
    locationId: ubicacion.id,
    ampliacionId: ampliacion.id,
    scopeId: alcance.id,
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
    docProjectId: PROYECTO,
    module: ModuleType.PROJECTS,
  })
})

test("el documento publicado no tiene proyecto, y por eso el módulo importa", async () => {
  // Es el único eje disponible cuando no hay proyecto: sin `module`, toda su
  // traza quedaría en una masa indistinguible.
  assert.deepEqual(
    await contextoDe(DocObjectType.DOCUMENT, creados.publicadoId),
    { docProjectId: null, module: ModuleType.QUALITY },
  )
})

test("revisión, versión, circuito y paso derivan del documento", async () => {
  const esperado = { docProjectId: PROYECTO, module: ModuleType.PROJECTS }

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
    { docProjectId: PROYECTO, module: ModuleType.PROJECTS },
  )
})

// --- Los objetos que llevan su propio contexto ---

test("el transmittal lleva su proyecto y su módulo es siempre PROJECTS", async () => {
  // No es un valor fijado a mano como el que denunciaba H-24: es lo que el
  // modelo afirma, declarado en un solo lugar.
  assert.deepEqual(
    await contextoDe(DocObjectType.TRANSMITTAL, creados.transmittalId),
    { docProjectId: PROYECTO, module: ModuleType.PROJECTS },
  )
})

test("los catálogos no pertenecen a ningún proyecto", async () => {
  assert.deepEqual(
    await contextoDe(DocObjectType.DOCUMENT_CLASS, creados.classId),
    { docProjectId: null, module: ModuleType.QUALITY },
  )
  assert.deepEqual(
    await contextoDe(DocObjectType.DOCUMENT_TYPE, creados.typeId),
    { docProjectId: null, module: ModuleType.QUALITY },
  )
})

test("la configuración y la membresía del proyecto no tienen módulo", async () => {
  // Son contexto del proyecto, no documentación.
  assert.deepEqual(
    await contextoDe(
      DocObjectType.DOC_PROJECT,
      (creados as any).docProjectId,
    ),
    { docProjectId: PROYECTO, module: null },
  )
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_PROJECT_MEMBER, creados.memberId),
    { docProjectId: PROYECTO, module: null },
  )
})

test("la plantilla lleva su proyecto en el alcance y no declara módulo", async () => {
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_WORKFLOW_TEMPLATE, creados.templateId),
    { docProjectId: PROYECTO, module: null },
  )
})

test("la configuración del despliegue no tiene ni proyecto ni módulo", async () => {
  // Es exactamente lo que la vuelve el último escalón de la precedencia.
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_SETTINGS, creados.settingsId),
    { docProjectId: null, module: null },
  )
})

test("la calificación lleva su alcance, y la del despliegue no tiene proyecto", async () => {
  // Misma forma que la plantilla del circuito: el proyecto sale del alcance y el
  // módulo es nulo, porque el catálogo no es documentación sino configuración
  // del contrato (BLOQUE 04, B11).
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_QUALIFICATION, creados.qualificationId),
    { docProjectId: PROYECTO, module: null },
  )

  const delDespliegue = await prisma.docQualification.findFirst({
    where: { docProjectId: null },
    select: { id: true },
  })
  assert.ok(delDespliegue, "la siembra del despliegue debe existir")
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_QUALIFICATION, delDespliegue.id),
    { docProjectId: null, module: null },
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

test("el acto de reemplazo toma el contexto de los documentos que agrupa", async () => {
  // Los documentos de un acto COMPARTEN ÁMBITO (BLOQUE 03B, B5), y esa es la
  // condición que vuelve bien definida la derivación: cualquiera de ellos da la
  // misma respuesta, de modo que no hay que elegir uno.
  const acto = await prisma.docReplacement.create({
    data: {
      reason: "unificación de prueba",
      createdById: 1,
      items: {
        create: { documentId: creados.documentId, role: "REPLACED" },
      },
    },
  })

  assert.deepEqual(await contextoDe(DocObjectType.DOC_REPLACEMENT, acto.id), {
    docProjectId: PROYECTO,
    module: ModuleType.PROJECTS,
  })

  await prisma.docReplacement.delete({ where: { id: acto.id } })
})

test("la respuesta toma el contexto del transmittal por el que el documento salió", async () => {
  // La cadena es respuesta ▸ ítem ▸ transmittal, un nivel más abajo que el
  // transmittal, y por eso su módulo es también PROJECTS (BLOQUE 04, B5).
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_TRANSMITTAL_RESPONSE, creados.responseId),
    { docProjectId: PROYECTO, module: ModuleType.PROJECTS },
  )
})

test("el nodo de ubicación aporta su alcance, y el del despliegue no tiene proyecto", async () => {
  // De acá sale la segunda capa de autorización sin una regla por operación: el
  // nodo del despliegue se resuelve con el permiso global, el de proyecto exige
  // membresía (BLOQUE 02B, B1).
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_LOCATION, creados.locationId),
    { docProjectId: null, module: null },
  )
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_LOCATION, creados.ampliacionId),
    { docProjectId: PROYECTO, module: null },
  )
})

test("la declaración de alcance pertenece a un proyecto por definición", async () => {
  // Sin proyecto no hay nada que declarar: el árbol del despliegue es el que se
  // hereda. El módulo es nulo porque no es documentación.
  assert.deepEqual(
    await contextoDe(DocObjectType.DOC_CATALOG_SCOPE, creados.scopeId),
    { docProjectId: PROYECTO, module: null },
  )
})

test("los dieciocho tipos de objeto tienen derivador", async () => {
  // Ninguno queda sin regla: es la prueba que BLOQUE 01 exige y que cada tipo
  // nuevo debe seguir pasando. Los dos últimos los incorpora BLOQUE 02B:
  // `DOC_LOCATION` en su fase 1 y `DOC_CATALOG_SCOPE` en su fase 2.
  for (const objectType of Object.values(DocObjectType)) {
    await assert.doesNotReject(
      () => contextoDe(objectType, -999999),
      `${objectType} no tiene derivador de contexto`,
    )
  }
  assert.equal(Object.values(DocObjectType).length, 18)
})
