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
} from "../../generated/prisma/client.js"

export const resolverTypes = {
  Document: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.document.findFirst({
        where: { id: ref.id },
        include: {
          documentType: true,
          revisions: {
            include: {
              versions: true,
              workflow: {
                include: {
                  steps: true,
                },
              },
            },
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
    currentRevision: async (parent: any) => {
      // Si ya viene con revisions incluidas
      if (parent.revisions && parent.revisions.length > 0) {
        // Buscar primero APPROVED, luego DRAFT/IN_REVIEW
        const approved = parent.revisions.find(
          (r: any) => r.status === "APPROVED",
        )
        if (approved) return approved

        const active = parent.revisions.find(
          (r: any) => r.status === "DRAFT" || r.status === "IN_REVIEW",
        )
        if (active) return active

        return parent.revisions[0]
      }

      // Si no, hacer query
      const revision = await prisma.documentRevision.findFirst({
        where: { documentId: parent.id },
        orderBy: { createdAt: "desc" },
        include: {
          versions: true,
          workflow: {
            include: {
              steps: true,
            },
          },
        },
      })
      return revision
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
          versions: true,
          workflow: {
            include: {
              steps: true,
            },
          },
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
        orderBy: { versionNumber: "desc" },
      })
      return version
    },
  },

  DocumentVersion: {
    __resolveReference: async (ref: { id: number }) => {
      return prisma.documentVersion.findFirst({
        where: { id: ref.id },
        include: {
          revision: true,
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
  },

  ReviewStep: {
    assignedTo: (parent: ReviewStep) => {
      return { __typename: "UserName", id: parent.assignedToId }
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
  },

  DocumentSysLog: {
    user: (parent: DocumentSysLog) => {
      return { __typename: "UserName", id: parent.userId }
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

  DocumentSysLogsArchive: {
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
        ? `${baseUrl}${parent.externalReference}`
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
}
