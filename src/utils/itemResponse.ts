import { GraphQLError } from "graphql"
import {
  DocumentRole,
  PurposeCode,
  TransmittalNature,
  TransmittalStatus,
} from "../generated/prisma/enums.js"
import { emitsOutward } from "./transmittalCirculation.js"
import { expectsQualification } from "./emissionPurpose.js"

/**
 * Reglas de la respuesta de la contraparte (BLOQUE 04, B5 y B7).
 *
 * La respuesta es un objeto propio del **ítem** por el que ese documento salió.
 * No es una versión: el archivo que devuelve la contraparte llega de afuera del
 * circuito, sin paso vigente que lo produzca ni firma que lo acredite (B6).
 */

/**
 * Solo se responde lo que salió.
 *
 * D-18 lo fija sin rodeos: *no se admiten respuestas sobre documentos que no
 * fueron emitidos; si falta la emisión, se registra primero*. Un transmittal en
 * borrador es la carpeta que se está armando, y todavía no llegó a nadie.
 *
 * Cerrado, en cambio, sí admite respuesta: cerrar declara que se dejó de
 * esperar, no que se dejó de escuchar (B10).
 */
export const wasIssued = (status: TransmittalStatus): boolean =>
  status !== TransmittalStatus.DRAFT

export const assertIssued = (status: TransmittalStatus): void => {
  if (!wasIssued(status)) {
    throw new GraphQLError(
      "No se responde un documento que todavía no fue emitido: emita el transmittal primero",
      { extensions: { code: "BAD_REQUEST" } },
    )
  }
}

/**
 * El sobre en que la respuesta viajó, si vino consolidada (D-18).
 *
 * Debe ser un transmittal de respuesta, y debe contestar **la emisión por la que
 * ese documento salió**. Sin esa condición, un remito podría transportar la
 * calificación de documentos que nunca contestó, y el vínculo entre respuesta y
 * emisión dejaría de ser inequívoco.
 */
export const carrierViolation = (
  carrier: { nature: TransmittalNature; respondsToTransmittalId: number | null },
  emissionId: number,
): string | null => {
  if (carrier.nature !== TransmittalNature.RESPONSE) {
    return "El sobre declarado no es un transmittal de respuesta"
  }

  if (carrier.respondsToTransmittalId !== emissionId) {
    return "El transmittal de respuesta no contesta la emisión por la que salió ese documento"
  }

  return null
}

export const assertCarrier = (
  carrier: { nature: TransmittalNature; respondsToTransmittalId: number | null },
  emissionId: number,
): void => {
  const violacion = carrierViolation(carrier, emissionId)

  if (violacion) {
    throw new GraphQLError(violacion, { extensions: { code: "BAD_USER_INPUT" } })
  }
}

/**
 * ¿La respuesta la transcribió alguien distinto de quien respondió?
 *
 * Se **deriva** de que ambos datos existan, en lugar de almacenarse como
 * indicador. Es el criterio de D-04 sobre la firma delegada, aplicado a la
 * respuesta: no se restringe quién puede ingresar el dato, pero la diferencia
 * entre el autor y quien la transcribió queda explícita.
 *
 * En el caso habitual de D-12 la respuesta es transcripta: el cliente contesta
 * por correo o por un repositorio compartido, y el control documental la
 * registra. Cuando `respondedBy` va vacío, la respuesta se atribuye a quien la
 * registró, que es la vía directa.
 */
export const wasTranscribed = (
  respondedBy: string | null | undefined,
): boolean => (respondedBy ?? "").trim() !== ""

/**
 * Estado del transmittal cuando aparece la primera respuesta.
 *
 * Las respuestas son **parciales y no bloquean** (D-18): cada documento
 * respondido reinicia su propio ciclo con independencia de los demás. El estado
 * del transmittal acompaña el hecho de que empezó a contestarse, y no espera a
 * que estén todos.
 *
 * Devuelve `null` cuando no corresponde transición: ya estaba respondido, o está
 * cerrado y cerrar no se deshace por una respuesta tardía.
 */
export const statusAfterResponse = (
  actual: TransmittalStatus,
): TransmittalStatus | null =>
  actual === TransmittalStatus.ISSUED ||
  actual === TransmittalStatus.ACKNOWLEDGED
    ? TransmittalStatus.RESPONDED
    : null

/**
 * El acuse de recibo es del ENVÍO, no del documento (B8).
 *
 * Solo tiene sentido donde la emisión viaja afuera y no se sabe si llegó. En
 * modo Receptor el contratista carga el transmittal dentro del sistema: no hay
 * nada que acusar, y el acto equivalente es la confirmación de la recepción, que
 * pertenece al circuito del rol Receptor.
 *
 * Declararlo evita que se implemente un estado que en ese modo no significa
 * nada — el mismo defecto que H-12 denuncia al otro lado: un valor de
 * enumeración que ninguna operación asigna.
 */
export const canAcknowledge = (
  role: DocumentRole,
  nature: TransmittalNature,
  status: TransmittalStatus,
): string | null => {
  if (!emitsOutward(role)) {
    return "El acuse de recibo solo existe en modo Emisor: acá el transmittal se carga dentro del sistema"
  }

  if (nature !== TransmittalNature.EMISSION) {
    return "Se acusa recibo de una emisión, no de una respuesta"
  }

  if (status !== TransmittalStatus.ISSUED) {
    return status === TransmittalStatus.DRAFT
      ? "No se acusa recibo de un transmittal que todavía no se emitió"
      : "El transmittal ya fue acusado o respondido"
  }

  return null
}

export const assertCanAcknowledge = (
  role: DocumentRole,
  nature: TransmittalNature,
  status: TransmittalStatus,
): void => {
  const violacion = canAcknowledge(role, nature, status)

  if (violacion) {
    throw new GraphQLError(violacion, { extensions: { code: "BAD_REQUEST" } })
  }
}

/**
 * Avance de las respuestas de un transmittal (B10).
 *
 * Lo que el cierre puede MOSTRAR, no lo que lo condiciona. Con la primera regla
 * del propósito, el transmittal sabe cuántos de sus ítems esperaban calificación
 * y cuántos la tienen: *faltan 3 de las 5 que esperaban respuesta* en lugar de
 * *faltan 3 de 8*.
 *
 * Se deriva y no se almacena.
 */
export type ResponseProgress = {
  expected: number
  answered: number
  pending: number
}

export const responseProgress = (
  items: Array<{ purposeCode: PurposeCode; hasResponse: boolean }>,
): ResponseProgress => {
  const esperan = items.filter((i) => expectsQualification(i.purposeCode))
  const answered = esperan.filter((i) => i.hasResponse).length

  return {
    expected: esperan.length,
    answered,
    pending: esperan.length - answered,
  }
}

