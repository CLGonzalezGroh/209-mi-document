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
  DocFileRole,
  DocObjectType,
  ModuleType,
  RevisionStatus,
  RevisionScheme,
  StepStatus,
  WorkflowStatus,
} from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import {
  emitAuditEvent,
  emitWorkflowEvent,
  emitWorkflowEvents,
} from "../events/emit.js"
import { lastLiveRevision } from "../utils/revisionScheme.js"
import {
  planRevision,
  REVISION_PLAN_MESSAGE,
} from "../utils/revisionSetup.js"
import { initialSteps } from "../utils/workflowTemplate.js"
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

// Las revisiones se ordenan por CREACIÓN y nunca por código (BLOQUE 03, B12 y
// H-10): con el cambio de esquema la secuencia puede quedar A, B, C, 0, 1.
const documentIncludes = {
  currentDocumentType: true,
  currentDocumentClass: true,
  revisions: {
    include: {
      versions: { include: { files: true } },
      workflows: {
        include: {
          steps: { orderBy: { stepOrder: "asc" as const } },
        },
        orderBy: { createdAt: "asc" as const },
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
            { currentTitle: { contains: filter.query, mode: "insensitive" as const } },
            { description: { contains: filter.query, mode: "insensitive" as const } },
          ]
        }

        if (filter?.module) {
          where.module = filter.module
        }

        // Los filtros resuelven sobre la COPIA del documento y no por join a la
        // revisión: es para lo que la copia existe (BLOQUE 03B, B2).
        if (filter?.documentTypeId) {
          where.currentDocumentTypeId = filter.documentTypeId
        }

        if (filter?.documentClassId) {
          where.currentDocumentClassId = filter.documentClassId
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
          select: { id: true, code: true, currentTitle: true },
          orderBy: { code: "asc" },
        })

        return documents.map(
          (d): SelectOption => ({
            value: String(d.id),
            label: `${d.code} - ${d.currentTitle}`,
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
          // El armador del primer circuito (B3). Obligatorio, con el valor por
          // defecto del proyecto cuando no se informa.
          assignedOrganizerId?: number
          // Esquema con que se propone el código de la primera revisión. No se
          // persiste: gobierna la propuesta y nada más (B13).
          revisionScheme?: RevisionScheme
          initialRevisionCode?: string
          // El archivo DEJA DE SER OBLIGATORIO (H-20): el paso de elaboración
          // existe justamente para producirlo. Sigue siendo admisible, porque el
          // proyecto que parte de un documento preexistente lo adjunta en el alta.
          initialVersion?: {
            fileKey: string
            fileName: string
            fileSize: number
            mimeType: string
            checksum: string
            comment?: string
          }
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
        const document = await context.orm.$transaction(async (tx) => {
          // Código, armador y plantilla propuesta, con la misma resolución que
          // usa createRevision. Ver utils/revisionSetup.
          const planned = await planRevision(tx, {
            documentId: null,
            scope: {
              projectId: input.projectId ?? null,
              documentClassId: input.documentClassId ?? null,
              documentTypeId: input.documentTypeId,
            },
            chosenScheme: input.revisionScheme ?? null,
            informedCode: input.initialRevisionCode ?? null,
            informedOrganizerId: input.assignedOrganizerId ?? null,
          })

          if (!planned.ok) {
            throw new GraphQLError(REVISION_PLAN_MESSAGE[planned.reason], {
              extensions: { code: "BAD_USER_INPUT" },
            })
          }
          const { revisionCode, organizerId, templateId } = planned.plan

          // No existe documento sin circuito: existe circuito en armado (B3).
          // Los pasos siguientes se materializan al completarse el armado, y no
          // antes, porque hasta entonces no tienen actor.
          const created = await tx.document.create({
            data: {
              code: input.code,
              description: input.description,
              module: input.module,
              projectId: input.projectId,
              // Copia de la revisión en curso, que acá es la que nace (B2).
              currentTitle: input.title,
              currentDocumentTypeId: input.documentTypeId,
              currentDocumentClassId: input.documentClassId,
              createdById: userId,
              updatedById: userId,
              revisions: {
                create: {
                  revisionCode,
                  status: RevisionStatus.DRAFT,
                  assignedOrganizerId: organizerId,
                  // La identificación es de la revisión (B1). En el alta la
                  // aporta el input, porque no hay revisión anterior de la que
                  // copiarla.
                  title: input.title,
                  documentTypeId: input.documentTypeId,
                  documentClassId: input.documentClassId,
                  createdById: userId,
                  updatedById: userId,
                  ...(input.initialVersion && {
                    versions: {
                      create: {
                        versionNumber: 1,
                        comment: input.initialVersion.comment,
                        createdById: userId,
                        // La versión es un CONJUNTO (B6): el archivo del alta
                        // entra como entregable, que es lo que era.
                        files: {
                          create: {
                            role: DocFileRole.DELIVERABLE,
                            fileKey: input.initialVersion.fileKey,
                            fileName: input.initialVersion.fileName,
                            fileSize: input.initialVersion.fileSize,
                            mimeType: input.initialVersion.mimeType,
                            checksum: input.initialVersion.checksum,
                          },
                        },
                      },
                    },
                  }),
                  workflows: {
                    create: {
                      status: WorkflowStatus.IN_PROGRESS,
                      initiatedById: userId,
                      templateId,
                      steps: {
                        create: initialSteps(organizerId).map((s) => ({
                          ...s,
                          status: StepStatus.PENDING,
                        })),
                      },
                    },
                  },
                },
              },
            },
            include: documentIncludes,
          })

          const revision = created.revisions[0]
          const workflow = revision.workflows[0]

          await emitAuditEvent(tx, {
            action: AuditAction.CreateDocument,
            objectId: created.id,
            actorId: userId,
            meta: {
              code: created.code,
              title: created.currentTitle,
              module: created.module,
              revisionCode,
              assignedOrganizerId: organizerId,
              templateId,
              withInitialVersion: Boolean(input.initialVersion),
            },
          })
          await emitWorkflowEvents(tx, [
            {
              name: WorkflowEvent.RevisionCreated,
              objectId: revision.id,
              toState: RevisionStatus.DRAFT,
              actorId: userId,
            },
            {
              name: WorkflowEvent.WorkflowStarted,
              objectId: workflow.id,
              toState: WorkflowStatus.IN_PROGRESS,
              actorId: userId,
            },
          ])

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
        // La metadata se CONGELA con la revisión aprobada (BLOQUE 03, B6).
        //
        // El motivo es material: parte de la metadata está impresa dentro del
        // archivo —el rótulo lleva código, título y a menudo clase y tipo—, de
        // modo que cambiarla después de aprobar produciría una divergencia
        // silenciosa entre lo que el sistema afirma y lo que el entregable dice.
        //
        // Se mira la ÚLTIMA revisión viva y no "si existe alguna aprobada":
        // abrir la revisión siguiente vuelve a habilitar la edición, y el
        // archivo que se elabore llevará el rótulo nuevo.
        const revisions = await context.orm.documentRevision.findMany({
          where: { documentId: id },
          select: {
            id: true,
            revisionCode: true,
            status: true,
            createdAt: true,
          },
        })
        const last = lastLiveRevision(revisions)

        if (last?.status === RevisionStatus.APPROVED) {
          throw new GraphQLError(
            "La revisión vigente está aprobada y su identificación no se edita. Para corregirla, abra una revisión nueva.",
            { extensions: { code: "CONFLICT" } },
          )
        }

        const { documentTypeId, documentClassId, title, ...rest } = input

        const document = await context.orm.$transaction(async (tx) => {
          const updated = await tx.document.update({
            where: { id },
            data: {
              ...rest,
              updatedById: userId,
              ...(title !== undefined && { currentTitle: title }),
              ...(documentTypeId !== undefined && {
                currentDocumentType: { connect: { id: documentTypeId } },
              }),
              ...(documentClassId !== undefined && {
                currentDocumentClass: documentClassId
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
  },
}
