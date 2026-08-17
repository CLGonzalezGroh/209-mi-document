import type { Prisma } from "../generated/prisma/client.js"
import { DocCatalogKind, DocScopeMode, ModuleType } from "../generated/prisma/enums.js"
import { effectiveMode, scopeWhere } from "./catalogScope.js"

/**
 * El alcance de la clasificación, resuelto en un solo lugar (BLOQUE 02C, B8).
 *
 * Clase y tipo son **un solo sistema de clasificación** y declaran su alcance
 * juntos (B1), de modo que hay una sola declaración —`CLASSIFICATION`— y no una
 * por catálogo. Estas funciones son lo que impide que cada resolver arme su
 * propio criterio: la resolución se expone y no se deriva en cada consumidor.
 *
 * Son cuatro los consumidores —la lista y el selector de cada uno de los dos
 * catálogos— y ninguno debe poder discrepar de otro.
 */

/** El modo con que un proyecto resuelve el catálogo de clasificación. */
export const classificationScopeMode = async (
  client: Prisma.TransactionClient,
  projectId: number,
): Promise<DocScopeMode> => {
  const declarado = await client.docCatalogScope.findUnique({
    where: {
      module_projectId_catalog: {
        module: ModuleType.PROJECTS,
        projectId,
        catalog: DocCatalogKind.CLASSIFICATION,
      },
    },
    select: { mode: true },
  })

  return effectiveMode(declarado?.mode)
}

/**
 * El criterio de las entradas que un ámbito **ve**, para elegir entre ellas.
 *
 * **Sin proyecto rige el ámbito del despliegue, y no todo** (B8): la ausencia de
 * argumento nombra un ámbito en lugar de apagar un filtro. Es lo que conserva
 * intacto el comportamiento de las pantallas existentes, que llaman sin proyecto
 * y administran justamente ese ámbito.
 *
 * Con proyecto, resuelve: las propias más las del despliegue si hereda, o solo
 * las propias si declaró catálogo propio.
 */
export const visibleClassificationWhere = async (
  client: Prisma.TransactionClient,
  projectId: number | null | undefined,
): Promise<{ projectId: number | null } | { OR: [{ projectId: number }, { projectId: null }] }> =>
  projectId === null || projectId === undefined
    ? { projectId: null }
    : scopeWhere({
        projectId,
        mode: await classificationScopeMode(client, projectId),
      })
