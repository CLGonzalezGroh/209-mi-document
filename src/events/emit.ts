import type { Prisma } from "../generated/prisma/client.js"
import {
  AUDIT_ACTION_OBJECT,
  WORKFLOW_EVENT_OBJECT,
  type AuditAction,
  type WorkflowEvent,
} from "./catalog.js"
import { resolveEventContext } from "../utils/objectContext.js"

/**
 * Emisión de eventos de dominio (Bloque 01).
 *
 * El cliente se recibe por parámetro para que la emisión ocurra dentro de la
 * misma transacción que aplica el cambio de estado (B3). `Prisma.TransactionClient`
 * admite tanto el cliente transaccional como el `PrismaClient` completo, de modo
 * que una operación sin transacción también puede emitir.
 *
 * La emisión no captura errores: si el evento no puede registrarse, la operación
 * debe fallar. Un cambio de estado sin su registro es precisamente lo que este
 * bloque viene a evitar.
 */

export type AuditEventInput = {
  action: AuditAction
  /** Nulo cuando la acción no recae sobre un objeto persistido. */
  objectId?: number | null
  /** Nulo cuando la emite el sistema. */
  actorId?: number | null
  meta?: Prisma.InputJsonValue
}

export type WorkflowEventInput = {
  name: WorkflowEvent
  objectId: number
  /** Nulo cuando el objeto no tenía estado previo, como en un alta. */
  fromState?: string | null
  toState?: string | null
  /** Nulo cuando la emite el sistema. */
  actorId?: number | null
}

/** Construye el registro de auditoría. Puro: el tipo de objeto se deriva del catálogo. */
export const buildAuditEvent = (input: AuditEventInput) => ({
  action: input.action,
  objectType: AUDIT_ACTION_OBJECT[input.action],
  objectId: input.objectId ?? null,
  createdById: input.actorId ?? null,
  ...(input.meta !== undefined && { meta: input.meta }),
})

/** Construye el registro de transición. Puro: el tipo de objeto se deriva del catálogo. */
export const buildWorkflowEvent = (input: WorkflowEventInput) => ({
  name: input.name,
  objectType: WORKFLOW_EVENT_OBJECT[input.name],
  objectId: input.objectId,
  fromState: input.fromState ?? null,
  toState: input.toState ?? null,
  createdById: input.actorId ?? null,
})

/**
 * Registra una acción ejecutada por un usuario o por el sistema.
 * El contexto —proyecto y módulo— se deriva del objeto afectado (B9).
 */
export const emitAuditEvent = async (
  client: Prisma.TransactionClient,
  input: AuditEventInput,
): Promise<void> => {
  const evento = buildAuditEvent(input)
  const contexto = await resolveEventContext(
    client,
    evento.objectType,
    evento.objectId,
  )

  await client.docAuditEvent.create({ data: { ...evento, ...contexto } })
}

/** Registra una transición de estado, con el contexto derivado del objeto (B9). */
export const emitWorkflowEvent = async (
  client: Prisma.TransactionClient,
  input: WorkflowEventInput,
): Promise<void> => {
  const evento = buildWorkflowEvent(input)
  const contexto = await resolveEventContext(
    client,
    evento.objectType,
    evento.objectId,
  )

  await client.docWorkflowEvent.create({ data: { ...evento, ...contexto } })
}

/**
 * Registra varias transiciones en una sola operación.
 * Una acción puede producir varias transiciones (B4): al completarse un circuito
 * se aprueba la revisión y se deja en `SUPERSEDED` a cada revisión anterior.
 *
 * El contexto se deriva por objeto, no una sola vez: las transiciones de una
 * misma acción pueden recaer sobre objetos distintos.
 */
export const emitWorkflowEvents = async (
  client: Prisma.TransactionClient,
  inputs: WorkflowEventInput[],
): Promise<void> => {
  if (inputs.length === 0) return

  const eventos = await Promise.all(
    inputs.map(async (input) => {
      const evento = buildWorkflowEvent(input)
      const contexto = await resolveEventContext(
        client,
        evento.objectType,
        evento.objectId,
      )

      return { ...evento, ...contexto }
    }),
  )

  await client.docWorkflowEvent.createMany({ data: eventos })
}
