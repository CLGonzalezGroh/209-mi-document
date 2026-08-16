import { GraphQLError } from "graphql"
import type { Prisma } from "../generated/prisma/client.js"
import {
  DocumentRole,
  TransmittalNature,
} from "../generated/prisma/enums.js"

/**
 * Reglas de circulación del transmittal (BLOQUE 04, B1 y B2).
 *
 * La clasificación relevante no es la dirección sino el propósito (D-18): un
 * transmittal es una **emisión** —entrega de documentación producida— o una
 * **respuesta** —calificación consolidada de una emisión—. El sentido no es un
 * atributo: se deriva del rol del proyecto y de la naturaleza.
 */

/** Sentido de la circulación. Derivado, nunca almacenado. */
export const TransmittalDirection = {
  OUTGOING: "OUTGOING",
  INCOMING: "INCOMING",
} as const

export type TransmittalDirection =
  (typeof TransmittalDirection)[keyof typeof TransmittalDirection]

/**
 * De dónde sale el sentido.
 *
 * |            | `EMISSION`               | `RESPONSE`            |
 * | ---------- | ------------------------ | --------------------- |
 * | `ISSUER`   | Saliente                 | Entrante              |
 * | `RECEIVER` | Entrante, del contratista| **No existe**         |
 * | `INTERNAL` | **No existe**            | **No existe**         |
 *
 * Devuelve `null` en las combinaciones que ningún transmittal puede tener, que
 * son las que `natureViolation` impide crear. Es el mismo criterio con que D-13
 * retiró el esquema de revisión del documento: un dato almacenado que puede
 * contradecir a los hechos obliga a inventar una precondición que tape la
 * incoherencia.
 */
export const directionOf = (
  role: DocumentRole,
  nature: TransmittalNature,
): TransmittalDirection | null => {
  if (role === DocumentRole.INTERNAL) return null

  if (nature === TransmittalNature.RESPONSE) {
    return role === DocumentRole.ISSUER ? TransmittalDirection.INCOMING : null
  }

  return role === DocumentRole.ISSUER
    ? TransmittalDirection.OUTGOING
    : TransmittalDirection.INCOMING
}

/**
 * ¿La emisión de este proyecto sale del sistema?
 *
 * Es la condición de la puerta dura de `B3`: exige aprobación **interna**, y en
 * modo Receptor no ocurre ninguna —el contratista sube documentación ya aprobada
 * por sus propios medios y la planta no modela su ciclo interno (D-18)—.
 */
export const emitsOutward = (role: DocumentRole): boolean =>
  role === DocumentRole.ISSUER

/** Devuelve el motivo del incumplimiento, o `null` si la combinación es válida. */
export const natureViolation = (
  role: DocumentRole,
  nature: TransmittalNature,
): string | null => {
  if (role === DocumentRole.INTERNAL) {
    return "Un proyecto interno no admite transmittals: su ciclo termina en la aprobación"
  }

  if (role === DocumentRole.RECEIVER && nature === TransmittalNature.RESPONSE) {
    return "En modo Receptor no existe el transmittal de respuesta: la calificación se responde documento a documento"
  }

  return null
}

export const assertNature = (
  role: DocumentRole,
  nature: TransmittalNature,
): void => {
  const violacion = natureViolation(role, nature)

  if (violacion) {
    throw new GraphQLError(violacion, { extensions: { code: "BAD_USER_INPUT" } })
  }
}

/**
 * Vínculo entre la respuesta y la emisión que contesta.
 *
 * La respuesta referencia **necesariamente** una emisión, y del mismo proyecto:
 * es lo que la vuelve inequívoca sin necesidad de marcarla de otro modo (D-18).
 * La emisión, en cambio, no responde a nada.
 */
export const responseLinkViolation = (
  nature: TransmittalNature,
  respondsTo: { projectId: number; nature: TransmittalNature } | null,
  projectId: number,
): string | null => {
  if (nature === TransmittalNature.EMISSION) {
    return respondsTo
      ? "Una emisión no responde a otro transmittal"
      : null
  }

  if (!respondsTo) {
    return "Un transmittal de respuesta debe declarar la emisión que contesta"
  }

  if (respondsTo.projectId !== projectId) {
    return "La emisión que se contesta pertenece a otro proyecto"
  }

  if (respondsTo.nature !== TransmittalNature.EMISSION) {
    return "Solo se contesta una emisión, no otra respuesta"
  }

  return null
}

/**
 * Código sucesor dentro del proyecto (B2).
 *
 * Puro y separado de la lectura, para que la generación pueda reintentarse
 * dentro de la transacción sin repetir la regla.
 */
const PREFIJO = "TR"
const ANCHO = 3

export const nextTransmittalCode = (ultimo: string | null): string => {
  const numero = ultimo?.match(/^TR-(\d+)$/)
  const siguiente = numero ? parseInt(numero[1], 10) + 1 : 1

  return `${PREFIJO}-${String(siguiente).padStart(ANCHO, "0")}`
}

/**
 * Genera el código dentro de la transacción, sobre el máximo **del proyecto**.
 *
 * Dos defectos de H-16 en el mismo lugar: la numeración era global al despliegue
 * —cuando el transmittal pertenece a un proyecto, que es la unidad contractual—
 * y se calculaba fuera de la transacción leyendo el último registro por `id`, de
 * modo que dos emisiones simultáneas obtenían el mismo número.
 *
 * El árbitro es el índice único `[projectId, code]`, no esta función: acá se
 * propone el sucesor y la base decide. Por eso el llamador reintenta, y lo hace
 * repitiendo la transacción entera: una violación de unicidad aborta la
 * transacción en PostgreSQL, de modo que reintentar adentro no es posible.
 *
 * Ordena por `id` y no por `code`: el código es texto con relleno de tres
 * dígitos, y `TR-1000` ordena antes que `TR-999`. El orden de creación dentro
 * del proyecto sí es el de la secuencia, porque cada código nace del anterior.
 */
export const generateTransmittalCode = async (
  client: Prisma.TransactionClient,
  projectId: number,
): Promise<string> => {
  const ultimo = await client.transmittal.findFirst({
    where: { projectId },
    orderBy: { id: "desc" },
    select: { code: true },
  })

  return nextTransmittalCode(ultimo?.code ?? null)
}
