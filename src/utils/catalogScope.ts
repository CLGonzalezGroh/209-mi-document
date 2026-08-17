import { DocScopeMode } from "../generated/prisma/enums.js"

/**
 * Alcance por proyecto de los catálogos documentales (BLOQUE 02B, B1).
 *
 * Dos modos que el proyecto declara **por catálogo**: heredar el del despliegue
 * y ampliarlo, o tener el propio sin verlo. La ausencia de declaración es
 * heredar, que es lo que vuelve aditiva la incorporación del mecanismo.
 *
 * El mecanismo es uno para los tres catálogos —ubicación, clase y tipo—, de modo
 * que estas funciones no saben de árboles: reciben entradas con alcance. Lo
 * específico del árbol son las dos invariantes de cruce del final, que existen
 * porque la ubicación tiene relación de padre y los otros dos no.
 *
 * Todas son puras y se prueban sin base.
 */

/** Lo mínimo que una entrada de catálogo debe exponer para resolver alcance. */
export type ScopedEntry = { projectId: number | null }

/** El modo declarado, o el que rige cuando nadie declaró nada. */
export const effectiveMode = (
  declared: DocScopeMode | null | undefined,
): DocScopeMode => declared ?? DocScopeMode.INHERIT

/**
 * Las entradas que un proyecto ve.
 *
 * Con `INHERIT`, las del despliegue **más** las propias: es un vínculo vivo, de
 * modo que una entrada nueva del despliegue aparece sin que el proyecto haga
 * nada. Con `OWN`, solo las propias.
 *
 * Difiere del `resolveScope` de las calificaciones, y la diferencia es
 * deliberada: allá el proyecto que declara una propia usa las suyas y **solo**
 * las suyas, porque la lista de calificaciones es la del contrato y una lista
 * mezclada no es la de nadie. Acá heredar y ampliar es el caso normal de una
 * planta, y por eso el modo se declara en lugar de derivarse de que existan
 * entradas propias.
 */
export const visibleEntries = <T extends ScopedEntry>(
  entries: T[],
  { projectId, mode }: { projectId: number; mode: DocScopeMode },
): T[] =>
  mode === DocScopeMode.OWN
    ? entries.filter((e) => e.projectId === projectId)
    : entries.filter((e) => e.projectId === projectId || e.projectId === null)

/**
 * Criterio de consulta equivalente a `visibleEntries`, para no traer de la base
 * lo que se va a descartar en memoria.
 *
 * Los dos existen y deben coincidir: el criterio acota la lectura y la función
 * pura es la que se prueba. Es el mismo par que el módulo ya usa en otros lados.
 */
export const scopeWhere = ({
  projectId,
  mode,
}: {
  projectId: number
  mode: DocScopeMode
}): { projectId: number } | { OR: [{ projectId: number }, { projectId: null }] } =>
  mode === DocScopeMode.OWN
    ? { projectId }
    : { OR: [{ projectId }, { projectId: null }] }

// ---------------------------------------------------------------------------
// Invariantes de cruce — propias del catálogo jerárquico
// ---------------------------------------------------------------------------

/**
 * ¿Puede un nodo de alcance `childScope` colgar de uno de alcance `parentScope`?
 *
 * El cruce se admite **en un solo sentido**: un nodo del proyecto cuelga de uno
 * del despliegue, que es exactamente lo que significa *ampliar* —la planta
 * agrega una unidad dentro de un área que ya existe—. Al revés no, porque
 * volvería el árbol global dependiente de un proyecto: quien mira el catálogo del
 * despliegue vería una rama que pertenece a otro, y borrar el proyecto dejaría
 * huérfano un nodo global.
 *
 * Y un proyecto no cuelga del árbol de otro proyecto, que no ve.
 */
export const parentScopeAdmitted = ({
  childScope,
  parentScope,
}: {
  childScope: number | null
  parentScope: number | null
}): boolean => {
  // Del despliegue: solo cuelga del despliegue.
  if (childScope === null) return parentScope === null

  // De un proyecto: cuelga del despliegue —ampliar— o de su propio árbol.
  return parentScope === null || parentScope === childScope
}

/**
 * Los nodos de un proyecto que cuelgan del árbol del despliegue.
 *
 * Es lo que impide declarar catálogo propio: al dejar de heredar, esos nodos
 * quedarían colgados de un padre que el proyecto ya no ve, y la rama se leería
 * como desconectada. Se rechaza el cambio de modo y se nombran los nodos que lo
 * impiden, en lugar de convertirlos en raíces por decisión del sistema —eso
 * reescribiría rutas de nodos que nadie tocó por un cambio de configuración—.
 *
 * Devolver los nodos y no un booleano es lo que permite decir **cuáles**: un
 * rechazo que no dice qué mover obliga a buscarlo a mano.
 */
export const crossScopeChildren = <
  T extends ScopedEntry & { id: number; parentId: number | null },
>(
  nodes: T[],
  projectId: number,
): T[] => {
  const scopeOf = new Map(nodes.map((n) => [n.id, n.projectId]))

  return nodes.filter(
    (n) =>
      n.projectId === projectId &&
      n.parentId !== null &&
      scopeOf.get(n.parentId) === null,
  )
}
