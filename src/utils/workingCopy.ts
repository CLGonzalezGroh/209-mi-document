import { DocFileRole } from "../generated/prisma/enums.js"

/**
 * La copia de trabajo: el conjunto EN PREPARACIÓN (BLOQUE 03B, B12).
 *
 * Lo que estas funciones resuelven es **cuándo la versión existe**. La versión
 * debe ser inmutable una vez que existe; abrir, reemplazar, adjuntar y quitar
 * ocurren antes, sobre un conjunto que todavía no acredita nada.
 */

/** Lo que identifica a un archivo dentro del conjunto. */
export type CopyFile = {
  role: DocFileRole
  fileKey: string
  fileName: string
  fileSize: number
  mimeType: string
  checksum: string
}

/**
 * El conjunto con que se abre la copia: los archivos de la versión vigente,
 * tal cual.
 *
 * Precargar es lo que vuelve barata la edición (B12): el que corrige el
 * entregable abre, lo reemplaza y confirma, y la fuente y el respaldo viajan
 * solos **conservando su `fileKey` y su `checksum`**, sin volver a subirse. Lo
 * que se crea al confirmar es el registro del conjunto, no el objeto almacenado.
 *
 * Sin versión vigente el conjunto arranca vacío: es el caso del documento que
 * nace sin archivo, donde la elaboración existe precisamente para producirlo.
 */
export const preloadFrom = (files: CopyFile[] | null | undefined): CopyFile[] =>
  // Proyecta EXACTAMENTE la forma del conjunto y no la fila de la que sale: los
  // archivos llegan como registros de la versión, con su id y su versionId, y
  // arrastrarlos haría que la copia intentara nacer con la identidad de otro.
  (files ?? []).map((f) => ({
    role: f.role,
    fileKey: f.fileKey,
    fileName: f.fileName,
    fileSize: f.fileSize,
    mimeType: f.mimeType,
    checksum: f.checksum,
  }))

/** Índice por `fileKey`, que es lo que distingue a un archivo del conjunto. */
const byKey = (files: CopyFile[]) => new Map(files.map((f) => [f.fileKey, f]))

/**
 * Si la copia difiere de la versión de la que salió.
 *
 * **Confirmar exige al menos un cambio** (B12): sin archivo agregado,
 * reemplazado o quitado no hay nada que confirmar, porque *la versión solo
 * existe con contenido nuevo*. El principio del §4 se hace cumplir solo, sin
 * una regla que lo enuncie aparte.
 *
 * Un archivo cambió si cambió su `checksum` —contenido nuevo— o su rol, que es
 * lo que el sistema interpreta. El nombre y el tamaño acompañan al contenido y
 * no se evalúan por separado: no pueden cambiar sin que cambie el archivo.
 */
export const hasChanges = (
  origen: CopyFile[],
  copia: CopyFile[],
): boolean => {
  if (origen.length !== copia.length) return true

  const original = byKey(origen)
  return copia.some((f) => {
    const antes = original.get(f.fileKey)
    return !antes || antes.checksum !== f.checksum || antes.role !== f.role
  })
}

/**
 * Qué le falta al conjunto para poder confirmarse, si le falta algo.
 *
 * Devuelve `null` cuando está completo. Los invariantes son los de `B6` y `B7`:
 * al menos un archivo, y al menos uno con rol `DELIVERABLE` —el entregable es lo
 * que se revisa y se marca, y un conjunto sin entregable no es una emisión—.
 * `SOURCE` y `SUPPORT` son opcionales y admiten varios.
 */
export type IncompleteReason = "EMPTY" | "NO_DELIVERABLE"

export const incompleteReason = (
  files: CopyFile[],
): IncompleteReason | null => {
  if (files.length === 0) return "EMPTY"
  if (!files.some((f) => f.role === DocFileRole.DELIVERABLE)) {
    return "NO_DELIVERABLE"
  }
  return null
}

export const INCOMPLETE_MESSAGE: Record<IncompleteReason, string> = {
  EMPTY: "La copia de trabajo no tiene ningún archivo.",
  NO_DELIVERABLE:
    "La versión exige al menos un entregable: es lo que se revisa y se marca.",
}
