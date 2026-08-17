import { GraphQLError } from "graphql"
import type { Prisma } from "../generated/prisma/client.js"
import {
  DocCatalogKind,
  DocScopeMode,
  ModuleType,
} from "../generated/prisma/enums.js"
import { effectiveMode, entryVisible } from "./catalogScope.js"

/**
 * La ubicación física del documento (BLOQUE 02B, B3 y B4).
 *
 * Cuatro reglas, todas de escritura y ninguna del modelo, con la orientación de
 * D-13: cambiar la configuración nunca revalida ni invalida lo ya clasificado.
 *
 * 1. **es opcional en los tres roles**, y la obligatoriedad se configura por
 *    proyecto. Se corrige acá la expectativa de D-14 de que "una planta lo
 *    exigirá": la planta lo usa para filtrar;
 * 2. **el nodo debe estar dentro del alcance del documento** — el árbol que su
 *    proyecto ve, o el del despliegue si no tiene proyecto—. Es la misma regla de
 *    visibilidad de B1, aplicada a una entrada;
 * 3. **un nodo dado de baja no se elige**, aunque los documentos que ya lo
 *    tienen lo conserven;
 * 4. **con el atributo deshabilitado no se declara ubicación**, y no es lo mismo
 *    que no ser obligatorio.
 *
 * La función es pura: el resolver aporta la lectura del nodo y de la
 * configuración, y traduce el motivo a mensaje.
 */

export type LocationRejection =
  | "DISABLED"
  | "REQUIRED"
  | "OUT_OF_SCOPE"
  | "TERMINATED"

export type LocationCheck = { ok: true } | { ok: false; reason: LocationRejection }

const OK: LocationCheck = { ok: true }

/** Configuración del atributo en el proyecto, o la que rige sin proyecto. */
export type LocationSettings = {
  enabled: boolean
  required: boolean
}

/**
 * El nodo elegido, tal como la base lo devuelve. `null` cuando el documento no
 * declara ubicación.
 */
export type ChosenLocation = {
  projectId: number | null
  terminatedAt: Date | null
} | null

/**
 * Ámbito del documento: su proyecto y el modo con que resuelve el catálogo.
 *
 * `projectId` nulo es el régimen de publicación —calidad, comercial, activos—,
 * que no tiene proyecto y por lo tanto usa el árbol del despliegue. No es una
 * ausencia sino un ámbito, con el criterio de B1 de BLOQUE 02.
 */
export type DocumentScope = {
  projectId: number | null
  mode: DocScopeMode
}

export const checkLocation = ({
  chosen,
  settings,
  scope,
}: {
  chosen: ChosenLocation
  settings: LocationSettings
  scope: DocumentScope
}): LocationCheck => {
  if (chosen === null) {
    // Obligatorio solo si además está habilitado: exigir un atributo que no se
    // puede declarar sería una contradicción, y no una regla estricta.
    return settings.enabled && settings.required ? { ok: false, reason: "REQUIRED" } : OK
  }

  if (!settings.enabled) return { ok: false, reason: "DISABLED" }

  if (chosen.terminatedAt !== null) return { ok: false, reason: "TERMINATED" }

  // Sin proyecto rige el árbol del despliegue, y solo él: el régimen de
  // publicación no hereda de ningún proyecto porque no pertenece a ninguno.
  const visible =
    scope.projectId === null
      ? chosen.projectId === null
      : entryVisible(chosen.projectId, {
          projectId: scope.projectId,
          mode: scope.mode,
        })

  return visible ? OK : { ok: false, reason: "OUT_OF_SCOPE" }
}

/**
 * Resuelve y valida la ubicación de un documento, contra la base.
 *
 * Devuelve el snapshot de la ruta a guardar, o `null` si el documento no declara
 * ubicación. Rechaza con el mensaje del motivo, que vive en un solo lugar.
 *
 * Reúne las tres lecturas que la regla pura necesita —la configuración del
 * proyecto, el modo con que resuelve el catálogo y el nodo elegido— para que
 * ningún resolver las junte por su cuenta.
 */
export const resolveDocumentLocation = async (
  client: Prisma.TransactionClient,
  {
    locationId,
    projectId,
  }: { locationId: number | null; projectId: number | null },
): Promise<string | null> => {
  // Sin proyecto rige el valor por defecto: habilitado y no obligatorio. El
  // escalón de módulo que el plan tiene diferido es lo que permitiría a calidad,
  // comercial o activos exigirla; hoy no tienen dónde declararlo.
  const settings =
    projectId === null
      ? null
      : await client.docProjectSettings.findUnique({
          where: { projectId },
          select: { locationEnabled: true, locationRequired: true },
        })

  const chosen =
    locationId === null
      ? null
      : await client.docLocation.findUnique({
          where: { id: locationId },
          select: { projectId: true, terminatedAt: true, path: true },
        })

  if (locationId !== null && !chosen) {
    throw new GraphQLError("La ubicación indicada no existe", {
      extensions: { code: "BAD_USER_INPUT" },
    })
  }

  const declarado =
    projectId === null
      ? null
      : await client.docCatalogScope.findUnique({
          where: {
            module_projectId_catalog: {
              module: ModuleType.PROJECTS,
              projectId,
              catalog: DocCatalogKind.LOCATION,
            },
          },
          select: { mode: true },
        })

  const check = checkLocation({
    chosen,
    settings: {
      enabled: settings?.locationEnabled ?? true,
      required: settings?.locationRequired ?? false,
    },
    scope: { projectId, mode: effectiveMode(declarado?.mode) },
  })

  if (!check.ok) {
    throw new GraphQLError(LOCATION_MESSAGE[check.reason], {
      extensions: { code: "BAD_USER_INPUT" },
    })
  }

  return chosen?.path ?? null
}

/** El mensaje de cada rechazo, en un solo lugar. */
export const LOCATION_MESSAGE: Record<LocationRejection, string> = {
  DISABLED:
    "El proyecto tiene deshabilitado el atributo de ubicación física: no se puede declarar una.",
  REQUIRED: "El proyecto exige declarar la ubicación física del documento.",
  OUT_OF_SCOPE:
    "La ubicación elegida no pertenece al catálogo que el proyecto resuelve.",
  TERMINATED:
    "La ubicación elegida está dada de baja: elija otra vigente. Los documentos que ya la tenían la conservan.",
}
