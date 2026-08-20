import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { userAuthorization } from "./userAuthorization.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"
import { DocObjectType, DocProjectStatus } from "../generated/prisma/enums.js"
import { resolveObjectContext } from "./objectContext.js"

const logger = createLogger("projectAuthorization")

/**
 * Autorización acotada por proyecto (BLOQUE 02, D-15 y B7).
 *
 * La autorización efectiva combina dos capas:
 *  1) el permiso global, validado contra mi-admin (userAuthorization);
 *  2) la membresía vigente del usuario en el proyecto (DocProjectMember).
 *
 * La segunda capa se aplica de DOS FORMAS, según la operación tenga o no un
 * proyecto determinable:
 *
 *  - operaciones sobre un objeto  → `projectAuthorization`, que exige membresía
 *    y rechaza si no la hay;
 *  - listados sin proyecto en los argumentos → `projectScopeAuthorization`, que
 *    no puede exigir membresía en un proyecto que la consulta no nombra y por lo
 *    tanto restringe el conjunto de resultados.
 *
 * La distinción es deliberada: un listado que rechazara por falta de membresía
 * sería inutilizable, y un objeto que solo filtrara dejaría el acceso abierto.
 *
 * Se adopta el patrón de `projectAuthorization` (ADR-020) de OperMask
 * Digitalization, con la diferencia de que acá `docProjectId` puede ser nulo.
 */

/** Membresía vigente: dada de alta, activa y sin baja registrada. */
const ACTIVE_MEMBERSHIP = { isActive: true, revokedAt: null } as const

/**
 * Fragmento de filtro aplicable a cualquier modelo que exponga `docProjectId`.
 * Se compone anidándolo donde corresponda: los transmittals lo llevan directo,
 * mientras que un workflow lo alcanza a través de su revisión y su documento.
 */
export type ProjectScope =
  | { docProjectId: { in: number[] } }
  | { OR: [{ docProjectId: { in: number[] } }, { docProjectId: null }] }

/**
 * Construye el criterio de alcance a partir de las membresías vigentes.
 *
 * `includeWithoutProject` incorpora los objetos sin proyecto, que son el régimen
 * de publicación de B1: no circulan, no tienen partes que acotar y se gobiernan
 * únicamente por el permiso global.
 *
 * Corresponde a los listados de documentos y también a los de workflows y pasos:
 * D-03 fija que toda revisión atraviesa un circuito, de modo que un documento
 * publicado tiene workflows sin proyecto. NO corresponde a los transmittals, que
 * son el único objeto cuyo `docProjectId` es obligatorio en el modelo.
 *
 * Sin membresías y sin esa opción el resultado es vacío, que es lo correcto:
 * quien no es miembro de ningún proyecto no alcanza ningún documento en
 * circulación.
 */
export const buildProjectScope = (
  projectIds: number[],
  { includeWithoutProject }: { includeWithoutProject: boolean },
): ProjectScope => {
  const uniqueIds = [...new Set(projectIds)].sort((a, b) => a - b)

  if (includeWithoutProject) {
    return { OR: [{ docProjectId: { in: uniqueIds } }, { docProjectId: null }] }
  }

  return { docProjectId: { in: uniqueIds } }
}

/**
 * Incorpora el alcance a un `where` existente, SIEMPRE bajo `AND`.
 *
 * No se fusiona a nivel raíz: varios resolvers ya usan `OR` para la búsqueda por
 * texto, y el alcance también lo usa cuando incorpora el régimen de publicación.
 * Escribirlo directo pisaría uno de los dos y, en el peor caso, ampliaría el
 * resultado en lugar de restringirlo. Bajo `AND` los dos criterios conviven y el
 * alcance nunca puede relajarse.
 */
export const applyProjectScope = <T extends Record<string, unknown>>(
  where: T,
  scope: ProjectScope,
): T & { AND: unknown[] } => {
  const previo = where.AND
  const acumulado = Array.isArray(previo)
    ? previo
    : previo === undefined
      ? []
      : [previo]

  return { ...where, AND: [...acumulado, scope] }
}

/** Proyectos en los que el usuario tiene membresía vigente. */
export const listMemberProjectIds = async (
  userId: number,
  context: ResolverContext,
): Promise<number[]> => {
  const memberships = await context.orm.docProjectMember.findMany({
    where: { userId, ...ACTIVE_MEMBERSHIP },
    select: { docProjectId: true },
  })

  return memberships.map(({ docProjectId }) => docProjectId)
}

/**
 * Segunda capa aislada, para cuando el proyecto no se conoce hasta leer el objeto.
 *
 * El orden correcto en ese caso es: permiso global → lectura del proyecto del
 * objeto → membresía. Exponerla por separado permite respetarlo, en lugar de
 * leer la base antes de haber verificado el permiso.
 *
 * `docProjectId` nulo es el régimen de publicación (B1): no hay membresía que exigir.
 */
export const assertProjectMembership = async ({
  userId,
  docProjectId,
  context,
}: {
  userId: number
  docProjectId: number | null
  context: ResolverContext
}): Promise<void> => {
  if (docProjectId === null) {
    logger.debug("Objeto sin proyecto: rige solo el permiso global", {
      userId,
    })
    return
  }

  const membership = await context.orm.docProjectMember.findFirst({
    where: { docProjectId, userId, ...ACTIVE_MEMBERSHIP },
  })

  if (!membership) {
    logger.auth(`Sin membresía vigente en el proyecto ${docProjectId}`, {
      userId,
    })
    throw new GraphQLError("No sos miembro de este proyecto", {
      extensions: { code: "FORBIDDEN" },
    })
  }
}

/**
 * Intención de la operación sobre el contrato (BLOQUE 02D, B9).
 *
 * Se declara de forma explícita en cada llamada, con el mismo criterio con que
 * `docProjectId` no es opcional: un valor por defecto haría que la puerta se
 * saltee por descuido en lugar de por decisión.
 */
export type ContractIntent = "read" | "write"

/**
 * La puerta de escritura del contrato (BLOQUE 02D, B9).
 *
 * En curso admite todas las operaciones; cerrado, solo lectura. Es una puerta
 * sobre la escritura y NO una máquina de estados: no se propaga hacia abajo, de
 * modo que una revisión en circuito al momento del cierre queda donde está y
 * deja de poder avanzar.
 *
 * Un objeto sin contrato —el régimen de publicación— no tiene puerta que
 * atravesar: se gobierna solo por el permiso global (B1).
 */
export const assertContractOpen = async ({
  docProjectId,
  intent,
  context,
}: {
  docProjectId: number | null
  intent: ContractIntent
  context: ResolverContext
}): Promise<void> => {
  if (intent === "read" || docProjectId === null) return

  const contrato = await context.orm.docProject.findUnique({
    where: { id: docProjectId },
    select: { status: true, code: true },
  })

  // Un contrato inexistente no es asunto de esta puerta: lo resuelve la clave
  // foránea al escribir, o el NOT_FOUND de quien resolvió el objeto.
  if (!contrato || contrato.status !== DocProjectStatus.CLOSED) return

  throw new GraphQLError(
    `El contrato ${contrato.code} está cerrado y solo admite lectura`,
    { extensions: { code: "CONFLICT" } },
  )
}

/**
 * Segunda capa para una operación sobre un objeto existente, cualquiera sea su
 * tipo. Resuelve el proyecto del objeto con la tabla de derivación compartida y
 * exige membresía.
 *
 * Distingue "el objeto no pertenece a ningún proyecto" —que autoriza por permiso
 * global (B1)— de "el objeto no existe" —que corta con NOT_FOUND—. Confundirlos
 * autorizaría operaciones sobre objetos inexistentes.
 */
export const assertObjectAccess = async ({
  userId,
  objectType,
  objectId,
  context,
  notFoundMessage,
  intent,
}: {
  userId: number
  objectType: DocObjectType
  objectId: number
  context: ResolverContext
  notFoundMessage: string
  intent: ContractIntent
}): Promise<void> => {
  const contexto = await resolveObjectContext(context.orm, objectType, objectId)

  if (!contexto) {
    throw new GraphQLError(notFoundMessage, {
      extensions: { code: "NOT_FOUND" },
    })
  }

  await assertProjectMembership({
    userId,
    docProjectId: contexto.docProjectId,
    context,
  })

  await assertContractOpen({
    docProjectId: contexto.docProjectId,
    intent,
    context,
  })
}

type ProjectAuthorizationProps = {
  requiredPermissions: string[]
  /**
   * Proyecto del objeto sobre el que se opera.
   *
   * `null` significa que el objeto NO pertenece a un proyecto: es el régimen de
   * publicación y queda gobernado solo por el permiso global. Se declara de
   * forma explícita, y no como parámetro opcional, para que nunca se omita por
   * descuido y termine salteando la segunda capa sin que nadie lo decida.
   */
  docProjectId: number | null
  context: ResolverContext
  /** Si la operación escribe. Cerrado, el contrato solo admite lectura (B9). */
  intent: ContractIntent
}

/**
 * Doble capa estricta, para operaciones sobre un objeto concreto.
 * Devuelve el id del usuario autenticado si cumple ambas capas.
 */
export const projectAuthorization = async ({
  requiredPermissions,
  docProjectId,
  context,
  intent,
}: ProjectAuthorizationProps): Promise<number> => {
  // Capa 1: permiso global (valida JWT + consulta a mi-admin)
  const userId = await userAuthorization({ requiredPermissions, context })

  // Capa 2: membresía vigente en el proyecto
  await assertProjectMembership({ userId, docProjectId, context })

  // Y la puerta del estado del contrato, que no es una capa de autorización:
  // no dice quién puede, dice qué admite el contrato (B9).
  await assertContractOpen({ docProjectId, intent, context })

  return userId
}

type ProjectScopeAuthorizationProps = {
  requiredPermissions: string[]
  context: ResolverContext
  includeWithoutProject: boolean
}

/**
 * Segunda capa en forma de filtro, para listados que no nombran un proyecto.
 * Devuelve el usuario autenticado y el criterio de alcance que el resolver debe
 * incorporar a su `where`.
 */
export const projectScopeAuthorization = async ({
  requiredPermissions,
  context,
  includeWithoutProject,
}: ProjectScopeAuthorizationProps): Promise<{
  userId: number
  scope: ProjectScope
}> => {
  const userId = await userAuthorization({ requiredPermissions, context })
  const projectIds = await listMemberProjectIds(userId, context)

  return {
    userId,
    scope: buildProjectScope(projectIds, { includeWithoutProject }),
  }
}
