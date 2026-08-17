import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { ResolverContext } from "../types.js"
import {
  DocCatalogKind,
  DocLocationOrigin,
  DocProjectSide,
  DocScopeMode,
  DocumentRole,
  ModuleType,
} from "../generated/prisma/enums.js"
import { locationResolvers } from "./locations.js"
import { documentResolvers } from "./documents.js"
import { catalogScopeResolvers } from "./catalogScopes.js"
import { projectSettingsResolvers } from "./projectSettings.js"
import { projectMemberResolvers } from "./projectMembers.js"
import { AuditAction } from "../events/catalog.js"

/**
 * Catálogo de ubicación física contra la base y el resolver (BLOQUE 02B).
 *
 * Cubre lo que las pruebas puras no pueden: que el cruce de alcances se rechace
 * donde corresponde, que la resolución del alcance devuelva lo que el proyecto
 * ve, y que la siembra escriba el árbol en orden resolviendo cada ruta a su
 * identificador — que es donde el plan puro deja de alcanzar.
 *
 * Sobre el arnés de integración de BLOQUE 02: contexto real, token firmado y
 * primera capa validada contra `mi-admin`. Requiere `mi-admin` corriendo, el
 * usuario de prueba con el rol documental completo, y la base local.
 */

const USER_ID = 3
const ROLE_IDS = [1, 16] // view + doc-full

const PLANTA = -424420 // hereda y amplía
const INGENIERIA = -424421 // catálogo propio
const OTRO_CLIENTE = -424422 // destino de la siembra desde otro proyecto
const AJENO = -424423 // sin membresía del usuario

const PROYECTOS = [PLANTA, INGENIERIA, OTRO_CLIENTE, AJENO]
const CODIGO = "TEST-B02B"

let context: ResolverContext

const limpiar = async () => {
  // Los documentos primero: referencian ubicaciones con RESTRICT.
  await prisma.document.deleteMany({ where: { code: { startsWith: CODIGO } } })
  // Por niveles descendentes: la clave del árbol es RESTRICT.
  for (let i = 0; i < 4; i++) {
    await prisma.docLocation.deleteMany({
      where: {
        code: { startsWith: CODIGO },
        children: { none: {} },
      },
    })
  }
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

const declarar = async (
  projectId: number,
  conMembresia = true,
  ubicacion: { locationEnabled?: boolean; locationRequired?: boolean } = {},
) => {
  await projectSettingsResolvers.Mutation.declareDocProjectSettings(
    null,
    {
      input: {
        projectId,
        documentRole: DocumentRole.INTERNAL,
        defaultOrganizerId: USER_ID,
        ...ubicacion,
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

const crear = (input: Record<string, unknown>) =>
  locationResolvers.Mutation.createLocation(
    null,
    { input: { ...input, code: `${CODIGO}-${input.code}` } as any },
    context,
  ) as Promise<any>

const sembrar = (projectId: number, sourceProjectId?: number) =>
  locationResolvers.Mutation.seedProjectLocations(
    null,
    { projectId, sourceProjectId },
    context,
  ) as Promise<any>

const declararAlcance = (projectId: number, mode: DocScopeMode) =>
  catalogScopeResolvers.Mutation.declareCatalogScope(
    null,
    { input: { projectId, catalog: DocCatalogKind.LOCATION, mode } },
    context,
  ) as Promise<any>

const rutasDe = async (projectId: number) => {
  const nodos = (await locationResolvers.Query.projectLocations(
    null,
    { projectId },
    context,
  )) as any[]
  return nodos.map((n) => n.path).sort()
}

// El árbol del despliegue de las pruebas
let planta: any
let area: any
let unidad: any

before(async () => {
  await limpiar()

  const token = jwt.sign(
    { id: USER_ID, roles: ROLE_IDS },
    process.env.AUTH_JWT_SECRET as string,
    { expiresIn: "1h" },
  )
  context = { orm: prisma, token: `Bearer ${token}` } as ResolverContext

  await declarar(PLANTA)
  await declarar(INGENIERIA)
  await declarar(OTRO_CLIENTE)
  await declarar(AJENO, false)

  planta = await crear({ code: "P", name: "Planta Urea" })
  area = await crear({ code: "A1", name: "Área 100", parentId: planta.id })
  unidad = await crear({
    code: "U1",
    name: "Unidad 110",
    parentId: area.id,
    externalOrigin: DocLocationOrigin.ASSETS,
    externalRef: "TAG-110",
  })
})

after(async () => {
  await limpiar()
  await prisma.$disconnect()
})

// --- El árbol del despliegue ---

test("el árbol del despliegue compone la ruta con su ascendencia", async () => {
  assert.equal(planta.path, "Planta Urea")
  assert.equal(area.path, "Planta Urea / Área 100")
  assert.equal(unidad.path, "Planta Urea / Área 100 / Unidad 110")
  assert.equal(planta.projectId, null)
})

// --- El cruce de alcances (B1) ---

test("un proyecto amplía el árbol del despliegue colgando de un nodo global", async () => {
  const ampliacion = await crear({
    code: "U2",
    name: "Unidad 120",
    parentId: area.id,
    projectId: PLANTA,
  })

  assert.equal(ampliacion.projectId, PLANTA)
  assert.equal(ampliacion.path, "Planta Urea / Área 100 / Unidad 120")
})

test("un nodo del despliegue no puede colgar de uno de proyecto", async () => {
  const ampliacion = await prisma.docLocation.findFirstOrThrow({
    where: { code: `${CODIGO}-U2` },
  })

  await assert.rejects(
    () => crear({ code: "X1", name: "Global inválida", parentId: ampliacion.id }),
    /árbol global quedaría dependiendo de un proyecto/,
  )
})

test("un proyecto no puede colgar del árbol de otro proyecto", async () => {
  const ampliacion = await prisma.docLocation.findFirstOrThrow({
    where: { code: `${CODIGO}-U2` },
  })

  await assert.rejects(
    () =>
      crear({
        code: "X2",
        name: "Ajena",
        parentId: ampliacion.id,
        projectId: INGENIERIA,
      }),
    /su propio árbol/,
  )
})

// --- La resolución del alcance (B1) ---

test("sin declarar nada, el proyecto hereda y ve lo propio más lo del despliegue", async () => {
  assert.deepEqual(await rutasDe(PLANTA), [
    "Planta Urea",
    "Planta Urea / Área 100",
    "Planta Urea / Área 100 / Unidad 110",
    "Planta Urea / Área 100 / Unidad 120",
  ])

  assert.equal(
    await locationResolvers.Query.locationScope(null, { projectId: PLANTA }, context),
    DocScopeMode.INHERIT,
  )
})

test("otro proyecto no ve la ampliación ajena", async () => {
  assert.deepEqual(await rutasDe(INGENIERIA), [
    "Planta Urea",
    "Planta Urea / Área 100",
    "Planta Urea / Área 100 / Unidad 110",
  ])
})

// --- Declarar catálogo propio ---

test("declarar propio se rechaza si el proyecto tiene ampliaciones del árbol global", async () => {
  // Y el mensaje nombra la ruta: un rechazo que no dice qué mover obliga a
  // buscarlo a mano.
  await assert.rejects(
    () => declararAlcance(PLANTA, DocScopeMode.OWN),
    /Unidad 120/,
  )
})

test("un proyecto sin ampliaciones declara propio y deja de ver el despliegue", async () => {
  await declararAlcance(INGENIERIA, DocScopeMode.OWN)

  assert.equal(
    await locationResolvers.Query.locationScope(
      null,
      { projectId: INGENIERIA },
      context,
    ),
    DocScopeMode.OWN,
  )
  assert.deepEqual(await rutasDe(INGENIERIA), [])
})

test("mover la ampliación a un nodo propio habilita declarar propio", async () => {
  const raiz = await crear({ code: "R", name: "Sitio propio", projectId: PLANTA })
  const ampliacion = await prisma.docLocation.findFirstOrThrow({
    where: { code: `${CODIGO}-U2` },
  })

  await locationResolvers.Mutation.moveLocation(
    null,
    { id: ampliacion.id, parentId: raiz.id },
    context,
  )

  const declarado = await declararAlcance(PLANTA, DocScopeMode.OWN)
  assert.equal(declarado.mode, DocScopeMode.OWN)

  assert.deepEqual(await rutasDe(PLANTA), [
    "Sitio propio",
    "Sitio propio / Unidad 120",
  ])

  // Se vuelve atrás declarándolo, y la fila queda: es lo que la traza necesita.
  await declararAlcance(PLANTA, DocScopeMode.INHERIT)
  assert.equal(
    await prisma.docCatalogScope.count({ where: { projectId: PLANTA } }),
    1,
  )
})

// --- La siembra por copia (B2) ---

test("sembrar desde el despliegue crea el árbol en el proyecto, con su jerarquía", async () => {
  const resultado = await sembrar(INGENIERIA)

  assert.equal(resultado.added, 3)
  assert.equal(resultado.alreadyPresent, 0)
  assert.equal(resultado.skippedTerminated, 0)

  assert.deepEqual(await rutasDe(INGENIERIA), [
    "Planta Urea",
    "Planta Urea / Área 100",
    "Planta Urea / Área 100 / Unidad 110",
  ])

  // La jerarquía se reconstruyó de verdad, y no solo las rutas: es lo que el
  // plan puro no puede verificar.
  const copiada = await prisma.docLocation.findFirstOrThrow({
    where: { projectId: INGENIERIA, name: "Unidad 110" },
    include: { parent: true },
  })
  assert.equal(copiada.parent?.name, "Área 100")
  assert.equal(copiada.parent?.projectId, INGENIERIA)

  // La referencia externa viaja: identifica el mismo objeto real.
  assert.equal(copiada.externalOrigin, DocLocationOrigin.ASSETS)
  assert.equal(copiada.externalRef, "TAG-110")
})

test("sembrar dos veces no duplica", async () => {
  const resultado = await sembrar(INGENIERIA)

  assert.equal(resultado.added, 0)
  assert.equal(resultado.alreadyPresent, 3)
  assert.equal(
    await prisma.docLocation.count({ where: { projectId: INGENIERIA } }),
    3,
  )
})

test("una siembra que no agrega nada deja rastro igual", async () => {
  // Es la razón por la que la siembra tiene acción propia además de las
  // creaciones que produce.
  const eventos = await prisma.docAuditEvent.count({
    where: { action: AuditAction.SeedLocations },
  })
  assert.ok(eventos >= 2)
})

test("sembrar desde otro proyecto copia el estándar de ese cliente", async () => {
  // **Primero se declara propio y después se siembra**, y el orden importa: un
  // proyecto que todavía hereda ya VE el árbol del despliegue, de modo que la
  // deduplicación por ruta no tendría nada que agregar. Es el orden natural —se
  // declara que no se hereda, y entonces se carga— y no una restricción del
  // mecanismo.
  await declararAlcance(OTRO_CLIENTE, DocScopeMode.OWN)
  assert.deepEqual(await rutasDe(OTRO_CLIENTE), [])

  const resultado = await sembrar(OTRO_CLIENTE, INGENIERIA)

  assert.equal(resultado.added, 3)
  assert.deepEqual(await rutasDe(OTRO_CLIENTE), [
    "Planta Urea",
    "Planta Urea / Área 100",
    "Planta Urea / Área 100 / Unidad 110",
  ])
})

test("sembrar en un proyecto que hereda esas rutas no agrega nada", async () => {
  // Ya las ve: crear copias propias las taparía con duplicados. `PLANTA` volvió
  // a heredar, de modo que el árbol del despliegue ya le resuelve.
  const resultado = await sembrar(PLANTA)

  assert.equal(resultado.added, 0)
  assert.ok(resultado.alreadyPresent >= 3)

  // Y no quedó ninguna copia propia de un nodo global.
  const propias = await prisma.docLocation.findMany({
    where: { projectId: PLANTA },
    select: { path: true },
  })
  assert.equal(
    propias.some((n) => n.path.startsWith("Planta Urea")),
    false,
  )
})

test("una fuente solapada agrega solo lo que falta", async () => {
  const nueva = await crear({ code: "A2", name: "Área 200", parentId: planta.id })
  assert.equal(nueva.path, "Planta Urea / Área 200")

  const resultado = await sembrar(INGENIERIA)

  assert.equal(resultado.added, 1)
  assert.equal(resultado.alreadyPresent, 3)

  const copiada = await prisma.docLocation.findFirstOrThrow({
    where: { projectId: INGENIERIA, name: "Área 200" },
    include: { parent: true },
  })
  // Colgada del nodo que el destino ya tenía, y no de una copia nueva.
  assert.equal(copiada.parent?.name, "Planta Urea")
  assert.equal(copiada.parent?.projectId, INGENIERIA)
})

test("un proyecto no se siembra de sí mismo", async () => {
  await assert.rejects(
    () => sembrar(INGENIERIA, INGENIERIA),
    /no se siembra de sí mismo/,
  )
})

test("sembrar de un proyecto ajeno exige membresía en la fuente", async () => {
  // Alcanzar el destino no habilita leer el catálogo de otro cliente (D-15).
  await assert.rejects(() => sembrar(INGENIERIA, AJENO))
})

// --- La lista de selección ---

test("la lista de selección sin proyecto ofrece el árbol del despliegue", async () => {
  const lista = (await locationResolvers.Query.locationsSelectList(
    null,
    {},
    context,
  )) as any[]

  const propias = lista.filter((o) => o.label.startsWith("Planta Urea"))
  assert.ok(propias.length >= 4)
  // El rótulo es la ruta completa y no el nombre.
  assert.ok(propias.some((o) => o.label === "Planta Urea / Área 100 / Unidad 110"))
})

// --- El atributo en el documento (B3, B4) ---

let documentTypeId: number

const crearDocumento = async (
  sufijo: string,
  projectId: number,
  locationId?: number | null,
) =>
  (await documentResolvers.Mutation.createDocument(
    null,
    {
      input: {
        code: `${CODIGO}-${sufijo}`,
        title: `Documento ${sufijo}`,
        module: ModuleType.PROJECTS,
        projectId,
        documentTypeId,
        assignedOrganizerId: USER_ID,
        ...(locationId !== undefined && { locationId }),
      },
    } as any,
    context,
  )) as any

test("un documento sin ubicación es válido con la configuración por defecto", async () => {
  const tipo = await prisma.documentType.findFirstOrThrow({ select: { id: true } })
  documentTypeId = tipo.id

  const doc = await crearDocumento("D1", PLANTA)

  assert.equal(doc.locationId, null)
  assert.equal(doc.locationPath, null)
})

test("el documento guarda la ruta como snapshot al declarar su ubicación", async () => {
  const doc = await crearDocumento("D2", PLANTA, area.id)

  assert.equal(doc.locationId, area.id)
  assert.equal(doc.locationPath, "Planta Urea / Área 100")
})

test("una ubicación fuera del alcance del proyecto se rechaza", async () => {
  // `INGENIERIA` declaró catálogo propio: los nodos del despliegue no le
  // resuelven, aunque existan.
  await assert.rejects(
    () => crearDocumento("D3", INGENIERIA, area.id),
    /no pertenece al catálogo que el proyecto resuelve/,
  )
})

test("una ubicación dada de baja no se elige, y lo ya clasificado la conserva", async () => {
  const nodo = await crear({ code: "TB", name: "Área de baja", parentId: planta.id })
  const doc = await crearDocumento("D4", PLANTA, nodo.id)

  await locationResolvers.Mutation.terminateLocation(null, { id: nodo.id }, context)

  await assert.rejects(
    () => crearDocumento("D5", PLANTA, nodo.id),
    /está dada de baja/,
  )

  // El documento que ya la tenía la conserva: la validación es solo en escritura.
  const conservado = await prisma.document.findUniqueOrThrow({
    where: { id: doc.id },
    select: { locationId: true, locationPath: true },
  })
  assert.equal(conservado.locationId, nodo.id)
  assert.equal(conservado.locationPath, "Planta Urea / Área de baja")
})

test("un proyecto puede exigir la ubicación", async () => {
  await declarar(OTRO_CLIENTE, true, { locationRequired: true })

  await assert.rejects(
    () => crearDocumento("D6", OTRO_CLIENTE),
    /exige declarar la ubicación física/,
  )

  // Con una de su propio catálogo, entra. `OTRO_CLIENTE` declaró propio en la
  // fase 3 y tiene su copia del árbol.
  const propia = await prisma.docLocation.findFirstOrThrow({
    where: { projectId: OTRO_CLIENTE, name: "Área 100" },
  })
  const doc = await crearDocumento("D7", OTRO_CLIENTE, propia.id)
  assert.equal(doc.locationPath, "Planta Urea / Área 100")
})

test("con el atributo deshabilitado no se declara ubicación", async () => {
  await declarar(OTRO_CLIENTE, true, { locationEnabled: false })

  const propia = await prisma.docLocation.findFirstOrThrow({
    where: { projectId: OTRO_CLIENTE, name: "Área 100" },
  })
  await assert.rejects(
    () => crearDocumento("D8", OTRO_CLIENTE, propia.id),
    /deshabilitado el atributo de ubicación/,
  )

  // Y deshabilitado no exige, aunque quedara marcada como obligatoria.
  const doc = await crearDocumento("D9", OTRO_CLIENTE)
  assert.equal(doc.locationId, null)
})

// --- El snapshot se recalcula solo (B6) ---

test("renombrar el nodo recalcula el snapshot de los documentos clasificados", async () => {
  const doc = await prisma.document.findFirstOrThrow({
    where: { code: `${CODIGO}-D2` },
  })
  const antes = doc.updatedAt

  await locationResolvers.Mutation.updateLocation(
    null,
    { id: area.id, input: { name: "Área 100 - Síntesis" } },
    context,
  )

  const despues = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })
  assert.equal(despues.locationPath, "Planta Urea / Área 100 - Síntesis")

  // Nadie editó el documento: atribuirle el cambio a quien renombró el nodo
  // diría que tocó documentos que no tocó.
  assert.equal(despues.updatedById, doc.updatedById)
  assert.deepEqual(despues.updatedAt, antes)
})

test("mover el nodo también lo recalcula, y el evento dice cuántos", async () => {
  const raiz = await crear({ code: "OTRA", name: "Planta Amoníaco" })

  await locationResolvers.Mutation.moveLocation(
    null,
    { id: area.id, parentId: raiz.id },
    context,
  )

  const doc = await prisma.document.findFirstOrThrow({
    where: { code: `${CODIGO}-D2` },
  })
  assert.equal(doc.locationPath, "Planta Amoníaco / Área 100 - Síntesis")

  const evento = await prisma.docAuditEvent.findFirstOrThrow({
    where: { action: AuditAction.MoveLocation },
    orderBy: { id: "desc" },
  })
  // `meta` es una columna Json: viene como objeto y no como texto.
  const meta = evento.meta as { documents?: number }
  assert.ok(
    (meta.documents ?? 0) >= 1,
    "el evento no informa los documentos recalculados",
  )
})

// --- La otra mitad de la condición de borrado ---

test("no se elimina una ubicación con documentos clasificados", async () => {
  // Una HOJA con documentos: si tuviera descendencia se rechazaría por eso, y la
  // prueba no distinguiría las dos mitades de la condición.
  const hoja = await prisma.docLocation.findFirstOrThrow({
    where: { code: `${CODIGO}-TB` },
  })
  assert.equal(await prisma.docLocation.count({ where: { parentId: hoja.id } }), 0)
  assert.ok(await prisma.document.count({ where: { locationId: hoja.id } }))

  await assert.rejects(
    () => locationResolvers.Mutation.deleteLocation(null, { id: hoja.id }, context),
    /documento\(s\) están clasificados/,
  )
})

test("una hoja sin documentos ni descendencia sí se elimina", async () => {
  const suelta = await crear({ code: "SUELTA", name: "Área suelta" })

  assert.equal(
    await locationResolvers.Mutation.deleteLocation(
      null,
      { id: suelta.id },
      context,
    ),
    true,
  )
  assert.equal(
    await prisma.docLocation.count({ where: { id: suelta.id } }),
    0,
  )
})

test("la ubicación se edita con revisión aprobada, porque clasifica y no identifica", async () => {
  const doc = await prisma.document.findFirstOrThrow({
    where: { code: `${CODIGO}-D1` },
  })

  const actualizado = (await documentResolvers.Mutation.updateDocument(
    null,
    { id: doc.id, input: { locationId: area.id } },
    context,
  )) as any

  assert.equal(actualizado.locationId, area.id)
  assert.equal(actualizado.locationPath, "Planta Amoníaco / Área 100 - Síntesis")

  // Y se retira con nulo.
  const sinUbicacion = (await documentResolvers.Mutation.updateDocument(
    null,
    { id: doc.id, input: { locationId: null } },
    context,
  )) as any
  assert.equal(sinUbicacion.locationId, null)
  assert.equal(sinUbicacion.locationPath, null)
})
