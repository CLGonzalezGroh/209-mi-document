import { DocumentRole } from "../generated/prisma/enums.js"

/**
 * Contratos de prueba con id explícito (BLOQUE 02D, fase 3).
 *
 * Desde que el alcance cuelga de `DocProject` con clave foránea real, una fila
 * con `docProjectId` exige que el contrato exista. Las pruebas venían usando
 * identificadores negativos como convención de fixtures, y esa convención se
 * conserva: el número pasa a ser el id DEL CONTRATO en lugar del proyecto de
 * `mi-project`, de modo que ninguna prueba tiene que reescribir sus constantes.
 *
 * El id se fija a mano a propósito. Dejarlo autogenerar obligaría a cada prueba
 * a hilvanar el id devuelto por todas sus llamadas, que es ruido sin valor: lo
 * que esas pruebas verifican no es cómo se crea un contrato.
 */
export const asegurarContratos = async (
  prisma: {
    docProject: {
      upsert: (args: any) => Promise<unknown>
      deleteMany: (args: any) => Promise<unknown>
    }
  },
  ids: number[],
  documentRole: DocumentRole = DocumentRole.INTERNAL,
): Promise<void> => {
  for (const id of ids) {
    await prisma.docProject.upsert({
      where: { id },
      update: {},
      create: {
        id,
        code: `T-${id}`,
        name: "Contrato de prueba",
        documentRole,
        createdById: 1,
      },
    })
  }
}

export const borrarContratos = async (
  prisma: { docProject: { deleteMany: (args: any) => Promise<unknown> } },
  ids: number[],
): Promise<void> => {
  await prisma.docProject.deleteMany({ where: { id: { in: ids } } })
}
