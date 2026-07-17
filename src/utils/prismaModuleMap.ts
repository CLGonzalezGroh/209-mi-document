/**
 * Mapeo entre los `MODULE_IDS` del catálogo común (`mi-common`) y el enum
 * `ModuleType` persistido en Prisma para los documentos.
 *
 * - Cualquier nuevo `MODULE_IDS.*` debe agregarse aquí.
 * - Si el módulo no se puede etiquetar como dueño de documentos, mapear a `null`
 *   (ej.: `documents` y `admin` no se etiquetan a sí mismos).
 *
 * `assertPrismaModuleSync()` se invoca al arranque del subgraph para fallar
 * rápido si el enum Prisma y este mapping divergen.
 */
import { MODULE_IDS, type ModuleId } from "@CLGonzalezGroh/mi-common"
import { ModuleType } from "../generated/prisma/client.js"

export const MODULE_ID_TO_PRISMA: Record<ModuleId, ModuleType | null> = {
  [MODULE_IDS.QUALITY]: ModuleType.QUALITY,
  [MODULE_IDS.PROJECTS]: ModuleType.PROJECTS,
  [MODULE_IDS.DOCUMENTS]: null, // documents no se etiqueta a sí mismo
  [MODULE_IDS.DIGITALIZATION]: null, // digitalization gestiona su propia metadata; no etiqueta documentos en mi-document
  [MODULE_IDS.MANAGEMENT]: ModuleType.MANAGEMENT,
  [MODULE_IDS.COMERCIAL]: ModuleType.COMERCIAL,
  [MODULE_IDS.TAGS]: ModuleType.TAGS,
  [MODULE_IDS.OPERATIONS]: ModuleType.OPERATIONS,
  [MODULE_IDS.ADMIN]: null, // admin no se etiqueta a sí mismo
}

/**
 * Garantiza que cada valor del enum Prisma `ModuleType` esté representado en
 * `MODULE_ID_TO_PRISMA`. Si alguien agrega un valor nuevo a Prisma sin
 * actualizar el mapping (o viceversa), el subgraph falla en el arranque.
 */
export function assertPrismaModuleSync(): void {
  const prismaSet = new Set<ModuleType>(Object.values(ModuleType))
  const mappedSet = new Set<ModuleType>(
    Object.values(MODULE_ID_TO_PRISMA).filter(
      (v): v is ModuleType => v !== null,
    ),
  )
  for (const v of prismaSet) {
    if (!mappedSet.has(v)) {
      throw new Error(`ModuleType.${v} no está mapeado en MODULE_ID_TO_PRISMA`)
    }
  }
}
