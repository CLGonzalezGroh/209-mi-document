import { GraphQLError } from "graphql"
import type { Prisma } from "../generated/prisma/client.js"
import { DocCatalogKind, DocScopeMode, ModuleType } from "../generated/prisma/enums.js"
import {
  effectiveMode,
  entryVisible,
  parentScopeAdmitted,
  scopeWhere,
} from "./catalogScope.js"

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

export type ClassificationRejection =
  | "CLASS_OUT_OF_SCOPE"
  | "TYPE_OUT_OF_SCOPE"
  | "CLASS_SCOPE_CROSSING"

/** El mensaje de cada rechazo, en un solo lugar. */
export const CLASSIFICATION_MESSAGE: Record<ClassificationRejection, string> = {
  CLASS_OUT_OF_SCOPE:
    "La clase elegida no pertenece al catálogo que este ámbito resuelve.",
  TYPE_OUT_OF_SCOPE:
    "El tipo elegido no pertenece al catálogo que este ámbito resuelve.",
  CLASS_SCOPE_CROSSING:
    "Un tipo del despliegue no puede colgar de una clase de proyecto: el catálogo global quedaría dependiendo de un proyecto. Al revés sí, que es lo que significa ampliar.",
}

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

/**
 * La clase y el tipo elegidos están dentro del alcance del ámbito que clasifica
 * (BLOQUE 02C, B7).
 *
 * Es la misma regla de visibilidad que resuelve el selector, aplicada a una
 * entrada concreta: sin ella, quien conoce un identificador podría clasificar
 * con una entrada que su proyecto no ve, y el selector sería una sugerencia en
 * lugar de un límite.
 *
 * `projectId` nulo es el régimen de publicación —calidad, comercial, activos—,
 * que resuelve el catálogo del despliegue **y solo él**: no hereda de ningún
 * proyecto porque no pertenece a ninguno.
 *
 * No valida que la entrada esté vigente. Es deliberado y no un olvido: lo ya
 * clasificado no se revalida (D-13), y rechazar una entrada dada de baja sería
 * una regla nueva que este bloque no definió.
 */
export const assertClassificationInScope = async (
  client: Prisma.TransactionClient,
  {
    projectId,
    documentClassId,
    documentTypeId,
  }: {
    projectId: number | null
    documentClassId?: number | null
    documentTypeId?: number | null
  },
): Promise<void> => {
  if (
    (documentClassId === undefined || documentClassId === null) &&
    (documentTypeId === undefined || documentTypeId === null)
  ) {
    return
  }

  const mode =
    projectId === null ? null : await classificationScopeMode(client, projectId)

  const alcanza = (entryScope: number | null): boolean =>
    projectId === null || mode === null
      ? entryScope === null
      : entryVisible(entryScope, { projectId, mode })

  if (documentClassId !== undefined && documentClassId !== null) {
    const clase = await client.documentClass.findUnique({
      where: { id: documentClassId },
      select: { projectId: true },
    })

    if (!clase || !alcanza(clase.projectId)) {
      throw new GraphQLError(CLASSIFICATION_MESSAGE.CLASS_OUT_OF_SCOPE, {
        extensions: { code: "BAD_USER_INPUT" },
      })
    }
  }

  if (documentTypeId !== undefined && documentTypeId !== null) {
    const tipo = await client.documentType.findUnique({
      where: { id: documentTypeId },
      select: { projectId: true },
    })

    if (!tipo || !alcanza(tipo.projectId)) {
      throw new GraphQLError(CLASSIFICATION_MESSAGE.TYPE_OUT_OF_SCOPE, {
        extensions: { code: "BAD_USER_INPUT" },
      })
    }
  }
}

/**
 * La clase de la que un tipo cuelga admite su alcance (BLOQUE 02C, B7).
 *
 * Reutiliza `parentScopeAdmitted`, que **no es del árbol** aunque haya nacido
 * ahí: la regla compara dos alcances y no dos nodos. El cruce va en un solo
 * sentido —un tipo del proyecto cuelga de una clase del despliegue, que es lo
 * que significa ampliar; al revés volvería el catálogo global dependiente de un
 * proyecto—.
 */
export const assertClassScopeAdmitted = async (
  client: Prisma.TransactionClient,
  { typeScope, classId }: { typeScope: number | null; classId: number | null },
): Promise<void> => {
  if (classId === null) return

  const clase = await client.documentClass.findUnique({
    where: { id: classId },
    select: { projectId: true },
  })

  if (!clase) {
    throw new GraphQLError("La clase indicada no existe", {
      extensions: { code: "BAD_USER_INPUT" },
    })
  }

  if (!parentScopeAdmitted({ childScope: typeScope, parentScope: clase.projectId })) {
    throw new GraphQLError(CLASSIFICATION_MESSAGE.CLASS_SCOPE_CROSSING, {
      extensions: { code: "BAD_USER_INPUT" },
    })
  }
}
