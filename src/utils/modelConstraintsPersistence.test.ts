import assert from "node:assert/strict"
import test, { after, before } from "node:test"
import { readFileSync } from "node:fs"
import { prisma } from "../lib/prisma.js"
import {
  DocCatalogKind,
  DocFileRole,
  DocLocationOrigin,
  DocReplacementRole,
  DocScopeMode,
  ModuleType,
  RevisionStatus,
  StepStatus,
  StepType,
  WorkflowStatus,
} from "../generated/prisma/enums.js"

/**
 * Restricciones del modelo del ciclo interno, contra la base (BLOQUE 03).
 *
 * Son invariantes que **la aplicación no puede garantizar sola**: dos peticiones
 * concurrentes pueden pasar la misma precondición y escribir las dos. Por eso
 * viven en índices, y por eso la evidencia tiene que ser esta y no una prueba
 * pura. En la fase B se verificaron a mano; acá quedan automatizadas.
 *
 * Requiere la base local (`npm run test:model-constraints-db`).
 */

const CODIGO = "TEST-CONSTRAINTS"
const PROYECTO = -424405

let documentTypeId: number
let documentId: number

const esViolacionDeUnicidad = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: string }).code === "P2002"

/** Ejecuta el alta y devuelve si la base la rechazó por unicidad. */
const rechazaPorUnicidad = async (fn: () => Promise<unknown>) => {
  try {
    await fn()
    return false
  } catch (error) {
    if (esViolacionDeUnicidad(error)) return true
    throw error
  }
}

const esViolacionDeCheck = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { message?: string }).message?.includes(
    "doc_locations_external_reference_complete",
  ) === true

/** Ejecuta el alta y devuelve si la base la rechazó por el CHECK. */
const rechazaPorCheck = async (fn: () => Promise<unknown>) => {
  try {
    await fn()
    return false
  } catch (error) {
    if (esViolacionDeCheck(error)) return true
    throw error
  }
}

const limpiar = async () => {
  // La descendencia primero: la clave del árbol es RESTRICT, de modo que un
  // borrado que llegue al padre antes que al hijo se rechaza. Las pruebas de
  // ubicación no pasan de dos niveles.
  await prisma.docLocation.deleteMany({
    where: { code: { startsWith: `${CODIGO}-L` }, parentId: { not: null } },
  })
  await prisma.docLocation.deleteMany({
    where: { code: { startsWith: `${CODIGO}-L` } },
  })
  await prisma.docCatalogScope.deleteMany({
    where: { projectId: { in: [-424406, -424407, -424408, -424409] } },
  })
  // La declaración de MÓDULO no tiene proyecto, de modo que la limpieza de
  // arriba no la alcanza (BLOQUE 02C, B6). Se borra por su forma exacta y no
  // por el módulo suelto: hoy ninguna operación produce filas de módulo, y el
  // día que exista esta prueba no debe barrer las suyas.
  await prisma.docCatalogScope.deleteMany({
    where: {
      projectId: null,
      module: ModuleType.QUALITY,
      catalog: DocCatalogKind.CLASSIFICATION,
    },
  })
  await prisma.document.deleteMany({ where: { code: { startsWith: CODIGO } } })
  await prisma.docWorkflowTemplate.deleteMany({ where: { projectId: PROYECTO } })
  await prisma.documentType.deleteMany({
    where: { code: { startsWith: `${CODIGO}-T` } },
  })
  await prisma.documentClass.deleteMany({
    where: { code: { startsWith: `${CODIGO}-C` } },
  })
}

before(async () => {
  await limpiar()

  const tipo = await prisma.documentType.create({
    data: { name: `${CODIGO} tipo base`, code: `${CODIGO}-T0` },
  })
  documentTypeId = tipo.id

  const documento = await prisma.document.create({
    data: {
      code: `${CODIGO}-1`,
      currentTitle: "Documento de restricciones",
      module: ModuleType.PROJECTS,
      projectId: PROYECTO,
      currentDocumentTypeId: documentTypeId,
      createdById: 1,
    },
  })
  documentId = documento.id
})

after(async () => {
  await limpiar()
  await prisma.$disconnect()
})

const crearRevision = (revisionCode: string, status: RevisionStatus) =>
  prisma.documentRevision.create({
    data: {
      documentId,
      revisionCode,
      status,
      assignedOrganizerId: 1,
      title: "Documento de restricciones",
      documentTypeId,
      createdById: 1,
    },
  })

const crearCircuito = (revisionId: number, status: WorkflowStatus) =>
  prisma.reviewWorkflow.create({
    data: { revisionId, status, initiatedById: 1 },
  })

// --- B12: la revisión abandonada no consume código ---

test("varias revisiones abandonadas comparten código", async () => {
  // Tres intentos de B abandonados es correcto: cada uno se distingue por su
  // fecha y su motivo.
  const primera = await crearRevision("X", RevisionStatus.ABANDONED)
  const segunda = await crearRevision("X", RevisionStatus.ABANDONED)

  assert.notEqual(primera.id, segunda.id)
  assert.equal(primera.revisionCode, segunda.revisionCode)
})

test("una revisión viva convive con las abandonadas del mismo código", async () => {
  const viva = await crearRevision("X", RevisionStatus.DRAFT)
  assert.equal(viva.status, RevisionStatus.DRAFT)
})

test("dos revisiones vivas con el mismo código se rechazan", async () => {
  assert.equal(
    await rechazaPorUnicidad(() =>
      crearRevision("X", RevisionStatus.IN_REVIEW),
    ),
    true,
  )
})

test("aprobar y luego abandonar no libera el código de la aprobada", async () => {
  await crearRevision("Y", RevisionStatus.APPROVED)

  assert.equal(
    await rechazaPorUnicidad(() => crearRevision("Y", RevisionStatus.DRAFT)),
    true,
  )
})

// --- B2: un solo circuito abierto por revisión ---

test("una revisión acumula circuitos cerrados y uno solo abierto", async () => {
  // Es lo que cierra H-01: el rechazo abre un circuito nuevo en lugar de dejar
  // al documento sin salida.
  const revision = await crearRevision("W1", RevisionStatus.DRAFT)

  await crearCircuito(revision.id, WorkflowStatus.CANCELLED)
  await crearCircuito(revision.id, WorkflowStatus.REJECTED)
  await crearCircuito(revision.id, WorkflowStatus.COMPLETED)
  await crearCircuito(revision.id, WorkflowStatus.IN_PROGRESS)

  assert.equal(
    await prisma.reviewWorkflow.count({ where: { revisionId: revision.id } }),
    4,
  )
})

test("un segundo circuito abierto sobre la misma revisión se rechaza", async () => {
  const revision = await prisma.documentRevision.findFirstOrThrow({
    where: { documentId, revisionCode: "W1" },
  })

  assert.equal(
    await rechazaPorUnicidad(() =>
      crearCircuito(revision.id, WorkflowStatus.IN_PROGRESS),
    ),
    true,
  )
})

test("cerrar el circuito abierto habilita abrir el siguiente", async () => {
  const revision = await prisma.documentRevision.findFirstOrThrow({
    where: { documentId, revisionCode: "W1" },
  })
  const abierto = await prisma.reviewWorkflow.findFirstOrThrow({
    where: { revisionId: revision.id, status: WorkflowStatus.IN_PROGRESS },
  })

  await prisma.reviewWorkflow.update({
    where: { id: abierto.id },
    data: { status: WorkflowStatus.REJECTED },
  })

  const nuevo = await crearCircuito(revision.id, WorkflowStatus.IN_PROGRESS)
  assert.equal(nuevo.status, WorkflowStatus.IN_PROGRESS)
})

// --- B15: los catálogos con NULLS NOT DISTINCT ---

test("dos clases sin módulo con el mismo nombre se rechazan", async () => {
  // El caso que la restricción anterior NO impedía, y el más frecuente en un
  // catálogo recién sembrado (H-19).
  await prisma.documentClass.create({
    data: { name: `${CODIGO} clase`, code: `${CODIGO}-C1`, module: null },
  })

  assert.equal(
    await rechazaPorUnicidad(() =>
      prisma.documentClass.create({
        data: { name: `${CODIGO} clase`, code: `${CODIGO}-C2`, module: null },
      }),
    ),
    true,
  )
})

test("dos clases sin módulo con el mismo código se rechazan", async () => {
  assert.equal(
    await rechazaPorUnicidad(() =>
      prisma.documentClass.create({
        data: { name: `${CODIGO} otra`, code: `${CODIGO}-C1`, module: null },
      }),
    ),
    true,
  )
})

test("la misma clase en otro módulo sí se admite", async () => {
  const otra = await prisma.documentClass.create({
    data: {
      name: `${CODIGO} clase`,
      code: `${CODIGO}-C1`,
      module: ModuleType.QUALITY,
    },
  })
  assert.equal(otra.module, ModuleType.QUALITY)
})

test("dos tipos sin módulo ni clase con el mismo nombre se rechazan", async () => {
  await prisma.documentType.create({
    data: { name: `${CODIGO} tipo`, code: `${CODIGO}-T1`, module: null, classId: null },
  })

  assert.equal(
    await rechazaPorUnicidad(() =>
      prisma.documentType.create({
        data: {
          name: `${CODIGO} tipo`,
          code: `${CODIGO}-T2`,
          module: null,
          classId: null,
        },
      }),
    ),
    true,
  )
})

test("dos tipos sin módulo ni clase con el mismo código se rechazan", async () => {
  assert.equal(
    await rechazaPorUnicidad(() =>
      prisma.documentType.create({
        data: {
          name: `${CODIGO} otro`,
          code: `${CODIGO}-T1`,
          module: null,
          classId: null,
        },
      }),
    ),
    true,
  )
})

// --- B3: el alcance de la plantilla, también con nulos ---

test("dos plantillas con el mismo alcance nulo se rechazan", async () => {
  await prisma.docWorkflowTemplate.create({
    data: { name: `${CODIGO} plantilla`, projectId: PROYECTO, createdById: 1 },
  })

  assert.equal(
    await rechazaPorUnicidad(() =>
      prisma.docWorkflowTemplate.create({
        data: {
          name: `${CODIGO} repetida`,
          projectId: PROYECTO,
          createdById: 1,
        },
      }),
    ),
    true,
  )
})

test("el refinamiento por clase es otro alcance y se admite", async () => {
  const clase = await prisma.documentClass.findFirstOrThrow({
    where: { code: `${CODIGO}-C1`, module: null },
  })

  const refinada = await prisma.docWorkflowTemplate.create({
    data: {
      name: `${CODIGO} por clase`,
      projectId: PROYECTO,
      documentClassId: clase.id,
      createdById: 1,
    },
  })
  assert.equal(refinada.documentClassId, clase.id)
})

// --- B4 y B7: la evidencia no se modifica ---

test("un paso admite una sola firma", async () => {
  const revision = await crearRevision("S1", RevisionStatus.DRAFT)
  const circuito = await crearCircuito(revision.id, WorkflowStatus.IN_PROGRESS)
  const paso = await prisma.reviewStep.create({
    data: {
      workflowId: circuito.id,
      stepOrder: 1,
      stepType: StepType.APPROVE,
      assignedToId: 1,
      status: StepStatus.PENDING,
    },
  })

  await prisma.docStepSignature.create({
    data: { stepId: paso.id, payload: "{}", hash: "h1", createdById: 1 },
  })

  assert.equal(
    await rechazaPorUnicidad(() =>
      prisma.docStepSignature.create({
        data: { stepId: paso.id, payload: "{}", hash: "h2", createdById: 1 },
      }),
    ),
    true,
  )
})

test("el contrato no expone ninguna operación que modifique una versión o una firma", async () => {
  // H-34: la versión es inmutable, y eso incluye su comentario. No hay
  // restricción de base que lo garantice —una columna no impide un UPDATE—, de
  // modo que el invariante vive en que la operación NO EXISTA. Esta prueba
  // impide que aparezca sin que nadie lo note.
  const contrato = readFileSync("./schema.graphql", { encoding: "utf-8" })
  const mutaciones = contrato
    .slice(contrato.indexOf("type Mutation {"))
    .split("\n")
    .map((l) => l.trim().match(/^([a-zA-Z]+)\s*[(:]/)?.[1])
    .filter((n): n is string => Boolean(n))

  const prohibidas = mutaciones.filter((n) =>
    /^(update|delete|terminate|modify)(Document)?(Version|StepSignature|Signature)/i.test(
      n,
    ),
  )

  assert.deepEqual(prohibidas, [])

  // La versión la produce `confirmWorkingCopy` (BLOQUE 03B, B12). `registerVersion`
  // se retiró: la versión dejó de ser un archivo y pasó a ser un CONJUNTO, de modo
  // que "registrar la versión" dejó de ser un acto único.
  assert.ok(mutaciones.includes("confirmWorkingCopy"))
  assert.ok(!mutaciones.includes("registerVersion"))

  // Y las operaciones de la copia de trabajo NO son excepciones a la
  // inmutabilidad: operan sobre el conjunto en preparación, que todavía no es
  // una versión. Por eso ninguna se llama `updateVersion`.
  for (const esperada of [
    "openWorkingCopy",
    "putWorkingCopyFile",
    "removeWorkingCopyFile",
    "discardWorkingCopy",
  ]) {
    assert.ok(mutaciones.includes(esperada), `falta ${esperada}`)
  }
})

// --- B5: la secuencia de versiones es de la revisión, no del circuito ---

test("la secuencia de versiones no se reinicia con cada circuito", async () => {
  // Las versiones pertenecen a la REVISIÓN: el rechazo abre un circuito nuevo y
  // la numeración continúa, porque lo que se corrige es el mismo entregable.
  const revision = await crearRevision("V1", RevisionStatus.DRAFT)
  await crearCircuito(revision.id, WorkflowStatus.REJECTED)
  await crearCircuito(revision.id, WorkflowStatus.IN_PROGRESS)

  for (const n of [1, 2, 3]) {
    await prisma.documentVersion.create({
      data: {
        revisionId: revision.id,
        versionNumber: n,
        createdById: 1,
        files: {
          create: {
            role: DocFileRole.DELIVERABLE,
            fileKey: `k${n}`,
            fileName: `f${n}.pdf`,
            fileSize: 1,
            mimeType: "application/pdf",
            checksum: `${n}`.repeat(64),
          },
        },
      },
    })
  }

  assert.equal(
    await rechazaPorUnicidad(() =>
      prisma.documentVersion.create({
        data: {
          revisionId: revision.id,
          versionNumber: 3,
          createdById: 1,
          files: {
            create: {
              role: DocFileRole.DELIVERABLE,
              fileKey: "kx",
              fileName: "fx.pdf",
              fileSize: 1,
              mimeType: "application/pdf",
              checksum: "x".repeat(64),
            },
          },
        },
      }),
    ),
    true,
  )

  const versiones = await prisma.documentVersion.findMany({
    where: { revisionId: revision.id },
    orderBy: { versionNumber: "asc" },
  })
  assert.deepEqual(
    versiones.map((v) => v.versionNumber),
    [1, 2, 3],
  )
})

test("todo archivo de la versión exige checksum", async () => {
  // El checksum es obligatorio en CADA archivo, con el mismo fundamento que
  // antes lo volvía obligatorio en la versión (BLOQUE 03B, B7): es lo que la
  // firma acredita.
  const version = await prisma.documentVersion.findFirstOrThrow({
    where: { revision: { documentId, revisionCode: "V1" } },
  })

  await assert.rejects(() =>
    prisma.$executeRaw`
      INSERT INTO doc_version_files ("versionId", "role", "fileKey", "fileName", "fileSize", "mimeType")
      VALUES (${version.id}, 'DELIVERABLE', 'k9', 'f9.pdf', 1, 'application/pdf')
    `,
  )
})

test("un archivo no se repite dentro de la misma versión", async () => {
  const version = await prisma.documentVersion.findFirstOrThrow({
    where: { revision: { documentId, revisionCode: "V1" } },
  })

  const archivo = (fileKey: string, role: DocFileRole) =>
    prisma.docVersionFile.create({
      data: {
        versionId: version.id,
        role,
        fileKey,
        fileName: `${fileKey}.dwg`,
        fileSize: 1,
        mimeType: "image/vnd.dwg",
        checksum: "d".repeat(64),
      },
    })

  // El mismo archivo con otro rol tampoco: la unicidad es por fileKey
  await archivo("fuente", DocFileRole.SOURCE)
  assert.equal(
    await rechazaPorUnicidad(() => archivo("fuente", DocFileRole.SUPPORT)),
    true,
  )
})

test("a lo sumo una copia de trabajo abierta por revisión", async () => {
  // El mismo invariante que el módulo ya aplica a la revisión en curso y al
  // circuito abierto, en un tercer nivel (BLOQUE 03B, B12).
  const revision = await crearRevision("WC1", RevisionStatus.DRAFT)

  const abrir = () =>
    prisma.docWorkingCopy.create({
      data: { revisionId: revision.id, createdById: 1 },
    })

  const primera = await abrir()
  assert.equal(await rechazaPorUnicidad(abrir), true)

  // Descartada la primera, se puede abrir otra: el índice es PARCIAL
  await prisma.docWorkingCopy.update({
    where: { id: primera.id },
    data: {
      discardedAt: new Date(),
      discardedById: 1,
      discardReason: "se rehace",
    },
  })
  const segunda = await abrir()
  assert.ok(segunda.id !== primera.id)
})

test("un documento no se repite con el mismo papel en un acto de reemplazo", async () => {
  const acto = await prisma.docReplacement.create({
    data: { reason: "unificación de planos", createdById: 1 },
  })

  const item = (role: DocReplacementRole) =>
    prisma.docReplacementItem.create({
      data: { replacementId: acto.id, documentId, role },
    })

  await item(DocReplacementRole.REPLACED)
  assert.equal(await rechazaPorUnicidad(() => item(DocReplacementRole.REPLACED)), true)

  // Con el otro papel sí entra: la unicidad es por la terna, no por el par
  const reemplazante = await item(DocReplacementRole.REPLACING)
  assert.equal(reemplazante.role, DocReplacementRole.REPLACING)

  await prisma.docReplacement.delete({ where: { id: acto.id } })
})

// --- BLOQUE 02B, B5 a B7: el catálogo de ubicación física ---

const crearUbicacion = (
  code: string,
  extra: {
    parentId?: number | null
    projectId?: number | null
    name?: string
    externalOrigin?: DocLocationOrigin | null
    externalRef?: string | null
  } = {},
) =>
  prisma.docLocation.create({
    data: {
      code,
      name: extra.name ?? code,
      path: extra.name ?? code,
      parentId: extra.parentId ?? null,
      projectId: extra.projectId ?? null,
      externalOrigin: extra.externalOrigin ?? null,
      externalRef: extra.externalRef ?? null,
      createdById: 1,
    },
  })

test("dos ubicaciones raíz con el mismo código se rechazan", async () => {
  // Es el caso que exige NULLS NOT DISTINCT: sin la cláusula, dos nodos con
  // `parentId` nulo no se consideran duplicados, y en un catálogo plano son
  // TODOS los nodos. Es H-19 en el nivel del árbol.
  await crearUbicacion(`${CODIGO}-L1`)

  assert.equal(
    await rechazaPorUnicidad(() => crearUbicacion(`${CODIGO}-L1`)),
    true,
  )
})

test("dos proyectos nombran igual su propio nodo raíz", async () => {
  // El alcance entra en la tupla de unicidad (B1): el código de un proyecto no
  // choca con el de otro, ni con el del despliegue.
  const A = -424406
  const B = -424407

  const enA = await crearUbicacion(`${CODIGO}-LS`, { projectId: A })
  const enB = await crearUbicacion(`${CODIGO}-LS`, { projectId: B })
  const enDespliegue = await crearUbicacion(`${CODIGO}-LS`)

  assert.equal(new Set([enA.id, enB.id, enDespliegue.id]).size, 3)

  // Y dentro del mismo alcance sigue sin repetirse.
  assert.equal(
    await rechazaPorUnicidad(() =>
      crearUbicacion(`${CODIGO}-LS`, { projectId: A }),
    ),
    true,
  )
})

test("un nodo de proyecto cuelga de uno del despliegue: eso es ampliar", async () => {
  // El cruce de alcance en ese sentido lo admite la BASE —la clave no lo mira— y
  // la invariante del sentido contrario vive en la operación, porque exige mirar
  // el padre y no es expresable en un CHECK.
  const area = await crearUbicacion(`${CODIGO}-LG`)
  const ampliacion = await crearUbicacion(`${CODIGO}-LU`, {
    parentId: area.id,
    projectId: -424408,
  })

  assert.equal(ampliacion.parentId, area.id)
  assert.equal(ampliacion.projectId, -424408)
})

test("el alcance de un catálogo se declara una sola vez por ámbito", async () => {
  const proyecto = -424409

  const declarar = (mode: DocScopeMode) =>
    prisma.docCatalogScope.create({
      data: {
        module: ModuleType.PROJECTS,
        projectId: proyecto,
        catalog: DocCatalogKind.LOCATION,
        mode,
        createdById: 1,
      },
    })

  await declarar(DocScopeMode.OWN)
  assert.equal(await rechazaPorUnicidad(() => declarar(DocScopeMode.INHERIT)), true)

  // El otro catálogo del mismo proyecto sí entra: la unicidad es por el ámbito
  // y el catálogo. Son dos y no tres —clasificación y ubicación— porque clase y
  // tipo declaran juntos (BLOQUE 02C, B1).
  const otro = await prisma.docCatalogScope.create({
    data: {
      module: ModuleType.PROJECTS,
      projectId: proyecto,
      catalog: DocCatalogKind.CLASSIFICATION,
      mode: DocScopeMode.OWN,
      createdById: 1,
    },
  })
  assert.equal(otro.catalog, DocCatalogKind.CLASSIFICATION)
})

test("el módulo declara su alcance sin proyecto, y no choca con el de un proyecto", async () => {
  // El eje de módulo es lo que impide que la ausencia de proyecto equivalga al
  // despliegue (BLOQUE 02C, B6). Todavía no hay operación que lo produzca: lo
  // que esta prueba fija es que la estructura ya lo admite.
  const calidad = await prisma.docCatalogScope.create({
    data: {
      module: ModuleType.QUALITY,
      catalog: DocCatalogKind.CLASSIFICATION,
      mode: DocScopeMode.OWN,
      createdById: 1,
    },
  })

  assert.equal(calidad.projectId, null)

  // Y la unicidad lo alcanza con NULLS NOT DISTINCT: sin la cláusula, dos
  // declaraciones de módulo no se considerarían duplicadas.
  assert.equal(
    await rechazaPorUnicidad(() =>
      prisma.docCatalogScope.create({
        data: {
          module: ModuleType.QUALITY,
          catalog: DocCatalogKind.CLASSIFICATION,
          mode: DocScopeMode.INHERIT,
          createdById: 1,
        },
      }),
    ),
    true,
  )
})

test("el mismo código bajo otro padre sí se admite", async () => {
  // La unicidad es por nivel y no global: dos plantas pueden tener su "100".
  const plantaA = await crearUbicacion(`${CODIGO}-LA`)
  const plantaB = await crearUbicacion(`${CODIGO}-LB`)

  const enA = await crearUbicacion(`${CODIGO}-L100`, { parentId: plantaA.id })
  const enB = await crearUbicacion(`${CODIGO}-L100`, { parentId: plantaB.id })

  assert.ok(enA.id !== enB.id)

  // Y dentro del mismo padre no se repite.
  assert.equal(
    await rechazaPorUnicidad(() =>
      crearUbicacion(`${CODIGO}-L100`, { parentId: plantaA.id }),
    ),
    true,
  )
})

test("eliminar un nodo con descendencia lo rechaza la base", async () => {
  // La operación lo verifica antes para dar un mensaje, pero la garantía es de
  // la clave: RESTRICT y no CASCADE, para que la base no resuelva borrando en
  // silencio una rama entera.
  const padre = await crearUbicacion(`${CODIGO}-LP`)
  await crearUbicacion(`${CODIGO}-LH`, { parentId: padre.id })

  await assert.rejects(() =>
    prisma.docLocation.delete({ where: { id: padre.id } }),
  )
})

test("la referencia externa se declara completa o no se declara", async () => {
  // Los dos campos viajan juntos (B7): un origen sin identificador no dice
  // nada. El resolver lo rechaza antes para dar un mensaje; el CHECK es lo que
  // lo garantiza contra cualquier escritura.
  const completa = await crearUbicacion(`${CODIGO}-LX`, {
    externalOrigin: DocLocationOrigin.ASSETS,
    externalRef: "TAG-110",
  })
  assert.equal(completa.externalRef, "TAG-110")

  assert.equal(
    await rechazaPorCheck(() =>
      crearUbicacion(`${CODIGO}-LY`, {
        externalOrigin: DocLocationOrigin.ASSETS,
      }),
    ),
    true,
  )

  assert.equal(
    await rechazaPorCheck(() =>
      crearUbicacion(`${CODIGO}-LZ`, { externalRef: "TAG-120" }),
    ),
    true,
  )
})
