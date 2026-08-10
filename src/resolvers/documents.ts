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
import { userAuthorization } from "../utils/userAuthorization.js"
import {
  applyProjectScope,
  assertObjectAccess,
  projectAuthorization,
  projectScopeAuthorization,
} from "../utils/projectAuthorization.js"
import { assertDocumentContext } from "../utils/documentContext.js"
import { handleError } from "../utils/handleError.js"
import { buildDocumentOrderBy } from "../utils/orderByHelper.js"
import {
  DocObjectType,
  ModuleType,
  RevisionStatus,
  RevisionScheme,
} from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { emitAuditEvent, emitWorkflowEvent } from "../events/emit.js"
import { Document } from "../generated/prisma/client.js"

export interface DocumentOrderByInput extends OrderByInput {
  field: "CODE" | "TITLE" | "CREATED_AT" | "UPDATED_AT" | "MODULE"
}

interface DocumentFilterInput {
  query?: string
  module?: ModuleType
  documentTypeId?: number
  documentClassId?: number
  status?: RevisionStatus
  terminatedFilter?: TerminatedFilter
}

const documentIncludes = {
  documentType: true,
  documentClass: true,
  revisions: {
    include: {
      versions: true,
      workflow: {
        include: {
          steps: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
  },
}

import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("documents")

export const documentResolvers = {
  Query: {
    documentById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      // Doble capa: permiso global, lectura del proyecto del objeto, membresía.
      // Ese orden es el correcto: no se lee la base antes de verificar el permiso.
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_READ],
        context,
      })
      logger.info("documentById", { userId })

      // Fuera del try: un rechazo por permiso o por membresía no es un error del
      // servicio, y handleError lo registraría como ERROR en DocumentSysLog.
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT,
        objectId: id,
        context,
        notFoundMessage: "Documento no encontrado",
      })

      try {
        const document = await context.orm.document.findFirst({
          where: { id },
          include: documentIncludes,
        })

        if (!document) {
          throw new GraphQLError("Documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENT_BY_ID",
          messages: {
            notFound: "El documento solicitado no existe o no está disponible.",
            default: "Error al obtener el documento.",
          },
        })
      }
    },

    documents: async (
      _: any,
      {
        filter,
        pagination,
        orderBy,
      }: {
        filter?: DocumentFilterInput
        pagination?: PaginationInput
        orderBy?: DocumentOrderByInput
      },
      context: ResolverContext,
    ) => {
      // Listado sin proyecto en los argumentos: la segunda capa se aplica como
      // FILTRO, no como rechazo. Incorpora los documentos sin proyecto, que son
      // el régimen de publicación y se gobiernan solo por el permiso global (B7).
      const { userId, scope } = await projectScopeAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_LIST],
        context,
        includeWithoutProject: true,
      })
      logger.info("documents", { userId })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        // Construir filtros
        const where: any = {}

        // Filtro de estado activo/inactivo
        if (filter?.terminatedFilter !== undefined) {
          if (filter.terminatedFilter === TerminatedFilter.ACTIVE) {
            where.terminatedAt = null
          } else if (filter.terminatedFilter === TerminatedFilter.DISABLED) {
            where.terminatedAt = { not: null }
          }
        }

        if (filter?.query) {
          where.OR = [
            { code: { contains: filter.query, mode: "insensitive" as const } },
            { title: { contains: filter.query, mode: "insensitive" as const } },
            { description: { contains: filter.query, mode: "insensitive" as const } },
          ]
        }

        if (filter?.module) {
          where.module = filter.module
        }

        if (filter?.documentTypeId) {
          where.documentTypeId = filter.documentTypeId
        }

        if (filter?.documentClassId) {
          where.documentClassId = filter.documentClassId
        }

        if (filter?.status) {
          where.revisions = {
            some: {
              status: filter.status,
            },
          }
        }

        // Construir ordenamiento
        const orderByClause = buildDocumentOrderBy(orderBy)

        // El alcance se incorpora bajo AND para no pisar el OR de la búsqueda
        const scopedWhere = applyProjectScope(where, scope)

        // Obtener total de elementos
        const totalItems = await context.orm.document.count({ where: scopedWhere })

        // Obtener documentos paginados
        const documents = await context.orm.document.findMany({
          where: scopedWhere,
          skip,
          take,
          orderBy: orderByClause,
          include: documentIncludes,
        })

        // Calcular información de paginación
        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        const response: ListResponse<Document> = {
          items: documents,
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
          logName: "GET_DOCUMENTS",
          messages: {
            default: "Error al obtener la lista de documentos.",
          },
        })
      }
    },

    documentsByModule: async (
      _: any,
      {
        module,
        pagination,
        orderBy,
      }: {
        module: ModuleType
        pagination?: PaginationInput
        orderBy?: DocumentOrderByInput
      },
      context: ResolverContext,
    ) => {
      // Listado sin proyecto en los argumentos: la segunda capa filtra (B7).
      const { userId, scope } = await projectScopeAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_LIST],
        context,
        includeWithoutProject: true,
      })
      logger.info("documentsByModule", { userId })

      try {
        const skip = pagination?.skip || 0
        const take = pagination?.take || 10

        // Los filtros por entityType y entityId se retiraron con las columnas (B3)
        const where: any = {
          module,
          terminatedAt: null,
        }

        const orderByClause = buildDocumentOrderBy(orderBy)
        const scopedWhere = applyProjectScope(where, scope)
        const totalItems = await context.orm.document.count({ where: scopedWhere })

        const documents = await context.orm.document.findMany({
          where: scopedWhere,
          skip,
          take,
          orderBy: orderByClause,
          include: documentIncludes,
        })

        const totalPages = Math.ceil(totalItems / take)
        const currentPage = Math.floor(skip / take) + 1

        return {
          items: documents,
          pagination: {
            currentPage,
            totalPages,
            totalItems,
            hasNext: skip + take < totalItems,
            hasPrev: skip > 0,
          },
        }
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENTS_BY_MODULE",
          messages: {
            default: "Error al obtener documentos del módulo.",
          },
        })
      }
    },

    documentsSelectList: async (
      _: any,
      { filter }: { filter?: DocumentFilterInput },
      context: ResolverContext,
    ) => {
      // Listado sin proyecto en los argumentos: la segunda capa filtra (B7).
      const { userId, scope } = await projectScopeAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_SELECT],
        context,
        includeWithoutProject: true,
      })
      logger.info("documentsSelectList", { userId })

      try {
        const where: any = { terminatedAt: null }

        if (filter?.module) {
          where.module = filter.module
        }

        if (filter?.query) {
          where.OR = [
            { code: { contains: filter.query, mode: "insensitive" as const } },
            { title: { contains: filter.query, mode: "insensitive" as const } },
          ]
        }

        const documents = await context.orm.document.findMany({
          where: applyProjectScope(where, scope),
          select: { id: true, code: true, title: true },
          orderBy: { code: "asc" },
        })

        return documents.map(
          (d): SelectOption => ({
            value: String(d.id),
            label: `${d.code} - ${d.title}`,
          }),
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOCUMENTS_SELECT_LIST",
          messages: {
            default: "Error al obtener la lista de documentos.",
          },
        })
      }
    },
  },

  Mutation: {
    createDocument: async (
      _: any,
      {
        input,
      }: {
        input: {
          code: string
          title: string
          description?: string
          module: ModuleType
          projectId?: number
          documentTypeId: number
          documentClassId?: number
          revisionScheme?: RevisionScheme
          initialRevisionCode?: string
          fileKey: string
          fileName: string
          fileSize: number
          mimeType: string
          checksum?: string
        }
      },
      context: ResolverContext,
    ) => {
      // El invariante de B1 se exige ANTES de autorizar por proyecto: no tiene
      // sentido verificar membresía sobre un contexto que no es representable.
      assertDocumentContext(input.module, input.projectId)

      // El proyecto viene en el input, de modo que la doble capa es estricta.
      // Nulo cuando el módulo no es PROJECTS: régimen de publicación (B1).
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CREATE],
        projectId: input.projectId ?? null,
        context,
      })
      logger.info("createDocument", { userId })

      try {
        // Determinar esquema de revisión y código inicial
        const revisionScheme =
          input.revisionScheme || RevisionScheme.ALPHABETICAL
        const initialRevisionCode =
          input.initialRevisionCode ||
          (revisionScheme === RevisionScheme.NUMERIC ? "0" : "A")

        // Crear documento con primera revisión y primera versión en una transacción
        const document = await context.orm.$transaction(async (tx) => {
          const created = await tx.document.create({
            data: {
              code: input.code,
              title: input.title,
              description: input.description,
              module: input.module,
              projectId: input.projectId,
              documentTypeId: input.documentTypeId,
              documentClassId: input.documentClassId,
              revisionScheme,
              createdById: userId,
              updatedById: userId,
              revisions: {
                create: {
                  revisionCode: initialRevisionCode,
                  status: "DRAFT",
                  createdById: userId,
                  updatedById: userId,
                  versions: {
                    create: {
                      versionNumber: 1,
                      fileKey: input.fileKey,
                      fileName: input.fileName,
                      fileSize: input.fileSize,
                      mimeType: input.mimeType,
                      checksum: input.checksum,
                      createdById: userId,
                    },
                  },
                },
              },
            },
            include: documentIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CreateDocument,
            objectId: created.id,
            actorId: userId,
            meta: { code: created.code, title: created.title, module: created.module },
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.RevisionCreated,
            objectId: created.revisions[0].id,
            toState: RevisionStatus.DRAFT,
            actorId: userId,
          })

          return created
        })

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_DOCUMENT",
          messages: {
            uniqueConstraint: "Ya existe un documento con ese código en este contexto.",
            foreignKeyConstraint:
              "El tipo de documento especificado no existe.",
            default: "Error al crear el documento.",
          },
        })
      }
    },

    updateDocument: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: {
          title?: string
          description?: string
          documentTypeId?: number
          documentClassId?: number
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_UPDATE],
        context,
      })
      logger.info("updateDocument", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT,
        objectId: id,
        context,
        notFoundMessage: "Documento no encontrado",
      })

      try {
        const { documentTypeId, documentClassId, ...rest } = input

        const document = await context.orm.$transaction(async (tx) => {
          const updated = await tx.document.update({
            where: { id },
            data: {
              ...rest,
              updatedById: userId,
              ...(documentTypeId !== undefined && {
                documentType: { connect: { id: documentTypeId } },
              }),
              ...(documentClassId !== undefined && {
                documentClass: documentClassId
                  ? { connect: { id: documentClassId } }
                  : { disconnect: true },
              }),
            },
            include: documentIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateDocument,
            objectId: id,
            actorId: userId,
            meta: { input },
          })

          return updated
        })

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_DOCUMENT",
          messages: {
            notFound: "El documento no existe.",
            foreignKeyConstraint:
              "El tipo o clase de documento especificado no existe.",
            default: "Error al actualizar el documento.",
          },
        })
      }
    },

    terminateDocument: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_DELETE],
        context,
      })
      logger.info("terminateDocument", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT,
        objectId: id,
        context,
        notFoundMessage: "Documento no encontrado",
      })

      try {
        const document = await context.orm.$transaction(async (tx) => {
          const updated = await tx.document.update({
            where: { id },
            data: {
              terminatedAt: new Date(),
              updatedById: userId,
            },
            include: documentIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.TerminateDocument,
            objectId: id,
            actorId: userId,
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.DocumentTerminated,
            objectId: id,
            fromState: "ACTIVE",
            toState: "TERMINATED",
            actorId: userId,
          })

          return updated
        })

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_DOCUMENT",
          messages: {
            notFound: "El documento no existe.",
            default: "Error al deshabilitar el documento.",
          },
        })
      }
    },

    activateDocument: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_UPDATE],
        context,
      })
      logger.info("activateDocument", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT,
        objectId: id,
        context,
        notFoundMessage: "Documento no encontrado",
      })

      try {
        const document = await context.orm.$transaction(async (tx) => {
          const updated = await tx.document.update({
            where: { id },
            data: {
              terminatedAt: null,
              updatedById: userId,
            },
            include: documentIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.ActivateDocument,
            objectId: id,
            actorId: userId,
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.DocumentActivated,
            objectId: id,
            fromState: "TERMINATED",
            toState: "ACTIVE",
            actorId: userId,
          })

          return updated
        })

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACTIVATE_DOCUMENT",
          messages: {
            notFound: "El documento no existe.",
            default: "Error al reactivar el documento.",
          },
        })
      }
    },

    switchRevisionScheme: async (
      _: any,
      { id, scheme }: { id: number; scheme: RevisionScheme },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_UPDATE],
        context,
      })
      logger.info("switchRevisionScheme", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT,
        objectId: id,
        context,
        notFoundMessage: "Documento no encontrado",
      })

      try {
        const existing = await context.orm.document.findFirst({
          where: { id },
        })

        if (!existing) {
          throw new GraphQLError("Documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (existing.revisionScheme === scheme) {
          throw new GraphQLError(
            `El documento ya tiene el esquema de revisión ${scheme}.`,
            { extensions: { code: "BAD_USER_INPUT" } },
          )
        }

        const document = await context.orm.$transaction(async (tx) => {
          const updated = await tx.document.update({
            where: { id },
            data: {
              revisionScheme: scheme,
              updatedById: userId,
            },
            include: documentIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.SwitchRevisionScheme,
            objectId: id,
            actorId: userId,
            meta: { from: existing.revisionScheme, to: scheme },
          })

          return updated
        })

        return document
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "SWITCH_REVISION_SCHEME",
          messages: {
            notFound: "El documento no existe.",
            default: "Error al cambiar el esquema de revisión.",
          },
        })
      }
    },
  },
}
