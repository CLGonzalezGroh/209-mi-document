import { GraphQLError } from "graphql"
import {
  DocumentRole,
  QualificationEffect,
  RevisionStatus,
  StepType,
} from "../generated/prisma/enums.js"

/**
 * El circuito del rol Receptor (BLOQUE 04, B12).
 *
 * Ejecuta lo que `B16` de `BLOCK_03` dejó habilitado y no implementó. Las dos
 * diferencias del rol se desprenden de **un solo hecho**: allí la elaboración no
 * ocurre dentro del sistema. El contratista sube documentación ya aprobada por
 * sus propios medios y la planta no modela su ciclo interno (D-18), de modo que
 * el circuito no tiene a quién devolverle el trabajo.
 *
 * La regla uniforme es que **el rechazo devuelve el trabajo a quien elabora**; lo
 * que cambia es dónde vive esa persona.
 */

/** ¿El circuito de este proyecto concluye la revisión en lugar de devolverla? */
export const concludesRevision = (role: DocumentRole | null): boolean =>
  role === DocumentRole.RECEIVER

/**
 * Estado en que queda la revisión al concluir el circuito, en modo Receptor.
 *
 * `REJECTED` no es el `OBSOLETE` que `BLOCK_03B` retiró: obsoleto es lo que dejó
 * de aplicar, y esto es una emisión que la contraparte no aceptó.
 *
 * **Consume código**, a diferencia de `ABANDONED`: salió y la contraparte la
 * recibió con él. La secuencia sigue de largo en los tres desenlaces —aprobada,
 * aprobada con comentarios o rechazada—, de modo que rechazada la `A`, la
 * siguiente es la `B`. Que el rechazo no implique avance contractual es otro
 * asunto, y no se expresa en el código de revisión.
 */
export const terminalStatusFor = (aprueba: boolean): RevisionStatus =>
  aprueba ? RevisionStatus.APPROVED : RevisionStatus.REJECTED

/**
 * La calificación es la conclusión del circuito, no un dato al lado.
 *
 * Se exige exactamente cuando la resolución **cierra** el circuito: al aprobar
 * el último paso que decide, o al rechazar en cualquiera. Un paso intermedio que
 * aprueba no la lleva, porque todavía no hay respuesta que dar.
 *
 * Y se prohíbe fuera del modo Receptor: en Emisor la calificación la produce el
 * cliente y la transcribe el control documental (D-12), no el circuito interno.
 */
export const qualificationRequirement = (
  role: DocumentRole,
  concluye: boolean,
  qualificationId: number | undefined,
): string | null => {
  if (!concludesRevision(role)) {
    return qualificationId
      ? "La calificación es la respuesta de la contraparte y solo la produce el circuito en modo Receptor"
      : null
  }

  if (concluye && !qualificationId) {
    return "En modo Receptor el circuito concluye con la calificación: indique con cuál"
  }

  if (!concluye && qualificationId) {
    return "La calificación se registra al concluir el circuito, no en un paso intermedio"
  }

  return null
}

export const assertQualificationRequirement = (
  role: DocumentRole,
  concluye: boolean,
  qualificationId: number | undefined,
): void => {
  const violacion = qualificationRequirement(role, concluye, qualificationId)

  if (violacion) {
    throw new GraphQLError(violacion, { extensions: { code: "BAD_USER_INPUT" } })
  }
}

/**
 * El desenlace del paso se DERIVA del efecto de la calificación (D-22).
 *
 * El circuito conserva su desenlace interno binario, de modo que su lógica no se
 * ramifica: la calificación es lo que el usuario elige y lo que la interfaz
 * muestra, y el paso queda aprobado o rechazado según su efecto.
 */
export const stepOutcomeOf = (effect: QualificationEffect): boolean =>
  effect !== QualificationEffect.REJECTED

/**
 * Y por eso la operación elegida tiene que coincidir con el efecto.
 *
 * Sin esta verificación el desenlace **no** se derivaría del efecto: se podría
 * rechazar el paso con una calificación que habilita el documento, o aprobarlo
 * con una que lo rechaza, y el circuito quedaría diciendo lo contrario que la
 * respuesta que la contraparte lee.
 */
export const outcomeMismatch = (
  effect: QualificationEffect,
  apruebaElPaso: boolean,
): string | null => {
  if (stepOutcomeOf(effect) === apruebaElPaso) return null

  return apruebaElPaso
    ? "Esa calificación rechaza el documento: el paso no puede aprobarse con ella"
    : "Esa calificación no rechaza el documento: el paso no puede rechazarse con ella"
}

export const assertOutcomeMatches = (
  effect: QualificationEffect,
  apruebaElPaso: boolean,
): void => {
  const violacion = outcomeMismatch(effect, apruebaElPaso)

  if (violacion) {
    throw new GraphQLError(violacion, { extensions: { code: "BAD_USER_INPUT" } })
  }
}

/**
 * El armado del rol Receptor lo resuelve el sistema, no una persona (B12).
 *
 * D-03 sostiene que el armado siempre tiene contenido **porque el elaborador
 * nunca se preasigna**. En modo Receptor no hay elaborador: con la plantilla
 * completa el armado queda literalmente vacío, y no hay nada que decidir.
 *
 * La plantilla resuelve su alcance por proyecto, clase y tipo —que en proyectos
 * son la disciplina y el tipo de documento— con actores preasignados. Es la
 * matriz de responsabilidad para esos ejes; lo que la matriz agregaría es el
 * área, que depende de D-14.
 *
 * Devuelve los pasos a materializar, o `null` cuando la plantilla no alcanza:
 * ahí el armado queda pendiente y la planta lo resuelve a mano. Es una red y no
 * el camino normal — rechazar la emisión dejaría al contratista trabado por una
 * configuración que él no puede corregir.
 */
export const autoAssignableSteps = <
  T extends { stepOrder: number; stepType: StepType; assignedToId: number | null },
>(
  role: DocumentRole | null,
  templateSteps: T[] | null | undefined,
): Array<{ stepOrder: number; stepType: StepType; assignedToId: number }> | null => {
  if (!concludesRevision(role)) return null
  if (!templateSteps?.length) return null

  // Todos los actores preasignados: uno solo sin actor deja el armado con algo
  // que decidir, y entonces no puede resolverlo el sistema.
  if (templateSteps.some((s) => s.assignedToId === null)) return null

  return templateSteps.map((s) => ({
    stepOrder: s.stepOrder,
    stepType: s.stepType,
    assignedToId: s.assignedToId as number,
  }))
}

