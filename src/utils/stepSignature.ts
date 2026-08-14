import { createHash } from "node:crypto"
import { StepStatus, StepType } from "../generated/prisma/enums.js"

/**
 * Firma de un paso del circuito (BLOQUE 03, B7 y D-05).
 *
 * La firma acredita **quién resolvió y qué resolvió**. Para que sea verificable
 * se persiste el payload canónico serializado junto con el hash y el algoritmo:
 * un hash sin sus insumos no es verificable, que es el defecto de H-06, donde
 * `SHA-256(stepId + userId + timestamp + action)` no guardaba nada de lo que
 * afirmaba acreditar.
 *
 * Verificar es recalcular el hash **sobre el payload guardado**, y no sobre
 * entidades que pudieron cambiar después.
 */

export const SIGNATURE_ALGORITHM = "SHA-256"

/**
 * Versión del formato del payload. Se firma junto con el resto: sin ella, un
 * cambio futuro en la forma del payload dejaría las firmas viejas indistinguibles
 * de las nuevas y no se sabría con qué reglas recalcularlas.
 *
 * `2` (BLOQUE 03B): la versión pasó a ser un CONJUNTO de archivos (B6) y la
 * identificación pasó a la revisión (B1). Las firmas en `1` siguen verificando
 * con su propia forma, porque verificar es recalcular sobre el payload guardado
 * y no reconstruirlo desde las entidades.
 */
export const SIGNATURE_PAYLOAD_VERSION = 2

/** Los pasos que actúan sobre una versión firman. ASSIGN no (B7). */
export const SIGNING_STEP_TYPES: readonly StepType[] = [
  StepType.PREPARE,
  StepType.REVIEW,
  StepType.APPROVE,
  StepType.ACKNOWLEDGE,
]

/**
 * Si el paso produce firma al resolverse.
 *
 * ASSIGN no firma: al completarse puede no existir todavía ninguna versión —el
 * documento nace sin archivo (B5)—, de modo que no habría objeto que acreditar.
 * Su evidencia es el evento de auditoría, que registra quién designó a quién.
 */
export const signsStep = (stepType: StepType): boolean =>
  SIGNING_STEP_TYPES.includes(stepType)

/** Estado terminal que la firma acredita: cumplimiento, aprobación o rechazo. */
export type SignatureAction =
  | typeof StepStatus.COMPLETED
  | typeof StepStatus.APPROVED
  | typeof StepStatus.REJECTED

/** Un archivo del conjunto de la versión, tal como se acredita. */
export type SignedFile = {
  role: string
  fileKey: string
  fileName: string
  checksum: string
}

export type SignatureInput = {
  step: {
    id: number
    stepType: StepType
    stepOrder: number
  }
  workflowId: number
  /**
   * La revisión, con su IDENTIFICACIÓN (BLOQUE 03B, B1). El título, la clase y
   * el tipo viajan acá y no bajo `document` porque es donde viven: están
   * impresos en el rótulo del archivo, y lo impreso pertenece a la emisión que
   * lo produjo. Con ellos la firma acredita la identificación además del
   * contenido, que es lo que D-05 persigue.
   */
  revision: {
    id: number
    revisionCode: string
    title: string
    documentClassId: number | null
    documentTypeId: number | null
  }
  /**
   * Versión vigente al firmar, con TODOS sus archivos. Siempre existe: los
   * cuatro tipos que firman actúan después de que someter exigiera al menos una
   * versión (B5).
   *
   * Acredita también lo que nadie revisó, y esa es la razón de la decisión
   * (BLOQUE 03B, B8): la custodia del editable importa porque es la fuente del
   * entregable. Si pudiera sustituirse sin producir versión nueva, la
   * correspondencia entre uno y otro sería una afirmación sin evidencia; que
   * hayan sido firmados juntos es lo que la sostiene.
   */
  version: {
    id: number
    versionNumber: number
    files: SignedFile[]
  }
  /**
   * El documento aporta lo que es suyo: su identidad. El código no cambia
   * (B3), de modo que es lo único que no necesita snapshot — y precisamente por
   * eso se firma, porque es lo que ata la evidencia a un documento concreto.
   */
  document: {
    id: number
    code: string
  }
  assignedToId: number
  resolvedById: number
  /** Obligatorio cuando quien resuelve no es el asignado (B9). */
  delegationReason: string | null
  action: SignatureAction
  signedAt: Date
}

type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue }

/**
 * Serialización canónica: claves ordenadas en todos los niveles.
 *
 * `JSON.stringify` conserva el orden de inserción, de modo que dos payloads con
 * el mismo contenido construido en otro orden producirían hashes distintos.
 * Ordenar las claves vuelve la serialización dependiente solo del contenido.
 */
const canonicalize = (value: CanonicalValue): CanonicalValue => {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(canonicalize)

  const sorted: { [key: string]: CanonicalValue } = {}
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalize(value[key])
  }
  return sorted
}

/**
 * Los archivos de la versión, en orden DETERMINÍSTICO: por rol y después por
 * `fileKey`.
 *
 * `canonicalize` ordena las claves de los objetos pero **conserva el orden de
 * los arreglos**, de modo que dejar la lista en el orden en que la devolvió la
 * consulta haría que el mismo conjunto produjera hashes distintos. El orden se
 * fija acá y no se confía a la base.
 */
export const orderSignedFiles = (files: SignedFile[]): SignedFile[] =>
  [...files].sort(
    (a, b) => a.role.localeCompare(b.role) || a.fileKey.localeCompare(b.fileKey),
  )

/** Payload canónico serializado, tal como se persiste y tal como se firma. */
export const buildSignaturePayload = (input: SignatureInput): string => {
  const payload: CanonicalValue = {
    payloadVersion: SIGNATURE_PAYLOAD_VERSION,
    action: input.action,
    signedAt: input.signedAt.toISOString(),
    step: {
      id: input.step.id,
      stepType: input.step.stepType,
      stepOrder: input.step.stepOrder,
    },
    workflowId: input.workflowId,
    revision: {
      id: input.revision.id,
      revisionCode: input.revision.revisionCode,
      title: input.revision.title,
      documentClassId: input.revision.documentClassId,
      documentTypeId: input.revision.documentTypeId,
    },
    version: {
      id: input.version.id,
      versionNumber: input.version.versionNumber,
      files: orderSignedFiles(input.version.files).map((f) => ({
        role: f.role,
        fileKey: f.fileKey,
        fileName: f.fileName,
        checksum: f.checksum,
      })),
    },
    document: {
      id: input.document.id,
      code: input.document.code,
    },
    actor: {
      assignedToId: input.assignedToId,
      resolvedById: input.resolvedById,
      delegationReason: input.delegationReason,
    },
  }

  return JSON.stringify(canonicalize(payload))
}

const hashOf = (payload: string): string =>
  createHash("sha256").update(payload, "utf8").digest("hex")

export type Signature = {
  algorithm: string
  payload: string
  hash: string
}

/** Construye la firma: payload canónico, algoritmo y hash. */
export const buildSignature = (input: SignatureInput): Signature => {
  const payload = buildSignaturePayload(input)
  return { algorithm: SIGNATURE_ALGORITHM, payload, hash: hashOf(payload) }
}

export type SignatureVerification =
  | { valid: true }
  | { valid: false; reason: "HASH_MISMATCH" | "UNSUPPORTED_ALGORITHM"; expectedHash?: string }

/**
 * Verifica una firma persistida recalculando el hash sobre su propio payload.
 *
 * No reconstruye el payload desde las entidades: la revisión, la versión y la
 * metadata pueden haber cambiado, y precisamente por eso la firma guarda lo que
 * firmó. Lo que esta verificación responde es si la evidencia fue alterada.
 */
export const verifySignature = (signature: Signature): SignatureVerification => {
  if (signature.algorithm !== SIGNATURE_ALGORITHM) {
    return { valid: false, reason: "UNSUPPORTED_ALGORITHM" }
  }

  const expectedHash = hashOf(signature.payload)
  if (expectedHash !== signature.hash) {
    return { valid: false, reason: "HASH_MISMATCH", expectedHash }
  }

  return { valid: true }
}
