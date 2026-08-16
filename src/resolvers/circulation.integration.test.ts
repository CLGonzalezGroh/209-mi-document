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
import { revisionResolvers } from "./revisions.js"
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
  await prisma.docWorkflowTemplate.deleteMany({ where: { projectId: { in: PROYECTOS } } })
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

// ════════════════════════════════════════════════════════════
// FASE 4 — La respuesta como objeto propio del ítem
// ════════════════════════════════════════════════════════════

/** Emisión ya salida, lista para recibir respuesta. */
const emitido = async (
  sufijo: string,
  purpose: PurposeCode = PurposeCode.FOR_APPROVAL,
) => {
  const revision = await documento(EMISOR, sufijo)
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])
  await aprobar(revision.id)

  const transmittal = await conItem(EMISOR, revision.id, purpose)
  const emitidoTx = (await transmittalResolvers.Mutation.issueTransmittal(
    null,
    { id: transmittal.id },
    context,
  )) as any

  return { revision, transmittal: emitidoTx, item: emitidoTx.items[0] }
}

const calificacion = async (code: string) =>
  prisma.docQualification.findFirstOrThrow({
    where: { code, projectId: null },
    select: { id: true },
  })

const responder = (itemId: number, input: Record<string, unknown>) =>
  transmittalResolvers.Mutation.registerItemResponse(
    null,
    { itemId, input: input as any },
    context,
  ) as Promise<any>

// --- La respuesta cuelga del ítem (B5) ---

test("la respuesta se registra sobre el ítem por el que el documento salió", async () => {
  const { item } = await emitido("RESP-A")
  const aprobado = await calificacion("APPROVED")

  const respuesta = await responder(item.id, {
    qualificationId: aprobado.id,
    comments: "Sin observaciones",
  })

  assert.equal(respuesta.transmittalItemId, item.id)
  assert.equal(respuesta.qualificationId, aprobado.id)
})

test("la calificación es el único dato obligatorio; el archivo es opcional", async () => {
  // Un rechazo trae el plano marcado, un sello de aprobado no trae nada.
  const { item } = await emitido("RESP-B")
  const aprobado = await calificacion("APPROVED")

  const respuesta = await responder(item.id, { qualificationId: aprobado.id })

  assert.equal(respuesta.files.length, 0)
})

test("el archivo devuelto cuelga de la respuesta y no es una versión", async () => {
  // B6: un archivo que llega de AFUERA del circuito es evidencia de una
  // respuesta. El cliente no tiene paso vigente ni firma nuestra.
  const { revision, item } = await emitido("RESP-C")
  const rechazado = await calificacion("REJECTED")

  const versionesAntes = await prisma.documentVersion.count({
    where: { revisionId: revision.id },
  })

  const respuesta = await responder(item.id, {
    qualificationId: rechazado.id,
    files: [
      {
        fileKey: "marcado-1",
        fileName: "plano-marcado.pdf",
        fileSize: 99,
        mimeType: "application/pdf",
      },
    ],
  })

  assert.equal(respuesta.files.length, 1)
  assert.equal(respuesta.files[0].checksum, null)

  const versionesDespues = await prisma.documentVersion.count({
    where: { revisionId: revision.id },
  })
  assert.equal(versionesDespues, versionesAntes)
})

test("un documento se responde una sola vez", async () => {
  const { item } = await emitido("RESP-D")
  const aprobado = await calificacion("APPROVED")

  await responder(item.id, { qualificationId: aprobado.id })

  await assert.rejects(
    () => responder(item.id, { qualificationId: aprobado.id }),
    /ya fue respondido/,
  )
})

test("no se responde un documento que todavía no fue emitido", async () => {
  // D-18: si falta la emisión, se registra primero.
  const revision = await documento(EMISOR, "RESP-E")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])
  await aprobar(revision.id)

  const borrador = await conItem(EMISOR, revision.id, PurposeCode.FOR_APPROVAL)
  const aprobado = await calificacion("APPROVED")

  await assert.rejects(
    () => responder(borrador.items[0].id, { qualificationId: aprobado.id }),
    /todavía no fue emitido/,
  )
})

test("la calificación debe pertenecer al catálogo vigente del proyecto", async () => {
  const { item } = await emitido("RESP-F")

  const ajena = await prisma.docQualification.create({
    data: {
      projectId: -424499,
      code: "AJENA",
      label: "De otro proyecto",
      effect: "ACCEPTED",
      createdById: USER_ID,
    },
  })

  await assert.rejects(
    () => responder(item.id, { qualificationId: ajena.id }),
    /no pertenece al catálogo vigente/,
  )

  await prisma.docQualification.delete({ where: { id: ajena.id } })
})

// --- Autoría diferenciada (H-33, D-12) ---

test("distingue quién respondió de quién registró, y lo deriva", async () => {
  const { item } = await emitido("RESP-G")
  const aprobado = await calificacion("APPROVED")

  const transcripta = await responder(item.id, {
    qualificationId: aprobado.id,
    respondedBy: "Ing. Pérez, del cliente",
    respondedAt: new Date("2026-08-01T10:00:00Z"),
  })

  assert.equal(transcripta.registeredById, USER_ID)
  assert.equal(
    resolverTypes.DocTransmittalResponse.transcribed(transcripta),
    true,
  )
  // La fecha real es anterior a la de registro: la transcripción siempre lo es.
  assert.ok(transcripta.respondedAt < transcripta.createdAt)

  const { item: otro } = await emitido("RESP-H")
  const directa = await responder(otro.id, { qualificationId: aprobado.id })
  assert.equal(resolverTypes.DocTransmittalResponse.transcribed(directa), false)
})

// --- El sobre, cuando la respuesta vino consolidada (D-18) ---

test("la respuesta consolidada declara el remito en que viajó", async () => {
  const { transmittal, item } = await emitido("RESP-I")
  const aprobado = await calificacion("APPROVED")

  const sobre = await crear(EMISOR, TransmittalNature.RESPONSE, {
    respondsToTransmittalId: transmittal.id,
    counterpartyReference: "TX-CLI-500",
  })

  const respuesta = await responder(item.id, {
    qualificationId: aprobado.id,
    responseTransmittalId: sobre.id,
  })

  assert.equal(respuesta.responseTransmittalId, sobre.id)
})

test("el sobre debe contestar la emisión por la que ese documento salió", async () => {
  const { transmittal } = await emitido("RESP-J")
  const { item: itemDeOtra } = await emitido("RESP-K")
  const aprobado = await calificacion("APPROVED")

  const sobre = await crear(EMISOR, TransmittalNature.RESPONSE, {
    respondsToTransmittalId: transmittal.id,
  })

  await assert.rejects(
    () =>
      responder(itemDeOtra.id, {
        qualificationId: aprobado.id,
        responseTransmittalId: sobre.id,
      }),
    /no contesta la emisión/,
  )
})

// --- La respuesta no mueve la revisión (B7) ---

test("la respuesta no cambia el estado de la revisión ni la vigente", async () => {
  // D-26: la respuesta de la contraparte no es un estado de la revisión. Dos
  // máquinas de estados sobre el mismo hecho es el defecto que el §1 previene.
  const { revision, item } = await emitido("RESP-L")
  const rechazado = await calificacion("REJECTED")

  const documentoAntes = await prisma.document.findFirstOrThrow({
    where: { revisions: { some: { id: revision.id } } },
    include: { revisions: true },
  })
  const vigenteAntes = await resolverTypes.Document.currentRevision(documentoAntes)

  await responder(item.id, { qualificationId: rechazado.id })

  const despues = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(despues.status, RevisionStatus.APPROVED)

  const vigenteDespues = await resolverTypes.Document.currentRevision(documentoAntes)
  assert.equal((vigenteDespues as any)?.id, (vigenteAntes as any)?.id)
})

test("la primera respuesta lleva el transmittal a respondido", async () => {
  const { transmittal, item } = await emitido("RESP-M")
  const aprobado = await calificacion("APPROVED")

  await responder(item.id, { qualificationId: aprobado.id })

  const despues = await prisma.transmittal.findUniqueOrThrow({
    where: { id: transmittal.id },
  })
  assert.equal(despues.status, "RESPONDED")
})

// --- La corrección (B5) ---

test("la respuesta se corrige, y la traza conserva el valor anterior", async () => {
  // Nadie la firma: la inmutabilidad de la versión no le aplica. Y siendo
  // transcripta a mano, el error es esperable.
  const { item } = await emitido("RESP-N")
  const aprobado = await calificacion("APPROVED")
  const conComentarios = await calificacion("APPROVED_WITH_COMMENTS")

  const respuesta = await responder(item.id, {
    qualificationId: aprobado.id,
    comments: "Error de transcripción",
  })

  const corregida = (await transmittalResolvers.Mutation.correctItemResponse(
    null,
    {
      responseId: respuesta.id,
      input: { qualificationId: conComentarios.id, comments: "Con observaciones" },
    },
    context,
  )) as any

  assert.equal(corregida.qualificationId, conComentarios.id)

  const evento = await prisma.docAuditEvent.findFirstOrThrow({
    where: {
      action: AuditAction.CorrectItemResponse,
      objectId: respuesta.id,
    },
  })
  const meta = evento.meta as any
  assert.equal(meta.antes.qualificationId, aprobado.id)
  assert.equal(meta.antes.comments, "Error de transcripción")
})

// ════════════════════════════════════════════════════════════
// FASE 5 — El acuse de recibo y el cierre
// ════════════════════════════════════════════════════════════

const acusar = (id: number, input?: Record<string, unknown>) =>
  transmittalResolvers.Mutation.acknowledgeTransmittal(
    null,
    { id, input: input as any },
    context,
  ) as Promise<any>

const cerrar = (id: number, input?: Record<string, unknown>) =>
  transmittalResolvers.Mutation.closeTransmittal(
    null,
    { id, input: input as any },
    context,
  ) as Promise<any>

// --- El acuse (B8) ---

test("el acuse asigna el estado que hasta ahora nadie asignaba", async () => {
  // H-12: ACKNOWLEDGED existía en la enumeración y ninguna operación lo ponía.
  const { transmittal } = await emitido("ACK-A")

  const acusado = await acusar(transmittal.id, {
    acknowledgedBy: "Mesa de entradas del cliente",
    acknowledgedAt: new Date("2026-08-02T09:00:00Z"),
  })

  assert.equal(acusado.status, "ACKNOWLEDGED")
  assert.equal(acusado.acknowledgedBy, "Mesa de entradas del cliente")
  assert.equal(acusado.acknowledgeRegisteredById, USER_ID)
  assert.ok(acusado.acknowledgedAt < acusado.acknowledgeRegisteredAt)
})

test("en modo Receptor no hay nada que acusar", async () => {
  const revision = await documento(RECEPTOR, "ACK-B")
  const entrante = await conItem(RECEPTOR, revision.id, PurposeCode.FOR_APPROVAL)
  await transmittalResolvers.Mutation.issueTransmittal(
    null,
    { id: entrante.id },
    context,
  )

  await assert.rejects(
    () => acusar(entrante.id),
    /solo existe en modo Emisor/,
  )
})

test("el acuse no es precondición de la respuesta", async () => {
  // Un cliente puede responder sin haber acusado nunca.
  const { item } = await emitido("ACK-C")
  const aprobado = await calificacion("APPROVED")

  const respuesta = await responder(item.id, { qualificationId: aprobado.id })
  assert.ok(respuesta.id)
})

test("responder después de acusar mantiene la secuencia", async () => {
  const { transmittal, item } = await emitido("ACK-D")
  const aprobado = await calificacion("APPROVED")

  await acusar(transmittal.id)
  await responder(item.id, { qualificationId: aprobado.id })

  const despues = await prisma.transmittal.findUniqueOrThrow({
    where: { id: transmittal.id },
  })
  assert.equal(despues.status, "RESPONDED")
})

// --- El cierre (B10) ---

test("se cierra con respuestas parciales, y con motivo", async () => {
  // Las respuestas parciales son la práctica normal: un cierre que esperara a
  // que todas llegaran no ocurriría nunca (D-18).
  const revisionA = await documento(EMISOR, "CLOSE-A1")
  const revisionB = await documento(EMISOR, "CLOSE-A2")
  for (const r of [revisionA, revisionB]) {
    await versionCon(r.id, [DocFileRole.DELIVERABLE])
    await aprobar(r.id)
  }

  const transmittal = await conItem(
    EMISOR,
    revisionA.id,
    PurposeCode.FOR_APPROVAL,
  )
  await transmittalResolvers.Mutation.addTransmittalItem(
    null,
    {
      transmittalId: transmittal.id,
      input: {
        documentRevisionId: revisionB.id,
        purposeCode: PurposeCode.FOR_APPROVAL,
      },
    },
    context,
  )
  const emitidoTx = (await transmittalResolvers.Mutation.issueTransmittal(
    null,
    { id: transmittal.id },
    context,
  )) as any

  const aprobado = await calificacion("APPROVED")
  await responder(emitidoTx.items[0].id, { qualificationId: aprobado.id })

  const cerrado = await cerrar(transmittal.id, {
    closeReason: "El cliente no va a contestar el resto",
  })

  assert.equal(cerrado.status, "CLOSED")
  assert.equal(cerrado.closedById, USER_ID)
  assert.equal(cerrado.closeReason, "El cliente no va a contestar el resto")

  // El avance muestra lo que falta, sin condicionar el cierre.
  const avance = await resolverTypes.Transmittal.responseProgress(cerrado)
  assert.deepEqual(avance, { expected: 2, answered: 1, pending: 1 })
})

test("cerrar no impide una respuesta tardía", async () => {
  // Cerrar declara que se dejó de esperar, no que se dejó de escuchar.
  const { transmittal, item } = await emitido("CLOSE-B")
  const aprobado = await calificacion("APPROVED")

  await cerrar(transmittal.id)
  const tardia = await responder(item.id, { qualificationId: aprobado.id })

  assert.ok(tardia.id)

  // Y la respuesta tardía no reabre lo cerrado.
  const despues = await prisma.transmittal.findUniqueOrThrow({
    where: { id: transmittal.id },
  })
  assert.equal(despues.status, "CLOSED")
})

test("el avance cuenta solo lo que espera calificación", async () => {
  const { transmittal } = await emitido("CLOSE-C", PurposeCode.FOR_INFORMATION)

  const avance = await resolverTypes.Transmittal.responseProgress(transmittal)
  assert.deepEqual(avance, { expected: 0, answered: 0, pending: 0 })
})

// ════════════════════════════════════════════════════════════
// FASE 6 — El circuito del rol Receptor
// ════════════════════════════════════════════════════════════

/** Emisión entrante del contratista, ya cargada en el sistema de la planta. */
const recibido = async (sufijo: string) => {
  const revision = await documento(RECEPTOR, sufijo)
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])

  const transmittal = await conItem(
    RECEPTOR,
    revision.id,
    PurposeCode.FOR_APPROVAL,
  )
  const emitidoTx = (await transmittalResolvers.Mutation.issueTransmittal(
    null,
    { id: transmittal.id },
    context,
  )) as any

  return { revision, transmittal: emitidoTx, item: emitidoTx.items[0] }
}

/**
 * Plantilla del proyecto receptor, con los revisores preasignados.
 *
 * Es la matriz de responsabilidad para los ejes que hoy existen: resuelve por
 * proyecto, clase —disciplina, en proyectos— y tipo.
 */
const conPlantilla = async (pasos: StepType[]) => {
  await prisma.docWorkflowTemplate.deleteMany({ where: { projectId: RECEPTOR } })

  return prisma.docWorkflowTemplate.create({
    data: {
      name: "Matriz del proyecto",
      projectId: RECEPTOR,
      createdById: USER_ID,
      steps: {
        create: pasos.map((stepType, i) => ({
          stepOrder: i + 1,
          stepType,
          assignedToId: USER_ID,
        })),
      },
    },
  })
}

const sinPlantilla = () =>
  prisma.docWorkflowTemplate.deleteMany({ where: { projectId: RECEPTOR } })

/**
 * Emisión entrante en un proyecto SIN plantilla, para ejercitar el armado
 * manual. Se declara en cada prueba en lugar de depender del orden del archivo:
 * con plantilla el circuito se arma solo y el armado manual ya no aplica.
 */
const recibidoManual = async (sufijo: string) => {
  await sinPlantilla()
  return recibido(sufijo)
}

/** Armado manual, que queda como red cuando la plantilla no alcanza. */
const confirmarRecepcion = async (revisionId: number, pasos = 1) => {
  const circuito = await prisma.reviewWorkflow.findFirstOrThrow({
    where: { revisionId, status: WorkflowStatus.IN_PROGRESS },
  })

  return workflowResolvers.Mutation.defineWorkflow(
    null,
    {
      workflowId: circuito.id,
      input: {
        steps: Array.from({ length: pasos }, (_, i) => ({
          stepOrder: i + 1,
          stepType: i === pasos - 1 ? StepType.APPROVE : StepType.REVIEW,
          assignedToId: USER_ID,
        })),
      },
    },
    context,
  ) as Promise<any>
}

const pasoVigente = (workflowId: number, stepType: StepType) =>
  prisma.reviewStep.findFirstOrThrow({
    where: { workflowId, stepType, status: StepStatus.PENDING },
  })

// --- El circuito nace sin elaboración, y armar es confirmar la recepción ---

test("el circuito del receptor se arma sin paso de elaboración", async () => {
  // El documento llega elaborado desde afuera: no hay a quién asignarle esa
  // tarea, y por eso el armado no admite elaborador.
  const { revision } = await recibidoManual("RCV-A")

  const armado = await confirmarRecepcion(revision.id, 2)

  assert.deepEqual(
    armado.steps.map((s: any) => s.stepType),
    [StepType.ASSIGN, StepType.REVIEW, StepType.APPROVE],
  )
})

test("armar somete la revisión, porque no hay elaboración que esperar", async () => {
  // Sin esto la revisión quedaría en borrador con el circuito armado y ninguna
  // operación capaz de moverla: submitRevision completa un paso que acá no existe.
  const { revision } = await recibidoManual("RCV-B")

  await confirmarRecepcion(revision.id)

  const despues = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(despues.status, RevisionStatus.IN_REVIEW)
})

test("designar un elaborador en modo Receptor se rechaza", async () => {
  const { revision } = await recibidoManual("RCV-C")
  const circuito = await prisma.reviewWorkflow.findFirstOrThrow({
    where: { revisionId: revision.id, status: WorkflowStatus.IN_PROGRESS },
  })

  await assert.rejects(
    () =>
      workflowResolvers.Mutation.defineWorkflow(
        null,
        {
          workflowId: circuito.id,
          input: {
            preparerId: USER_ID,
            steps: [
              { stepOrder: 1, stepType: StepType.APPROVE, assignedToId: USER_ID },
            ],
          },
        },
        context,
      ) as Promise<unknown>,
  )
})

// --- La calificación es la conclusión del circuito ---

test("concluir sin calificación se rechaza", async () => {
  const { revision } = await recibidoManual("RCV-D")
  const armado = await confirmarRecepcion(revision.id)
  const paso = await pasoVigente(armado.id, StepType.APPROVE)

  await assert.rejects(
    () =>
      workflowResolvers.Mutation.approveStep(
        null,
        { stepId: paso.id },
        context,
      ) as Promise<unknown>,
    /concluye con la calificación/,
  )
})

test("un paso intermedio no lleva calificación", async () => {
  const { revision } = await recibidoManual("RCV-E")
  const armado = await confirmarRecepcion(revision.id, 2)
  const revisionStep = await pasoVigente(armado.id, StepType.REVIEW)
  const aprobado = await calificacion("APPROVED")

  await assert.rejects(
    () =>
      workflowResolvers.Mutation.approveStep(
        null,
        { stepId: revisionStep.id, qualificationId: aprobado.id },
        context,
      ) as Promise<unknown>,
    /no en un paso intermedio/,
  )

  // Sin ella avanza normalmente.
  await workflowResolvers.Mutation.approveStep(
    null,
    { stepId: revisionStep.id },
    context,
  )
})

test("la operación no puede contradecir al efecto de la calificación", async () => {
  const { revision } = await recibidoManual("RCV-F")
  const armado = await confirmarRecepcion(revision.id)
  const paso = await pasoVigente(armado.id, StepType.APPROVE)
  const rechazado = await calificacion("REJECTED")

  await assert.rejects(
    () =>
      workflowResolvers.Mutation.approveStep(
        null,
        { stepId: paso.id, qualificationId: rechazado.id },
        context,
      ) as Promise<unknown>,
    /no puede aprobarse con ella/,
  )
})

test("aprobar con calificación registra la respuesta y aprueba la revisión", async () => {
  const { revision, item } = await recibidoManual("RCV-G")
  const armado = await confirmarRecepcion(revision.id)
  const paso = await pasoVigente(armado.id, StepType.APPROVE)
  const conComentarios = await calificacion("APPROVED_WITH_COMMENTS")

  await workflowResolvers.Mutation.approveStep(
    null,
    { stepId: paso.id, qualificationId: conComentarios.id },
    context,
  )

  const aprobada = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(aprobada.status, RevisionStatus.APPROVED)

  // La calificación queda en el ítem, que es donde los dos modos la leen igual.
  const respuesta = await prisma.docTransmittalResponse.findUniqueOrThrow({
    where: { transmittalItemId: item.id },
  })
  assert.equal(respuesta.qualificationId, conComentarios.id)
  assert.equal(respuesta.respondedBy, null)
})

// --- La conclusión es terminal ---

test("el rechazo concluye la revisión y no abre circuito nuevo", async () => {
  // En Emisor e Interno el rechazo devuelve el trabajo y reinstancia el
  // circuito. Acá el elaborador está afuera: no hay a quién devolvérselo.
  const { revision, item } = await recibidoManual("RCV-H")
  const armado = await confirmarRecepcion(revision.id)
  const paso = await pasoVigente(armado.id, StepType.APPROVE)
  const rechazado = await calificacion("REJECTED")

  await workflowResolvers.Mutation.rejectStep(
    null,
    {
      stepId: paso.id,
      comments: "Falta la memoria de cálculo",
      qualificationId: rechazado.id,
    },
    context,
  )

  const despues = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(despues.status, RevisionStatus.REJECTED)

  const circuitos = await prisma.reviewWorkflow.count({
    where: { revisionId: revision.id },
  })
  assert.equal(circuitos, 1, "no debe abrirse un circuito nuevo")

  const respuesta = await prisma.docTransmittalResponse.findUniqueOrThrow({
    where: { transmittalItemId: item.id },
  })
  assert.equal(respuesta.qualificationId, rechazado.id)
})

test("la revisión rechazada no bloquea la emisión siguiente, y conserva su código", async () => {
  // Es lo que el estado terminal viene a resolver: sin él la revisión quedaba en
  // borrador para siempre y createRevision no dejaba abrir la siguiente, que es
  // H-01 reapareciendo en el otro modo.
  const { revision } = await recibidoManual("RCV-I")
  const armado = await confirmarRecepcion(revision.id)
  const paso = await pasoVigente(armado.id, StepType.APPROVE)
  const rechazado = await calificacion("REJECTED")

  await workflowResolvers.Mutation.rejectStep(
    null,
    { stepId: paso.id, comments: "Rechazada", qualificationId: rechazado.id },
    context,
  )

  const siguiente = (await revisionResolvers.Mutation.createRevision(
    null,
    { documentId: revision.documentId, input: {} },
    context,
  )) as any

  // La rechazada CONSUMIÓ su código y la secuencia sigue de largo: rechazada la
  // A, la próxima es la B, igual que si hubiera sido aprobada o aprobada con
  // comentarios. Lo que el rechazo no implica es avance contractual, y eso no es
  // un asunto del código de revisión.
  assert.equal(revision.revisionCode, "A")
  assert.equal(siguiente.revisionCode, "B")
})

// --- En modo Emisor nada de esto cambia ---

test("en modo Emisor el rechazo sigue devolviendo el trabajo", async () => {
  const revision = await documento(EMISOR, "RCV-J")
  await versionCon(revision.id, [DocFileRole.DELIVERABLE])

  const circuito = await prisma.reviewWorkflow.findFirstOrThrow({
    where: { revisionId: revision.id, status: WorkflowStatus.IN_PROGRESS },
  })
  await workflowResolvers.Mutation.defineWorkflow(
    null,
    {
      workflowId: circuito.id,
      input: {
        preparerId: USER_ID,
        steps: [
          { stepOrder: 1, stepType: StepType.APPROVE, assignedToId: USER_ID },
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

  const paso = await pasoVigente(circuito.id, StepType.APPROVE)
  await workflowResolvers.Mutation.rejectStep(
    null,
    { stepId: paso.id, comments: "Corregir el conexionado" },
    context,
  )

  const despues = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(despues.status, RevisionStatus.DRAFT)

  const circuitos = await prisma.reviewWorkflow.count({
    where: { revisionId: revision.id },
  })
  assert.equal(circuitos, 2, "el rechazo abre un circuito nuevo")
})

// --- La plantilla arma sola: no hay armado del lado de la planta ---

test("emitir el transmittal entrante arma el circuito y somete la revisión", async () => {
  // No hay acto de armado en la planta: quién revisa cada disciplina y tipo está
  // predefinido en la plantilla del proyecto, que es la matriz para esos ejes.
  await conPlantilla([StepType.REVIEW, StepType.APPROVE])

  const { revision } = await recibido("AUTO-A")

  const circuito = await prisma.reviewWorkflow.findFirstOrThrow({
    where: { revisionId: revision.id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  })

  assert.deepEqual(
    circuito.steps.map((s: any) => s.stepType),
    [StepType.ASSIGN, StepType.REVIEW, StepType.APPROVE],
  )
  assert.equal(circuito.steps[0].status, StepStatus.COMPLETED)
  assert.equal(
    circuito.steps[0].resolvedById,
    null,
    "el armado lo resuelve el sistema, no una persona",
  )

  const sometida = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(sometida.status, RevisionStatus.IN_REVIEW)
})

test("el circuito armado por plantilla concluye como cualquier otro", async () => {
  await conPlantilla([StepType.APPROVE])

  const { revision, item } = await recibido("AUTO-B")
  const circuito = await prisma.reviewWorkflow.findFirstOrThrow({
    where: { revisionId: revision.id, status: WorkflowStatus.IN_PROGRESS },
  })
  const paso = await pasoVigente(circuito.id, StepType.APPROVE)
  const aprobado = await calificacion("APPROVED")

  await workflowResolvers.Mutation.approveStep(
    null,
    { stepId: paso.id, qualificationId: aprobado.id },
    context,
  )

  const aprobada = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(aprobada.status, RevisionStatus.APPROVED)

  const respuesta = await prisma.docTransmittalResponse.findUniqueOrThrow({
    where: { transmittalItemId: item.id },
  })
  assert.equal(respuesta.qualificationId, aprobado.id)
})

test("sin plantilla el armado queda pendiente, y la planta lo resuelve a mano", async () => {
  // Es la red y no el camino: rechazar la emisión dejaría al contratista trabado
  // por una configuración que él no puede corregir.
  await sinPlantilla()

  const { revision } = await recibido("AUTO-C")

  const enBorrador = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(enBorrador.status, RevisionStatus.DRAFT)

  await confirmarRecepcion(revision.id)

  const sometida = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(sometida.status, RevisionStatus.IN_REVIEW)
})

test("una plantilla con un paso sin actor no alcanza para armar sola", async () => {
  // Un solo paso sin actor deja el armado con algo que decidir, y entonces no
  // puede resolverlo el sistema.
  await prisma.docWorkflowTemplate.deleteMany({ where: { projectId: RECEPTOR } })
  await prisma.docWorkflowTemplate.create({
    data: {
      name: "Matriz incompleta",
      projectId: RECEPTOR,
      createdById: USER_ID,
      steps: {
        create: [
          { stepOrder: 1, stepType: StepType.REVIEW, assignedToId: USER_ID },
          { stepOrder: 2, stepType: StepType.APPROVE, assignedToId: null },
        ],
      },
    },
  })

  const { revision } = await recibido("AUTO-D")

  const enBorrador = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(enBorrador.status, RevisionStatus.DRAFT)

  await sinPlantilla()
})

test("en modo Emisor emitir no arma nada", async () => {
  const { revision } = await emitido("AUTO-E")

  // La revisión ya estaba aprobada por su propio circuito, que se armó a mano.
  const aprobada = await prisma.documentRevision.findUniqueOrThrow({
    where: { id: revision.id },
  })
  assert.equal(aprobada.status, RevisionStatus.APPROVED)
})

