import { GraphQLError } from "graphql"
import {
  TransmittalNature,
  TransmittalStatus,
} from "../generated/prisma/enums.js"

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
