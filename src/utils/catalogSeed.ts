import { DocLocationOrigin } from "../generated/prisma/enums.js"
import { PATH_SEPARATOR } from "./locationPath.js"

/**
 * Siembra por copia del catálogo de ubicación (BLOQUE 02B, B2).
 *
 * La siembra es **puntual**: copia lo que hay en la fuente al momento de
 * ejecutarse y no deja vínculo. Una copia permanente **es** herencia, y llamarla
 * de otro modo daría dos formas de lo mismo.
 *
 * Cuatro reglas, y las cuatro se deciden acá:
 *
 * 1. **la identidad de un nodo es su ruta completa.** Copiar un árbol no es
 *    copiar una lista: dos nodos son el mismo nodo cuando su ruta coincide, y no
 *    cuando coincide su código —el mismo código puede repetirse en dos plantas—.
 *    De ahí sale todo lo demás;
 * 2. **la fuente es lo que la fuente VE**, con su alcance resuelto. Así el
 *    despliegue y otro proyecto son una sola regla y no dos;
 * 3. **el destino se compara por lo que VE**, no por lo que tiene propio. Sembrar
 *    el árbol del despliegue en un proyecto que hereda no agrega nada, que es lo
 *    correcto: ya lo ve. Y nunca se crea una copia propia que tape a una heredada;
 * 4. **solo se copia lo vigente con ascendencia vigente.** Un nodo dado de baja
 *    no se copia, y su descendencia tampoco: la rama no tendría de qué colgar.
 *
 * La consecuencia de la primera es que sembrar es **incremental e idempotente**:
 * dos veces no duplica, y una fuente parcialmente solapada agrega solo las ramas
 * que faltan, colgándolas de los nodos que el destino ya tiene.
 *
 * Todo es puro y se prueba sin base. Lo que el resolver aporta es el orden de
 * escritura y la resolución de cada ruta a su identificador.
 */

/** Lo que la siembra necesita leer de cada nodo de la fuente. */
export type SeedSourceNode = {
  id: number
  parentId: number | null
  code: string
  name: string
  path: string
  sortOrder: number
  externalOrigin: DocLocationOrigin | null
  externalRef: string | null
  terminatedAt: Date | null
}

/**
 * Un nodo a crear en el destino.
 *
 * Lleva `parentPath` y no `parentId` porque el identificador del padre en el
 * destino todavía no existe cuando el plan se arma: puede ser un nodo que el
 * destino ya tenía, o uno que esta misma siembra crea unos pasos antes.
 */
export type SeedStep = {
  sourceId: number
  code: string
  name: string
  path: string
  parentPath: string | null
  sortOrder: number
  externalOrigin: DocLocationOrigin | null
  externalRef: string | null
}

export type SeedPlan = {
  /** En orden de creación: un padre siempre antes que sus hijos. */
  steps: SeedStep[]
  /** Nodos de la fuente que el destino ya ve, por su ruta. */
  alreadyPresent: number
  /** Nodos no copiados por estar dados de baja, ellos o algún ascendiente. */
  skippedTerminated: number
}

/** La profundidad de un nodo, leída de su ruta. */
const depthOf = (path: string): number => path.split(PATH_SEPARATOR).length

/**
 * Qué copiar de la fuente al destino, y en qué orden.
 *
 * `destinationPaths` son las rutas que el destino **ve** —propias y heredadas—,
 * y no solo las propias.
 */
export const planSeed = ({
  source,
  destinationPaths,
}: {
  source: SeedSourceNode[]
  destinationPaths: Iterable<string>
}): SeedPlan => {
  const presentes = new Set(destinationPaths)
  const porId = new Map(source.map((n) => [n.id, n]))

  /**
   * ¿El nodo y toda su ascendencia están vigentes?
   *
   * Un ascendiente ausente del conjunto cuenta como no vigente: si la fuente no
   * lo ve, la rama no es reconstruible desde su vista.
   */
  const conAscendenciaVigente = (nodo: SeedSourceNode): boolean => {
    let cursor: SeedSourceNode | undefined = nodo
    const visitados = new Set<number>()

    while (cursor) {
      if (cursor.terminatedAt !== null) return false
      if (visitados.has(cursor.id)) return false // dato inconsistente
      visitados.add(cursor.id)

      if (cursor.parentId === null) return true
      cursor = porId.get(cursor.parentId)
    }

    return false
  }

  const copiables = source.filter(conAscendenciaVigente)
  const skippedTerminated = source.length - copiables.length

  // Por profundidad y después por ruta: el padre siempre queda antes que el
  // hijo, y el orden es determinista para que dos corridas iguales produzcan la
  // misma secuencia.
  const ordenados = [...copiables].sort(
    (a, b) => depthOf(a.path) - depthOf(b.path) || a.path.localeCompare(b.path),
  )

  const steps: SeedStep[] = []
  let alreadyPresent = 0

  for (const nodo of ordenados) {
    if (presentes.has(nodo.path)) {
      alreadyPresent++
      continue
    }

    const padre = nodo.parentId === null ? null : porId.get(nodo.parentId)

    steps.push({
      sourceId: nodo.id,
      code: nodo.code,
      name: nodo.name,
      path: nodo.path,
      parentPath: padre?.path ?? null,
      sortOrder: nodo.sortOrder,
      externalOrigin: nodo.externalOrigin,
      externalRef: nodo.externalRef,
    })
  }

  return { steps, alreadyPresent, skippedTerminated }
}
