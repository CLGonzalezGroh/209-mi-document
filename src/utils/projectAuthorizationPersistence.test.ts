import assert from "node:assert/strict"
import test, { after } from "node:test"
import { prisma } from "../lib/prisma.js"
import { DocProjectSide } from "../generated/prisma/enums.js"
import { ResolverContext } from "../types.js"
import { buildProjectScope, listMemberProjectIds } from "./projectAuthorization.js"

/**
 * Verificación de la segunda capa de autorización contra la base.
 *
 * Requiere la base local (`npm run test:project-scope-db`). Cubre lo que la
 * suite pura no puede: que la membresía vigente sea la que efectivamente
 * determina el alcance, y que la baja lo retire.
 *
 * No atraviesa `userAuthorization`, que exige JWT y una consulta a mi-admin.
 * La primera capa queda fuera de esta suite, del mismo modo que `BLOCK_01`
 * difirió la verificación de extremo a extremo.
 *
 * Se usan identificadores fuera de rango para no interferir con datos
 * existentes, y se limpian los registros al terminar.
 */

const USER_ID = -424242
const OTRO_USER_ID = -424243
const PROYECTO_A = -424301
const PROYECTO_B = -424302

// El contexto real trae además el token, que esta capa no usa.
const context = { orm: prisma } as ResolverContext

const limpiar = async () => {
  await prisma.docProjectMember.deleteMany({
    where: { userId: { in: [USER_ID, OTRO_USER_ID] } },
  })
}

const afiliar = async (
  userId: number,
  projectId: number,
  side: DocProjectSide = DocProjectSide.HOST,
) =>
  prisma.docProjectMember.create({
    data: { userId, projectId, side, assignedById: USER_ID },
  })

after(async () => {
  await limpiar()
  await prisma.$disconnect()
})

test("sin membresías, el alcance es vacío", async () => {
  await limpiar()

  assert.deepEqual(await listMemberProjectIds(USER_ID, context), [])
})

test("el alcance son los proyectos con membresía vigente", async () => {
  await limpiar()
  await afiliar(USER_ID, PROYECTO_A)
  await afiliar(USER_ID, PROYECTO_B, DocProjectSide.COUNTERPARTY)

  const ids = await listMemberProjectIds(USER_ID, context)
  const ordenar = (xs: number[]) => [...xs].sort((a, b) => a - b)

  assert.deepEqual(ordenar(ids), ordenar([PROYECTO_A, PROYECTO_B]))
})

test("la membresía de otro usuario no amplía el alcance propio", async () => {
  await limpiar()
  await afiliar(USER_ID, PROYECTO_A)
  await afiliar(OTRO_USER_ID, PROYECTO_B)

  assert.deepEqual(await listMemberProjectIds(USER_ID, context), [PROYECTO_A])
})

test("la baja de la membresía retira el acceso", async () => {
  await limpiar()
  const membresia = await afiliar(USER_ID, PROYECTO_A)

  assert.deepEqual(await listMemberProjectIds(USER_ID, context), [PROYECTO_A])

  await prisma.docProjectMember.update({
    where: { id: membresia.id },
    data: { isActive: false, revokedAt: new Date(), revokedById: USER_ID },
  })

  assert.deepEqual(await listMemberProjectIds(USER_ID, context), [])
})

test("una membresía inactiva sin fecha de baja tampoco habilita", async () => {
  await limpiar()
  const membresia = await afiliar(USER_ID, PROYECTO_A)

  await prisma.docProjectMember.update({
    where: { id: membresia.id },
    data: { isActive: false },
  })

  assert.deepEqual(await listMemberProjectIds(USER_ID, context), [])
})

test("la membresía es única por par usuario–proyecto", async () => {
  await limpiar()
  await afiliar(USER_ID, PROYECTO_A)

  await assert.rejects(() => afiliar(USER_ID, PROYECTO_A), /Unique constraint/)
})

test("el filtro derivado de las membresías se aplica sobre documentos reales", async () => {
  await limpiar()
  await afiliar(USER_ID, PROYECTO_A)

  const ids = await listMemberProjectIds(USER_ID, context)
  const scope = buildProjectScope(ids, { includeWithoutProject: true })

  // No se prueba el resultado, que depende de los datos, sino que el fragmento
  // construido sea un `where` válido para Prisma: si la forma fuera incorrecta,
  // la consulta fallaría.
  assert.equal(typeof (await prisma.document.count({ where: scope })), "number")
})
