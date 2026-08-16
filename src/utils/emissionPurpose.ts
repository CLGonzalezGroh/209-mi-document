import { GraphQLError } from "graphql"
import {
  DocFileRole,
  DocumentRole,
  PurposeCode,
  RevisionStatus,
} from "../generated/prisma/enums.js"
import { emitsOutward } from "./transmittalCirculation.js"

/**
 * Puerta de emisión y reglas del propósito (BLOQUE 04, B3 y B4).
 *
 * `PurposeCode` existe desde el origen del módulo y ninguna validación lo
 * consultaba. Acá gana sus dos primeras reglas, y con eso deja de ser una
 * etiqueta. Una es puerta y la otra advertencia, y la diferencia no es de
 * criterio sino estructural: **una puerta solo puede ser dura si existe una
 * manera legal de satisfacerla.**
 */

// ---------------------------------------------------------------------------
// La puerta (B3)
// ---------------------------------------------------------------------------

/**
 * ¿Este proyecto exige aprobación interna para que un documento salga?
 *
 * Solo donde la emisión es saliente. En modo Receptor no hay puerta, y no es
 * una excepción a la regla sino su consecuencia: la puerta exige aprobación
 * **interna**, y ahí adentro no ocurre ninguna —el contratista sube
 * documentación ya aprobada por sus propios medios y la planta no modela su
 * ciclo interno (D-18)—.
 */
export const requiresApprovedRevision = (role: DocumentRole): boolean =>
  emitsOutward(role)

/**
 * Revisiones que no pueden incorporarse a una emisión saliente.
 *
 * Se aplica **al incorporar el ítem** y no solo al emitir: una revisión en
 * circuito no es candidata a salir, de modo que tampoco es candidata a entrar
 * en la carpeta. Admitirla en borrador para rechazarla después obliga a armar
 * el transmittal con documentos que van a trabar la emisión, y a descubrirlo al
 * final.
 */
export const notApprovedFor = <
  T extends { id: number; status: RevisionStatus },
>(
  role: DocumentRole,
  revisions: T[],
): T[] =>
  requiresApprovedRevision(role)
    ? revisions.filter((r) => r.status !== RevisionStatus.APPROVED)
    : []

export const assertApprovedForEmission = <
  T extends { id: number; revisionCode?: string; status: RevisionStatus },
>(
  role: DocumentRole,
  revisions: T[],
): void => {
  const sinAprobar = notApprovedFor(role, revisions)

  if (sinAprobar.length === 0) return

  const detalle = sinAprobar
    .map((r) => `${r.revisionCode ?? r.id} (${r.status})`)
    .join(", ")

  throw new GraphQLError(
    `Solo se emiten revisiones aprobadas, cualquiera sea el propósito. Sin aprobar: ${detalle}`,
    { extensions: { code: "BAD_USER_INPUT" } },
  )
}

// ---------------------------------------------------------------------------
// Primera regla del propósito: qué se espera de vuelta (B4)
// ---------------------------------------------------------------------------

/**
 * ¿La emisión espera calificación de la contraparte?
 *
 * Es **expectativa y no permiso**: si la contraparte igual responde sobre una
 * emisión informativa, la respuesta se registra. Lo que la regla gobierna es
 * qué está **pendiente**.
 *
 * Sin ella, la bandeja de lo que falta contestar acumula para siempre emisiones
 * que nadie va a responder, y deja de servir para lo único que sirve — el mismo
 * mecanismo por el que los pasos de toma de conocimiento quedaban `PENDING` de
 * forma permanente hasta que `B10` de `BLOQUE 03` corrigió la consulta.
 */
const ESPERAN_CALIFICACION: ReadonlySet<PurposeCode> = new Set([
  PurposeCode.FOR_APPROVAL,
  PurposeCode.FOR_REVIEW,
])

export const expectsQualification = (purpose: PurposeCode): boolean =>
  ESPERAN_CALIFICACION.has(purpose)

// ---------------------------------------------------------------------------
// Segunda regla del propósito: qué archivos se esperan (B4)
// ---------------------------------------------------------------------------

/**
 * Roles de archivo que el propósito espera en la versión emitida.
 *
 * Es el encargo de `B9` de `BLOQUE 03B`: el editable se exige recién en la
 * emisión final —apto para construcción, conforme a obra—, porque ahí el
 * entregable deja de ser una etapa y pasa a ser el documento con el que se
 * construye.
 */
const FUENTE_EN: ReadonlySet<PurposeCode> = new Set([
  PurposeCode.FOR_CONSTRUCTION,
  PurposeCode.AS_BUILT,
])

export const expectedFileRoles = (purpose: PurposeCode): DocFileRole[] =>
  FUENTE_EN.has(purpose)
    ? [DocFileRole.DELIVERABLE, DocFileRole.SOURCE]
    : [DocFileRole.DELIVERABLE]

/**
 * Qué falta, y **no se exige**.
 *
 * Es advertencia y no puerta, por dos motivos. El caso legítimo existe: el
 * editable pesa cientos de megabytes o llega en un formato que no viaja por el
 * mismo canal, y se comparte por otro medio.
 *
 * Y el que decide: en el momento de emitir, la revisión ya está aprobada. No
 * tiene paso vigente, no admite versiones nuevas (`B5` de `BLOQUE 03`) y su
 * versión es inmutable con su conjunto completo (`B6` de `BLOQUE 03B`). **No
 * hay forma legal de agregar la fuente que falta**, de modo que una puerta dura
 * exigiría algo que el propio sistema hace imposible.
 *
 * Por eso la advertencia se adelanta al momento en que todavía sirve: mientras
 * la revisión está abierta y la copia de trabajo sin confirmar.
 */
export const missingFileRoles = (
  purpose: PurposeCode,
  presentes: DocFileRole[],
): DocFileRole[] => {
  const hay = new Set(presentes)

  return expectedFileRoles(purpose).filter((rol) => !hay.has(rol))
}
