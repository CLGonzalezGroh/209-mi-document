import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { asegurarContratos, borrarContratos } from "../utils/testContracts.js"
import { ResolverContext } from "../types.js"
import {
  DocProjectSide,
  DocumentRole,
  ModuleType,
  TransmittalNature,
} from "../generated/prisma/enums.js"
import { documentResolvers } from "./documents.js"
import { transmittalResolvers } from "./transmittals.js"
import { docProjectsResolvers } from "./docProjects.js"
import { projectMemberResolvers } from "./projectMembers.js"
import { AuditAction } from "../events/catalog.js"

/**
 * Arnés de integración de la autorización (BLOQUE 02, B7).
 *
 * Ejercita los resolvers con un contexto REAL: token firmado, primera capa
 * validada contra mi-admin y segunda capa contra la base. Es la evidencia que
 * ni la compilación ni las pruebas puras pueden dar — en la fase B se comprobó
 * que `tsc` pasa limpio sobre código roto en tiempo de ejecución.
 *
 * Requisitos, por eso vive en un script aparte (`test:block02-integration`):
 *  - `mi-admin` corriendo en ADMIN_API_URL;
 *  - el usuario de prueba con el rol documental completo;
 *  - la base local del módulo.
 *
 * El token se firma localmente con AUTH_JWT_SECRET, el mismo que usa mi-admin
 * para revalidarlo. No se persiste ni sale de localhost.
 */

/** Empresas de prueba: la contraparte es una referencia a Company (B4). */
const EMPRESA_A = -424801
const EMPRESA_B = -424802

const USER_ID = 3
const ROLE_IDS = [1, 16] // view + doc-full

const PROYECTO_CON_MEMBRESIA = -424401
const PROYECTO_SIN_MEMBRESIA = -424402
const CODIGO = "TEST-BLOCK02"

/** Los dos contratos de la prueba. El id negativo es la convención de fixtures. */
const CONTRATOS = [PROYECTO_CON_MEMBRESIA, PROYECTO_SIN_MEMBRESIA]

let context: ResolverContext
let docConMembresia: number
let docSinMembresia: number
let docPublicado: number
let transmittalSinMembresia: number

const limpiar = async () => {
  await prisma.transmittal.deleteMany({
    where: { docProjectId: { in: [PROYECTO_CON_MEMBRESIA, PROYECTO_SIN_MEMBRESIA] } },
  })
  await prisma.document.deleteMany({ where: { code: { startsWith: CODIGO } } })
  await prisma.docProjectMember.deleteMany({ where: { userId: USER_ID } })
  await prisma.docProject.deleteMany({
    where: { projectId: { in: [PROYECTO_CON_MEMBRESIA, PROYECTO_SIN_MEMBRESIA] } },
  })
  await prisma.docAuditEvent.deleteMany({
    where: { docProjectId: { in: [PROYECTO_CON_MEMBRESIA, PROYECTO_SIN_MEMBRESIA] } },
  })
}

const crearDocumento = async (sufijo: string, module: ModuleType, docProjectId: number | null) => {
  const tipo = await prisma.documentType.findFirst({ select: { id: true } })
  const doc = await prisma.document.create({
    data: {
      code: `${CODIGO}-${sufijo}`,
      currentTitle: `Documento de prueba ${sufijo}`,
      module,
      docProjectId,
      currentDocumentTypeId: tipo!.id,
      createdById: USER_ID,
      updatedById: USER_ID,
    },
  })
  return doc.id
}

before(async () => {
  await limpiar()

  // Los dos contratos, con id explícito: el documento les cuelga con clave
  // foránea desde BLOQUE 02D, B7.
  //
  // Cada uno nace con el rol que después declara su prueba. El rol es inmutable
  // desde el primer documento (B5), y estos contratos tienen documentos creados
  // acá abajo: nacer con otro rol volvería la declaración un CAMBIO de rol, que
  // el invariante rechaza con razón.
  await asegurarContratos(prisma, [PROYECTO_CON_MEMBRESIA], DocumentRole.ISSUER)
  await asegurarContratos(prisma, [PROYECTO_SIN_MEMBRESIA], DocumentRole.INTERNAL)

  const token = jwt.sign({ id: USER_ID, roles: ROLE_IDS }, process.env.AUTH_JWT_SECRET as string, {
    expiresIn: "1h",
  })
  context = { orm: prisma, token: `Bearer ${token}` } as ResolverContext

  docConMembresia = await crearDocumento("A", ModuleType.PROJECTS, PROYECTO_CON_MEMBRESIA)
  docSinMembresia = await crearDocumento("B", ModuleType.PROJECTS, PROYECTO_SIN_MEMBRESIA)
  docPublicado = await crearDocumento("PUB", ModuleType.QUALITY, null)

  const transmittal = await prisma.transmittal.create({
    data: {
      code: `${CODIGO}-TR`,
      docProjectId: PROYECTO_SIN_MEMBRESIA,
      nature: TransmittalNature.EMISSION,
      issuedById: USER_ID,
    },
  })
  transmittalSinMembresia = transmittal.id

  // El usuario es miembro de UN SOLO proyecto
  await prisma.docProjectMember.create({
    data: {
      docProjectId: PROYECTO_CON_MEMBRESIA,
      userId: USER_ID,
      side: DocProjectSide.HOST,
      assignedById: USER_ID,
    },
  })
})

after(async () => {
  await limpiar()
  await borrarContratos(prisma, CONTRATOS)
  await prisma.$disconnect()
})

const codigoDeError = async (fn: () => Promise<unknown>): Promise<string> => {
  try {
    await fn()
    return "SIN_ERROR"
  } catch (error: any) {
    return error?.extensions?.code ?? "DESCONOCIDO"
  }
}

// --- Doble capa estricta sobre un objeto ---

test("con membresía vigente, la operación sobre el objeto prospera", async () => {
  const documento: any = await documentResolvers.Query.documentById(
    null,
    { id: docConMembresia },
    context,
  )

  assert.equal(documento.id, docConMembresia)
})

test("sin membresía en el proyecto del objeto, se rechaza con FORBIDDEN", async () => {
  assert.equal(
    await codigoDeError(() =>
      documentResolvers.Query.documentById(null, { id: docSinMembresia }, context),
    ),
    "FORBIDDEN",
  )
})

test("el régimen de publicación se alcanza solo con el permiso global", async () => {
  // Documento sin proyecto: no hay membresía que exigir (B1)
  const documento: any = await documentResolvers.Query.documentById(
    null,
    { id: docPublicado },
    context,
  )

  assert.equal(documento.id, docPublicado)
})

test("un objeto inexistente corta con NOT_FOUND y no con FORBIDDEN", async () => {
  assert.equal(
    await codigoDeError(() => documentResolvers.Query.documentById(null, { id: -1 }, context)),
    "NOT_FOUND",
  )
})

// --- Segunda capa como filtro en los listados ---

test("el listado filtra en lugar de rechazar", async () => {
  const respuesta: any = await documentResolvers.Query.documents(
    null,
    { filter: { query: CODIGO }, pagination: { skip: 0, take: 50 } },
    context,
  )

  const ids = respuesta.items.map((d: any) => d.id)

  assert.ok(ids.includes(docConMembresia), "falta el documento del proyecto con membresía")
  assert.ok(ids.includes(docPublicado), "falta el documento publicado")
  assert.ok(!ids.includes(docSinMembresia), "se filtró el documento de un proyecto ajeno")
})

test("el listado de transmittals excluye los proyectos sin membresía", async () => {
  const respuesta: any = await transmittalResolvers.Query.transmittals(
    null,
    { filter: { query: CODIGO }, pagination: { skip: 0, take: 50 } },
    context,
  )

  assert.equal(
    respuesta.items.filter((t: any) => t.id === transmittalSinMembresia).length,
    0,
  )
})

test("el proyecto como argumento explícito exige membresía", async () => {
  assert.equal(
    await codigoDeError(() =>
      transmittalResolvers.Query.transmittalsByProject(
        null,
        { docProjectId: PROYECTO_SIN_MEMBRESIA },
        context,
      ),
    ),
    "FORBIDDEN",
  )
})

// --- Invariante del contexto (B1) ---

test("un documento de proyecto sin proyecto se rechaza antes de autorizar", async () => {
  assert.equal(
    await codigoDeError(() =>
      documentResolvers.Mutation.createDocument(
        null,
        {
          input: {
            code: `${CODIGO}-INV`,
            title: "Inválido",
            module: ModuleType.PROJECTS,
            documentTypeId: 1,
            // El archivo dejó de ser obligatorio (BLOQUE 03, H-20): el alta ya
            // no lo lleva, y el armador lo aporta DocProject.
            assignedOrganizerId: USER_ID,
          },
        },
        context,
      ),
    ),
    "BAD_USER_INPUT",
  )
})

test("crear en un proyecto ajeno se rechaza con FORBIDDEN", async () => {
  assert.equal(
    await codigoDeError(() =>
      documentResolvers.Mutation.createDocument(
        null,
        {
          input: {
            code: `${CODIGO}-AJENO`,
            title: "Ajeno",
            module: ModuleType.PROJECTS,
            docProjectId: PROYECTO_SIN_MEMBRESIA,
            documentTypeId: 1,
            // El archivo dejó de ser obligatorio (BLOQUE 03, H-20): el alta ya
            // no lo lleva, y el armador lo aporta DocProject.
            assignedOrganizerId: USER_ID,
          },
        },
        context,
      ),
    ),
    "FORBIDDEN",
  )
})

// --- La baja de la membresía retira el acceso, de punta a punta ---

// --- Contexto de proyecto: configuración y membresía (fase F) ---

test("la configuración se declara y se lee, y emite su traza", async () => {
  const settings: any = await docProjectsResolvers.Mutation.declareDocProject(
    null,
    {
      input: {
        code: `T-${PROYECTO_CON_MEMBRESIA}`,
        name: "Contrato de prueba",
        projectId: PROYECTO_CON_MEMBRESIA,
        documentRole: DocumentRole.ISSUER,
        counterpartyId: EMPRESA_A,
      },
    },
    context,
  )

  assert.equal(settings.documentRole, DocumentRole.ISSUER)

  const leida: any = await docProjectsResolvers.Query.docProject(
    null,
    { id: settings.id },
    context,
  )
  assert.equal(leida.counterpartyId, EMPRESA_A)

  // La traza del objeto nuevo lleva su proyecto, derivado (B9)
  const eventos = await prisma.docAuditEvent.findMany({
    where: { objectId: settings.id, action: AuditAction.DeclareDocProject },
  })
  assert.equal(eventos.length, 1)
  assert.equal(eventos[0].docProjectId, PROYECTO_CON_MEMBRESIA)
})

test("un proyecto interno no admite contraparte", async () => {
  assert.equal(
    await codigoDeError(() =>
      docProjectsResolvers.Mutation.declareDocProject(
        null,
        {
          input: {
            code: `T-${PROYECTO_SIN_MEMBRESIA}`,
            name: "Contrato de prueba",
            projectId: PROYECTO_SIN_MEMBRESIA,
            documentRole: DocumentRole.INTERNAL,
            counterpartyId: EMPRESA_A,
          },
        },
        context,
      ),
    ),
    "BAD_USER_INPUT",
  )
})

test("una obra admite varios contratos, uno por contratista", async () => {
  // El desbloqueo funcional de BLOQUE 02D, B3. Hasta la fase 4 el vínculo era
  // uno a uno, y una planta con tres contratistas tenía que abrir tres
  // proyectos hermanos sin nada que los una.
  const OBRA = -424490
  const codigos = ["OBRA-CIVIL", "OBRA-MEC", "OBRA-CONSTR"]

  for (const [i, code] of codigos.entries()) {
    await docProjectsResolvers.Mutation.declareDocProject(
      null,
      {
        input: {
          code,
          name: `Contrato ${i + 1}`,
          projectId: OBRA,
          documentRole: DocumentRole.RECEIVER,
          counterpartyId: EMPRESA_A + i,
        },
      },
      context,
    )
  }

  const contratos: any[] = await docProjectsResolvers.Query.docProjectsByProject(
    null,
    { projectId: OBRA },
    context,
  )

  assert.equal(contratos.length, 3)
  assert.deepEqual(contratos.map((c) => c.code), [...codigos].sort())

  // Cada uno conserva UNA sola contraparte: la binariedad de D-15 no se toca.
  assert.deepEqual(
    contratos.map((c) => c.counterpartyId).sort((a, b) => a - b),
    [EMPRESA_A, EMPRESA_A + 1, EMPRESA_A + 2],
  )

  // Y una obra sin contratos devuelve vacío, que no es un error.
  assert.deepEqual(
    await docProjectsResolvers.Query.docProjectsByProject(
      null,
      { projectId: -424491 },
      context,
    ),
    [],
  )

  await prisma.docProject.deleteMany({ where: { code: { in: codigos } } })
})

test("el rol no puede cambiarse si el proyecto ya tiene documentos", async () => {
  // PROYECTO_CON_MEMBRESIA ya tiene un documento creado en el before
  assert.equal(
    await codigoDeError(() =>
      docProjectsResolvers.Mutation.declareDocProject(
        null,
        {
          input: {
            code: `T-${PROYECTO_CON_MEMBRESIA}`,
            name: "Contrato de prueba",
            projectId: PROYECTO_CON_MEMBRESIA,
            documentRole: DocumentRole.RECEIVER,
            counterpartyId: EMPRESA_B,
          },
        },
        context,
      ),
    ),
    "CONFLICT",
  )
})

test("administrar la membresía no exige membresía previa", async () => {
  // Es el caso de arranque: el primer miembro de un proyecto no puede exigir una
  // membresía que todavía no existe. Se administra con el permiso global.
  const miembro: any = await projectMemberResolvers.Mutation.assignDocProjectMember(
    null,
    {
      input: {
        docProjectId: PROYECTO_SIN_MEMBRESIA,
        userId: USER_ID,
        side: DocProjectSide.COUNTERPARTY,
      },
    },
    context,
  )

  assert.equal(miembro.side, DocProjectSide.COUNTERPARTY)
  assert.equal(miembro.isActive, true)

  // Y ahora sí alcanza el documento de ese proyecto
  const documento: any = await documentResolvers.Query.documentById(
    null,
    { id: docSinMembresia },
    context,
  )
  assert.equal(documento.id, docSinMembresia)

  // Se revierte para no alterar las pruebas siguientes
  await projectMemberResolvers.Mutation.revokeDocProjectMember(null, { id: miembro.id }, context)
  assert.equal(
    await codigoDeError(() =>
      documentResolvers.Query.documentById(null, { id: docSinMembresia }, context),
    ),
    "FORBIDDEN",
  )
})

test("el alta repetida reincorpora en lugar de duplicar", async () => {
  const primera: any = await projectMemberResolvers.Mutation.assignDocProjectMember(
    null,
    {
      input: {
        docProjectId: PROYECTO_SIN_MEMBRESIA,
        userId: USER_ID,
        side: DocProjectSide.COUNTERPARTY,
      },
    },
    context,
  )

  const total = await prisma.docProjectMember.count({
    where: { docProjectId: PROYECTO_SIN_MEMBRESIA, userId: USER_ID },
  })

  assert.equal(total, 1, "la unicidad del par usuario–proyecto debe sostenerse")
  assert.equal(primera.isActive, true)
  assert.equal(primera.revokedAt, null)

  await projectMemberResolvers.Mutation.revokeDocProjectMember(null, { id: primera.id }, context)
})

test("el listado de miembros excluye las bajas salvo que se pidan", async () => {
  const vigentes: any = await projectMemberResolvers.Query.docProjectMembers(
    null,
    { docProjectId: PROYECTO_SIN_MEMBRESIA },
    context,
  )
  const todas: any = await projectMemberResolvers.Query.docProjectMembers(
    null,
    { docProjectId: PROYECTO_SIN_MEMBRESIA, includeRevoked: true },
    context,
  )

  assert.equal(vigentes.length, 0)
  assert.ok(todas.length > 0, "la baja debe conservarse, no borrarse")
})

test("dar de baja la membresía retira el acceso al objeto", async () => {
  const membresia = await prisma.docProjectMember.findFirstOrThrow({
    where: { docProjectId: PROYECTO_CON_MEMBRESIA, userId: USER_ID },
  })

  await prisma.docProjectMember.update({
    where: { id: membresia.id },
    data: { isActive: false, revokedAt: new Date(), revokedById: USER_ID },
  })

  const codigo = await codigoDeError(() =>
    documentResolvers.Query.documentById(null, { id: docConMembresia }, context),
  )

  // Se restituye para no dejar el estado alterado a las pruebas siguientes
  await prisma.docProjectMember.update({
    where: { id: membresia.id },
    data: { isActive: true, revokedAt: null, revokedById: null },
  })

  assert.equal(codigo, "FORBIDDEN")
})
