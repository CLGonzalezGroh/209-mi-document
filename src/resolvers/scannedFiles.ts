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
  field:
    | "ID"
    | "CODE"
    | "TITLE"
    | "CREATED_AT"
    | "CLASSIFIED_AT"
    | "DIGITAL_DISPOSITION"
    | "PHYSICAL_LOCATION"
}

const EXTERNAL_SYSTEM_BASE_URL = process.env.EXTERNAL_SYSTEM_BASE_URL || ""

interface ScannedFileFilterInput {
  query?: string
  projectId?: number
  documentTypeId?: number
  documentClassId?: number
  areaId?: number
  digitalDisposition?: DigitalDisposition
  physicalDisposition?: PhysicalDisposition
  terminatedFilter?: TerminatedFilter
}

const scannedFileIncludes = {
  documentType: true,
  documentClass: true,
  area: true,
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
          const parsedId = parseInt(filter.query, 10)
          where.OR = [
            ...(!isNaN(parsedId) ? [{ id: parsedId }] : []),
            { code: { contains: filter.query, mode: "insensitive" as const } },
            { title: { contains: filter.query, mode: "insensitive" as const } },
            { originalReference: { contains: filter.query, mode: "insensitive" as const } },
            { externalReference: { contains: filter.query, mode: "insensitive" as const } },
          ]
        }

        if (filter?.projectId) {
          where.projectId = filter.projectId
        }

        if (filter?.documentTypeId) {
          where.documentTypeId = filter.documentTypeId
        }

        if (filter?.documentClassId) {
          where.documentClassId = filter.documentClassId
        }

        if (filter?.areaId) {
          where.areaId = filter.areaId
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

    scannedFileStats: async (
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
        ] = await context.orm.$transaction([
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
          code: string
          title: string
          description?: string
          originalReference?: string
          physicalLocation?: string
          areaId?: number
          documentClassId?: number
          documentTypeId?: number
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
            code: input.code,
            title: input.title,
            description: input.description,
            originalReference: input.originalReference,
            physicalLocation: input.physicalLocation,
            areaId: input.areaId,
            documentClassId: input.documentClassId,
            documentTypeId: input.documentTypeId,
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

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "CREATE_SCANNED_FILE",
            message: `Archivo escaneado creado: ${scannedFile.title} (${scannedFile.code})`,
            meta: JSON.stringify({ scannedFileId: scannedFile.id, input }),
          },
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_SCANNED_FILE",
          messages: {
            uniqueConstraint: "Ya existe un archivo escaneado con ese código en este proyecto.",
            default: "Error al crear el archivo escaneado.",
          },
        })
      }
    },

    updateScannedFile: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: {
          code: string
          title: string
          description?: string
          originalReference?: string
          physicalLocation?: string
          areaId?: number
          documentClassId?: number
          documentTypeId?: number
          fileKey?: string
          fileName?: string
          fileSize?: number
          mimeType?: string
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
          throw new GraphQLError("No se puede editar un archivo dado de baja", {
            extensions: { code: "BAD_REQUEST" },
          })
        }

        const data: any = {
          code: input.code,
          title: input.title,
          description: input.description,
          originalReference: input.originalReference,
          physicalLocation: input.physicalLocation,
          areaId: input.areaId,
          documentClassId: input.documentClassId,
          documentTypeId: input.documentTypeId,
          updatedById: userId,
        }

        // Solo actualizar campos de archivo si se envían todos
        if (
          input.fileKey &&
          input.fileName &&
          input.fileSize &&
          input.mimeType
        ) {
          data.fileKey = input.fileKey
          data.fileName = input.fileName
          data.fileSize = input.fileSize
          data.mimeType = input.mimeType
        }

        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data,
          include: scannedFileIncludes,
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "UPDATE_SCANNED_FILE",
            message: `Archivo escaneado actualizado: ${scannedFile.title} (${scannedFile.code})`,
            meta: JSON.stringify({ scannedFileId: id, input }),
          },
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_SCANNED_FILE",
          messages: {
            notFound: "El archivo escaneado no existe.",
            uniqueConstraint: "Ya existe un archivo escaneado con ese código en este proyecto.",
            default: "Error al actualizar el archivo escaneado.",
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
          classificationNotes?: string
          discardReason?: string
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_APPROVE],
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

        // Transiciones permitidas según máquina de estados:
        // PENDING → ACCEPTED | DISCARDED
        // DISCARDED → ACCEPTED | PENDING
        // ACCEPTED → PENDING | DISCARDED
        // UPLOADED → (no se puede reclasificar)
        const allowedTransitions: Record<string, string[]> = {
          PENDING: ["ACCEPTED", "DISCARDED", "PENDING"],
          DISCARDED: ["ACCEPTED", "PENDING", "DISCARDED"],
          ACCEPTED: ["PENDING", "DISCARDED", "ACCEPTED"],
        }

        const allowed = allowedTransitions[existing.digitalDisposition]

        if (!allowed) {
          throw new GraphQLError(
            `No se puede reclasificar un archivo con disposición ${existing.digitalDisposition}`,
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        if (!allowed.includes(input.digitalDisposition)) {
          throw new GraphQLError(
            `Transición no permitida: ${existing.digitalDisposition} → ${input.digitalDisposition}`,
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        if (input.digitalDisposition === "DISCARDED" && !input.discardReason) {
          throw new GraphQLError(
            "discardReason es requerido cuando se descarta un archivo",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        if (
          !["ACCEPTED", "DISCARDED", "PENDING"].includes(
            input.digitalDisposition,
          )
        ) {
          throw new GraphQLError(
            "digitalDisposition debe ser ACCEPTED, DISCARDED o PENDING",
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        // Limpiar campos según la transición
        const data: Record<string, any> = {
          digitalDisposition: input.digitalDisposition,
          classificationNotes: input.classificationNotes,
          updatedById: userId,
        }

        if (input.digitalDisposition === "PENDING") {
          // Volver a pendiente: limpiar clasificación
          data.classifiedById = null
          data.classifiedAt = null
          data.discardReason = null
        } else {
          // ACCEPTED o DISCARDED: registrar clasificador
          data.classifiedById = userId
          data.classifiedAt = new Date()
          data.discardReason =
            input.digitalDisposition === "DISCARDED"
              ? input.discardReason
              : null
        }

        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data,
          include: scannedFileIncludes,
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "CLASSIFY_SCANNED_FILE",
            message: `Archivo escaneado clasificado como ${input.digitalDisposition}: ID ${id}`,
            meta: JSON.stringify({ scannedFileId: id, input }),
          },
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

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "MARK_AS_UPLOADED",
            message: `Archivo escaneado marcado como cargado: ID ${id}, ref: ${input.externalReference}`,
            meta: JSON.stringify({ scannedFileId: id, externalReference: input.externalReference }),
          },
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

    updateExternalReference: async (
      _: any,
      {
        id,
        externalReference,
      }: {
        id: number
        externalReference: string
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
            "No se puede actualizar un archivo dado de baja",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        if (existing.digitalDisposition !== "UPLOADED") {
          throw new GraphQLError(
            `Solo se puede corregir la referencia externa de archivos con disposición UPLOADED (actual: ${existing.digitalDisposition})`,
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data: {
            externalReference,
            updatedById: userId,
          },
          include: scannedFileIncludes,
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "UPDATE_EXTERNAL_REFERENCE",
            message: `Referencia externa actualizada: ID ${id}, ref anterior: ${existing.externalReference}, nueva ref: ${externalReference}`,
            meta: JSON.stringify({ scannedFileId: id, previousReference: existing.externalReference, newReference: externalReference }),
          },
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_EXTERNAL_REFERENCE",
          messages: {
            notFound: "El archivo escaneado no existe.",
            default: "Error al actualizar la referencia externa.",
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
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_APPROVE],
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

        // Transiciones permitidas según máquina de estados:
        // PENDING → DESTROY | ARCHIVE
        // DESTROY ↔ ARCHIVE (bidireccional)
        // DESTROY → PENDING
        // ARCHIVE → PENDING
        // DESTROYED / ARCHIVED → (estados terminales)
        const allowedTransitions: Record<string, string[]> = {
          PENDING: ["DESTROY", "ARCHIVE"],
          DESTROY: ["PENDING", "ARCHIVE"],
          ARCHIVE: ["PENDING", "DESTROY"],
        }

        const allowed = allowedTransitions[existing.physicalDisposition]

        if (!allowed) {
          throw new GraphQLError(
            `No se puede cambiar la disposición física desde ${existing.physicalDisposition}`,
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        if (!allowed.includes(disposition)) {
          throw new GraphQLError(
            `Transición no permitida: ${existing.physicalDisposition} → ${disposition}`,
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const data: Record<string, any> = {
          physicalDisposition: disposition,
          updatedById: userId,
        }

        // Si vuelve a PENDING, limpiar confirmación previa
        if (disposition === "PENDING") {
          data.physicalConfirmedById = null
          data.physicalConfirmedAt = null
        }

        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data,
          include: scannedFileIncludes,
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "UPDATE_PHYSICAL_DISPOSITION",
            message: `Disposición física actualizada a ${disposition}: ID ${id}`,
            meta: JSON.stringify({ scannedFileId: id, from: existing.physicalDisposition, to: disposition }),
          },
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
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_UPDATE],
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

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "TERMINATE_SCANNED_FILE",
            message: `Archivo escaneado dado de baja: ${scannedFile.title} (${scannedFile.code})`,
            meta: JSON.stringify({ scannedFileId: id }),
          },
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
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_APPROVE],
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

        const newDisposition = transitionMap[existing.physicalDisposition]

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

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "CONFIRM_PHYSICAL_DISPOSITION",
            message: `Disposición física confirmada: ${existing.physicalDisposition} → ${newDisposition}, ID ${id}`,
            meta: JSON.stringify({ scannedFileId: id, from: existing.physicalDisposition, to: newDisposition }),
          },
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
            default: "Error al confirmar la disposición física.",
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

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "ACTIVATE_SCANNED_FILE",
            message: `Archivo escaneado reactivado: ${scannedFile.title} (${scannedFile.code})`,
            meta: JSON.stringify({ scannedFileId: id }),
          },
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

    resetScannedFileToPending: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_ADMIN_UPDATE],
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
            "No se puede revertir un archivo dado de baja",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        const scannedFile = await context.orm.scannedFile.update({
          where: { id },
          data: {
            digitalDisposition: "PENDING",
            physicalDisposition: "PENDING",
            classifiedById: null,
            classifiedAt: null,
            classificationNotes: null,
            discardReason: null,
            externalReference: null,
            physicalConfirmedById: null,
            physicalConfirmedAt: null,
            updatedById: userId,
          },
          include: scannedFileIncludes,
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "WARNING",
            name: "RESET_SCANNED_FILE_TO_PENDING",
            message: `Archivo escaneado revertido a pendiente: ID ${id}`,
            meta: JSON.stringify({ scannedFileId: id, previousDigital: existing.digitalDisposition, previousPhysical: existing.physicalDisposition }),
          },
        })

        return scannedFile
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "RESET_SCANNED_FILE_TO_PENDING",
          messages: {
            notFound: "El archivo escaneado no existe.",
            default: "Error al revertir el archivo escaneado a pendiente.",
          },
        })
      }
    },

    deleteScannedFile: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SCANNED_FILE_DELETE],
        context,
      })

      try {
        const scannedFile = await context.orm.scannedFile.findFirst({
          where: { id },
        })

        if (!scannedFile) {
          throw new GraphQLError("Archivo escaneado no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (scannedFile.digitalDisposition !== "PENDING") {
          throw new GraphQLError(
            "Solo se puede eliminar un archivo en estado PENDING",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        await context.orm.scannedFile.delete({
          where: { id },
        })

        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "WARNING",
            name: "DELETE_SCANNED_FILE",
            message: `Archivo escaneado eliminado: ${scannedFile.title} (${scannedFile.code})`,
            meta: JSON.stringify({ scannedFileId: id }),
          },
        })

        return true
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DELETE_SCANNED_FILE",
          messages: {
            notFound: "El archivo escaneado no existe.",
            default: "Error al eliminar el archivo escaneado.",
          },
        })
      }
    },
  },
}
