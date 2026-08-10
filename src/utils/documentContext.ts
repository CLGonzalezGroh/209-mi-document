import { GraphQLError } from "graphql"
import { ModuleType } from "../generated/prisma/enums.js"

/**
 * Invariante del contexto de un documento (BLOQUE 02, B1).
 *
 * `Document.projectId` admite nulo en el modelo, pero no en cualquier caso:
 *
 *  - `module = PROJECTS` → el proyecto es OBLIGATORIO. Un documento de proyecto
 *    sin proyecto no es representable;
 *  - cualquier otro módulo → el proyecto queda nulo. Es el régimen de
 *    publicación: documentación que no circula y se gobierna por permiso global
 *    y clasificación.
 *
 * El nulo en el modelo existe para no obligar a un documento de calidad a colgar
 * de un proyecto artificial, no para dejar el dato librado al llamador. Por eso
 * la validación vive acá y no en la base.
 */

export const requiresProject = (module: ModuleType): boolean => module === ModuleType.PROJECTS

/** Devuelve el motivo del incumplimiento, o `null` si el contexto es válido. */
export const documentContextViolation = (
  module: ModuleType,
  projectId: number | null | undefined,
): string | null => {
  const tieneProyecto = projectId !== null && projectId !== undefined

  if (requiresProject(module) && !tieneProyecto) {
    return "Un documento del módulo de proyectos debe pertenecer a un proyecto"
  }

  if (!requiresProject(module) && tieneProyecto) {
    return `Un documento del módulo ${module} no pertenece a un proyecto`
  }

  return null
}

/** Variante que corta la operación, para usar en los resolvers. */
export const assertDocumentContext = (
  module: ModuleType,
  projectId: number | null | undefined,
): void => {
  const violacion = documentContextViolation(module, projectId)

  if (violacion) {
    throw new GraphQLError(violacion, { extensions: { code: "BAD_USER_INPUT" } })
  }
}
