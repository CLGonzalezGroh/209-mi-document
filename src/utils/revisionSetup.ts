import type { Prisma } from "../generated/prisma/client.js"
import {
  DocumentRole,
  RevisionScheme,
  RevisionStatus,
} from "../generated/prisma/enums.js"
import {
  decideRevisionCode,
  lastLiveRevision,
  proposeRevisionCode,
  type RevisionCodeDecision,
} from "./revisionScheme.js"
import { resolveTemplate, type TemplateScope } from "./workflowTemplate.js"

/**
 * Lo que hace falta resolver antes de crear una revisión (BLOQUE 03, B3 y B13):
 * el código, el armador y la plantilla propuesta.
 *
 * Vive acá y no en cada resolver porque `createDocument` y `createRevision`
 * resuelven exactamente lo mismo: la primera con un documento que todavía no
 * existe, la segunda con uno que ya tiene historia.
 */

/**
 * Esquema por defecto del despliegue, último escalón de la precedencia
 * documento ▸ proyecto ▸ despliegue (B13).
 *
 * El registro único puede no existir todavía —se crea al declararlo— y en ese
 * caso rige el valor por defecto del modelo. Es preferible a exigir un seed:
 * un despliegue recién instalado debe poder crear documentos.
 */
export const deploymentRevisionScheme = async (
  client: Prisma.TransactionClient,
): Promise<RevisionScheme> => {
  const settings = await client.docSettings.findUnique({
    where: { id: 1 },
    select: { revisionScheme: true },
  })
  return settings?.revisionScheme ?? RevisionScheme.ALPHA
}

export type ProjectDefaults = {
  revisionScheme: RevisionScheme | null
  defaultOrganizerId: number | null
  documentRole: DocumentRole | null
}

const SIN_PROYECTO: ProjectDefaults = {
  revisionScheme: null,
  defaultOrganizerId: null,
  documentRole: null,
}

/**
 * Lo que el proyecto aporta al alta. Nulo en el régimen de publicación, donde no
 * hay proyecto que consultar y todo cae al escalón del despliegue.
 */
export const projectDefaults = async (
  client: Prisma.TransactionClient,
  docProjectId: number | null,
): Promise<ProjectDefaults> => {
  if (docProjectId === null) return SIN_PROYECTO

  const settings = await client.docProject.findUnique({
    where: { id: docProjectId },
    select: {
      revisionScheme: true,
      defaultOrganizerId: true,
      documentRole: true,
    },
  })
  return settings ?? SIN_PROYECTO
}

/**
 * Plantilla que se propone para el documento, resuelta por alcance.
 *
 * Se traen las candidatas en una sola consulta y la más específica se elige en
 * memoria: el criterio de desempate es el de `resolveTemplate` y conviene que
 * viva en un solo lugar, probado sin base.
 */
export const proposeTemplate = async (
  client: Prisma.TransactionClient,
  scope: TemplateScope,
): Promise<number | null> => {
  const candidates = await client.docWorkflowTemplate.findMany({
    where: {
      OR: [{ docProjectId: null }, { docProjectId: scope.docProjectId ?? undefined }],
    },
    select: {
      id: true,
      docProjectId: true,
      documentClassId: true,
      documentTypeId: true,
      terminatedAt: true,
    },
  })

  return resolveTemplate(candidates, scope)?.id ?? null
}

export type RevisionPlan = {
  revisionCode: string
  organizerId: number
  templateId: number | null
}

/** Motivos por los que no se puede planificar la revisión. */
export type RevisionPlanFailure =
  | Extract<RevisionCodeDecision, { ok: false }>["reason"]
  | "ORGANIZER_REQUIRED"

export type RevisionPlanResult =
  | { ok: true; plan: RevisionPlan }
  | { ok: false; reason: RevisionPlanFailure }

/**
 * Resuelve código, armador y plantilla para la revisión que se va a crear.
 *
 * - **Código**: el sistema lo propone y valida el informado según el esquema
 *   (B13, H-09). Las revisiones abortadas no participan: ni del sucesor ni de
 *   la unicidad, porque no consumen código (B12).
 * - **Armador**: obligatorio. Si no se informa lo aporta el proyecto, de modo
 *   que en la práctica el campo llega lleno (B3).
 * - **Plantilla**: propuesta por alcance, y puede cambiarse. Propone, no impone.
 */
export const planRevision = async (
  client: Prisma.TransactionClient,
  {
    documentId,
    scope,
    chosenScheme,
    informedCode,
    informedOrganizerId,
  }: {
    /** Nulo al crear el documento: todavía no hay revisiones que consultar. */
    documentId: number | null
    scope: TemplateScope
    chosenScheme: RevisionScheme | null
    informedCode: string | null
    informedOrganizerId: number | null
  },
): Promise<RevisionPlanResult> => {
  const defaults = await projectDefaults(client, scope.docProjectId)

  const organizerId = informedOrganizerId ?? defaults.defaultOrganizerId
  if (organizerId === null) {
    return { ok: false, reason: "ORGANIZER_REQUIRED" }
  }

  const revisions = documentId
    ? await client.documentRevision.findMany({
        where: { documentId },
        select: {
          id: true,
          revisionCode: true,
          status: true,
          createdAt: true,
        },
      })
    : []

  const last = lastLiveRevision(revisions)
  const fallbackScheme =
    defaults.revisionScheme ?? (await deploymentRevisionScheme(client))

  // El esquema que rige: el elegido en el momento, o el que revela el último
  // código. Sin revisiones vivas rige la precedencia proyecto ▸ despliegue.
  const scheme = chosenScheme ?? fallbackScheme

  const decision = decideRevisionCode({
    scheme,
    informedCode,
    proposedCode: proposeRevisionCode({
      lastCode: last?.revisionCode ?? null,
      chosenScheme,
      fallbackScheme,
    }),
    liveCodes: revisions
      .filter((r) => r.status !== RevisionStatus.ABANDONED)
      .map((r) => r.revisionCode),
  })

  if (!decision.ok) return { ok: false, reason: decision.reason }

  return {
    ok: true,
    plan: {
      revisionCode: decision.code,
      organizerId,
      templateId: await proposeTemplate(client, scope),
    },
  }
}

/** Mensaje de error de cada motivo, para que los dos resolvers respondan igual. */
export const REVISION_PLAN_MESSAGE: Record<RevisionPlanFailure, string> = {
  ORGANIZER_REQUIRED:
    "Debe designarse un armador. El proyecto no declara uno por defecto.",
  CODE_NOT_ACCEPTED:
    "El código de revisión lo calcula el sistema según el esquema elegido y no admite otro valor.",
  CODE_REQUIRED:
    "El esquema de texto libre exige informar el código de la revisión.",
  CODE_TAKEN: "Ya existe una revisión con ese código para este documento.",
}
