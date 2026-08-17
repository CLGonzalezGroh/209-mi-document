import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PaginationInput,
  ListResponse,
  OrderByInput,
  SelectOption,
  PERMISSIONS,
  TerminatedFilter,
} from "@CLGonzalezGroh/mi-common"
import { DocumentClass } from "../generated/prisma/client.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { emitAuditEvent, emitWorkflowEvent } from "../events/emit.js"
import { userAuthorization } from "../utils/userAuthorization.js"
import {
  assertObjectAccess,
  projectAuthorization,
} from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { buildDocumentClassOrderBy } from "../utils/orderByHelper.js"
import { visibleClassificationWhere } from "../utils/classificationScope.js"
import {
  DocObjectType,
  ModuleType,
  SysLogModule,
} from "../generated/prisma/enums.js"

export interface DocumentClassOrderByInput extends OrderByInput {
  field: "NAME" | "CODE" | "SORT_ORDER" | "CREATED_AT"
}

interface DocumentClassFilterInput {
  query?: string
  module?: ModuleType
  terminatedFilter?: TerminatedFilter
}

const documentClassIncludes = {
  documentTypes: {
    where: { terminatedAt: null },
    orderBy: { name: "asc" as const },
  },
}

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("documentClasses")

export const documentClassResolvers = {
  Query: {
    /**
     * El catálogo tal como está declarado, **sin resolver alcance**: lista el del
     * despliegue o el propio de un proyecto, según se pida. Es la vista de
     * administración, con la misma forma que la de ubicaciones.
     *
     * Omitir el proyecto nombra el ámbito del despliegue y no apaga el filtro
     * (BLOQUE 02C, B8), que es lo que conserva intacto lo que esta pantalla
     * muestra hoy.
     */
    documentClasses: async (
      _: any,
      {
        projectId,
        filter,
        pagination,
        orderBy,
      }: {
        projectId?: number
        filter?: DocumentClassFilterInput
        pagination?: PaginationInput
        orderBy?: DocumentClassOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId =
        projectId !== undefined
          ? await projectAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_LIST],
              projectId,
              context,
            })
          : await userAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_LIST],
              context,
            })
      logger.info("documentClasses", { userId })

      try {
        const where: any = { projectId: projectId ?? null }

        if (filter?.terminatedFilter !== undefined) {
          if (filter.terminatedFilter === TerminatedFilter.ACTIVE) {
            where.terminatedAt = null
          } else if (filter.terminatedFilter === TerminatedFilter.DISABLED) {
            where.terminatedAt = { not: null }
          }
        }

        if (filter?.query) {
          where.OR = [
            { name: { contains: filter.query, mode: "insensitive" as const } },
            { code: { contains: filter.query, mode: "insensitive" as const } },
            {
              description: {
                contains: filter.query,
                mode: "insensitive" as const,
              },
            },
          ]
        }

        if (filter?.module) {
          const moduleCondition = {
            OR: [{ module: filter.module }, { module: null }],
          }
          if (where.OR && filter?.query) {
            where.AND = [
              {
                OR: [
                  {
                    name: {
                      contains: filter.query,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    code: {
                      contains: filter.query,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    description: {
                      contains: filter.query,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
              moduleCondition,
            ]
            delete where.OR
          } else {
            Object.assign(where, moduleCondition)
          }
        }

        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const orderByClause = buildDocumentClassOrderBy(orderBy)

        const totalItems = await context.orm.documentClass.count({
          where,
        })

        const documentClasses = await context.orm.documentClass.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause || { sortOrder: "asc" },
          include: documentClassIncludes,
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<DocumentClass> = {
          items: documentClasses,
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
          logName: "GET_DOCUMENT_CLASSES",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener las clases de documento.",
          },
        })
      }
    },

    documentClassById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_READ],
        context,
      })
      logger.info("documentClassById", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      // La clase de un proyecto exige membresía; la del despliegue no pertenece
      // a ninguno y se resuelve con el permiso global (BLOQUE 02, B7).
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_CLASS,
        objectId: id,
        context,
        notFoundMessage: "Clase de documento no encontrada",
      })

      try {
        const documentClass = await context.orm.documentClass.findFirst({
          where: { id },
          include: documentClassIncludes,
        })

        if (!documentClass) {
          throw new GraphQLError("Clase de documento no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return documentClass
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENT_CLASS_BY_ID",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La clase de documento solicitada no existe.",
            default: "Error al obtener la clase de documento.",
          },
        })
      }
    },

    /**
     * Las clases con que se puede clasificar, con el **alcance resuelto**:
     * heredando del despliegue y sumando las propias, o solo las propias.
     *
     * `projectId` es opcional porque hay documentos sin proyecto —calidad,
     * comercial, activos—, y para ellos rige el catálogo del despliegue.
     */
    documentClassesSelectList: async (
      _: any,
      { module, projectId }: { module?: ModuleType; projectId?: number },
      context: ResolverContext,
    ) => {
      const permisos = [
        PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_SELECT,
        PERMISSIONS.COMMON_SELECT_LIST_ACCESS,
      ]

      const userId =
        projectId !== undefined
          ? await projectAuthorization({
              requiredPermissions: permisos,
              projectId,
              context,
            })
          : await userAuthorization({ requiredPermissions: permisos, context })
      logger.info("documentClassesSelectList", { userId })

      try {
        const where: any = {
          terminatedAt: null,
          ...(await visibleClassificationWhere(context.orm, projectId)),
        }

        if (module) {
          where.AND = [{ OR: [{ module }, { module: null }] }]
        }

        const documentClasses = await context.orm.documentClass.findMany({
          where,
          select: { id: true, name: true },
          orderBy: { sortOrder: "asc" },
        })

        return documentClasses.map(
          (dc): SelectOption => ({
            value: String(dc.id),
            label: dc.name,
          }),
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENT_CLASSES_SELECT_LIST",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener la lista de clases de documento.",
          },
        })
      }
    },
  },

  Mutation: {
    createDocumentClass: async (
      _: any,
      {
        input,
      }: {
        input: {
          name: string
          code: string
          module?: ModuleType
          projectId?: number
          description?: string
          sortOrder?: number
        }
      },
      context: ResolverContext,
    ) => {
      // El alcance de lo que se crea decide quién puede crearlo: la entrada de
      // un proyecto exige membresía, la del despliegue el permiso global.
      const scope = input.projectId ?? null

      const userId =
        scope !== null
          ? await projectAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_CREATE],
              projectId: scope,
              context,
            })
          : await userAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_CREATE],
              context,
            })
      logger.info("createDocumentClass", { userId })

      try {
        const documentClass = await context.orm.$transaction(async (tx) => {
          const created = await tx.documentClass.create({
            data: {
              name: input.name,
              code: input.code,
              // El CHECK de la base exige PROJECTS cuando hay proyecto, y no se
              // completa de oficio: declarar el módulo es del usuario.
              module: input.module,
              projectId: scope,
              description: input.description,
              sortOrder: input.sortOrder ?? 0,
              updatedById: userId,
            },
            include: documentClassIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CreateDocumentClass,
            objectId: created.id,
            actorId: userId,
            meta: { name: created.name, code: created.code },
          })

          return created
        })

        return documentClass
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_DOCUMENT_CLASS",
          module: SysLogModule.DOCUMENT,
          messages: {
            uniqueConstraint:
              "Ya existe una clase de documento con ese nombre o código.",
            default: "Error al crear la clase de documento.",
          },
        })
      }
    },

    updateDocumentClass: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: {
          name?: string
          code?: string
          module?: ModuleType
          description?: string
          sortOrder?: number
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_UPDATE],
        context,
      })
      logger.info("updateDocumentClass", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_CLASS,
        objectId: id,
        context,
        notFoundMessage: "Clase de documento no encontrada",
      })

      try {
        const documentClass = await context.orm.$transaction(async (tx) => {
          const updated = await tx.documentClass.update({
            where: { id },
            data: {
              ...input,
              updatedById: userId,
            },
            include: documentClassIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateDocumentClass,
            objectId: id,
            actorId: userId,
            meta: { input },
          })

          return updated
        })

        return documentClass
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_DOCUMENT_CLASS",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La clase de documento no existe.",
            uniqueConstraint:
              "Ya existe una clase de documento con ese nombre o código.",
            default: "Error al actualizar la clase de documento.",
          },
        })
      }
    },

    terminateDocumentClass: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_DELETE],
        context,
      })
      logger.info("terminateDocumentClass", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_CLASS,
        objectId: id,
        context,
        notFoundMessage: "Clase de documento no encontrada",
      })

      try {
        const documentClass = await context.orm.$transaction(async (tx) => {
          const updated = await tx.documentClass.update({
            where: { id },
            data: {
              terminatedAt: new Date(),
              updatedById: userId,
            },
            include: documentClassIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.TerminateDocumentClass,
            objectId: id,
            actorId: userId,
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.DocumentClassTerminated,
            objectId: id,
            fromState: "ACTIVE",
            toState: "TERMINATED",
            actorId: userId,
          })

          return updated
        })

        return documentClass
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_DOCUMENT_CLASS",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La clase de documento no existe.",
            default: "Error al deshabilitar la clase de documento.",
          },
        })
      }
    },

    activateDocumentClass: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_UPDATE],
        context,
      })
      logger.info("activateDocumentClass", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_CLASS,
        objectId: id,
        context,
        notFoundMessage: "Clase de documento no encontrada",
      })

      try {
        const documentClass = await context.orm.$transaction(async (tx) => {
          const updated = await tx.documentClass.update({
            where: { id },
            data: {
              terminatedAt: null,
              updatedById: userId,
            },
            include: documentClassIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.ActivateDocumentClass,
            objectId: id,
            actorId: userId,
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.DocumentClassActivated,
            objectId: id,
            fromState: "TERMINATED",
            toState: "ACTIVE",
            actorId: userId,
          })

          return updated
        })

        return documentClass
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACTIVATE_DOCUMENT_CLASS",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La clase de documento no existe.",
            default: "Error al reactivar la clase de documento.",
          },
        })
      }
    },

    deleteDocumentClass: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_DELETE],
        context,
      })
      logger.info("deleteDocumentClass", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_CLASS,
        objectId: id,
        context,
        notFoundMessage: "Clase de documento no encontrada",
      })

      try {
        const documentClass = await context.orm.documentClass.findFirst({
          where: { id },
        })

        if (!documentClass) {
          throw new GraphQLError("Clase de documento no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        await context.orm.$transaction(async (tx) => {
          await tx.documentClass.delete({
            where: { id },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.DeleteDocumentClass,
            objectId: id,
            actorId: userId,
            meta: { name: documentClass.name, code: documentClass.code },
          })
        })

        return true
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DELETE_DOCUMENT_CLASS",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La clase de documento no existe.",
            default: "Error al eliminar la clase de documento.",
          },
        })
      }
    },
  },
}
