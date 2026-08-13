import { RevisionScheme, RevisionStatus } from "../generated/prisma/enums.js"

/**
 * Códigos de revisión: sucesor, inferencia del esquema y validación.
 *
 * El esquema NO se persiste en el documento (BLOQUE 03, B13). Se elige al crear
 * cada revisión, y el escalón del documento se LEE de su última revisión no
 * abortada en lugar de guardarse: un esquema almacenado puede contradecir a los
 * hechos —declarar NUMERIC con la revisión vigente en `A`— y obliga a inventar
 * una precondición para tapar la incoherencia.
 *
 * Se porta del util de digitalización la generación, no la lista:
 * `revisionListSize` responde a validar contra un conjunto cerrado, que es el
 * problema de allá y no el de acá. Acá se calcula el sucesor.
 */

/** Primera revisión de cada esquema. Nulo en FREE_TEXT: el código lo escribe el usuario. */
export const firstRevisionCode = (scheme: RevisionScheme): string | null => {
  switch (scheme) {
    case RevisionScheme.ALPHA:
      return "A"
    case RevisionScheme.NUMERIC:
      return "0"
    case RevisionScheme.FREE_TEXT:
      return null
  }
}

/** Sucesor alfabético estilo Excel: A…Z, AA, AB… */
const nextAlphaCode = (currentCode: string): string => {
  if (!currentCode) return "A"

  const chars = currentCode.split("")
  let carry = true

  for (let i = chars.length - 1; i >= 0 && carry; i--) {
    if (chars[i] === "Z") {
      chars[i] = "A"
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
      carry = false
    }
  }

  if (carry) chars.unshift("A")

  return chars.join("")
}

/** Sucesor numérico: 0, 1, 2… */
const nextNumericCode = (currentCode: string): string => {
  const n = parseInt(currentCode, 10)
  return Number.isNaN(n) ? "0" : String(n + 1)
}

/**
 * Sucesor del código dentro del mismo esquema. Nulo en FREE_TEXT, donde no hay
 * secuencia que continuar.
 */
export const nextRevisionCode = (
  currentCode: string,
  scheme: RevisionScheme,
): string | null => {
  switch (scheme) {
    case RevisionScheme.ALPHA:
      return nextAlphaCode(currentCode)
    case RevisionScheme.NUMERIC:
      return nextNumericCode(currentCode)
    case RevisionScheme.FREE_TEXT:
      return null
  }
}

const ALPHA_CODE = /^[A-Z]+$/
const NUMERIC_CODE = /^\d+$/

/**
 * Esquema que un código revela por su forma: dígitos continúan en NUMERIC,
 * letras en ALPHA. Nulo cuando el código no responde a ninguna de las dos
 * secuencias, que es el caso de FREE_TEXT.
 *
 * La inferencia solo necesita interpretar valores que el propio sistema generó:
 * bajo FREE_TEXT el código lo escribe el usuario y no hay secuencia que inferir.
 */
export const inferRevisionScheme = (code: string): RevisionScheme | null => {
  const trimmed = code.trim()
  if (ALPHA_CODE.test(trimmed)) return RevisionScheme.ALPHA
  if (NUMERIC_CODE.test(trimmed)) return RevisionScheme.NUMERIC
  return null
}

/** Lo mínimo que hace falta saber de una revisión para ordenarla y leer su código. */
export type RevisionSnapshot = {
  id: number
  revisionCode: string
  status: RevisionStatus
  createdAt: Date
}

/**
 * Última revisión NO abortada, por secuencia de creación.
 *
 * Las revisiones se ordenan por creación y NUNCA por código (BLOQUE 03, B12 y
 * H-10): con el cambio de esquema la secuencia puede quedar `A, B, C, 0, 1`, de
 * modo que ordenar por código pierde sentido.
 *
 * Es una sola regla con dos usos: de esta revisión se deriva el código sucesor
 * (B12) y es la que `Document.lastRevision` expone (B14).
 */
export const lastLiveRevision = <T extends RevisionSnapshot>(
  revisions: T[],
): T | null => {
  const live = revisions.filter((r) => r.status !== RevisionStatus.CANCELLED)
  if (live.length === 0) return null

  return live.reduce((latest, current) => {
    if (current.createdAt.getTime() !== latest.createdAt.getTime()) {
      return current.createdAt > latest.createdAt ? current : latest
    }
    // Desempate por id: dos revisiones creadas en el mismo milisegundo conservan
    // el orden de alta, que es el que la secuencia describe.
    return current.id > latest.id ? current : latest
  })
}

/**
 * Código que el sistema propone para la revisión que se está creando.
 *
 * - **Primera revisión** — según el esquema elegido, o el que rige por
 *   precedencia: proyecto y, si no lo declara, el valor por defecto del
 *   despliegue.
 * - **Revisiones siguientes** — se calcula a partir de la última revisión no
 *   abortada, infiriendo el esquema de la forma de su código.
 * - **Cambiar de esquema** es elegir otro en ese momento, y la secuencia se
 *   reinicia: de `C` a NUMERIC da `0`.
 *
 * Nulo bajo FREE_TEXT, donde no hay código que proponer.
 */
export const proposeRevisionCode = ({
  lastCode,
  chosenScheme,
  fallbackScheme,
}: {
  lastCode: string | null
  chosenScheme: RevisionScheme | null
  fallbackScheme: RevisionScheme
}): string | null => {
  if (lastCode === null) {
    return firstRevisionCode(chosenScheme ?? fallbackScheme)
  }

  const inferred = inferRevisionScheme(lastCode)
  const effective = chosenScheme ?? inferred ?? fallbackScheme

  // Continuar la secuencia solo tiene sentido si el código anterior pertenece al
  // esquema vigente. Si no, se está cambiando de esquema y la secuencia arranca.
  return effective === inferred
    ? nextRevisionCode(lastCode, effective)
    : firstRevisionCode(effective)
}

export type RevisionCodeDecision =
  | { ok: true; code: string }
  | {
      ok: false
      reason:
        | "CODE_NOT_ACCEPTED" // El sistema calcula el código: no se admite el informado
        | "CODE_REQUIRED" // Bajo FREE_TEXT el código lo ingresa el usuario
        | "CODE_TAKEN" // Ya lo usa otra revisión no abortada del documento
    }

/**
 * Decide el código con que la revisión se crea (BLOQUE 03, B13 y H-09).
 *
 * Bajo ALPHA y NUMERIC el sistema lo calcula y **rechaza el informado**: aceptar
 * uno arbitrario reintroduciría la ausencia de validación que H-09 describe.
 * Bajo FREE_TEXT lo ingresa el usuario y solo se valida que no se repita entre
 * las revisiones NO abortadas, que es lo que sostiene el índice parcial de B12.
 */
export const decideRevisionCode = ({
  scheme,
  informedCode,
  proposedCode,
  liveCodes,
}: {
  scheme: RevisionScheme
  informedCode: string | null
  proposedCode: string | null
  liveCodes: string[]
}): RevisionCodeDecision => {
  if (scheme === RevisionScheme.FREE_TEXT) {
    const code = informedCode?.trim()
    if (!code) return { ok: false, reason: "CODE_REQUIRED" }
    if (liveCodes.includes(code)) return { ok: false, reason: "CODE_TAKEN" }
    return { ok: true, code }
  }

  if (informedCode !== null && informedCode.trim() !== proposedCode) {
    return { ok: false, reason: "CODE_NOT_ACCEPTED" }
  }

  // proposedCode nunca es nulo bajo ALPHA ni NUMERIC.
  const code = proposedCode as string
  if (liveCodes.includes(code)) return { ok: false, reason: "CODE_TAKEN" }
  return { ok: true, code }
}
