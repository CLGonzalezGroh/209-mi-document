import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { ResolverContext } from "../types.js"
import {
  DocProjectSide,
  DocumentRole,
  TransmittalNature,
} from "../generated/prisma/enums.js"
import { transmittalResolvers } from "./transmittals.js"
import { projectSettingsResolvers } from "./projectSettings.js"
import { projectMemberResolvers } from "./projectMembers.js"
import { resolverTypes } from "./resolversTypes/index.js"
import { TransmittalDirection } from "../utils/transmittalCirculation.js"

/**
 * Circulación del transmittal contra la base y el resolver (BLOQUE 04, fase 2).
 *
 * Cubre los criterios 1, 2, 3, 7 y 9 del bloque: los tres invariantes de rol y
 * naturaleza, la numeración por proyecto y su comportamiento concurrente.
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

const limpiar = async () => {
  await prisma.transmittal.deleteMany({ where: { projectId: { in: PROYECTOS } } })
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

before(async () => {
  await limpiar()

  const token = jwt.sign(
    { id: USER_ID, roles: ROLE_IDS },
    process.env.AUTH_JWT_SECRET as string,
    { expiresIn: "1h" },
  )
  context = { orm: prisma, token: `Bearer ${token}` } as ResolverContext

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
