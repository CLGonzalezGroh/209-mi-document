import { QualificationEffect } from "../generated/prisma/enums.js"

/**
 * Reglas del catálogo de calificaciones (BLOQUE 04, B11).
 *
 * La calificación es lo que la contraparte responde sobre una emisión. Cada
 * entrada declara su código, su rótulo y su efecto: los dos primeros son lo que
 * el usuario ve, y el efecto es lo único que el sistema interpreta.
 */

/**
 * Las dos preguntas que D-22 usa para explicar el efecto.
 *
 * Se DERIVAN de la enumeración y no se almacenan. Con dos indicadores, la cuarta
 * combinación —no habilita y no obliga— podría escribirse en la base, y habría
 * que impedirla por validación; acá no puede expresarse.
 */

/** ¿Habilita usar el documento? */
export const enablesUse = (effect: QualificationEffect): boolean =>
  effect !== QualificationEffect.REJECTED

/** ¿Obliga a emitir una revisión nueva? */
export const requiresNewRevision = (effect: QualificationEffect): boolean =>
  effect !== QualificationEffect.ACCEPTED

/**
 * Desenlace del paso que produce la calificación, en el circuito del rol
 * Receptor (D-22).
 *
 * El circuito conserva su desenlace interno BINARIO —el paso queda aprobado o
 * rechazado, derivado del efecto— de modo que su lógica no se ramifica. La
 * calificación es lo que el usuario elige y lo que la interfaz muestra.
 */
export const approvesStep = (effect: QualificationEffect): boolean =>
  effect !== QualificationEffect.REJECTED

/**
 * Alcance de la resolución: el proyecto REEMPLAZA al despliegue, no lo hereda.
 *
 * Es una diferencia deliberada con D-21, y conviene enunciarla porque las dos
 * son catálogos con alcance por proyecto. Allá el proyecto puede heredar el
 * catálogo del módulo y ampliarlo, porque una clase documental de más no molesta
 * a nadie. Acá no: la lista de calificaciones es la del CONTRATO, y una lista
 * mezclada —cuatro del despliegue más tres del cliente— no es la de nadie y
 * admite calificar con un valor que la contraparte no usa.
 *
 * Recibe el catálogo COMPLETO, con las entradas dadas de baja incluidas, y
 * decide sobre él: la baja lógica se filtra después. Es lo que impide que dar de
 * baja la última calificación propia devuelva el proyecto al catálogo del
 * despliegue y le cambie en silencio el juego de valores disponibles.
 */
export const resolveScope = <T extends { projectId: number | null }>(
  entradas: T[],
  projectId: number | null,
): T[] => {
  const delDespliegue = entradas.filter((e) => e.projectId === null)

  if (projectId === null) return delDespliegue

  return hasOwnCatalog(entradas, projectId)
    ? entradas.filter((e) => e.projectId === projectId)
    : delDespliegue
}

/**
 * ¿El proyecto declara catálogo propio?
 *
 * Basta con que exista UNA entrada propia, dada de baja o no: declarar la
 * primera es lo que separa al proyecto del catálogo del despliegue.
 */
export const hasOwnCatalog = <T extends { projectId: number | null }>(
  entradas: T[],
  projectId: number,
): boolean => entradas.some((e) => e.projectId === projectId)
