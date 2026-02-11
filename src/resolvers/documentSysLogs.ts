import { ResolverContext } from "../types.js"
import {
  PaginationInput,
  ListResponse,
  PERMISSIONS,
} from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { DocumentSysLog } from "../generated/prisma/client.js"

export const documentSysLogResolvers = {
  Query: {
    documentSysLogs: async (
      _: any,
      {
        pagination,
      }: {
        pagination?: PaginationInput
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_SYS_LOG_LIST],
        context,
      })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 25

        const totalItems = await context.orm.documentSysLog.count()

        const logs = await context.orm.documentSysLog.findMany({
          skip,
          take,
          orderBy: { createdAt: "desc" },
        })

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
          logName: "GET_DOCUMENT_SYS_LOGS",
          messages: {
            default: "Error al obtener los logs del sistema.",
          },
        })
      }
    },
  },
}
