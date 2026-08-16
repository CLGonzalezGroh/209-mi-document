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
  PurposeCode,
  RevisionStatus,
  StepStatus,
  StepType,
  TransmittalNature,
  WorkflowStatus,
} from "../generated/prisma/enums.js"
import { transmittalResolvers } from "./transmittals.js"
import { documentResolvers } from "./documents.js"
import { workflowResolvers } from "./workflows.js"
import { workingCopyResolvers } from "./workingCopies.js"
import { projectSettingsResolvers } from "./projectSettings.js"
import { projectMemberResolvers } from "./projectMembers.js"
import { resolverTypes } from "./resolversTypes/index.js"
import { TransmittalDirection } from "../utils/transmittalCirculation.js"
import { AuditAction } from "../events/catalog.js"

/**
 * Circulación del transmittal contra la base y el resolver (BLOQUE 04).
 *
 * Cubre los criterios 1 a 9 del bloque: los invariantes de rol y naturaleza, la
 * numeración por proyecto y su comportamiento concurrente, la puerta de emisión
 * al incorporar el ítem, la revisión que se emite una sola vez, y las dos reglas
 * del propósito.
 *
 * Sobre el arnés de integración de BLOQUE 02: contexto real, token firmado y
 * primera capa validada contra `mi-admin`. Requiere `mi-admin` corriendo, el
 * usuario de prueba con el rol documental completo, y la base local.
 */

const USER_ID = 3
const ROLE_IDS = [1, 16] // view + doc-full
const EMISOR = -424410
const RECEPTOR = -424411
const INTERNO = -424412

let context: ResolverContext

const PROYECTOS = [EMISOR, RECEPTOR, INTERNO]

const CODIGO = "TEST-BLOCK04"

const limpiar = async () => {
  await prisma.transmittal.deleteMany({ where: { projectId: { in: PROYECTOS } } })
  await prisma.document.deleteMany({ where: { code: { startsWith: CODIGO } } })
  await prisma.docProjectMember.deleteMany({ where: { projectId: { in: PROYECTOS } } })
  await prisma.docProjectSettings.deleteMany({ where: { projectId: { in: PROYECTOS } } })
  await prisma.docAuditEvent.deleteMany({ where: { projectId: { in: PROYECTOS } } })
  await prisma.docWorkflowEvent.deleteMany({ where: { projectId: { in: PROYECTOS } } })
}

const declarar = async (projectId: number, documentRole: DocumentRole) => {
  await projectSettingsResolvers.Mutation.declareDocProjectSettings(
    null,
    {
      input: {
        projectId,
        documentRole,
        ...(documentRole !== DocumentRole.INTERNAL && {
          counterpartyName: "Contraparte de prueba",
        }),
        defaultOrganizerId: USER_ID,
      },
    },
    context,
  )
  await projectMemberResolvers.Mutation.assignDocProjectMember(
    null,
    { input: { projectId, userId: USER_ID, side: DocProjectSide.HOST } },
    context,
  )
}

let documentTypeId: number

before(async () => {
  await limpiar()

  const token = jwt.sign(
    { id: USER_ID, roles: ROLE_IDS },
    process.env.AUTH_JWT_SECRET as string,
    { expiresIn: "1h" },
  )
  context = { orm: prisma, token: `Bearer ${token}` } as ResolverContext

  const tipo = await prisma.documentType.findFirstOrThrow({ select: { id: true } })
  documentTypeId = tipo.id

  await declarar(EMISOR, DocumentRole.ISSUER)
  await declarar(RECEPTOR, DocumentRole.RECEIVER)
  await declarar(INTERNO, DocumentRole.INTERNAL)
})

after(async () => {
  await limpiar()
  await prisma.$disconnect()
})

const crear = (
  projectId: number,
  nature: TransmittalNature,
  extra: Record<string, unknown> = {},
) =>
  transmittalResolvers.Mutation.createTransmittal(
    null,
    { input: { projectId, nature, items: [], ...extra } as any },
    context,
  ) as Promise<any>

// --- Los invariantes de rol y naturaleza (B1) ---

test("un proyecto interno no admite transmittals de ninguna naturaleza", async () => {
  // D-19: sin contraparte no hay emisión, y el ciclo termina en la aprobación.
  await assert.rejects(
    () => crear(INTERNO, TransmittalNature.EMISSION),
    /proyecto interno no admite transmittals/,
  )
  await assert.rejects(
    () => crear(INTERNO, TransmittalNature.RESPONSE),
    /proyecto interno no admite transmittals/,
  )
})

test("en modo Receptor no existe el transmittal de respuesta", async () => {
  // D-18: la planta no consolida su calificación en un remito; responde
  // documento a documento.
  await assert.rejects(
    () => crear(RECEPTOR, TransmittalNature.RESPONSE),
    /no existe el transmittal de respuesta/,
  )
})

test("una respuesta sin la emisión que contesta se rechaza", async () => {
  await assert.rejects(
    () => crear(EMISOR, TransmittalNature.RESPONSE),
    /debe declarar la emisión que contesta/,
  )
})

test("una respuesta a una emisión de otro proyecto se rechaza", async () => {
  const ajena = await crear(RECEPTOR, TransmittalNature.EMISSION)

  await assert.rejects(
    () =>
      crear(EMISOR, TransmittalNature.RESPONSE, {
        respondsToTransmittalId: ajena.id,
      }),
    /otro proyecto/,
  )
})

test("una emisión no puede declarar que responde a otro transmittal", async () => {
  const propia = await crear(EMISOR, TransmittalNature.EMISSION)

  await assert.rejects(
    () =>
      crear(EMISOR, TransmittalNature.EMISSION, {
        respondsToTransmittalId: propia.id,
      }),
    /no responde a otro transmittal/,
  )
})

test("la respuesta se vincula a la emisión que contesta, en los dos sentidos", async () => {
  const emision = await crear(EMISOR, TransmittalNature.EMISSION)
  const respuesta = await crear(EMISOR, TransmittalNature.RESPONSE, {
    respondsToTransmittalId: emision.id,
    counterpartyReference: "TX-CLIENTE-88",
  })

  assert.equal(respuesta.respondsToTransmittalId, emision.id)
  assert.equal(respuesta.counterpartyReference, "TX-CLIENTE-88")

  const desdeLaEmision = await resolverTypes.Transmittal.responses(emision)
  assert.deepEqual(
    desdeLaEmision.map((r: any) => r.id),
    [respuesta.id],
  )
})

// --- El sentido, derivado y no almacenado (B1) ---

test("el sentido se deriva del rol y de la naturaleza, y no se guarda", async () => {
  const emision = await crear(EMISOR, TransmittalNature.EMISSION)
  const entrante = await crear(RECEPTOR, TransmittalNature.EMISSION)
  const respuesta = await crear(EMISOR, TransmittalNature.RESPONSE, {
    respondsToTransmittalId: emision.id,
  })

  assert.equal(
    await resolverTypes.Transmittal.direction(emision),
    TransmittalDirection.OUTGOING,
  )
  assert.equal(
    await resolverTypes.Transmittal.direction(entrante),
    TransmittalDirection.INCOMING,
  )
  assert.equal(
    await resolverTypes.Transmittal.direction(respuesta),
    TransmittalDirection.INCOMING,
  )

  // Ninguna columna lo almacena: el mismo registro cambia de sentido si el
  // proyecto cambiara de rol, que es lo que un dato guardado no garantizaría.
  const columnas = await prisma.transmittal.findUnique({
    where: { id: emision.id },
  })
  assert.equal("direction" in (columnas as object), false)
})

// --- El código, por proyecto y transaccional (B2) ---

test("la numeración corre por proyecto y arranca en TR-001 en cada uno", async () => {
  await prisma.transmittal.deleteMany({ where: { projectId: { in: PROYECTOS } } })

  const primeroEmisor = await crear(EMISOR, TransmittalNature.EMISSION)
  const primeroReceptor = await crear(RECEPTOR, TransmittalNature.EMISSION)
  const segundoEmisor = await crear(EMISOR, TransmittalNature.EMISSION)

  assert.equal(primeroEmisor.code, "TR-001")
  assert.equal(primeroReceptor.code, "TR-001")
  assert.equal(segundoEmisor.code, "TR-002")
})

test("dos creaciones concurrentes en el mismo proyecto no comparten código", async () => {
  // Es la otra mitad de H-16: el código se calculaba fuera de la transacción,
  // de modo que dos emisiones simultáneas obtenían el mismo número. El árbitro
  // es el índice único, y el resolver reintenta la transacción entera.
  await prisma.transmittal.deleteMany({ where: { projectId: EMISOR } })

  const creados = await Promise.all(
    Array.from({ length: 5 }, () => crear(EMISOR, TransmittalNature.EMISSION)),
  )

  const codigos = creados.map((t) => t.code).sort()
  assert.equal(new Set(codigos).size, 5, `códigos repetidos: ${codigos}`)
  assert.deepEqual(codigos, ["TR-001", "TR-002", "TR-003", "TR-004", "TR-005"])
})

test("dos proyectos pueden tener el mismo código", async () => {
  const [delEmisor, delReceptor] = await Promise.all([
    prisma.transmittal.findFirst({ where: { projectId: EMISOR, code: "TR-001" } }),
    prisma.transmittal.findFirst({ where: { projectId: RECEPTOR, code: "TR-001" } }),
  ])

  assert.ok(delEmisor)
  assert.ok(delReceptor)
  assert.notEqual(delEmisor.id, delReceptor.id)
})

// ════════════════════════════════════════════════════════════
// FASE 3 — La puerta de emisión y las reglas del propósito
// ════════════════════════════════════════════════════════════

/** Documento nuevo con su revisión en borrador. */
const documento = async (projectId: number, sufijo: string) => {
  const doc = (await documentResolvers.Mutation.createDocument(
    null,
    {
      input: {
        code: `${CODIGO}-${sufijo}`,
        title: `Documento ${sufijo}`,
        module: ModuleType.PROJECTS,
        projectId,
        documentTypeId,
      },
    },
    context,
  )) as any

  return doc.revisions[0]
}

const versionCon = (revisionId: number, roles: DocFileRole[]) =>
  workingCopyResolvers.Mutation.confirmWorkingCopy(
    null,
    {
      revisionId,
      input: {
        files: roles.map((role, i) => ({
          role,
          fileKey: `k-${revisionId}-${i}`,
          fileName: `archivo-${i}`,
          fileSize: 10 + i,
          mimeType: "application/pdf",
          checksum: `${i}`.repeat(64),
        })),
      },
    },
    context,
  ) as Promise<any>

/** Lleva la revisión hasta APPROVED por el circuito completo. */
const aprobar = async (revisionId: number) => {
  const circuito = await prisma.reviewWorkflow.findFirstOrThrow({
    where: { revisionId, status: WorkflowStatus.IN_PROGRESS },
  })

  await workflowResolvers.Mutation.defineWorkflow(
    null,
    {
      workflowId: circuito.id,
      input: {
        preparerId: USER_ID,
        steps: [
          { stepOrder: 1, stepType: StepType.REVIEW, assignedToId: USER_ID },
          { stepOrder: 2, stepType: StepType.APPROVE, assignedToId: USER_ID },
        ],
      },
    },
    context,
  )
  await workflowResolvers.Mutation.submitRevision(null, { revisionId }, context)

  for (const stepType of [StepType.REVIEW, StepType.APPROVE]) {
    const paso = await prisma.reviewStep.findFirstOrThrow({
      where: { workflowId: circuito.id, stepType, status: StepStatus.PENDING },
    })
    await workflowResolvers.Mutation.approveStep(null, { stepId: paso.id }, context)
  }
}

const conItem = (
  projectId: number,
  revisionId: number,
  purposeCode: PurposeCode,
) =>
  crear(projectId, TransmittalNature.EMISSION, {
    items: [{ documentRevisionId: revisionId, purposeCode }],
  })

// --- La puerta, al incorporar el ítem (B3) ---

test("una revisión en borrador no puede incorporarse a una emisión saliente", async () => {
  // La puerta vive donde se ELIGE: admitirla en borrador para rechazarla al
  // emitir obliga a armar la carpeta con documentos que van a trabarla.
  const revision = await documento(EMISOR, "GATE-1")

  await assert.rejects(
    () => conItem(EMISOR, revision.id, PurposeCode.FOR_APPROVAL),
    /Solo se emiten revisiones aprobadas/,
  )
})

test("la puerta no cede ante ningún propósito", async () => {
  const revision = await documento(EMISOR, "GATE-2")

  for (const purpose of Object.values(PurposeCode)) {
    await assert.rejects(
      () => conItem(EMISOR, revision.id, purpose),
      /Solo se emiten revisiones aprobadas/,
      purpose,
    )
  }
})

test("en modo Receptor el transmittal entrante admite revisiones en borrador", async () => {
  // No es una excepción a la regla sino su consecuencia: la puerta exige
  // aprobación INTERNA, y el contratista no la hace dentro del sistema.
  const revision = await documento(RECEPTOR, "GATE-3")
  const entrante = await conItem(RECEPTOR, revision.id, PurposeCode.FOR_APPROVAL)

  assert.equal(entrante.items.length, 1)
})

test("emitir vuelve a verificar la puerta, por si la revisión se abandonó", async () => {
  const revision = await documento(EMISOR, "GATE-4")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])
  await aprobar(revision.id)

  const transmittal = await conItem(
    EMISOR,
    revision.id,
    PurposeCode.FOR_APPROVAL,
  )

  // Se fuerza el estado para representar lo que ocurriría entre incorporar y
  // emitir. La puerta debe volver a mirarlo.
  await prisma.documentRevision.update({
    where: { id: revision.id },
    data: { status: RevisionStatus.ABANDONED },
  })

  await assert.rejects(
    () =>
      transmittalResolvers.Mutation.issueTransmittal(
        null,
        { id: transmittal.id },
        context,
      ) as Promise<unknown>,
    /Solo se emiten revisiones aprobadas/,
  )

  await prisma.documentRevision.update({
    where: { id: revision.id },
    data: { status: RevisionStatus.APPROVED },
  })
})

// --- Una revisión se emite una sola vez (B3) ---

test("la revisión ya emitida no vuelve a ser candidata", async () => {
  const revision = await documento(EMISOR, "ONCE")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])
  await aprobar(revision.id)

  await conItem(EMISOR, revision.id, PurposeCode.FOR_APPROVAL)

  // Falla por UNICIDAD y no por validación: el índice es el árbitro, y con eso
  // quedan cubiertos el reintento del emisor y la revisión ya respondida.
  await assert.rejects(
    () => conItem(EMISOR, revision.id, PurposeCode.FOR_REVIEW),
    /una revisión se emite una sola vez/,
  )
})

// --- Las dos reglas del propósito (B4) ---

test("solo aprobación y revisión quedan a la espera de calificación", async () => {
  const revision = await documento(EMISOR, "PURPOSE-1")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])
  await aprobar(revision.id)

  const transmittal = await conItem(
    EMISOR,
    revision.id,
    PurposeCode.FOR_INFORMATION,
  )
  const item = transmittal.items[0]

  assert.equal(resolverTypes.TransmittalItem.expectsQualification(item), false)
  assert.equal(
    resolverTypes.TransmittalItem.expectsQualification({
      ...item,
      purposeCode: PurposeCode.FOR_APPROVAL,
    }),
    true,
  )
})

test("emitir para construcción sin el editable se admite, advierte y queda registrado", async () => {
  // Es advertencia y no puerta: acá la revisión ya está aprobada, su versión es
  // inmutable y NO HAY FORMA LEGAL de agregar la fuente que falta. Una puerta
  // dura exigiría algo que el propio sistema hace imposible.
  const revision = await documento(EMISOR, "WARN")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])
  await aprobar(revision.id)

  const transmittal = await conItem(
    EMISOR,
    revision.id,
    PurposeCode.FOR_CONSTRUCTION,
  )

  const faltantes = await resolverTypes.TransmittalItem.missingFileRoles(
    transmittal.items[0],
  )
  assert.deepEqual(faltantes, [DocFileRole.SOURCE])

  const emitido = (await transmittalResolvers.Mutation.issueTransmittal(
    null,
    { id: transmittal.id },
    context,
  )) as any
  assert.equal(emitido.status, "ISSUED")

  const evento = await prisma.docAuditEvent.findFirstOrThrow({
    where: { action: AuditAction.IssueTransmittal, objectId: transmittal.id },
  })
  const meta = evento.meta as any
  assert.deepEqual(meta.missingFiles[0].missing, [DocFileRole.SOURCE])
})

test("la advertencia está disponible mientras la revisión sigue abierta", async () => {
  // Es el momento en que incorporar el archivo no cuesta nada. La revisión
  // todavía no sabe con qué propósito va a salir, y por eso lo recibe.
  const revision = await documento(EMISOR, "WARN-OPEN")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])

  assert.deepEqual(
    await resolverTypes.DocumentRevision.missingFileRoles(revision, {
      purpose: PurposeCode.FOR_CONSTRUCTION,
    }),
    [DocFileRole.SOURCE],
  )
  assert.deepEqual(
    await resolverTypes.DocumentRevision.missingFileRoles(revision, {
      purpose: PurposeCode.FOR_APPROVAL,
    }),
    [],
  )
})

// --- Los ítems se editan en borrador (B9) ---

test("el transmittal se crea vacío y los documentos se vinculan después", async () => {
  const revision = await documento(EMISOR, "ADD-1")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])
  await aprobar(revision.id)

  const vacio = await crear(EMISOR, TransmittalNature.EMISSION)
  assert.equal(vacio.items.length, 0)

  const conDocumento = (await transmittalResolvers.Mutation.addTransmittalItem(
    null,
    {
      transmittalId: vacio.id,
      input: {
        documentRevisionId: revision.id,
        purposeCode: PurposeCode.FOR_APPROVAL,
      },
    },
    context,
  )) as any

  assert.equal(conDocumento.items.length, 1)
  assert.equal(conDocumento.items[0].documentRevisionId, revision.id)
})

test("agregar una revisión sin aprobar se rechaza por la misma puerta", async () => {
  // Es acá donde "la puerta se aplica al incorporar el ítem" tiene su caso
  // propio: el transmittal ya existe y el documento se elige después.
  const revision = await documento(EMISOR, "ADD-2")
  const transmittal = await crear(EMISOR, TransmittalNature.EMISSION)

  await assert.rejects(
    () =>
      transmittalResolvers.Mutation.addTransmittalItem(
        null,
        {
          transmittalId: transmittal.id,
          input: {
            documentRevisionId: revision.id,
            purposeCode: PurposeCode.FOR_APPROVAL,
          },
        },
        context,
      ) as Promise<unknown>,
    /Solo se emiten revisiones aprobadas/,
  )
})

test("quitar el ítem libera la revisión para otra carpeta", async () => {
  // Contracara de la unicidad de B3: la revisión deja de estar emitida porque
  // nunca salió, y vuelve a ser candidata.
  const revision = await documento(EMISOR, "FREE")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])
  await aprobar(revision.id)

  const primera = await conItem(EMISOR, revision.id, PurposeCode.FOR_APPROVAL)

  await assert.rejects(
    () => conItem(EMISOR, revision.id, PurposeCode.FOR_APPROVAL),
    /una revisión se emite una sola vez/,
  )

  await transmittalResolvers.Mutation.removeTransmittalItem(
    null,
    { itemId: primera.items[0].id },
    context,
  )

  const segunda = await conItem(EMISOR, revision.id, PurposeCode.FOR_APPROVAL)
  assert.equal(segunda.items[0].documentRevisionId, revision.id)
})

test("emitido, el contenido queda fijo", async () => {
  const revision = await documento(EMISOR, "FIXED")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])
  await aprobar(revision.id)

  const transmittal = await conItem(EMISOR, revision.id, PurposeCode.FOR_APPROVAL)
  await transmittalResolvers.Mutation.issueTransmittal(
    null,
    { id: transmittal.id },
    context,
  )

  const otra = await documento(EMISOR, "FIXED-2")
  await versionCon(otra.id, [DocFileRole.DELIVERABLE])
  await aprobar(otra.id)

  await assert.rejects(
    () =>
      transmittalResolvers.Mutation.addTransmittalItem(
        null,
        {
          transmittalId: transmittal.id,
          input: {
            documentRevisionId: otra.id,
            purposeCode: PurposeCode.FOR_APPROVAL,
          },
        },
        context,
      ) as Promise<unknown>,
    /mientras el transmittal está en borrador/,
  )

  await assert.rejects(
    () =>
      transmittalResolvers.Mutation.removeTransmittalItem(
        null,
        { itemId: transmittal.items[0].id },
        context,
      ) as Promise<unknown>,
    /mientras el transmittal está en borrador/,
  )
})

test("el transmittal de respuesta no lleva ítems propios", async () => {
  const revision = await documento(EMISOR, "RESP")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])
  await aprobar(revision.id)

  const emision = await conItem(EMISOR, revision.id, PurposeCode.FOR_APPROVAL)
  const respuesta = await crear(EMISOR, TransmittalNature.RESPONSE, {
    respondsToTransmittalId: emision.id,
  })

  const otra = await documento(EMISOR, "RESP-2")
  await versionCon(otra.id, [DocFileRole.DELIVERABLE])
  await aprobar(otra.id)

  await assert.rejects(
    () =>
      transmittalResolvers.Mutation.addTransmittalItem(
        null,
        {
          transmittalId: respuesta.id,
          input: {
            documentRevisionId: otra.id,
            purposeCode: PurposeCode.FOR_APPROVAL,
          },
        },
        context,
      ) as Promise<unknown>,
    /no lleva ítems propios/,
  )
})

