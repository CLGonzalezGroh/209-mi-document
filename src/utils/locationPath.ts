/**
 * Rutas del catálogo de ubicación física (BLOQUE 02B, B6).
 *
 * La ruta completa de un nodo es una **denormalización de conveniencia**: evita
 * el recorrido recursivo en cada listado y en cada filtro. No acredita nada
 * —la ubicación se edita siempre y no entra en el payload de la firma (B3)— de
 * modo que renombrar o mover un nodo recalcula las rutas de su descendencia de
 * forma automática, sin propagación explícita ni auditada.
 *
 * Es donde este módulo se aparta del precedente de digitalización, que la
 * propaga como acto explícito porque allá el snapshot forma parte de una
 * publicación.
 *
 * Las tres funciones son puras y se prueban sin base: la escritura queda en el
 * resolver, dentro de la transacción del cambio.
 */

/** El mismo separador que usa `CatalogReference` en digitalización. */
export const PATH_SEPARATOR = " / "

export type LocationNode = {
  id: number
  parentId: number | null
  name: string
}

/**
 * La ruta de un nodo: la de su padre más su nombre. Un nodo raíz es su nombre.
 */
export const composePath = (
  parentPath: string | null,
  name: string,
): string => (parentPath ? `${parentPath}${PATH_SEPARATOR}${name}` : name)

/**
 * Rutas del nodo indicado y de toda su descendencia.
 *
 * Recibe el catálogo completo y devuelve solo lo que cuelga de `rootId`, de modo
 * que quien escribe actualiza únicamente esos nodos. `parentPath` es la ruta del
 * padre del nodo raíz del subárbol —nula si pasa a ser raíz—, que es lo que
 * permite usar la misma función para renombrar y para mover.
 *
 * Recorrido por niveles y no recursivo: la profundidad del árbol es libre y no
 * conviene atarla a la pila de llamadas.
 */
export const subtreePaths = ({
  rootId,
  parentPath,
  nodes,
}: {
  rootId: number
  parentPath: string | null
  nodes: LocationNode[]
}): Map<number, string> => {
  const rutas = new Map<number, string>()

  const raiz = nodes.find((n) => n.id === rootId)
  if (!raiz) return rutas

  const hijosPorPadre = new Map<number, LocationNode[]>()
  for (const nodo of nodes) {
    if (nodo.parentId === null) continue
    const hermanos = hijosPorPadre.get(nodo.parentId)
    if (hermanos) hermanos.push(nodo)
    else hijosPorPadre.set(nodo.parentId, [nodo])
  }

  let frontera = [{ id: raiz.id, path: composePath(parentPath, raiz.name) }]

  // La frontera se agota porque el catálogo es un árbol: `wouldCycle` es lo que
  // impide que un movimiento lo convierta en un grafo con ciclos. Aun así se
  // lleva registro de lo visitado, para que un dato ya inconsistente en la base
  // no cuelgue el proceso.
  const visitados = new Set<number>()

  while (frontera.length > 0) {
    const siguiente: Array<{ id: number; path: string }> = []

    for (const { id, path } of frontera) {
      if (visitados.has(id)) continue
      visitados.add(id)
      rutas.set(id, path)

      for (const hijo of hijosPorPadre.get(id) ?? []) {
        siguiente.push({ id: hijo.id, path: composePath(path, hijo.name) })
      }
    }

    frontera = siguiente
  }

  return rutas
}

/**
 * El nodo indicado y toda su descendencia, como conjunto de identificadores.
 *
 * Es lo que necesita filtrar **por rama**: los documentos de un área incluyen los
 * de sus unidades, porque quien pregunta por el área pregunta por lo que hay
 * dentro. Devuelve el conjunto vacío si el nodo no existe, para que un filtro con
 * un identificador inválido no devuelva todo.
 *
 * Comparte la travesía de `subtreePaths` en lugar de repetirla: las rutas que
 * calcula se descartan, y a cambio hay una sola implementación del recorrido y
 * una sola batería de pruebas sobre él. Filtrar por prefijo de la ruta habría
 * evitado la lectura del catálogo, pero dos nodos de alcances distintos pueden
 * tener la misma ruta —el propio de un proyecto y el del despliegue del que
 * salió— y el filtro los mezclaría.
 */
export const subtreeIds = (
  nodes: LocationNode[],
  rootId: number,
): number[] => [...subtreePaths({ rootId, parentPath: null, nodes }).keys()]

/**
 * ¿Mover `nodeId` bajo `newParentId` crearía un ciclo?
 *
 * Sin esta verificación, colgar un nodo de su propio descendiente produce un
 * árbol que ya no es un árbol: la rama queda desconectada de toda raíz y el
 * recálculo de rutas no la alcanza nunca. El precedente de digitalización no lo
 * necesita porque no admite mover un nodo; acá D-14 lo pide.
 */
export const wouldCycle = (
  nodeId: number,
  newParentId: number | null,
  nodes: Array<{ id: number; parentId: number | null }>,
): boolean => {
  if (newParentId === null) return false
  if (newParentId === nodeId) return true

  const padreDe = new Map(nodes.map((n) => [n.id, n.parentId]))

  const visitados = new Set<number>()
  let cursor: number | null | undefined = newParentId

  while (cursor !== null && cursor !== undefined) {
    if (cursor === nodeId) return true
    // Ciclo preexistente en los datos: no es este movimiento el que lo crea, y
    // seguir recorriendo no termina.
    if (visitados.has(cursor)) return false
    visitados.add(cursor)
    cursor = padreDe.get(cursor)
  }

  return false
}
