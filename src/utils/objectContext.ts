import type { Prisma } from "../generated/prisma/client.js"
import { DocObjectType, ModuleType } from "../generated/prisma/enums.js"

/**
 * Contexto de un evento de dominio (BLOQUE 02, B9).
 *
 * `projectId` y `module` se DERIVAN del objeto afectado y **no los informa quien
 * emite**. Es la misma regla que `BLOCK_01` aplica al tipo de objeto, extendida
 * al contexto, y es lo que impide que reaparezca H-24: el módulo de un
 * transmittal se resuelve por la misma vía que el de cualquier otro objeto, en
 * un único lugar, en lugar de fijarse a mano en cada resolver.
 *
 * El costo es una lectura por emisión. Se acepta deliberadamente: la alternativa
 * —que cada resolver informe el contexto— es exactamente el mecanismo que
 * produjo la inconsistencia que este bloque cierra.
 */

export type EventContext = {
  projectId: number | null
  module: ModuleType | null
}

const SIN_CONTEXTO: EventContext = { projectId: null, module: null }

/**
 * De dónde sale el contexto de cada tipo de objeto. Declarado en un solo lugar,
 * y consumido por dos usos que deben coincidir: el contexto de los eventos (B9)
 * y la resolución del proyecto para la segunda capa de autorización (B7).
 *
 * Devuelve `null` cuando el objeto no existe. Los dos usos lo tratan distinto:
 * la autorización debe distinguirlo, la emisión no.
 */
const derivadores: Record<
  DocObjectType,
  (
    client: Prisma.TransactionClient,
    objectId: number,
  ) => Promise<EventContext | null>
> = {
  [DocObjectType.DOCUMENT]: async (client, id) => {
    const doc = await client.document.findUnique({
      where: { id },
      select: { projectId: true, module: true },
    })
    return doc && { projectId: doc.projectId, module: doc.module }
  },

  [DocObjectType.DOCUMENT_REVISION]: async (client, id) => {
    const revision = await client.documentRevision.findUnique({
      where: { id },
      select: { document: { select: { projectId: true, module: true } } },
    })
    return (
      revision && {
        projectId: revision.document.projectId,
        module: revision.document.module,
      }
    )
  },

  [DocObjectType.DOCUMENT_VERSION]: async (client, id) => {
    const version = await client.documentVersion.findUnique({
      where: { id },
      select: {
        revision: {
          select: { document: { select: { projectId: true, module: true } } },
        },
      },
    })
    return (
      version && {
        projectId: version.revision.document.projectId,
        module: version.revision.document.module,
      }
    )
  },

  [DocObjectType.REVIEW_WORKFLOW]: async (client, id) => {
    const workflow = await client.reviewWorkflow.findUnique({
      where: { id },
      select: {
        revision: {
          select: { document: { select: { projectId: true, module: true } } },
        },
      },
    })
    return (
      workflow && {
        projectId: workflow.revision.document.projectId,
        module: workflow.revision.document.module,
      }
    )
  },

  [DocObjectType.REVIEW_STEP]: async (client, id) => {
    const step = await client.reviewStep.findUnique({
      where: { id },
      select: {
        workflow: {
          select: {
            revision: {
              select: {
                document: { select: { projectId: true, module: true } },
              },
            },
          },
        },
      },
    })
    return (
      step && {
        projectId: step.workflow.revision.document.projectId,
        module: step.workflow.revision.document.module,
      }
    )
  },

  // El transmittal lleva su proyecto y NO tiene columna de módulo: es una
  // capacidad exclusiva de proyectos (D-06). Que el módulo sea PROJECTS no es un
  // valor fijado a mano como el que denunciaba H-24, sino lo que el modelo
  // afirma, declarado acá y en ningún otro lugar. Si el transmittal se extendiera
  // a otros módulos, incorporaría su discriminador y esta línea lo derivaría.
  [DocObjectType.TRANSMITTAL]: async (client, id) => {
    const transmittal = await client.transmittal.findUnique({
      where: { id },
      select: { projectId: true },
    })
    return (
      transmittal && {
        projectId: transmittal.projectId,
        module: ModuleType.PROJECTS,
      }
    )
  },

  // Los catálogos son globales del despliegue: no pertenecen a ningún proyecto y
  // su módulo es opcional, donde nulo significa disponible para todos.
  [DocObjectType.DOCUMENT_CLASS]: async (client, id) => {
    const clase = await client.documentClass.findUnique({
      where: { id },
      select: { module: true },
    })
    return clase && { projectId: null, module: clase.module }
  },

  [DocObjectType.DOCUMENT_TYPE]: async (client, id) => {
    const tipo = await client.documentType.findUnique({
      where: { id },
      select: { module: true },
    })
    return tipo && { projectId: null, module: tipo.module }
  },

  // La configuración y la membresía pertenecen a un proyecto por definición, y
  // no a un módulo: son el contexto del proyecto, no documentación.
  [DocObjectType.DOC_PROJECT_SETTINGS]: async (client, id) => {
    const settings = await client.docProjectSettings.findUnique({
      where: { id },
      select: { projectId: true },
    })
    return settings && { projectId: settings.projectId, module: null }
  },

  [DocObjectType.DOC_PROJECT_MEMBER]: async (client, id) => {
    const member = await client.docProjectMember.findUnique({
      where: { id },
      select: { projectId: true },
    })
    return member && { projectId: member.projectId, module: null }
  },
}

/**
 * Contexto del objeto, o `null` si el objeto no existe.
 *
 * Es la forma que necesita la autorización (B7): distinguir "no pertenece a
 * ningún proyecto" —que autoriza por permiso global— de "no existe" —que debe
 * cortar con NOT_FOUND—. Confundirlos autorizaría operaciones sobre objetos
 * inexistentes.
 */
export const resolveObjectContext = async (
  client: Prisma.TransactionClient,
  objectType: DocObjectType,
  objectId: number,
): Promise<EventContext | null> => derivadores[objectType](client, objectId)

/**
 * Contexto para la emisión de un evento.
 *
 * Devuelve contexto vacío cuando no hay objeto —una acción sin `objectId`— o
 * cuando el objeto ya no existe, que ocurre al registrar una eliminación. El
 * evento se emite igual: perder la traza por no poder derivar su contexto sería
 * peor que registrarla sin él.
 */
export const resolveEventContext = async (
  client: Prisma.TransactionClient,
  objectType: DocObjectType,
  objectId: number | null | undefined,
): Promise<EventContext> => {
  if (objectId === null || objectId === undefined) return SIN_CONTEXTO

  return (
    (await resolveObjectContext(client, objectType, objectId)) ?? SIN_CONTEXTO
  )
}
