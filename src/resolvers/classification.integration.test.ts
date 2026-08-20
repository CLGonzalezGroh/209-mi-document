import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import jwt from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { asegurarContratos, borrarContratos } from "../utils/testContracts.js"
import { ResolverContext } from "../types.js"
import {
  DocCatalogKind,
  DocProjectSide,
  DocScopeMode,
  DocumentRole,
  ModuleType,
  StepType,
} from "../generated/prisma/enums.js"
import { documentClassResolvers } from "./documentClasses.js"
import { documentTypeResolvers } from "./documentTypes.js"
import { catalogScopeResolvers } from "./catalogScopes.js"
import { classificationResolvers } from "./classification.js"
import { docProjectsResolvers } from "./docProjects.js"
import { projectMemberResolvers } from "./projectMembers.js"
import { AuditAction } from "../events/catalog.js"
import { documentResolvers } from "./documents.js"
import { workflowTemplateResolvers } from "./workflowTemplates.js"

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
const SEMBRADO = -424433 // destino de la siembra desde el despliegue
const SEGUNDO = -424434 // destino de la siembra desde otro proyecto
const TERCERO = -424435 // destino donde se prueba lo dado de baja

const PROYECTOS = [HEREDA, PROPIO, AJENO, SEMBRADO, SEGUNDO, TERCERO]
const CODIGO = "TEST-B02C"

let context: ResolverContext

const limpiar = async () => {
  await prisma.docWorkflowTemplate.deleteMany({
    where: { name: { startsWith: CODIGO } },
  })
  await prisma.document.deleteMany({ where: { code: { startsWith: CODIGO } } })
  await prisma.documentType.deleteMany({
    where: { code: { startsWith: CODIGO } },
  })
  await prisma.documentClass.deleteMany({
    where: { code: { startsWith: CODIGO } },
  })
  await prisma.docCatalogScope.deleteMany({
    where: { docProjectId: { in: PROYECTOS } },
  })
  await prisma.docProjectMember.deleteMany({
    where: { docProjectId: { in: PROYECTOS } },
  })
  // Por alcance y no solo por código: varias entradas de la prueba llevan un
  // código propio del dominio —"CIVIL"— y el prefijo solo está en el nombre.
  // Con clave foránea RESTRICT, una que sobreviva impide borrar su contrato.
  await prisma.documentType.deleteMany({
    where: { docProjectId: { in: PROYECTOS } },
  })
  await prisma.documentClass.deleteMany({
    where: { docProjectId: { in: PROYECTOS } },
  })
  await borrarContratos(prisma, PROYECTOS)
  await prisma.docAuditEvent.deleteMany({
    where: { docProjectId: { in: PROYECTOS } },
  })
}

const declarar = async (projectId: number, conMembresia = true) => {
  // El contrato existe antes de declararlo, con id igual a la constante: la
  // mutación hace upsert POR CÓDIGO y cae sobre esta misma fila, de modo que
  // todo lo que la prueba cuelga de `docProjectId` sigue siendo válido.
  await asegurarContratos(prisma, [projectId], DocumentRole.INTERNAL)

  const contrato: any = await docProjectsResolvers.Mutation.updateDocProject(
    null,
    {
      id: projectId,
      input: {
        name: "Contrato de prueba",
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
      { input: { docProjectId: contrato.id, userId: USER_ID, side: DocProjectSide.HOST } },
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

const sembrar = (docProjectId: number, sourceProjectId?: number) =>
  classificationResolvers.Mutation.seedProjectClassification(
    null,
    { docProjectId, sourceProjectId },
    context,
  ) as Promise<any>

const declararAlcance = (docProjectId: number, mode: DocScopeMode) =>
  catalogScopeResolvers.Mutation.declareCatalogScope(
    null,
    { input: { docProjectId, catalog: DocCatalogKind.CLASSIFICATION, mode } },
    context,
  ) as Promise<any>

/** Los códigos que un ámbito ve, por el selector: es el alcance RESUELTO. */
const clasesQueVe = async (docProjectId?: number) => {
  const items = (await documentClassResolvers.Query.documentClassesSelectList(
    null,
    { module: ModuleType.PROJECTS, docProjectId },
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
const clasesDelAmbito = async (docProjectId?: number) => {
  const res = (await documentClassResolvers.Query.documentClasses(
    null,
    { docProjectId, filter: { query: CODIGO }, pagination: { skip: 0, take: 100 } },
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

  // Los seis contratos existen desde el arranque: las entradas de catálogo con
  // alcance les cuelgan con clave foránea (BLOQUE 02D, B7), y varias pruebas
  // declaran su contrato recién a mitad del archivo.
  await asegurarContratos(prisma, PROYECTOS)

  await declarar(HEREDA)
  await declarar(PROPIO)
  await declarar(AJENO, false)

  await declararAlcance(PROPIO, DocScopeMode.OWN)

  global1 = await crearClase({ code: "CIVIL", name: `${CODIGO} Civil` })
  propia = await crearClase({
    code: "CIVIL-P",
    name: `${CODIGO} Civil del proyecto`,
    docProjectId: PROPIO,
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
    docProjectId: HEREDA,
  })

  assert.equal(propiaDeHereda.docProjectId, HEREDA)
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
    docProjectId: PROPIO,
  })

  assert.equal(homonima.docProjectId, PROPIO)
  assert.notEqual(homonima.id, global1.id)
})

// --- El eje de módulo sigue vigente ---

test("el alcance no reemplaza al módulo: los dos ejes filtran", async () => {
  const deCalidad = await crearClase({
    code: "QA",
    name: `${CODIGO} Calidad`,
    module: ModuleType.QUALITY,
  })

  assert.equal(deCalidad.docProjectId, null)
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
        docProjectId: AJENO,
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
      docProjectId: AJENO,
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
    docProjectId: PROPIO,
  })

  const vistos = async (docProjectId?: number) => {
    const items = (await documentTypeResolvers.Query.documentTypesSelectList(
      null,
      { module: ModuleType.PROJECTS, docProjectId },
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

// --- La siembra por copia (B2) ---

test("sembrar desde el despliegue copia clase y tipo en un acto", async () => {
  // SEMBRADO declara catálogo propio: sin eso ya vería el despliegue y sembrar
  // no agregaría nada, que es justamente la regla del destino.
  await declarar(SEMBRADO)
  await declararAlcance(SEMBRADO, DocScopeMode.OWN)

  // Un tipo COLGADO de una clase, que es el caso que ejercita la resolución por
  // código: el tipo suelto no prueba nada de eso.
  await crearTipo({
    code: "PLANO-C",
    name: `${CODIGO} Plano civil`,
    classId: global1.id,
  })

  const antes = await clasesQueVe(SEMBRADO)
  assert.deepEqual(antes, [])

  const res = await sembrar(SEMBRADO)

  assert.equal(res.added > 0, true)
  assert.equal((await clasesQueVe(SEMBRADO)).includes(`${CODIGO}-CIVIL`), true)

  const tipos = await prisma.documentType.findMany({
    where: { docProjectId: SEMBRADO, code: { startsWith: CODIGO } },
    select: { code: true, classId: true },
  })
  assert.equal(tipos.length > 0, true)
})

test("el tipo copiado cuelga de la clase copiada, y no de la del origen", async () => {
  // Es lo que el plan resuelve con el CÓDIGO de la clase: en el destino la
  // clase es otra fila, con otro identificador.
  const tipo = await prisma.documentType.findFirstOrThrow({
    where: { docProjectId: SEMBRADO, code: `${CODIGO}-PLANO-C` },
    select: { classId: true },
  })
  const clase = await prisma.documentClass.findUniqueOrThrow({
    where: { id: tipo.classId as number },
    select: { docProjectId: true, code: true },
  })

  assert.equal(clase.docProjectId, SEMBRADO)
  assert.equal(clase.code, `${CODIGO}-CIVIL`)
})

test("sembrar dos veces no duplica", async () => {
  const res = await sembrar(SEMBRADO)

  assert.equal(res.added, 0)
  assert.equal(res.alreadyPresent > 0, true)

  const clases = await prisma.documentClass.findMany({
    where: { docProjectId: SEMBRADO, code: `${CODIGO}-CIVIL` },
  })
  assert.equal(clases.length, 1)
})

test("la entrada copiada queda en el módulo de proyectos", async () => {
  // El CHECK de la base lo exige, y además es lo que la entrada pasa a ser: la
  // clase compartida del despliegue, al copiarse al alcance de un proyecto, ya
  // no está disponible para todos los módulos.
  const clase = await prisma.documentClass.findFirstOrThrow({
    where: { docProjectId: SEMBRADO, code: `${CODIGO}-CIVIL` },
    select: { module: true },
  })

  assert.equal(clase.module, ModuleType.PROJECTS)
})

test("un proyecto no se siembra de sí mismo", async () => {
  await assert.rejects(
    () => sembrar(SEMBRADO, SEMBRADO),
    /no se siembra de sí mismo/,
  )
})

test("sembrar desde un proyecto ajeno se rechaza por la fuente", async () => {
  // La segunda capa se aplica sobre la fuente aparte: alcanzar el destino no
  // habilita leer el catálogo de un proyecto del que no se es miembro.
  assert.equal(
    await rechazaPorMembresia(() => sembrar(SEMBRADO, AJENO)),
    true,
  )
})

test("sembrar desde otro proyecto copia lo que ese proyecto ve", async () => {
  // El segundo proyecto para el mismo cliente copia del primero, que es el caso
  // que esta fuente existe para cubrir.
  await declarar(SEGUNDO)
  await declararAlcance(SEGUNDO, DocScopeMode.OWN)

  const res = await sembrar(SEGUNDO, SEMBRADO)

  assert.equal(res.added > 0, true)
  assert.equal((await clasesQueVe(SEGUNDO)).includes(`${CODIGO}-CIVIL`), true)
})

test("la siembra deja el acto en la traza, aunque no agregue nada", async () => {
  const antes = await prisma.docAuditEvent.count({
    where: { action: AuditAction.SeedClassification, docProjectId: null },
  })

  await sembrar(SEMBRADO)

  const despues = await prisma.docAuditEvent.count({
    where: { action: AuditAction.SeedClassification, docProjectId: null },
  })

  assert.equal(despues, antes + 1)
})

test("una clase dada de baja no viaja, y su tipo tampoco", async () => {
  await declarar(TERCERO)
  await declararAlcance(TERCERO, DocScopeMode.OWN)

  const baja = await crearClase({ code: "BAJA", name: `${CODIGO} De baja` })
  await crearTipo({ code: "BAJA-T", name: `${CODIGO} Tipo de baja`, classId: baja.id })
  await documentClassResolvers.Mutation.terminateDocumentClass(
    null,
    { id: baja.id },
    context,
  )

  await sembrar(TERCERO)

  const copiadas = await prisma.documentClass.findMany({
    where: { docProjectId: TERCERO, code: `${CODIGO}-BAJA` },
  })
  const copiados = await prisma.documentType.findMany({
    where: { docProjectId: TERCERO, code: `${CODIGO}-BAJA-T` },
  })

  assert.equal(copiadas.length, 0)
  assert.equal(copiados.length, 0)
})

// --- Las invariantes de cruce (B7) ---

test("un tipo del proyecto puede colgar de una clase del despliegue", async () => {
  // Es lo que significa ampliar: el proyecto agrega un tipo dentro de una clase
  // que ya existe.
  const tipo = await crearTipo({
    code: "AMPLIA",
    name: `${CODIGO} Amplía`,
    docProjectId: HEREDA,
    classId: global1.id,
  })

  assert.equal(tipo.docProjectId, HEREDA)
  assert.equal(tipo.classId, global1.id)
})

test("un tipo del despliegue no puede colgar de una clase de proyecto", async () => {
  const delProyecto = await crearClase({
    code: "SOLO-P",
    name: `${CODIGO} Solo del proyecto`,
    docProjectId: HEREDA,
  })

  await assert.rejects(
    () =>
      crearTipo({
        code: "CRUZA",
        name: `${CODIGO} Cruza`,
        classId: delProyecto.id,
      }),
    /no puede colgar de una clase de proyecto/,
  )
})

test("un tipo de un proyecto no puede colgar de una clase de otro", async () => {
  const deOtro = await prisma.documentClass.findFirstOrThrow({
    where: { docProjectId: PROPIO, code: `${CODIGO}-CIVIL-P` },
  })

  await assert.rejects(
    () =>
      crearTipo({
        code: "CRUZA-2",
        name: `${CODIGO} Cruza entre proyectos`,
        docProjectId: HEREDA,
        classId: deOtro.id,
      }),
    /no puede colgar de una clase de proyecto/,
  )
})

test("mover un tipo del despliegue a una clase de proyecto se rechaza al editar", async () => {
  // El cruce se verifica también al editar: mover cruza igual que crear ahí.
  const delDespliegue = await crearTipo({
    code: "MUEVE",
    name: `${CODIGO} Se mueve`,
  })
  const delProyecto = await prisma.documentClass.findFirstOrThrow({
    where: { docProjectId: HEREDA, code: `${CODIGO}-SOLO-P` },
  })

  await assert.rejects(
    () =>
      documentTypeResolvers.Mutation.updateDocumentType(
        null,
        { id: delDespliegue.id, input: { classId: delProyecto.id } },
        context,
      ) as Promise<any>,
    /no puede colgar de una clase de proyecto/,
  )
})

test("declarar catálogo propio se rechaza con tipos colgando del despliegue", async () => {
  // Al dejar de heredar, el tipo que agregó HEREDA quedaría apuntando a una
  // clase que el proyecto ya no ve.
  await assert.rejects(
    () => declararAlcance(HEREDA, DocScopeMode.OWN),
    /cuelgan de una clase del despliegue/,
  )
})

// --- El alcance de la entrada elegida (B7) ---

test("un documento no se clasifica con una entrada fuera de su alcance", async () => {
  const tipoAjeno = await prisma.documentType.findFirstOrThrow({
    where: { docProjectId: PROPIO, code: `${CODIGO}-PLANO-P` },
  })

  await assert.rejects(
    () =>
      documentResolvers.Mutation.createDocument(
        null,
        {
          input: {
            code: `${CODIGO}-DOC-1`,
            title: "Documento fuera de alcance",
            docProjectId: HEREDA,
            module: ModuleType.PROJECTS,
            documentTypeId: tipoAjeno.id,
          },
        } as any,
        context,
      ) as Promise<any>,
    /no pertenece al catálogo que este ámbito resuelve/,
  )
})

test("una plantilla del despliegue no referencia entradas de proyecto", async () => {
  const claseDeProyecto = await prisma.documentClass.findFirstOrThrow({
    where: { docProjectId: PROPIO, code: `${CODIGO}-CIVIL-P` },
  })

  await assert.rejects(
    () =>
      workflowTemplateResolvers.Mutation.createDocWorkflowTemplate(
        null,
        {
          input: {
            name: `${CODIGO} plantilla global`,
            documentClassId: claseDeProyecto.id,
            steps: [{ stepOrder: 1, stepType: StepType.APPROVE }],
          },
        } as any,
        context,
      ) as Promise<any>,
    /no pertenece al catálogo que este ámbito resuelve/,
  )
})

// --- Lo dado de baja no se elige (B9) ---

test("un documento no se clasifica con una clase dada de baja", async () => {
  const clase = await crearClase({ code: "BAJA-C", name: `${CODIGO} Baja` })
  const tipo = await crearTipo({
    code: "BAJA-VIG",
    name: `${CODIGO} Tipo vigente`,
    classId: clase.id,
  })
  await documentClassResolvers.Mutation.terminateDocumentClass(
    null,
    { id: clase.id },
    context,
  )

  await assert.rejects(
    () =>
      documentResolvers.Mutation.createDocument(
        null,
        {
          input: {
            code: `${CODIGO}-DOC-BAJA`,
            title: "Con clase dada de baja",
            docProjectId: HEREDA,
            module: ModuleType.PROJECTS,
            documentTypeId: tipo.id,
            documentClassId: clase.id,
          },
        } as any,
        context,
      ) as Promise<any>,
    /dada de baja/,
  )
})

test("un documento no se clasifica con un tipo dado de baja", async () => {
  const tipo = await crearTipo({ code: "BAJA-T2", name: `${CODIGO} Tipo baja` })
  await documentTypeResolvers.Mutation.terminateDocumentType(
    null,
    { id: tipo.id },
    context,
  )

  await assert.rejects(
    () =>
      documentResolvers.Mutation.createDocument(
        null,
        {
          input: {
            code: `${CODIGO}-DOC-BAJA-T`,
            title: "Con tipo dado de baja",
            docProjectId: HEREDA,
            module: ModuleType.PROJECTS,
            documentTypeId: tipo.id,
          },
        } as any,
        context,
      ) as Promise<any>,
    /dado de baja/,
  )
})

test("lo ya clasificado conserva su entrada aunque se dé de baja después", async () => {
  // D-13: la validación ocurre solo en escritura y nunca revalida lo existente.
  // Es lo que distingue "no se elige" de "deja de valer".
  const clase = await crearClase({ code: "VIVE", name: `${CODIGO} Vive` })
  const tipo = await crearTipo({
    code: "VIVE-T",
    name: `${CODIGO} Tipo vive`,
    classId: clase.id,
  })

  const doc = (await documentResolvers.Mutation.createDocument(
    null,
    {
      input: {
        code: `${CODIGO}-DOC-VIVE`,
        title: "Clasificado antes de la baja",
        docProjectId: HEREDA,
        module: ModuleType.PROJECTS,
        documentTypeId: tipo.id,
        documentClassId: clase.id,
      },
    } as any,
    context,
  )) as any

  await documentTypeResolvers.Mutation.terminateDocumentType(
    null,
    { id: tipo.id },
    context,
  )

  const despues = await prisma.document.findUniqueOrThrow({
    where: { id: doc.id },
    select: { currentDocumentTypeId: true },
  })
  assert.equal(despues.currentDocumentTypeId, tipo.id)
})
