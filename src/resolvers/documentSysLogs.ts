import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PaginationInput,
  ListResponse,
  OrderByInput,
  PERMISSIONS,
} from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { buildDocumentSysLogOrderBy } from "../utils/orderByHelper.js"
import type {
  DocumentSysLog,
  DocumentSysLogArchive,
} from "../generated/prisma/client.js"
import { LogLevel, SysLogModule } from "../generated/prisma/enums.js"

export interface DocumentSysLogOrderByInput extends OrderByInput {
  field: "CREATED_AT" | "LEVEL" | "NAME" | "MODULE"
}

interface DocumentSysLogFilterInput {
  query?: string
  userId?: number
  level?: LogLevel
  module?: SysLogModule
  createdFrom?: Date
  createdTo?: Date
}

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("documentSysLogs")

export const documentSysLogResolvers = {
  Query: {
    documentSysLogById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SYS_LOG_READ],
        context,
      })
      logger.info("documentSysLogById", { userId })

      try {
        const log = await context.orm.documentSysLog.findFirst({
          where: { id },
        })

        if (!log) {
          throw new GraphQLError("Log del sistema no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return log
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "FETCH_DOCUMENT_SYS_LOG_ERROR",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "Log del sistema no encontrado",
            default: "Error al obtener el log del sistema",
          },
        })
      }
    },

    documentSysLogs: async (
      _: any,
      {
        filter,
        pagination,
        orderBy,
      }: {
        filter?: DocumentSysLogFilterInput
        pagination?: PaginationInput
        orderBy?: DocumentSysLogOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SYS_LOG_LIST],
        context,
      })
      logger.info("documentSysLogs", { userId })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const where: any = {}

        // Aplicar filtros
        if (filter) {
          if (filter.query) {
            where.OR = [
              { name: { contains: filter.query, mode: "insensitive" as const } },
              { message: { contains: filter.query, mode: "insensitive" as const } },
            ]
          }

          if (filter.userId) {
            where.userId = filter.userId
          }

          if (filter.level) {
            where.level = filter.level
          }

          if (filter.module) {
            where.module = filter.module
          }

          if (filter.createdFrom || filter.createdTo) {
            where.createdAt = {}
            if (filter.createdFrom) {
              where.createdAt.gte = filter.createdFrom
            }
            if (filter.createdTo) {
              where.createdAt.lte = filter.createdTo
            }
          }
        }

        const orderByClause = buildDocumentSysLogOrderBy(orderBy)

        const totalItems = await context.orm.documentSysLog.count({ where })

        const logs = await context.orm.documentSysLog.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause,
        })

        // Calcular información de paginación
        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<DocumentSysLog> = {
          items: logs,
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
          logName: "FETCH_DOCUMENT_SYS_LOGS_ERROR",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener logs del sistema",
          },
        })
      }
    },

    documentSysLogArchiveById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SYS_LOG_READ],
        context,
      })
      logger.info("documentSysLogArchiveById", { userId })

      try {
        const log = await context.orm.documentSysLogArchive.findFirst({
          where: { id },
        })

        if (!log) {
          throw new GraphQLError("Log archivado del sistema no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return log
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "FETCH_DOCUMENT_SYS_LOG_ARCHIVE_ERROR",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "Log archivado del sistema no encontrado",
            default: "Error al obtener el log archivado del sistema",
          },
        })
      }
    },

    documentSysLogsArchive: async (
      _: any,
      {
        filter,
        pagination,
        orderBy,
      }: {
        filter?: DocumentSysLogFilterInput
        pagination?: PaginationInput
        orderBy?: DocumentSysLogOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SYS_LOG_LIST],
        context,
      })
      logger.info("documentSysLogsArchive", { userId })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const where: any = {}

        // Aplicar filtros
        if (filter) {
          if (filter.query) {
            where.OR = [
              { name: { contains: filter.query, mode: "insensitive" as const } },
              { message: { contains: filter.query, mode: "insensitive" as const } },
            ]
          }

          if (filter.userId) {
            where.userId = filter.userId
          }

          if (filter.level) {
            where.level = filter.level
          }

          if (filter.module) {
            where.module = filter.module
          }

          if (filter.createdFrom || filter.createdTo) {
            where.createdAt = {}
            if (filter.createdFrom) {
              where.createdAt.gte = filter.createdFrom
            }
            if (filter.createdTo) {
              where.createdAt.lte = filter.createdTo
            }
          }
        }

        const orderByClause = buildDocumentSysLogOrderBy(orderBy)

        const totalItems = await context.orm.documentSysLogArchive.count({
          where,
        })

        const logs = await context.orm.documentSysLogArchive.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause,
        })

        // Calcular información de paginación
        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<DocumentSysLogArchive> = {
          items: logs,
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
          logName: "FETCH_DOCUMENT_SYS_LOGS_ARCHIVE_ERROR",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener logs archivados del sistema",
          },
        })
      }
    },
  },

  Mutation: {
    archiveDocumentSysLogs: async (
      _: any,
      { olderThanDays }: { olderThanDays: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SYS_LOG_ARCHIVE],
        context,
      })
      logger.info("archiveDocumentSysLogs", { userId })

      try {
        // Calcular la fecha límite
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

        // Obtener los logs antiguos
        const oldLogs = await context.orm.documentSysLog.findMany({
          where: {
            createdAt: {
              lt: cutoffDate,
            },
          },
        })

        if (oldLogs.length === 0) {
          return 0
        }

        // Copiar logs a la tabla de archivo
        await context.orm.documentSysLogArchive.createMany({
          data: oldLogs.map((log) => ({
            id: log.id,
            createdAt: log.createdAt,
            userId: log.userId,
            level: log.level,
            module: log.module,
            name: log.name,
            message: log.message,
            meta: log.meta,
          })),
        })

        // Eliminar los logs originales
        await context.orm.documentSysLog.deleteMany({
          where: {
            createdAt: {
              lt: cutoffDate,
            },
          },
        })

        // Registrar log de operación exitosa
        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "INFO",
            name: "ARCHIVE_DOCUMENT_SYS_LOGS",
            message: `${oldLogs.length} logs archivados exitosamente (mayores a ${olderThanDays} días)`,
            module: SysLogModule.DOCUMENT,
            meta: JSON.stringify({
              archivedCount: oldLogs.length,
              olderThanDays,
              cutoffDate,
            }),
          },
        })

        return oldLogs.length
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ARCHIVE_DOCUMENT_SYS_LOGS_ERROR",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al archivar logs del sistema",
          },
        })
      }
    },

    deleteDocumentSysLogsArchive: async (
      _: any,
      { olderThanDays }: { olderThanDays: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SYS_LOG_DELETE],
        context,
      })
      logger.info("deleteDocumentSysLogsArchive", { userId })

      try {
        // Calcular la fecha límite
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

        // Eliminar los logs archivados antiguos permanentemente
        const result = await context.orm.documentSysLogArchive.deleteMany({
          where: {
            createdAt: {
              lt: cutoffDate,
            },
          },
        })

        // Registrar log de operación exitosa
        await context.orm.documentSysLog.create({
          data: {
            userId,
            level: "WARNING",
            name: "DELETE_ARCHIVED_DOCUMENT_SYS_LOGS",
            message: `${result.count} logs archivados eliminados permanentemente (mayores a ${olderThanDays} días)`,
            module: SysLogModule.DOCUMENT,
            meta: JSON.stringify({
              deletedCount: result.count,
              olderThanDays,
              cutoffDate,
            }),
          },
        })

        return result.count
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DELETE_ARCHIVED_DOCUMENT_SYS_LOGS_ERROR",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al eliminar logs archivados del sistema",
          },
        })
      }
    },
  },
}
