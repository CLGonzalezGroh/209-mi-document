import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { ResolverContext } from "../types.js"
import {
  DocCatalogKind,
  DocProjectSide,
  DocScopeMode,
  DocumentRole,
  ModuleType,
} from "../generated/prisma/enums.js"
import { documentClassResolvers } from "./documentClasses.js"
import { documentTypeResolvers } from "./documentTypes.js"
import { catalogScopeResolvers } from "./catalogScopes.js"
import { projectSettingsResolvers } from "./projectSettings.js"
import { projectMemberResolvers } from "./projectMembers.js"

/**
 * Alcance por proyecto de clase y tipo, contra la base y el resolver
 * (BLOQUE 02C, fase 2).
 *
 * Lo que acá se prueba y las puras no alcanzan: que **omitir el ámbito nombre
 * el despliegue y no devuelva todo** (B8) —que es lo que sostiene que la webapp
 * no se toque—, que un proyecto con clasificación propia vea solo la suya y
 * pueda repetir códigos del despliegue, y que administrar el catálogo de un
 * proyecto exija membresía además del permiso.
 *
 * Sobre el arnés de integración de BLOQUE 02: contexto real, token firmado y
 * primera capa validada contra `mi-admin`. Requiere `mi-admin` corriendo, el
 * usuario de prueba con el rol documental completo, y la base local.
 */

const USER_ID = 3
const ROLE_IDS = [1, 16] // view + doc-full

const HEREDA = -424430
const PROPIO = -424431
const AJENO = -424432 // sin membresía del usuario

const PROYECTOS = [HEREDA, PROPIO, AJENO]
const CODIGO = "TEST-B02C"

let context: ResolverContext

const limpiar = async () => {
  await prisma.documentType.deleteMany({
    where: { code: { startsWith: CODIGO } },
  })
  await prisma.documentClass.deleteMany({
    where: { code: { startsWith: CODIGO } },
  })
  await prisma.docCatalogScope.deleteMany({
    where: { projectId: { in: PROYECTOS } },
  })
  await prisma.docProjectMember.deleteMany({
    where: { projectId: { in: PROYECTOS } },
  })
  await prisma.docProjectSettings.deleteMany({
    where: { projectId: { in: PROYECTOS } },
  })
  await prisma.docAuditEvent.deleteMany({
    where: { projectId: { in: PROYECTOS } },
  })
}

const declarar = async (projectId: number, conMembresia = true) => {
  await projectSettingsResolvers.Mutation.declareDocProjectSettings(
    null,
    {
      input: {
        projectId,
        documentRole: DocumentRole.INTERNAL,
        defaultOrganizerId: USER_ID,
      },
    },
    context,
  )
  if (conMembresia) {
    await projectMemberResolvers.Mutation.assignDocProjectMember(
      null,
      { input: { projectId, userId: USER_ID, side: DocProjectSide.HOST } },
      context,
    )
  }
}

const crearClase = (input: Record<string, unknown>) =>
  documentClassResolvers.Mutation.createDocumentClass(
    null,
    {
      input: {
        module: ModuleType.PROJECTS,
        ...input,
        code: `${CODIGO}-${input.code}`,
      } as any,
    },
    context,
  ) as Promise<any>

const crearTipo = (input: Record<string, unknown>) =>
  documentTypeResolvers.Mutation.createDocumentType(
    null,
    {
      input: {
        module: ModuleType.PROJECTS,
        ...input,
        code: `${CODIGO}-${input.code}`,
      } as any,
    },
    context,
  ) as Promise<any>

const declararAlcance = (projectId: number, mode: DocScopeMode) =>
  catalogScopeResolvers.Mutation.declareCatalogScope(
    null,
    { input: { projectId, catalog: DocCatalogKind.CLASSIFICATION, mode } },
    context,
  ) as Promise<any>

/** Los códigos que un ámbito ve, por el selector: es el alcance RESUELTO. */
const clasesQueVe = async (projectId?: number) => {
  const items = (await documentClassResolvers.Query.documentClassesSelectList(
    null,
    { module: ModuleType.PROJECTS, projectId },
    context,
  )) as { value: string; label: string }[]

  const ids = items.map((i) => Number(i.value))
  const filas = await prisma.documentClass.findMany({
    where: { id: { in: ids }, code: { startsWith: CODIGO } },
    select: { code: true },
  })
  return filas.map((f) => f.code).sort()
}

/** Lo que la vista de administración lista: el ámbito pedido, sin resolver. */
const clasesDelAmbito = async (projectId?: number) => {
  const res = (await documentClassResolvers.Query.documentClasses(
    null,
    { projectId, filter: { query: CODIGO }, pagination: { skip: 0, take: 100 } },
    context,
  )) as any
  return res.items.map((c: any) => c.code).sort()
}

/**
 * Rechaza **por membresía** y no por cualquier motivo.
 *
 * Un `try/catch` que acepta cualquier error deja pasar una prueba que aprueba
 * por la razón equivocada: si mañana la operación fallara por un código
 * duplicado, seguiría en verde sin probar nada de la autorización.
 */
const rechazaPorMembresia = async (fn: () => Promise<unknown>) => {
  try {
    await fn()
    return false
  } catch (error) {
    return (error as Error).message.includes("miembro")
  }
}

let global1: any
let propia: any

before(async () => {
  await limpiar()

  const token = jwt.sign(
    { id: USER_ID, roles: ROLE_IDS },
    process.env.AUTH_JWT_SECRET as string,
    { expiresIn: "1h" },
  )
  context = { orm: prisma, token: `Bearer ${token}` } as ResolverContext

  await declarar(HEREDA)
  await declarar(PROPIO)
  await declarar(AJENO, false)

  await declararAlcance(PROPIO, DocScopeMode.OWN)

  global1 = await crearClase({ code: "CIVIL", name: `${CODIGO} Civil` })
  propia = await crearClase({
    code: "CIVIL-P",
    name: `${CODIGO} Civil del proyecto`,
    projectId: PROPIO,
  })
})

after(async () => {
  await limpiar()
  await prisma.$disconnect()
})

// --- El ámbito por defecto (B8) ---

test("sin ámbito, la lista devuelve el despliegue y no todo", async () => {
  // Es lo que sostiene que la webapp no se toque: la pantalla global llama sin
  // proyecto y debe seguir mostrando exactamente lo que muestra hoy.
  const codigos = await clasesDelAmbito()

  assert.deepEqual(codigos, [`${CODIGO}-CIVIL`])
  assert.equal(codigos.includes(`${CODIGO}-CIVIL-P`), false)
})

test("sin ámbito, el selector también resuelve el despliegue", async () => {
  const codigos = await clasesQueVe()

  assert.deepEqual(codigos, [`${CODIGO}-CIVIL`])
})

test("la lista de un proyecto muestra lo suyo y no lo heredado", async () => {
  // La vista de administración NO resuelve alcance: muestra lo que ese ámbito
  // declaró. Resolver es del selector.
  assert.deepEqual(await clasesDelAmbito(PROPIO), [`${CODIGO}-CIVIL-P`])
  assert.deepEqual(await clasesDelAmbito(HEREDA), [])
})

// --- Los dos modos (criterios 1 y 2) ---

test("un proyecto que hereda ve las del despliegue", async () => {
  assert.deepEqual(await clasesQueVe(HEREDA), [`${CODIGO}-CIVIL`])
})

test("un proyecto con catálogo propio ve solo las suyas", async () => {
  assert.deepEqual(await clasesQueVe(PROPIO), [`${CODIGO}-CIVIL-P`])
})

test("un proyecto que hereda y amplía ve las dos", async () => {
  const propiaDeHereda = await crearClase({
    code: "ELEC",
    name: `${CODIGO} Eléctrica`,
    projectId: HEREDA,
  })

  assert.equal(propiaDeHereda.projectId, HEREDA)
  assert.deepEqual(await clasesQueVe(HEREDA), [
    `${CODIGO}-CIVIL`,
    `${CODIGO}-ELEC`,
  ])
})

test("un proyecto puede usar un código que el despliegue ya tiene", async () => {
  // La unicidad incorpora el alcance: es lo que permite que dos clientes
  // nombren igual su propia clase sin chocar entre ellos ni con el estándar.
  const homonima = await crearClase({
    code: "CIVIL",
    name: `${CODIGO} Civil del cliente`,
    projectId: PROPIO,
  })

  assert.equal(homonima.projectId, PROPIO)
  assert.notEqual(homonima.id, global1.id)
})

// --- El eje de módulo sigue vigente ---

test("el alcance no reemplaza al módulo: los dos ejes filtran", async () => {
  const deCalidad = await crearClase({
    code: "QA",
    name: `${CODIGO} Calidad`,
    module: ModuleType.QUALITY,
  })

  assert.equal(deCalidad.projectId, null)
  // Un proyecto que hereda ve el despliegue, pero no lo de otro módulo.
  assert.equal((await clasesQueVe(HEREDA)).includes(`${CODIGO}-QA`), false)
})

// --- La autorización en dos capas (criterio 8) ---

test("crear en el ámbito de un proyecto sin membresía se rechaza", async () => {
  assert.equal(
    await rechazaPorMembresia(() =>
      crearClase({
        code: "AJENA",
        name: `${CODIGO} Ajena`,
        projectId: AJENO,
      }),
    ),
    true,
  )
})

test("listar el catálogo de un proyecto sin membresía se rechaza", async () => {
  assert.equal(await rechazaPorMembresia(() => clasesDelAmbito(AJENO)), true)
})

test("editar una entrada de proyecto sin membresía se rechaza", async () => {
  // La autorización sale del alcance de la propia entrada y no de una regla por
  // operación: la entrada del despliegue se edita con el permiso global.
  const ajena = await prisma.documentClass.create({
    data: {
      name: `${CODIGO} ajena directa`,
      code: `${CODIGO}-AJENA-D`,
      module: ModuleType.PROJECTS,
      projectId: AJENO,
      updatedById: USER_ID,
    },
  })

  assert.equal(
    await rechazaPorMembresia(() =>
      documentClassResolvers.Mutation.updateDocumentClass(
        null,
        { id: ajena.id, input: { name: "otro" } },
        context,
      ),
    ),
    true,
  )

  const global = await documentClassResolvers.Mutation.updateDocumentClass(
    null,
    { id: global1.id, input: { description: "editada con permiso global" } },
    context,
  )
  assert.equal((global as any).description, "editada con permiso global")
})

// --- El tipo hereda el mismo mecanismo ---

test("el tipo resuelve su alcance con la misma declaración que la clase", async () => {
  // Clase y tipo declaran juntos (B1): la fila de alcance es una sola, y el
  // tipo la lee igual.
  await crearTipo({ code: "PLANO", name: `${CODIGO} Plano` })
  await crearTipo({
    code: "PLANO-P",
    name: `${CODIGO} Plano del proyecto`,
    projectId: PROPIO,
  })

  const vistos = async (projectId?: number) => {
    const items = (await documentTypeResolvers.Query.documentTypesSelectList(
      null,
      { module: ModuleType.PROJECTS, projectId },
      context,
    )) as { value: string }[]
    const filas = await prisma.documentType.findMany({
      where: {
        id: { in: items.map((i) => Number(i.value)) },
        code: { startsWith: CODIGO },
      },
      select: { code: true },
    })
    return filas.map((f) => f.code).sort()
  }

  assert.deepEqual(await vistos(), [`${CODIGO}-PLANO`])
  assert.deepEqual(await vistos(HEREDA), [`${CODIGO}-PLANO`])
  assert.deepEqual(await vistos(PROPIO), [`${CODIGO}-PLANO-P`])
})
