import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PaginationInput,
  ListResponse,
  OrderByInput,
  PERMISSIONS,
  TerminatedFilter,
} from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { buildScannedFileOrderBy } from "../utils/orderByHelper.js"
import type { ScannedFile } from "../generated/prisma/client.js"
import {
  DigitalDisposition,
  PhysicalDisposition,
} from "../generated/prisma/enums.js"

export interface ScannedFileOrderByInput extends OrderByInput {
  field: "TITLE" | "CREATED_AT" | "CLASSIFIED_AT" | "DIGITAL_DISPOSITION"
}

const EXTERNAL_SYSTEM_BASE_URL = process.env.EXTERNAL_SYSTEM_BASE_URL || ""

interface ScannedFileFilterInput {
  query?: string
  projectId?: number
  documentTypeId?: number
  digitalDisposition?: DigitalDisposition
  physicalDisposition?: PhysicalDisposition
  terminatedFilter?: TerminatedFilter
}

const scannedFileIncludes = {
  documentType: true,
}

export const scannedFileResolvers = {
  Query: {
    scannedFileById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_READ],
        context,
      })

      try {
        const scannedFile = await context.orm.scannedFile.findFirst({
          where: { id },
          include: scannedFileIncludes,
        })

        if (!scannedFile) {
          throw new GraphQLError("Archivo escaneado no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_SCANNED_FILE_BY_ID",
          messages: {
            notFound: "El archivo escaneado solicitado no existe.",
            default: "Error al obtener el archivo escaneado.",
          },
        })
      }
    },

    scannedFiles: async (
      _: any,
      {
        filter,
        pagination,
        orderBy,
      }: {
        filter?: ScannedFileFilterInput
        pagination?: PaginationInput
        orderBy?: ScannedFileOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_LIST],
        context,
      })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const where: any = {}

        // Filtro por terminatedAt
        if (!filter?.terminatedFilter || filter.terminatedFilter === "ACTIVE") {
          where.terminatedAt = null
        } else if (filter.terminatedFilter === "DISABLED") {
          where.terminatedAt = { not: null }
        }

        if (filter?.query) {
          where.OR = [
            { title: { contains: filter.query } },
            { originalReference: { contains: filter.query } },
            { externalReference: { contains: filter.query } },
          ]
        }

        if (filter?.projectId) {
          where.projectId = filter.projectId
        }

        if (filter?.documentTypeId) {
          where.documentTypeId = filter.documentTypeId
        }

        if (filter?.digitalDisposition) {
          where.digitalDisposition = filter.digitalDisposition
        }

        if (filter?.physicalDisposition) {
          where.physicalDisposition = filter.physicalDisposition
        }

        const prismaOrderBy = buildScannedFileOrderBy(orderBy)

        const totalItems = await context.orm.scannedFile.count({ where })

        const items = await context.orm.scannedFile.findMany({
          where,
          skip,
          take,
          orderBy: prismaOrderBy,
          include: scannedFileIncludes,
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<ScannedFile> = {
          items,
          pagination: {
            currentPage,
            totalPages,
            totalItems,
            hasNext: skip + take < totalItems,
            hasPrev: skip > 0,
          },
        }

        return response
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_SCANNED_FILES",
          messages: {
            default: "Error al obtener los archivos escaneados.",
          },
        })
      }
    },

    scannedFilesStats: async (
      _: any,
      { projectId }: { projectId: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_LIST],
        context,
      })

      try {
        const baseWhere = { projectId, terminatedAt: null }

        const [
          pending,
          accepted,
          uploaded,
          discarded,
          total,
          physicalPending,
          physicalDestroy,
          physicalDestroyed,
          physicalArchive,
          physicalArchived,
        ] = await Promise.all([
          context.orm.scannedFile.count({
            where: { ...baseWhere, digitalDisposition: "PENDING" },
          }),
          context.orm.scannedFile.count({
            where: { ...baseWhere, digitalDisposition: "ACCEPTED" },
          }),
          context.orm.scannedFile.count({
            where: { ...baseWhere, digitalDisposition: "UPLOADED" },
          }),
          context.orm.scannedFile.count({
            where: { ...baseWhere, digitalDisposition: "DISCARDED" },
          }),
          context.orm.scannedFile.count({ where: baseWhere }),
          context.orm.scannedFile.count({
            where: { ...baseWhere, physicalDisposition: "PENDING" },
          }),
          context.orm.scannedFile.count({
            where: { ...baseWhere, physicalDisposition: "DESTROY" },
          }),
          context.orm.scannedFile.count({
            where: { ...baseWhere, physicalDisposition: "DESTROYED" },
          }),
          context.orm.scannedFile.count({
            where: { ...baseWhere, physicalDisposition: "ARCHIVE" },
          }),
          context.orm.scannedFile.count({
            where: { ...baseWhere, physicalDisposition: "ARCHIVED" },
          }),
        ])

        return {
          pending,
          accepted,
          uploaded,
          discarded,
          total,
          physicalPending,
          physicalDestroy,
          physicalDestroyed,
          physicalArchive,
          physicalArchived,
        }
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_SCANNED_FILES_STATS",
          messages: {
            default: "Error al obtener las estadísticas.",
          },
        })
      }
    },
  },

  Mutation: {
    createScannedFile: async (
      _: any,
      {
        input,
      }: {
        input: {
          projectId: number
          title: string
          description?: string
          originalReference?: string
          physicalLocation?: string
          fileKey: string
          fileName: string
          fileSize: number
          mimeType: string
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_CREATE],
        context,
      })

      try {
        const scannedFile = await context.orm.scannedFile.create({
          data: {
            projectId: input.projectId,
            title: input.title,
            description: input.description,
            originalReference: input.originalReference,
            physicalLocation: input.physicalLocation,
            fileKey: input.fileKey,
            fileName: input.fileName,
            fileSize: input.fileSize,
            mimeType: input.mimeType,
            digitalDisposition: "PENDING",
            physicalDisposition: "PENDING",
            createdById: userId,
            updatedById: userId,
          },
          include: scannedFileIncludes,
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_SCANNED_FILE",
          messages: {
            default: "Error al crear el archivo escaneado.",
          },
        })
      }
    },

    classifyScannedFile: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: {
          digitalDisposition: DigitalDisposition
          documentTypeId?: number
          classificationNotes?: string
          discardReason?: string
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_UPDATE],
        context,
      })

      try {
        const existing = await context.orm.scannedFile.findFirst({
          where: { id },
        })

        if (!existing) {
          throw new GraphQLError("Archivo escaneado no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (existing.terminatedAt) {
          throw new GraphQLError(
            "No se puede clasificar un archivo dado de baja",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        if (existing.digitalDisposition !== "PENDING") {
          throw new GraphQLError(
            `El archivo ya fue clasificado como ${existing.digitalDisposition}`,
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        if (input.digitalDisposition === "ACCEPTED" && !input.documentTypeId) {
          throw new GraphQLError(
            "documentTypeId es requerido cuando se acepta un archivo",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        if (input.digitalDisposition === "DISCARDED" && !input.discardReason) {
          throw new GraphQLError(
            "discardReason es requerido cuando se descarta un archivo",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        if (!["ACCEPTED", "DISCARDED"].includes(input.digitalDisposition)) {
          throw new GraphQLError(
            "digitalDisposition debe ser ACCEPTED o DISCARDED",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data: {
            digitalDisposition: input.digitalDisposition,
            documentTypeId: input.documentTypeId,
            classificationNotes: input.classificationNotes,
            discardReason: input.discardReason,
            classifiedById: userId,
            classifiedAt: new Date(),
            updatedById: userId,
          },
          include: scannedFileIncludes,
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CLASSIFY_SCANNED_FILE",
          messages: {
            notFound: "El archivo escaneado no existe.",
            default: "Error al clasificar el archivo escaneado.",
          },
        })
      }
    },

    markAsUploaded: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: { externalReference: string }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_UPDATE],
        context,
      })

      try {
        const existing = await context.orm.scannedFile.findFirst({
          where: { id },
        })

        if (!existing) {
          throw new GraphQLError("Archivo escaneado no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (existing.terminatedAt) {
          throw new GraphQLError(
            "No se puede marcar como uploaded un archivo dado de baja",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        if (existing.digitalDisposition !== "ACCEPTED") {
          throw new GraphQLError(
            `Solo se pueden marcar como uploaded archivos con disposición ACCEPTED (actual: ${existing.digitalDisposition})`,
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data: {
            digitalDisposition: "UPLOADED",
            externalReference: input.externalReference,
            updatedById: userId,
          },
          include: scannedFileIncludes,
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "MARK_AS_UPLOADED",
          messages: {
            notFound: "El archivo escaneado no existe.",
            default:
              "Error al marcar el archivo como cargado en sistema externo.",
          },
        })
      }
    },

    updatePhysicalDisposition: async (
      _: any,
      { id, disposition }: { id: number; disposition: PhysicalDisposition },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_UPDATE],
        context,
      })

      try {
        const existing = await context.orm.scannedFile.findFirst({
          where: { id },
        })

        if (!existing) {
          throw new GraphQLError("Archivo escaneado no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (existing.terminatedAt) {
          throw new GraphQLError(
            "No se puede actualizar un archivo dado de baja",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data: {
            physicalDisposition: disposition,
            updatedById: userId,
          },
          include: scannedFileIncludes,
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_PHYSICAL_DISPOSITION",
          messages: {
            notFound: "El archivo escaneado no existe.",
            default: "Error al actualizar la disposición física.",
          },
        })
      }
    },

    terminateScannedFile: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_DELETE],
        context,
      })

      try {
        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data: {
            terminatedAt: new Date(),
            updatedById: userId,
          },
          include: scannedFileIncludes,
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_SCANNED_FILE",
          messages: {
            notFound: "El archivo escaneado no existe.",
            default: "Error al dar de baja el archivo escaneado.",
          },
        })
      }
    },

    confirmPhysicalDisposition: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_UPDATE],
        context,
      })

      try {
        const existing = await context.orm.scannedFile.findFirst({
          where: { id },
        })

        if (!existing) {
          throw new GraphQLError("Archivo escaneado no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (existing.terminatedAt) {
          throw new GraphQLError(
            "No se puede confirmar un archivo dado de baja",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const transitionMap: Record<string, string> = {
          DESTROY: "DESTROYED",
          ARCHIVE: "ARCHIVED",
        }

        const newDisposition =
          transitionMap[existing.physicalDisposition]

        if (!newDisposition) {
          throw new GraphQLError(
            `Solo se puede confirmar disposiciones DESTROY o ARCHIVE (actual: ${existing.physicalDisposition})`,
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data: {
            physicalDisposition: newDisposition as PhysicalDisposition,
            physicalConfirmedById: userId,
            physicalConfirmedAt: new Date(),
            updatedById: userId,
          },
          include: scannedFileIncludes,
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CONFIRM_PHYSICAL_DISPOSITION",
          messages: {
            notFound: "El archivo escaneado no existe.",
            default:
              "Error al confirmar la disposición física.",
          },
        })
      }
    },

    activateScannedFile: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_UPDATE],
        context,
      })

      try {
        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data: {
            terminatedAt: null,
            updatedById: userId,
          },
          include: scannedFileIncludes,
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACTIVATE_SCANNED_FILE",
          messages: {
            notFound: "El archivo escaneado no existe.",
            default: "Error al reactivar el archivo escaneado.",
          },
        })
      }
    },
  },
}
