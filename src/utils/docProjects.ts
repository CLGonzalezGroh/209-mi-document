import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { DocProjectSide, DocumentRole } from "../generated/prisma/enums.js"

/**
 * Reglas de la configuración documental del proyecto (BLOQUE 02, B4 y B5).
 */

/** El rol INTERNAL no tiene contraparte; los otros dos la exigen (D-19). */
export const requiresCounterparty = (role: DocumentRole): boolean =>
  role !== DocumentRole.INTERNAL

/** Devuelve el motivo del incumplimiento, o `null` si la declaración es válida. */
export const counterpartyViolation = (
  role: DocumentRole,
  counterpartyName: string | null | undefined,
): string | null => {
  const declarada = counterpartyName !== null && counterpartyName !== undefined &&
    counterpartyName.trim() !== ""

  if (requiresCounterparty(role) && !declarada) {
    return "Un proyecto en modo Emisor o Receptor debe declarar su contraparte"
  }

  if (!requiresCounterparty(role) && declarada) {
    return "Un proyecto interno no tiene contraparte"
  }

  return null
}

export const assertCounterparty = (
  role: DocumentRole,
  counterpartyName: string | null | undefined,
): void => {
  const violacion = counterpartyViolation(role, counterpartyName)

  if (violacion) {
    throw new GraphQLError(violacion, { extensions: { code: "BAD_USER_INPUT" } })
  }
}

/**
 * Rótulo de cada lado según el rol declarado por el proyecto (D-15).
 *
 * El modelo mantiene dos lados, pero la terminología genérica de anfitrión y
 * contraparte no se expone: cada modo aporta el nombre específico. En INTERNAL
 * solo existe el lado anfitrión, y no hay contraparte que nombrar.
 */
export const sideLabel = (role: DocumentRole, side: DocProjectSide): string => {
  if (role === DocumentRole.INTERNAL) return "Interno"

  const anfitrion = role === DocumentRole.ISSUER ? "Ingeniería" : "Planta"
  const contraparte = role === DocumentRole.ISSUER ? "Cliente" : "Contratista"

  return side === DocProjectSide.HOST ? anfitrion : contraparte
}

/**
 * El rol es inmutable desde el primer documento o transmittal (B5).
 *
 * El rol invierte el orden entre el circuito de revisión y el transmittal, de
 * modo que cambiarlo con objetos ya en circulación dejaría un ciclo que no
 * corresponde al modo declarado. Mientras el contrato esté vacío se modifica
 * libremente: lo que cambia es la precondición, no la operación.
 *
 * El contrato se busca por su CÓDIGO, que es su identidad y siempre está; el
 * `projectId` puede faltar, porque un contrato sin gestión PMI es válido (B3).
 * Sin gestión PMI tampoco puede haber documentos todavía —hasta la fase 3 el
 * documento cuelga del proyecto de mi-project—, de modo que el rol es libre.
 */
export const assertRoleIsSettled = async (
  context: ResolverContext,
  code: string,
  nuevoRol: DocumentRole,
): Promise<void> => {
  const actual = await context.orm.docProject.findUnique({
    where: { code },
    select: { documentRole: true, projectId: true },
  })

  if (!actual || actual.documentRole === nuevoRol) return
  if (actual.projectId === null) return

  const projectId = actual.projectId

  const [documentos, transmittals] = await Promise.all([
    context.orm.document.count({ where: { projectId } }),
    context.orm.transmittal.count({ where: { projectId } }),
  ])

  if (documentos > 0 || transmittals > 0) {
    throw new GraphQLError(
      "El rol documental no puede cambiarse: el contrato ya tiene documentos o transmittals",
      { extensions: { code: "CONFLICT" } },
    )
  }
}
