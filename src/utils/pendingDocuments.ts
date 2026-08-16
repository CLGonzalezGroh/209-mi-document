import { DocumentRole, RevisionStatus } from "../generated/prisma/enums.js"
import { lastLiveRevision, type RevisionSnapshot } from "./revisionScheme.js"

/**
 * El documento pendiente (BLOQUE 04, B13).
 *
 * **No hay documento esperado: hay documento.** Todo el que se da de alta en el
 * proyecto lo es, y el que aparece después del alcance inicial también — nació
 * más tarde, no es de otra clase. Esperado y adicional describen *cuándo
 * apareció* y no *qué es*, y el cuándo ya lo registra la auditoría.
 *
 * Pendiente es el que **todavía no salió**, y no necesita ningún atributo: la
 * condición ya está en el modelo, como ausencia de ítem de transmittal para su
 * revisión. Es la misma relación que `B3` volvió única, leída al revés.
 */

export type PendingSnapshot = RevisionSnapshot & { emitted: boolean }

/**
 * ¿Este documento está pendiente de salir?
 *
 * Se mira **la revisión en curso** y no cualquiera: la última no abandonada, que
 * es la misma que `B14` de `BLOCK_03` expone como `lastRevision` y de la que
 * `B12` deriva el código sucesor. Una sola regla con tres usos.
 *
 * Mirar "ninguna revisión salió" sería más simple y estaría mal: después de que
 * la contraparte rechaza, el documento debe la revisión siguiente, y con aquella
 * lectura dejaría de figurar para siempre por haber salido una vez.
 *
 * | Rol | Qué significa pendiente |
 * | --- | ----------------------- |
 * | `ISSUER` | La revisión en curso está aprobada y todavía no se emitió |
 * | `RECEIVER` | El contratista todavía no la entregó en ningún transmittal |
 * | `INTERNAL` | No aplica: no hay emisión |
 */
export const isPending = (
  role: DocumentRole | null,
  revisions: PendingSnapshot[],
): boolean => {
  if (role === null || role === DocumentRole.INTERNAL) return false

  const enCurso = lastLiveRevision(revisions)
  if (!enCurso) return false
  if (enCurso.emitted) return false

  // En modo Emisor la puerta de `B3` acota el conjunto: lo que todavía no está
  // aprobado no es candidato a salir, de modo que tampoco es una deuda con la
  // contraparte sino trabajo en curso. Y con eso **la lista de pendientes es la
  // misma consulta de candidatos**: lo que el control documental mira para armar
  // el próximo transmittal y lo que mira para saber qué debe es lo mismo.
  //
  // En modo Receptor no hay aprobación interna que exigir: el contratista sube
  // documentación ya aprobada por sus propios medios (D-18).
  return role === DocumentRole.ISSUER
    ? enCurso.status === RevisionStatus.APPROVED
    : true
}
