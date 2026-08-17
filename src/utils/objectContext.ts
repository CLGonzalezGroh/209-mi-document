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

  // Los catálogos de clasificación tienen ALCANCE desde BLOQUE 02C: nulo es la
  // entrada del despliegue, que no pertenece a ningún proyecto y se resuelve con
  // el permiso global; con proyecto, la entrada es suya y exige membresía. Es la
  // autorización en dos capas de BLOQUE 02, B7, y sale del alcance de la propia
  // entrada — no de una regla por operación.
  //
  // El módulo se conserva y es opcional, donde nulo significa disponible para
  // todos. Los dos ejes conviven, como en la declaración de alcance (B6).
  [DocObjectType.DOCUMENT_CLASS]: async (client, id) => {
    const clase = await client.documentClass.findUnique({
      where: { id },
      select: { module: true, projectId: true },
    })
    return clase && { projectId: clase.projectId, module: clase.module }
  },

  [DocObjectType.DOCUMENT_TYPE]: async (client, id) => {
    const tipo = await client.documentType.findUnique({
      where: { id },
      select: { module: true, projectId: true },
    })
    return tipo && { projectId: tipo.projectId, module: tipo.module }
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

  // La firma cuelga del paso, de modo que su contexto es el del circuito: un
  // nivel más que REVIEW_STEP en la misma cadena hasta el documento.
  [DocObjectType.DOC_STEP_SIGNATURE]: async (client, id) => {
    const signature = await client.docStepSignature.findUnique({
      where: { id },
      select: {
        step: {
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
        },
      },
    })
    return (
      signature && {
        projectId: signature.step.workflow.revision.document.projectId,
        module: signature.step.workflow.revision.document.module,
      }
    )
  },

  // La plantilla lleva su proyecto en el alcance, y puede no tener ninguno: la
  // de alcance nulo alcanza a los documentos del régimen de publicación. El
  // módulo no lo declara —la plantilla no es documentación— y por eso es nulo.
  [DocObjectType.DOC_WORKFLOW_TEMPLATE]: async (client, id) => {
    const template = await client.docWorkflowTemplate.findUnique({
      where: { id },
      select: { projectId: true },
    })
    return template && { projectId: template.projectId, module: null }
  },

  // El acto de reemplazo toma el contexto de CUALQUIERA de sus documentos, y no
  // de uno elegido a mano: los documentos de un acto comparten ámbito (BLOQUE
  // 03B, B5), y esa es justamente la condición que vuelve bien definida esta
  // derivación. Lo que cruza de un proyecto al régimen de publicación no es
  // reemplazo sino promoción, que no se registra acá.
  [DocObjectType.DOC_REPLACEMENT]: async (client, id) => {
    const acto = await client.docReplacement.findUnique({
      where: { id },
      select: {
        items: {
          take: 1,
          select: {
            document: { select: { projectId: true, module: true } },
          },
        },
      },
    })
    if (!acto) return null

    const doc = acto.items[0]?.document
    return doc ? { projectId: doc.projectId, module: doc.module } : SIN_CONTEXTO
  },

  // La configuración del despliegue no pertenece a ningún proyecto ni a ningún
  // módulo: es exactamente lo que la vuelve el último escalón de la precedencia.
  [DocObjectType.DOC_SETTINGS]: async (client, id) => {
    const settings = await client.docSettings.findUnique({
      where: { id },
      select: { id: true },
    })
    return settings && { projectId: null, module: null }
  },

  // La calificación lleva su proyecto en el alcance, y puede no tener ninguno:
  // la de alcance nulo es la del despliegue. El módulo es nulo porque el
  // catálogo no es documentación sino configuración del contrato, con la misma
  // forma que la plantilla del circuito.
  [DocObjectType.DOC_QUALIFICATION]: async (client, id) => {
    const qualification = await client.docQualification.findUnique({
      where: { id },
      select: { projectId: true },
    })
    return qualification && { projectId: qualification.projectId, module: null }
  },

  // El nodo de ubicación lleva su proyecto en el alcance, y puede no tener
  // ninguno: el de alcance nulo es el del árbol del despliegue, del que los
  // proyectos heredan (B1). El módulo es nulo porque el árbol no es documentación
  // sino la descripción de la instalación, con la misma forma que la plantilla
  // del circuito y el catálogo de calificaciones.
  //
  // De acá sale además la segunda capa de autorización: un nodo del despliegue se
  // resuelve con el permiso global, y uno de proyecto exige membresía. Sale
  // gratis, sin una regla propia en cada operación.
  [DocObjectType.DOC_LOCATION]: async (client, id) => {
    const location = await client.docLocation.findUnique({
      where: { id },
      select: { projectId: true },
    })
    return location && { projectId: location.projectId, module: null }
  },

  // La declaración de alcance pertenece a un proyecto por definición: es cómo
  // ESE proyecto resuelve un catálogo. Sin proyecto no hay nada que declarar,
  // porque el árbol del despliegue es el que se hereda.
  [DocObjectType.DOC_CATALOG_SCOPE]: async (client, id) => {
    const scope = await client.docCatalogScope.findUnique({
      where: { id },
      select: { projectId: true },
    })
    return scope && { projectId: scope.projectId, module: null }
  },

  // La respuesta toma el contexto del transmittal por el que el documento salió,
  // a través de su ítem. Es la misma cadena que el transmittal recorre, un nivel
  // más abajo, y por eso su módulo es también PROJECTS.
  [DocObjectType.DOC_TRANSMITTAL_RESPONSE]: async (client, id) => {
    const respuesta = await client.docTransmittalResponse.findUnique({
      where: { id },
      select: {
        transmittalItem: {
          select: { transmittal: { select: { projectId: true } } },
        },
      },
    })
    return (
      respuesta && {
        projectId: respuesta.transmittalItem.transmittal.projectId,
        module: ModuleType.PROJECTS,
      }
    )
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
