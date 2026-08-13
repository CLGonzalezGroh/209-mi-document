import { DocumentRole, StepType } from "../generated/prisma/enums.js"

/**
 * Plantilla del circuito: resolución por alcance y materialización de los pasos
 * (BLOQUE 03, B3).
 *
 * La plantilla **propone** y el armado **define**. Lo que se resuelve acá es qué
 * plantilla corresponde a un documento y qué pasos produce el armado; quién
 * queda designado en cada uno lo decide el armador.
 */

/** Alcance de una plantilla, y también la tupla del documento contra la que se resuelve. */
export type TemplateScope = {
  projectId: number | null
  documentClassId: number | null
  documentTypeId: number | null
}

export type TemplateSnapshot = TemplateScope & {
  id: number
  terminatedAt: Date | null
}

/**
 * Especificidad del alcance: 3 cuando fija el tipo, 2 cuando fija la clase, 1
 * cuando solo fija el proyecto, 0 cuando no fija nada.
 *
 * El tipo pesa más que la clase porque es el refinamiento más fino, y la
 * plantilla del proyecto con clase y tipo nulos **es** su default, sin necesidad
 * de una marca aparte.
 */
const specificity = (template: TemplateScope): number => {
  if (template.documentTypeId !== null) return 3
  if (template.documentClassId !== null) return 2
  if (template.projectId !== null) return 1
  return 0
}

/**
 * Plantilla que rige para un documento: **gana la más específica** —tipo,
 * después clase, después proyecto—.
 *
 * Una columna con valor debe coincidir con la del documento; una en nulo no
 * restringe. La plantilla de proyecto nulo alcanza a los documentos del régimen
 * de publicación (BLOQUE 02, B1), que no pertenecen a ninguno.
 *
 * Las plantillas dadas de baja no participan: proponer un circuito con una
 * plantilla retirada sería reintroducirla por la puerta de atrás.
 */
export const resolveTemplate = <T extends TemplateSnapshot>(
  templates: T[],
  document: TemplateScope,
): T | null => {
  const applicable = templates.filter(
    (t) =>
      t.terminatedAt === null &&
      (t.projectId === null || t.projectId === document.projectId) &&
      (t.documentClassId === null ||
        t.documentClassId === document.documentClassId) &&
      (t.documentTypeId === null ||
        t.documentTypeId === document.documentTypeId),
  )

  if (applicable.length === 0) return null

  return applicable.reduce((best, current) => {
    const diff = specificity(current) - specificity(best)
    if (diff !== 0) return diff > 0 ? current : best
    // Empate de especificidad: gana la última declarada, que es la vigente.
    return current.id > best.id ? current : best
  })
}

/** Paso tal como lo declara la plantilla, o lo designa el armado. */
export type TemplateStepSpec = {
  stepOrder: number
  stepType: StepType
  assignedToId: number | null
}

/** Paso ya materializado: con actor, porque `assignedToId` no admite nulo. */
export type MaterializedStep = {
  stepOrder: number
  stepType: StepType
  assignedToId: number
}

/**
 * Tipos que una plantilla puede declarar. `ASSIGN` y `PREPARE` los pone el
 * sistema: una plantilla que pudiera omitirlos permitiría circuitos sin
 * elaborador, y una que pudiera incluirlos permitiría dos armados.
 */
export const TEMPLATE_STEP_TYPES: readonly StepType[] = [
  StepType.REVIEW,
  StepType.APPROVE,
  StepType.ACKNOWLEDGE,
]

/**
 * Si el rol documental del proyecto tiene paso de elaboración.
 *
 * En el rol Receptor no lo hay: el contratista sube documentación ya aprobada
 * por sus propios medios y la planta no modela su ciclo interno (B16), de modo
 * que el circuito no tiene a quién devolverle el trabajo. Es lo único que este
 * bloque deja preparado para `BLOCK_04`.
 */
export const hasPreparationStep = (role: DocumentRole | null): boolean =>
  role !== DocumentRole.RECEIVER

/**
 * Pasos con que nace el circuito: solo el armado.
 *
 * Los siguientes **no se materializan antes** porque hasta el armado no tienen
 * actor, y `ReviewStep.assignedToId` no admite nulo. Entre el alta y el armado
 * existe el circuito, con su paso pendiente y la plantilla propuesta
 * referenciada: no hay documento sin circuito, hay circuito en armado.
 */
export const initialSteps = (organizerId: number): MaterializedStep[] => [
  { stepOrder: 1, stepType: StepType.ASSIGN, assignedToId: organizerId },
]

export type DefineWorkflowInput = {
  /** Nulo en el rol Receptor, donde la elaboración ocurre fuera del sistema. */
  preparerId: number | null
  /** Revisores, aprobadores y acuses, en el orden en que se recorren. */
  steps: TemplateStepSpec[]
}

export type MaterializationResult =
  | { ok: true; steps: MaterializedStep[] }
  | {
      ok: false
      reason:
        | "PREPARER_REQUIRED" // El rol exige elaboración y no se designó elaborador
        | "PREPARER_NOT_ALLOWED" // El rol Receptor no tiene paso de elaboración
        | "STRUCTURAL_STEP_IN_TEMPLATE" // ASSIGN o PREPARE declarados como paso común
        | "NO_DECIDING_STEP" // Sin REVIEW ni APPROVE el circuito no cerraría nunca
        | "STEP_WITHOUT_ACTOR" // Un paso quedó sin designar
    }

/**
 * Pasos que el armado materializa, a continuación del propio armado.
 *
 * Los valores de la plantilla ya vienen resueltos en `input`: se **copian** y no
 * se referencian, de modo que cambiar la plantilla después no altera ningún
 * circuito en curso. Es el mismo criterio del payload firmado.
 *
 * Exige al menos un paso que decida: sin `REVIEW` ni `APPROVE` el circuito no
 * tendría con qué completarse y la revisión quedaría trabada. El workflow mínimo
 * de D-03 es precisamente el caso límite —un único paso de aprobación—, de modo
 * que la exigencia no agrega estructura, solo impide la que no cierra.
 */
export const materializeSteps = (
  input: DefineWorkflowInput,
  { role }: { role: DocumentRole | null },
): MaterializationResult => {
  const expectsPreparer = hasPreparationStep(role)

  if (expectsPreparer && input.preparerId === null) {
    return { ok: false, reason: "PREPARER_REQUIRED" }
  }
  if (!expectsPreparer && input.preparerId !== null) {
    return { ok: false, reason: "PREPARER_NOT_ALLOWED" }
  }
  if (input.steps.some((s) => !TEMPLATE_STEP_TYPES.includes(s.stepType))) {
    return { ok: false, reason: "STRUCTURAL_STEP_IN_TEMPLATE" }
  }
  if (
    !input.steps.some(
      (s) => s.stepType === StepType.REVIEW || s.stepType === StepType.APPROVE,
    )
  ) {
    return { ok: false, reason: "NO_DECIDING_STEP" }
  }
  if (input.steps.some((s) => s.assignedToId === null)) {
    return { ok: false, reason: "STEP_WITHOUT_ACTOR" }
  }

  // El armado ocupa el orden 1. Los siguientes se renumeran de forma contigua
  // según el orden declarado: la plantilla puede traer huecos, y el circuito no.
  const ordered = [...input.steps].sort((a, b) => a.stepOrder - b.stepOrder)

  const steps: MaterializedStep[] = []
  let stepOrder = 2

  if (input.preparerId !== null) {
    steps.push({
      stepOrder: stepOrder++,
      stepType: StepType.PREPARE,
      assignedToId: input.preparerId,
    })
  }

  for (const step of ordered) {
    steps.push({
      stepOrder: stepOrder++,
      stepType: step.stepType,
      assignedToId: step.assignedToId as number,
    })
  }

  return { ok: true, steps }
}

/**
 * Elenco que hereda el circuito nuevo tras un rechazo: se reinstancia **desde la
 * elaboración**, con los mismos actores (B1).
 *
 * El elenco se **copia y no se referencia**: reasignar un paso del circuito
 * nuevo no debe alterar la historia del anterior. El armado no se repite —el
 * trabajo vuelve al elaborador sin rearmar nada, que es el caso frecuente—.
 */
export const stepsForRejectionRetry = (
  steps: Array<{ stepOrder: number; stepType: StepType; assignedToId: number }>,
): MaterializedStep[] =>
  steps
    .filter((s) => s.stepType !== StepType.ASSIGN)
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((s, index) => ({
      stepOrder: index + 1,
      stepType: s.stepType,
      assignedToId: s.assignedToId,
    }))
