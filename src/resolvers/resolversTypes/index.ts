const { prisma } = await import("../../lib/prisma.js")

import {
  Document,
  DocumentType,
  DocumentClass,
  DocumentRevision,
  DocumentVersion,
  ReviewWorkflow,
  ReviewStep,
  Transmittal,
  Attachment,
  ScannedFile,
  Area,
  DocumentSysLog,
  DocumentSysLogArchive,
  TaskDocumentReference,
} from "../../generated/prisma/client.js"
import {
  DocFileRole,
  PurposeCode,
  QualificationEffect,
  RevisionStatus,
  WorkflowStatus,
} from "../../generated/prisma/enums.js"
import { lastLiveRevision } from "../../utils/revisionScheme.js"
import { enablesUse, requiresNewRevision } from "../../utils/qualifications.js"
import { directionOf } from "../../utils/transmittalCirculation.js"
import {
  expectsQualification,
  missingFileRoles,
} from "../../utils/emissionPurpose.js"
import { obsolescenceCause } from "../../utils/documentMetadata.js"

/**
 * Roles de archivo de la última versión de una revisión.
 *
 * Aprovecha lo que el padre ya trae, si lo trae: la advertencia de archivos
 * faltantes se consulta sobre listados y no debe costar una lectura por fila.
 */
const rolesDeLaUltimaVersion = async (parent: any): Promise<DocFileRole[]> => {
  const cargadas: any[] = Array.isArray(parent?.versions) ? parent.versions : []

  const precargada = cargadas.length
    ? cargadas.reduce((prev, curr) =>
        curr.versionNumber > prev.versionNumber ? curr : prev,
      )
    : null

  // La versión precargada sirve SOLO si trae sus archivos. Varias consultas la
  // incluyen sin ellos, y darla por buena devolvía "faltan todos" con la misma
  // confianza que una respuesta correcta. Es la distinción que `revisionsOf` ya
  // hace un nivel más arriba: no vinieron no es lo mismo que no hay.
  const ultima = Array.isArray(precargada?.files)
    ? precargada
    : await prisma.documentVersion.findFirst({
        where: { revisionId: parent.id },
        include: { files: true },
        orderBy: { versionNumber: "desc" },
      })

  return (ultima?.files ?? []).map((f: any) => f.role)
}

/** Detalle que ambas lecturas devuelven cuando tienen que ir a la base. */
const revisionDetail = {
  documentType: true,
  documentClass: true,
  versions: { include: { files: true } },
  workflows: {
    include: { steps: { orderBy: { stepOrder: "asc" as const } } },
    orderBy: { createdAt: "asc" as const },
  },
}

/**
 * Revisiones que el padre ya trae, si las trae.
 *
 * Devuelve `null` —y no un arreglo vacío— cuando el padre no las incluyó, para
 * distinguir "no vinieron" de "no hay ninguna": confundirlos haría que un
 * documento sin revisiones cargadas se leyera como un documento sin revisiones.
 */
const revisionsOf = (parent: any): any[] | null =>
  Array.isArray(parent?.revisions) ? parent.revisions : null

export const resolverTypes = {
  Document: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.document.findFirst({
        where: { id: ref.id },
        include: {
          currentDocumentType: true,
          currentDocumentClass: true,
          revisions: {
            include: revisionDetail,
            orderBy: { createdAt: "desc" },
          },
        },
      })
    },
    updatedBy: (parent: Document) => {
      return { __typename: "UserName", id: parent.updatedById }
    },
    createdBy: (parent: Document) => {
      return { __typename: "UserName", id: parent.createdById }
    },
    // Fase A.5 — federación con mi-project
    projectTask: (parent: Document) => {
      return parent.projectTaskId
        ? { __typename: "ProjectTask", id: parent.projectTaskId }
        : null
    },
    obsoletedBy: (parent: Document) => {
      return parent.obsoletedById
        ? { __typename: "UserName", id: parent.obsoletedById }
        : null
    },
    /**
     * La causa se DERIVA y no se almacena (BLOQUE 03B, B5): un indicador sería
     * un dato calculable capaz de contradecir a los que lo originan. El hecho sí
     * se registra, porque dos causas llegan al mismo estado y ninguna se deduce
     * de la otra.
     */
    obsolescenceCause: async (parent: any) => {
      if (!parent.obsoletedAt) return null

      const items =
        parent.replacementItems ??
        (await prisma.docReplacementItem.findMany({
          where: { documentId: parent.id },
          select: { role: true },
        }))
      return obsolescenceCause({ obsoletedAt: parent.obsoletedAt, replacementItems: items })
    },
    replacementItems: async (parent: any) => {
      if (Array.isArray(parent.replacementItems)) return parent.replacementItems
      return prisma.docReplacementItem.findMany({
        where: { documentId: parent.id },
        orderBy: { id: "asc" },
      })
    },
    taskDocumentReferences: async (parent: Document) => {
      return prisma.taskDocumentReference.findMany({
        where: { documentId: parent.id },
        orderBy: { createdAt: "asc" },
      })
    },
    /**
     * La revisión VIGENTE: la última aprobada, y **solo la aprobada**
     * (BLOQUE 03, B14). Nulo mientras el documento no haya aprobado ninguna.
     *
     * Cambia de significado sin cambiar de forma: antes caía en `DRAFT` o
     * `IN_REVIEW` cuando no había aprobada, de modo que la lectura corriente
     * devolvía un borrador como si fuera el documento del proyecto. Y tenía dos
     * implementaciones divergentes en el mismo resolver, que podían devolver
     * revisiones distintas para el mismo documento: resolverlas en un solo lugar
     * es la corrección.
     *
     * A lo sumo hay una revisión en `APPROVED` por documento, porque aprobar una
     * supersede a las anteriores.
     */
    currentRevision: async (parent: any) => {
      const desdeElPadre = revisionsOf(parent)
      if (desdeElPadre) {
        return (
          desdeElPadre.find((r: any) => r.status === RevisionStatus.APPROVED) ??
          null
        )
      }

      return prisma.documentRevision.findFirst({
        where: { documentId: parent.id, status: RevisionStatus.APPROVED },
        include: revisionDetail,
      })
    },

    /**
     * La revisión EN CURSO: la última no abortada por secuencia de creación, en
     * cualquier estado (B14).
     *
     * Con `A` aprobada y `B` en circuito, `currentRevision` es `A` y
     * `lastRevision` es `B`. Ninguna de las dos considera las abortadas.
     *
     * Es la misma revisión de la que se deriva el código sucesor: una sola regla
     * con dos usos, y por eso comparte la implementación de `lastLiveRevision`.
     */
    lastRevision: async (parent: any) => {
      const desdeElPadre = revisionsOf(parent)
      if (desdeElPadre) return lastLiveRevision(desdeElPadre)

      const revisions = await prisma.documentRevision.findMany({
        where: {
          documentId: parent.id,
          status: { not: RevisionStatus.ABANDONED },
        },
        include: revisionDetail,
      })
      return lastLiveRevision(revisions)
    },
  },

  DocumentType: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.documentType.findFirst({
        where: { id: ref.id },
        include: { class: true },
      })
    },
    updatedBy: (parent: DocumentType) => {
      return { __typename: "UserName", id: parent.updatedById }
    },
  },

  DocumentClass: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.documentClass.findFirst({
        where: { id: ref.id },
        include: {
          documentTypes: {
            where: { terminatedAt: null },
            orderBy: { name: "asc" },
          },
        },
      })
    },
    updatedBy: (parent: DocumentClass) => {
      return { __typename: "UserName", id: parent.updatedById }
    },
  },

  DocumentRevision: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.documentRevision.findFirst({
        where: { id: ref.id },
        include: {
          document: true,
          ...revisionDetail,
        },
      })
    },
    createdBy: (parent: DocumentRevision) => {
      return { __typename: "UserName", id: parent.createdById }
    },
    approvedBy: (parent: DocumentRevision) => {
      return parent.approvedById
        ? { __typename: "UserName", id: parent.approvedById }
        : null
    },
    assignedOrganizer: (parent: DocumentRevision) => {
      return { __typename: "UserName", id: parent.assignedOrganizerId }
    },
    abandonedBy: (parent: DocumentRevision) => {
      return parent.abandonedById
        ? { __typename: "UserName", id: parent.abandonedById }
        : null
    },
    /**
     * El circuito vigente se DERIVA (BLOQUE 03, B2): no se almacena un
     * `currentWorkflowId`, que sería un dato derivado con riesgo de
     * desincronizarse. El índice único parcial garantiza que haya a lo sumo uno.
     */
    currentWorkflow: async (parent: any) => {
      if (Array.isArray(parent?.workflows)) {
        return (
          parent.workflows.find(
            (w: any) => w.status === WorkflowStatus.IN_PROGRESS,
          ) ?? null
        )
      }

      return prisma.reviewWorkflow.findFirst({
        where: { revisionId: parent.id, status: WorkflowStatus.IN_PROGRESS },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      })
    },
    currentVersion: async (parent: any) => {
      // Si ya viene con versions incluidas
      if (parent.versions && parent.versions.length > 0) {
        // La última versión (mayor versionNumber)
        return parent.versions.reduce((prev: any, curr: any) =>
          curr.versionNumber > prev.versionNumber ? curr : prev,
        )
      }

      // Si no, hacer query
      const version = await prisma.documentVersion.findFirst({
        where: { revisionId: parent.id },
        include: { files: true },
        orderBy: { versionNumber: "desc" },
      })
      return version
    },

    /**
     * Qué le faltaría si se emitiera con ese propósito (BLOQUE 04, B4).
     *
     * Toma el propósito por argumento porque la revisión todavía no sabe con
     * cuál va a salir. Es la misma regla que el ítem aplica ya conociéndolo, y
     * se expone en los dos lados para que la advertencia llegue mientras la
     * revisión está abierta, que es cuando incorporar el archivo no cuesta nada.
     */
    missingFileRoles: async (
      parent: any,
      { purpose }: { purpose: PurposeCode },
    ) => {
      const roles = await rolesDeLaUltimaVersion(parent)

      return missingFileRoles(purpose, roles)
    },
  },

  TransmittalItem: {
    /** Expectativa y no permiso: gobierna qué figura como pendiente. */
    expectsQualification: (parent: { purposeCode: PurposeCode }) =>
      expectsQualification(parent.purposeCode),

    missingFileRoles: async (parent: any) => {
      const revision =
        parent.documentRevision ??
        (await prisma.documentRevision.findUnique({
          where: { id: parent.documentRevisionId },
          select: { id: true },
        }))

      if (!revision) return []

      return missingFileRoles(
        parent.purposeCode,
        await rolesDeLaUltimaVersion(revision),
      )
    },
  },

  DocWorkingCopy: {
    createdBy: (parent: any) => ({ __typename: "UserName", id: parent.createdById }),
    confirmedBy: (parent: any) =>
      parent.confirmedById
        ? { __typename: "UserName", id: parent.confirmedById }
        : null,
    discardedBy: (parent: any) =>
      parent.discardedById
        ? { __typename: "UserName", id: parent.discardedById }
        : null,
    revision: async (parent: any) =>
      parent.revision ??
      prisma.documentRevision.findUnique({ where: { id: parent.revisionId } }),
    files: async (parent: any) =>
      parent.files ??
      prisma.docWorkingCopyFile.findMany({
        where: { workingCopyId: parent.id },
        orderBy: { fileKey: "asc" },
      }),
    version: async (parent: any) =>
      parent.versionId
        ? (parent.version ??
          prisma.documentVersion.findUnique({
            where: { id: parent.versionId },
            include: { files: true },
          }))
        : null,
  },

  DocReplacement: {
    createdBy: (parent: any) => ({ __typename: "UserName", id: parent.createdById }),
    items: async (parent: any) =>
      parent.items ??
      prisma.docReplacementItem.findMany({
        where: { replacementId: parent.id },
        orderBy: { id: "asc" },
      }),
  },

  DocReplacementItem: {
    document: async (parent: any) =>
      parent.document ??
      prisma.document.findUnique({ where: { id: parent.documentId } }),
    replacement: async (parent: any) =>
      parent.replacement ??
      prisma.docReplacement.findUnique({ where: { id: parent.replacementId } }),
  },

  DocumentVersion: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.documentVersion.findFirst({
        where: { id: ref.id },
        include: {
          revision: true,
          files: true,
        },
      })
    },
    createdBy: (parent: DocumentVersion) => {
      return { __typename: "UserName", id: parent.createdById }
    },
  },

  ReviewWorkflow: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.reviewWorkflow.findFirst({
        where: { id: ref.id },
        include: {
          revision: true,
          steps: {
            orderBy: { stepOrder: "asc" },
          },
        },
      })
    },
    initiatedBy: (parent: ReviewWorkflow) => {
      return { __typename: "UserName", id: parent.initiatedById }
    },
    initiatedAt: (parent: ReviewWorkflow) => {
      return parent.initiatedAt || parent.createdAt
    },
    cancelledBy: (parent: ReviewWorkflow) => {
      return parent.cancelledById
        ? { __typename: "UserName", id: parent.cancelledById }
        : null
    },
    template: async (parent: ReviewWorkflow) => {
      if (parent.templateId === null) return null
      return prisma.docWorkflowTemplate.findUnique({
        where: { id: parent.templateId },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      })
    },
  },

  ReviewStep: {
    assignedTo: (parent: ReviewStep) => {
      return { __typename: "UserName", id: parent.assignedToId }
    },
    /**
     * Quién resolvió efectivamente el paso (B9). Nulo mientras está pendiente.
     * La delegación se DERIVA de su divergencia con `assignedTo`: un indicador
     * booleano sería un dato calculable que puede contradecir a los dos campos
     * que lo originan.
     */
    resolvedBy: (parent: ReviewStep) => {
      return parent.resolvedById
        ? { __typename: "UserName", id: parent.resolvedById }
        : null
    },
    signature: async (parent: any) => {
      if (parent.signature !== undefined) return parent.signature
      return prisma.docStepSignature.findUnique({
        where: { stepId: parent.id },
      })
    },
  },

  DocStepSignature: {
    createdBy: (parent: { createdById: number }) => {
      return { __typename: "UserName", id: parent.createdById }
    },
  },

  DocWorkflowTemplate: {
    createdBy: (parent: { createdById: number }) => {
      return { __typename: "UserName", id: parent.createdById }
    },
    updatedBy: (parent: { updatedById: number }) => {
      return { __typename: "UserName", id: parent.updatedById }
    },
  },

  DocWorkflowTemplateStep: {
    assignedTo: (parent: { assignedToId: number | null }) => {
      if (parent.assignedToId === null) return null
      return { __typename: "UserName", id: parent.assignedToId }
    },
  },

  DocSettings: {
    updatedBy: (parent: { updatedById: number }) => {
      return { __typename: "UserName", id: parent.updatedById }
    },
  },

  // Las dos preguntas de D-22 se DERIVAN del efecto y se exponen resueltas, en
  // lugar de que cada consumidor las deduzca de la enumeración (BLOQUE 04, B11).
  DocQualification: {
    createdBy: (parent: { createdById: number }) => {
      return { __typename: "UserName", id: parent.createdById }
    },
    updatedBy: (parent: { updatedById: number }) => {
      return { __typename: "UserName", id: parent.updatedById }
    },
    enablesUse: (parent: { effect: QualificationEffect }) =>
      enablesUse(parent.effect),
    requiresNewRevision: (parent: { effect: QualificationEffect }) =>
      requiresNewRevision(parent.effect),
  },

  DocProjectSettings: {
    defaultOrganizer: (parent: { defaultOrganizerId: number | null }) => {
      if (parent.defaultOrganizerId === null) return null
      return { __typename: "UserName", id: parent.defaultOrganizerId }
    },
  },

  Transmittal: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.transmittal.findFirst({
        where: { id: ref.id },
        include: {
          items: {
            include: {
              documentRevision: {
                include: {
                  document: true,
                  versions: {
                    orderBy: { versionNumber: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      })
    },
    updatedBy: (parent: Transmittal) => {
      return { __typename: "UserName", id: parent.updatedById }
    },
    issuedBy: (parent: Transmittal) => {
      return { __typename: "UserName", id: parent.issuedById }
    },
    /**
     * El sentido se DERIVA del rol del proyecto y de la naturaleza (BLOQUE 04,
     * B1), y se expone resuelto en lugar de que cada consumidor lo deduzca.
     *
     * Nulo mientras el proyecto no haya declarado su rol: es la única situación
     * en que el sentido no puede establecerse, y no debe confundirse con las
     * combinaciones imposibles, que ningún transmittal llega a tener.
     */
    direction: async (parent: Transmittal) => {
      const settings = await prisma.docProjectSettings.findUnique({
        where: { projectId: parent.projectId },
        select: { documentRole: true },
      })

      return settings
        ? directionOf(settings.documentRole, parent.nature)
        : null
    },
    respondsTo: async (parent: any) => {
      if (parent.respondsTo !== undefined) return parent.respondsTo
      if (parent.respondsToTransmittalId === null) return null

      return prisma.transmittal.findUnique({
        where: { id: parent.respondsToTransmittalId },
      })
    },
    responses: async (parent: any) => {
      if (Array.isArray(parent.responses)) return parent.responses

      return prisma.transmittal.findMany({
        where: { respondsToTransmittalId: parent.id },
        orderBy: { id: "asc" },
      })
    },
  },

  DocumentSysLog: {
    user: (parent: DocumentSysLog) => {
      return { __typename: "UserName", id: parent.userId }
    },
  },

  DocWorkflowEvent: {
    createdBy: (parent: { createdById: number | null }) => {
      if (parent.createdById === null) return null
      return { __typename: "UserName", id: parent.createdById }
    },
  },

  DocAuditEvent: {
    createdBy: (parent: { createdById: number | null }) => {
      if (parent.createdById === null) return null
      return { __typename: "UserName", id: parent.createdById }
    },
  },

  DocProjectMember: {
    user: (parent: { userId: number }) => ({
      __typename: "UserName",
      id: parent.userId,
    }),
    assignedBy: (parent: { assignedById: number }) => ({
      __typename: "UserName",
      id: parent.assignedById,
    }),
    revokedBy: (parent: { revokedById: number | null }) => {
      if (parent.revokedById === null) return null
      return { __typename: "UserName", id: parent.revokedById }
    },
  },

  Attachment: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.attachment.findFirst({
        where: { id: ref.id },
      })
    },
    createdBy: (parent: Attachment) => {
      return { __typename: "UserName", id: parent.createdById }
    },
  },

  // El tipo del contrato es DocumentSysLogArchive, en singular. El resolver
  // estaba registrado como DocumentSysLogsArchive y por lo tanto NUNCA corría:
  // `user` caía en el resolver por defecto y devolvía nulo. Es anterior a este
  // bloque y se corrige acá porque el cruce contra el contrato lo hizo visible.
  DocumentSysLogArchive: {
    user: (parent: DocumentSysLogArchive) => {
      return { __typename: "UserName", id: parent.userId }
    },
  },

  ScannedFile: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.scannedFile.findFirst({
        where: { id: ref.id },
        include: { documentType: true, documentClass: true, area: true },
      })
    },
    createdBy: (parent: ScannedFile) => {
      return { __typename: "UserName", id: parent.createdById }
    },
    updatedBy: (parent: ScannedFile) => {
      return { __typename: "UserName", id: parent.updatedById }
    },
    classifiedBy: (parent: ScannedFile) => {
      return parent.classifiedById
        ? { __typename: "UserName", id: parent.classifiedById }
        : null
    },
    physicalConfirmedBy: (parent: ScannedFile) => {
      return parent.physicalConfirmedById
        ? { __typename: "UserName", id: parent.physicalConfirmedById }
        : null
    },
    externalUrl: (parent: ScannedFile) => {
      const baseUrl = process.env.EXTERNAL_SYSTEM_BASE_URL || ""
      return parent.externalReference && baseUrl
        ? `${baseUrl}${parent.externalReference}/latest`
        : null
    },
  },

  Area: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.area.findFirst({
        where: { id: ref.id },
      })
    },
    updatedBy: (parent: Area) => {
      return { __typename: "UserName", id: parent.updatedById }
    },
  },

  // ─── Fase A.5: Federación ProjectTask ↔ Document ───

  // Tipo federado: ProjectTask vive en 204-mi-project. Acá sólo extendemos
  // con los campos documentales que aporta este subgraph.
  ProjectTask: {
    __resolveReference: (ref: { id: number }) => ref,
    documents: async (parent: { id: number }) => {
      return prisma.document.findMany({
        where: { projectTaskId: parent.id, terminatedAt: null },
        orderBy: { code: "asc" },
      })
    },
    documentReferences: async (parent: { id: number }) => {
      return prisma.taskDocumentReference.findMany({
        where: { projectTaskId: parent.id },
        orderBy: { createdAt: "asc" },
      })
    },
  },

  TaskDocumentReference: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.taskDocumentReference.findUnique({ where: { id: ref.id } })
    },
    createdBy: (parent: TaskDocumentReference) => {
      return { __typename: "UserName", id: parent.createdById }
    },
    projectTask: (parent: TaskDocumentReference) => {
      return { __typename: "ProjectTask", id: parent.projectTaskId }
    },
    document: async (parent: TaskDocumentReference) => {
      return prisma.document.findUnique({ where: { id: parent.documentId } })
    },
  },
}
