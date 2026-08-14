import { lastLiveRevision, type RevisionSnapshot } from "./revisionScheme.js"

/**
 * Derivaciones de nivel documento (BLOQUE 03B, B2 y B5).
 *
 * Dos reglas que el módulo necesita resolver en un solo lugar: qué metadata
 * refleja la copia del documento, y por qué causa quedó obsoleto.
 */

/** La identificación, que vive en la revisión (B1). */
export type RevisionMetadata = {
  title: string
  documentTypeId: number
  documentClassId: number | null
}

type RevisionLike = RevisionMetadata & RevisionSnapshot

/**
 * La metadata que le corresponde a la COPIA del documento: la de su revisión
 * EN CURSO (B2).
 *
 * Es la misma lectura que `lastLiveRevision` ya resuelve —la última no
 * abandonada por secuencia de creación—, y por eso comparte su implementación:
 * una sola regla con dos usos, como el código sucesor.
 *
 * De ahí sale sola la propiedad que buscábamos: **abandonar una revisión
 * devuelve la metadata anterior**, porque la abandonada deja de ser la última
 * viva y el cálculo cae en la que estaba antes. No hace falta guardar nada para
 * revertir.
 *
 * Devuelve `null` cuando no queda ninguna revisión viva. El llamador decide qué
 * hacer con eso: no es un caso que la derivación pueda resolver por su cuenta,
 * porque un documento sin revisiones vivas no tiene metadata que declarar.
 */
export const metadataOfCurrentRevision = <T extends RevisionLike>(
  revisions: T[],
): RevisionMetadata | null => {
  const vigente = lastLiveRevision(revisions)
  if (!vigente) return null

  return {
    title: vigente.title,
    documentTypeId: vigente.documentTypeId,
    documentClassId: vigente.documentClassId,
  }
}

/** Si la copia del documento ya coincide con lo que le corresponde. */
export const metadataMatches = (
  copia: RevisionMetadata,
  esperada: RevisionMetadata,
): boolean =>
  copia.title === esperada.title &&
  copia.documentTypeId === esperada.documentTypeId &&
  copia.documentClassId === esperada.documentClassId

/**
 * Por qué un documento quedó obsoleto (B5).
 *
 * `REPLACEMENT` cuando figura como reemplazado en algún acto; `OUT_OF_SCOPE`
 * cuando no figura en ninguno, porque salió del alcance sin que nada lo
 * reemplace. `null` cuando no está obsoleto.
 *
 * La causa **se deriva y no se guarda**: un indicador sería un dato calculable
 * capaz de contradecir a los que lo originan, que es lo que el §7 rechaza. Lo
 * que sí se registra es el hecho —fecha, actor y motivo—, porque dos causas
 * distintas llegan al mismo estado y ninguna se deduce de la otra.
 *
 * La derivación vale **dentro de este módulo**, donde toda obsolescencia
 * proviene de una de esas dos causas. El activo de planta conoce otra —el
 * decomisionamiento— y necesitará un acto propio.
 */
export type ObsolescenceCause = "REPLACEMENT" | "OUT_OF_SCOPE"

export const obsolescenceCause = (document: {
  obsoletedAt: Date | null
  replacementItems?: { role: string }[]
}): ObsolescenceCause | null => {
  if (!document.obsoletedAt) return null

  const fueReemplazado = (document.replacementItems ?? []).some(
    (i) => i.role === "REPLACED",
  )
  return fueReemplazado ? "REPLACEMENT" : "OUT_OF_SCOPE"
}
