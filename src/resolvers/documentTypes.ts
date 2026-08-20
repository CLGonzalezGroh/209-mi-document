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
import { DocumentType } from "../generated/prisma/client.js"
import { userAuthorization } from "../utils/userAuthorization.js"
import {
  assertObjectAccess,
  projectAuthorization,
} from "../utils/projectAuthorization.js"
import {
  assertClassScopeAdmitted,
  visibleClassificationWhere,
} from "../utils/classificationScope.js"
import { handleError } from "../utils/handleError.js"
import { buildDocumentTypeOrderBy } from "../utils/orderByHelper.js"
import {
  DocObjectType,
  ModuleType,
  SysLogModule,
} from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { emitAuditEvent, emitWorkflowEvent } from "../events/emit.js"

export interface DocumentTypeOrderByInput extends OrderByInput {
  field: "NAME" | "CODE" | "CREATED_AT" | "UPDATED_AT"
}

interface DocumentTypeFilterInput {
  query?: string
  module?: ModuleType
  classId?: number
  terminatedFilter?: TerminatedFilter
}

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("documentTypes")

export const documentTypeResolvers = {
  Query: {
    /**
     * El catálogo tal como está declarado, **sin resolver alcance**, con la misma
     * forma que el de clases: omitir el proyecto nombra el ámbito del despliegue
     * y no apaga el filtro (BLOQUE 02C, B8).
     */
    documentTypes: async (
      _: any,
      {
        docProjectId,
        filter,
        pagination,
        orderBy,
      }: {
        docProjectId?: number
        filter?: DocumentTypeFilterInput
        pagination?: PaginationInput
        orderBy?: DocumentTypeOrderByInput
      },
      context: ResolverContext,
    ) => {
      const userId =
        docProjectId !== undefined
          ? await projectAuthorization({
              intent: "read",
              requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_LIST],
              docProjectId,
              context,
            })
          : await userAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_LIST],
              context,
            })
      logger.info("documentTypes", { userId })

      try {
        const where: any = { docProjectId: docProjectId ?? null }

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
            { description: { contains: filter.query, mode: "insensitive" as const } },
          ]
        }

        if (filter?.module) {
          where.OR = [
            ...(where.OR || []),
            { module: filter.module },
            { module: null }, // Disponible para todos
          ]
          // Si ya había un OR, necesitamos usar AND
          if (where.OR && filter?.query) {
            where.AND = [
              {
                OR: [
                  { name: { contains: filter.query, mode: "insensitive" as const } },
                  { code: { contains: filter.query, mode: "insensitive" as const } },
                  { description: { contains: filter.query, mode: "insensitive" as const } },
                ],
              },
              {
                OR: [{ module: filter.module }, { module: null }],
              },
            ]
            delete where.OR
          }
        }

        if (filter?.classId) {
          // Filtrar por clase específica O tipos sin clase (universales)
          const classCondition = {
            OR: [{ classId: filter.classId }, { classId: null }],
          }
          if (where.AND) {
            where.AND.push(classCondition)
          } else if (where.OR) {
            where.AND = [
              { OR: where.OR },
              classCondition,
            ]
            delete where.OR
          } else {
            Object.assign(where, classCondition)
          }
        }

        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        const orderByClause = buildDocumentTypeOrderBy(orderBy)

        const totalItems = await context.orm.documentType.count({ where })

        const documentTypes = await context.orm.documentType.findMany({
          where,
          skip,
          take,
          orderBy: orderByClause || { name: "asc" },
          include: { class: true },
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<DocumentType> = {
          items: documentTypes,
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
          logName: "GET_DOCUMENT_TYPES",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener los tipos de documento.",
          },
        })
      }
    },

    documentTypeById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_READ],
        context,
      })
      logger.info("documentTypeById", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      await assertObjectAccess({
        intent: "read",
        userId,
        objectType: DocObjectType.DOCUMENT_TYPE,
        objectId: id,
        context,
        notFoundMessage: "Tipo de documento no encontrado",
      })

      try {
        const documentType = await context.orm.documentType.findFirst({
          where: { id },
          include: { class: true },
        })

        if (!documentType) {
          throw new GraphQLError("Tipo de documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return documentType
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENT_TYPE_BY_ID",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound:
              "El tipo de documento solicitado no existe o no está disponible.",
            default: "Error al obtener el tipo de documento.",
          },
        })
      }
    },

    /**
     * Los tipos con que se puede clasificar, con el **alcance resuelto**.
     *
     * `docProjectId` es opcional porque hay documentos sin proyecto —calidad,
     * comercial, activos—, y para ellos rige el catálogo del despliegue.
     */
    documentTypesSelectList: async (
      _: any,
      {
        module,
        classId,
        docProjectId,
      }: { module?: ModuleType; classId?: number; docProjectId?: number },
      context: ResolverContext,
    ) => {
      const permisos = [
        PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_SELECT,
        PERMISSIONS.COMMON_SELECT_LIST_ACCESS,
      ]

      const userId =
        docProjectId !== undefined
          ? await projectAuthorization({
              intent: "read",
              requiredPermissions: permisos,
              docProjectId,
              context,
            })
          : await userAuthorization({ requiredPermissions: permisos, context })
      logger.info("documentTypesSelectList", { userId })

      try {
        const where: any = {
          terminatedAt: null,
          ...(await visibleClassificationWhere(context.orm, docProjectId)),
        }

        // Cada eje se agrega como una condición AND propia. Componerlos sobre el
        // mismo `OR` de nivel superior obligaba a moverlo de lugar cuando aparecía
        // el segundo, y con el alcance —que también puede aportar uno— el último
        // en escribirse habría borrado a los anteriores sin ruido.
        const ejes: any[] = []
        if (module) ejes.push({ OR: [{ module }, { module: null }] })
        if (classId) ejes.push({ OR: [{ classId }, { classId: null }] })
        if (ejes.length > 0) where.AND = ejes

        const documentTypes = await context.orm.documentType.findMany({
          where,
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })

        return documentTypes.map(
          (dt): SelectOption => ({
            value: String(dt.id),
            label: dt.name,
          }),
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENT_TYPES_SELECT_LIST",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener la lista de tipos de documento.",
          },
        })
      }
    },
  },

  Mutation: {
    createDocumentType: async (
      _: any,
      {
        input,
      }: {
        input: {
          name: string
          code: string
          module?: ModuleType
          docProjectId?: number
          classId?: number
          description?: string
          requiresFormalReview?: boolean
        }
      },
      context: ResolverContext,
    ) => {
      // El alcance de lo que se crea decide quién puede crearlo (BLOQUE 02, B7).
      const scope = input.docProjectId ?? null

      const userId =
        scope !== null
          ? await projectAuthorization({
              intent: "write",
              requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_CREATE],
              docProjectId: scope,
              context,
            })
          : await userAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_CREATE],
              context,
            })
      logger.info("createDocumentType", { userId })

      try {
        const documentType = await context.orm.$transaction(async (tx) => {
          // El cruce va en un solo sentido (BLOQUE 02C, B7): un tipo del
          // proyecto cuelga de una clase del despliegue —eso es ampliar—, y uno
          // del despliegue no cuelga de una clase de proyecto.
          await assertClassScopeAdmitted(tx, {
            typeScope: scope,
            classId: input.classId ?? null,
          })

          const created = await tx.documentType.create({
            data: {
              name: input.name,
              code: input.code,
              module: input.module,
              docProjectId: scope,
              classId: input.classId,
              description: input.description,
              requiresFormalReview: input.requiresFormalReview ?? false,
              updatedById: userId,
            },
            include: { class: true },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CreateDocumentType,
            objectId: created.id,
            actorId: userId,
            meta: { name: created.name, code: created.code },
          })

          return created
        })

        return documentType
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_DOCUMENT_TYPE",
          module: SysLogModule.DOCUMENT,
          messages: {
            uniqueConstraint:
              "Ya existe un tipo de documento con ese nombre o código.",
            default: "Error al crear el tipo de documento.",
          },
        })
      }
    },

    updateDocumentType: async (
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
          classId?: number
          description?: string
          requiresFormalReview?: boolean
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_UPDATE],
        context,
      })
      logger.info("updateDocumentType", { userId })

      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.DOCUMENT_TYPE,
        objectId: id,
        context,
        notFoundMessage: "Tipo de documento no encontrado",
      })

      try {
        const documentType = await context.orm.$transaction(async (tx) => {
          // El cruce se verifica también al editar: mover un tipo a otra clase
          // puede cruzarlo igual que crearlo ahí. El alcance del tipo no cambia
          // —no se edita—, de modo que se lee del propio registro.
          if (input.classId !== undefined) {
            const actual = await tx.documentType.findUniqueOrThrow({
              where: { id },
              select: { docProjectId: true },
            })
            await assertClassScopeAdmitted(tx, {
              typeScope: actual.docProjectId,
              classId: input.classId ?? null,
            })
          }

          const updated = await tx.documentType.update({
            where: { id },
            data: {
              ...input,
              updatedById: userId,
            },
            include: { class: true },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateDocumentType,
            objectId: id,
            actorId: userId,
            meta: { input },
          })

          return updated
        })

        return documentType
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_DOCUMENT_TYPE",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "El tipo de documento no existe.",
            uniqueConstraint:
              "Ya existe un tipo de documento con ese nombre o código.",
            default: "Error al actualizar el tipo de documento.",
          },
        })
      }
    },

    terminateDocumentType: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_DELETE],
        context,
      })
      logger.info("terminateDocumentType", { userId })

      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.DOCUMENT_TYPE,
        objectId: id,
        context,
        notFoundMessage: "Tipo de documento no encontrado",
      })

      try {
        const documentType = await context.orm.$transaction(async (tx) => {
          const updated = await tx.documentType.update({
            where: { id },
            data: {
              terminatedAt: new Date(),
              updatedById: userId,
            },
            include: { class: true },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.TerminateDocumentType,
            objectId: id,
            actorId: userId,
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.DocumentTypeTerminated,
            objectId: id,
            fromState: "ACTIVE",
            toState: "TERMINATED",
            actorId: userId,
          })

          return updated
        })

        return documentType
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_DOCUMENT_TYPE",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "El tipo de documento no existe.",
            default: "Error al deshabilitar el tipo de documento.",
          },
        })
      }
    },

    activateDocumentType: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_UPDATE],
        context,
      })
      logger.info("activateDocumentType", { userId })

      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.DOCUMENT_TYPE,
        objectId: id,
        context,
        notFoundMessage: "Tipo de documento no encontrado",
      })

      try {
        const documentType = await context.orm.$transaction(async (tx) => {
          const updated = await tx.documentType.update({
            where: { id },
            data: {
              terminatedAt: null,
              updatedById: userId,
            },
            include: { class: true },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.ActivateDocumentType,
            objectId: id,
            actorId: userId,
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.DocumentTypeActivated,
            objectId: id,
            fromState: "TERMINATED",
            toState: "ACTIVE",
            actorId: userId,
          })

          return updated
        })

        return documentType
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACTIVATE_DOCUMENT_TYPE",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "El tipo de documento no existe.",
            default: "Error al reactivar el tipo de documento.",
          },
        })
      }
    },

    deleteDocumentType: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_DELETE],
        context,
      })
      logger.info("deleteDocumentType", { userId })

      await assertObjectAccess({
        intent: "write",
        userId,
        objectType: DocObjectType.DOCUMENT_TYPE,
        objectId: id,
        context,
        notFoundMessage: "Tipo de documento no encontrado",
      })

      try {
        const documentType = await context.orm.documentType.findFirst({
          where: { id },
        })

        if (!documentType) {
          throw new GraphQLError("Tipo de documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        await context.orm.$transaction(async (tx) => {
          await tx.documentType.delete({
            where: { id },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.DeleteDocumentType,
            objectId: id,
            actorId: userId,
            meta: { name: documentType.name, code: documentType.code },
          })
        })

        return true
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DELETE_DOCUMENT_TYPE",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "El tipo de documento no existe.",
            default: "Error al eliminar el tipo de documento.",
          },
        })
      }
    },
  },
}
