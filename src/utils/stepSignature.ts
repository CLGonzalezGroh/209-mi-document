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
 */
export const SIGNATURE_PAYLOAD_VERSION = 1

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

export type SignatureInput = {
  step: {
    id: number
    stepType: StepType
    stepOrder: number
  }
  workflowId: number
  revision: {
    id: number
    revisionCode: string
  }
  /**
   * Versión vigente al firmar. Siempre existe: los cuatro tipos que firman
   * actúan después de que someter exigiera al menos una versión (B5).
   */
  version: {
    id: number
    versionNumber: number
    fileKey: string
    checksum: string
  }
  /**
   * Metadata del documento vigente al firmar (B6). Con ella la firma acredita
   * la identificación además del contenido, que es lo que D-05 persigue, y el
   * snapshot por revisión queda resuelto sin estructura nueva.
   */
  document: {
    id: number
    code: string
    title: string
    documentClassId: number | null
    documentTypeId: number | null
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
    },
    version: {
      id: input.version.id,
      versionNumber: input.version.versionNumber,
      fileKey: input.version.fileKey,
      checksum: input.version.checksum,
    },
    document: {
      id: input.document.id,
      code: input.document.code,
      title: input.document.title,
      documentClassId: input.document.documentClassId,
      documentTypeId: input.document.documentTypeId,
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
