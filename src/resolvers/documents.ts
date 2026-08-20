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
import { resolveDocumentLocation } from "../utils/documentLocation.js"
import { assertClassificationInScope } from "../utils/classificationScope.js"
import { subtreeIds } from "../utils/locationPath.js"
import { handleError } from "../utils/handleError.js"
import { buildDocumentOrderBy } from "../utils/orderByHelper.js"
import {
  DocFileRole,
  DocObjectType,
  DocumentRole,
  ModuleType,
  RevisionStatus,
  RevisionScheme,
  StepStatus,
  SysLogModule,
  WorkflowStatus,
} from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { isPending } from "../utils/pendingDocuments.js"
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
  // Ubicación física (BLOQUE 02B, fase 5). Tres formas de preguntar, y solo una
  // rige por consulta: el nodo exacto, la RAMA —el nodo y su descendencia— y los
  // documentos sin clasificar.
  locationId?: number
  locationBranchId?: number
  withoutLocation?: boolean
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

        // Ubicación física (BLOQUE 02B, fase 5). La precedencia se declara acá y
        // en un solo lugar, con la misma forma que `rootsOnly` sobre `parentId` en
        // el catálogo: `withoutLocation` es el caso especial de "sin nodo", de modo
        // que gana sobre los otros dos, y la rama gana sobre el nodo exacto porque
        // lo contiene.
        if (filter?.withoutLocation) {
          where.locationId = null
        } else if (filter?.locationBranchId !== undefined) {
          // La rama se resuelve como conjunto de identificadores y no por prefijo
          // de la ruta: dos nodos de alcances distintos pueden tener la misma ruta
          // —el propio de un proyecto y el del despliegue del que salió— y el
          // filtro los mezclaría.
          const nodes = await context.orm.docLocation.findMany({
            select: { id: true, parentId: true, name: true },
          })
          where.locationId = { in: subtreeIds(nodes, filter.locationBranchId) }
        } else if (filter?.locationId !== undefined) {
          where.locationId = filter.locationId
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

    /**
     * Documentos pendientes de salir (BLOQUE 04, B13).
     *
     * **No hay documento esperado: hay documento**, y pendiente es el que
     * todavía no salió. No se declara con un atributo: se deriva de la ausencia
     * de ítem de transmittal para su revisión en curso, que es la misma relación
     * que `B3` volvió única, leída al revés.
     *
     * En modo Emisor **es también la lista de candidatos a emitir**: lo que el
     * control documental mira para armar el próximo transmittal y lo que mira
     * para saber qué debe todavía es lo mismo.
     *
     * En modo Interno devuelve vacío, y no es un error: sin contraparte no hay
     * emisión, de modo que no hay nada pendiente de salir. Es literalmente cero.
     */
    pendingDocuments: async (
      _: any,
      { docProjectId }: { docProjectId: number },
      context: ResolverContext,
    ) => {
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_LIST],
        docProjectId,
        context,
      })
      logger.info("pendingDocuments", { userId })

      try {
        const settings = await context.orm.docProject.findUnique({
          where: { id: docProjectId },
          select: { documentRole: true },
        })

        if (!settings || settings.documentRole === DocumentRole.INTERNAL) {
          return []
        }

        // Se resuelve en memoria sobre las revisiones vivas del proyecto, y no
        // con un `where`: la condición mira **la revisión en curso**, que es la
        // última no abandonada por secuencia de creación, y esa regla ya vive en
        // `lastLiveRevision`. Reescribirla como consulta la duplicaría en otro
        // lenguaje, con el riesgo de que las dos versiones se separen.
        const documentos = await context.orm.document.findMany({
          where: {
            docProjectId,
            terminatedAt: null,
            obsoletedAt: null,
            revisions: { some: { status: { not: RevisionStatus.ABANDONED } } },
          },
          include: {
            currentDocumentType: true,
            currentDocumentClass: true,
            revisions: {
              where: { status: { not: RevisionStatus.ABANDONED } },
              include: { transmittalItems: { select: { id: true } } },
            },
          },
        })

        return documentos.filter((doc) =>
          isPending(
            settings.documentRole,
            doc.revisions.map((r) => ({
              id: r.id,
              revisionCode: r.revisionCode,
              status: r.status,
              createdAt: r.createdAt,
              emitted: r.transmittalItems.length > 0,
            })),
          ),
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_PENDING_DOCUMENTS",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener los documentos pendientes.",
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
          docProjectId?: number
          documentTypeId: number
          documentClassId?: number
          // El armador del primer circuito (B3). Obligatorio, con el valor por
          // defecto del proyecto cuando no se informa.
          assignedOrganizerId?: number
          // Ubicación física, opcional en los tres roles (BLOQUE 02B, B3 y B4).
          // La obligatoriedad la configura el proyecto y se valida en escritura.
          locationId?: number | null
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
      assertDocumentContext(input.module, input.docProjectId)

      // El proyecto viene en el input, de modo que la doble capa es estricta.
      // Nulo cuando el módulo no es PROJECTS: régimen de publicación (B1).
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CREATE],
        docProjectId: input.docProjectId ?? null,
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
              docProjectId: input.docProjectId ?? null,
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

          // La clase y el tipo, contra el alcance que el proyecto resuelve
          // (BLOQUE 02C, B7). Sin esto el selector sería una sugerencia y no un
          // límite: quien conoce un identificador clasificaría con una entrada
          // que su proyecto no ve.
          await assertClassificationInScope(tx, {
            docProjectId: input.docProjectId ?? null,
            documentClassId: input.documentClassId ?? null,
            documentTypeId: input.documentTypeId,
          })

          // La ubicación se valida contra el alcance que el proyecto resuelve, y
          // su ruta se guarda como snapshot (BLOQUE 02B, B3).
          const locationPath = await resolveDocumentLocation(tx, {
            locationId: input.locationId ?? null,
            docProjectId: input.docProjectId ?? null,
          })

          // No existe documento sin circuito: existe circuito en armado (B3).
          // Los pasos siguientes se materializan al completarse el armado, y no
          // antes, porque hasta entonces no tienen actor.
          const created = await tx.document.create({
            data: {
              code: input.code,
              description: input.description,
              module: input.module,
              docProjectId: input.docProjectId,
              // Copia de la revisión en curso, que acá es la que nace (B2).
              currentTitle: input.title,
              currentDocumentTypeId: input.documentTypeId,
              currentDocumentClassId: input.documentClassId,
              locationId: input.locationId ?? null,
              locationPath,
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


    /**
     * Corrige el código del documento (BLOQUE 03B, B4).
     *
     * El código es el IDENTIFICADOR y no cambia: está en los transmittals
     * emitidos, en el payload de cada firma, en las referencias cruzadas de
     * otros documentos y en el rótulo de cada archivo que salió. Cambiarlo no
     * renombra un registro, rompe la correspondencia con todo lo que ya lo
     * nombra y que el sistema no controla.
     *
     * La única excepción es el error de carga, y su ventana es **mientras el
     * documento no tenga ninguna revisión aprobada**: la condición material de
     * que nada salió. Es más precisa que "antes de la primera revisión" —si la
     * primera se abandona, sigue sin haberse aprobado nada— y no requiere
     * indicador nuevo, porque es la lectura de revisión vigente nula.
     *
     * Después, lo que corresponde es un documento nuevo que lo reemplace (B5).
     */
    correctDocumentCode: async (
      _: any,
      { id, code }: { id: number; code: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_UPDATE],
        context,
      })
      logger.info("correctDocumentCode", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT,
        objectId: id,
        context,
        notFoundMessage: "Documento no encontrado",
      })

      if (!code?.trim()) {
        throw new GraphQLError("El código no puede quedar vacío.", {
          extensions: { code: "BAD_USER_INPUT" },
        })
      }

      try {
        return await context.orm.$transaction(async (tx) => {
          const document = await tx.document.findFirst({
            where: { id },
            select: { id: true, code: true, revisions: { select: { status: true } } },
          })

          if (!document) {
            throw new GraphQLError("Documento no encontrado", {
              extensions: { code: "NOT_FOUND" },
            })
          }

          const aprobada = document.revisions.some(
            (r) => r.status === RevisionStatus.APPROVED,
          )
          if (aprobada) {
            throw new GraphQLError(
              "El código no se corrige después de aprobar una revisión: el documento ya salió con él. Lo que corresponde es dar de alta un documento nuevo que lo reemplace.",
              { extensions: { code: "CONFLICT" } },
            )
          }

          const anterior = document.code
          if (anterior === code.trim()) {
            throw new GraphQLError("El código informado es el que ya tiene.", {
              extensions: { code: "BAD_USER_INPUT" },
            })
          }

          const updated = await tx.document.update({
            where: { id },
            data: { code: code.trim(), updatedById: userId },
            include: documentIncludes,
          })

          // Acción propia y no un `UpdateDocument` más: es la IDENTIDAD
          // cambiando, y sin evento sería inexplicable en una auditoría.
          await emitAuditEvent(tx, {
            action: AuditAction.CorrectDocumentCode,
            objectId: id,
            actorId: userId,
            meta: { anterior, nuevo: updated.code },
          })

          return updated
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CORRECT_DOCUMENT_CODE",
          messages: {
            notFound: "El documento no existe.",
            uniqueConstraint: "Ya existe un documento con ese código en el ámbito.",
            default: "Error al corregir el código del documento.",
          },
        })
      }
    },

    /**
     * Declara obsoleto un documento por haber salido del alcance (BLOQUE 03B, B5).
     *
     * Es la segunda causa de obsolescencia, la que **nada reemplaza**: el
     * documento dejó de tener sentido en el proyecto. Por eso el hecho se
     * registra y no se deriva de la existencia de un reemplazo; lo que sí se
     * deriva es la causa.
     *
     * Obsoleto no es dado de baja: `terminatedAt` corrige un alta que no debió
     * existir, y esto es un hecho del ciclo de vida —el documento existió,
     * sirvió y dejó de servir— que conserva su historia entera.
     */
    obsoleteDocument: async (
      _: any,
      { id, reason }: { id: number; reason: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_OBSOLETE],
        context,
      })
      logger.info("obsoleteDocument", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT,
        objectId: id,
        context,
        notFoundMessage: "Documento no encontrado",
      })

      if (!reason?.trim()) {
        throw new GraphQLError(
          "Declarar obsoleto un documento exige motivo.",
          { extensions: { code: "BAD_USER_INPUT" } },
        )
      }

      try {
        return await context.orm.$transaction(async (tx) => {
          const document = await tx.document.findFirst({
            where: { id },
            select: { id: true, code: true, obsoletedAt: true },
          })

          if (!document) {
            throw new GraphQLError("Documento no encontrado", {
              extensions: { code: "NOT_FOUND" },
            })
          }
          if (document.obsoletedAt) {
            throw new GraphQLError("El documento ya está obsoleto.", {
              extensions: { code: "CONFLICT" },
            })
          }

          const updated = await tx.document.update({
            where: { id },
            data: {
              obsoletedAt: new Date(),
              obsoletedById: userId,
              obsoleteReason: reason.trim(),
              updatedById: userId,
            },
            include: documentIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.ObsoleteDocument,
            objectId: id,
            actorId: userId,
            meta: { code: document.code, reason: reason.trim() },
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.DocumentObsoleted,
            objectId: id,
            fromState: null,
            toState: "OBSOLETE",
            actorId: userId,
          })

          return updated
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "OBSOLETE_DOCUMENT",
          messages: {
            notFound: "El documento no existe.",
            default: "Error al declarar obsoleto el documento.",
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
          description?: string
          projectTaskId?: number | null
          // La ubicación se edita SIEMPRE, como la descripción (BLOQUE 02B, B3):
          // no entra en el congelamiento de D-05 ni en el payload de la firma,
          // porque clasifica y no identifica. Nulo la retira.
          locationId?: number | null
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
        // Solo lo ADMINISTRATIVO (BLOQUE 03B, B1). La identificación —título,
        // clase y tipo— se edita sobre la revisión, con `updateRevisionMetadata`:
        // está impresa en el rótulo, y lo impreso pertenece a la emisión que lo
        // produjo.
        //
        // Con eso desaparece la precondición de congelamiento que esta operación
        // llevaba: no hace falta mirar si la revisión vigente está aprobada,
        // porque acá ya no se toca nada que el rótulo muestre. La descripción no
        // se imprime en ninguno, y corregirla no debe exigir abrir una revisión.
        const document = await context.orm.$transaction(async (tx) => {
          // La ubicación se valida contra el alcance del PROYECTO DEL DOCUMENTO y
          // no contra el del input: cambiar de proyecto no es una edición.
          const locationPath =
            input.locationId === undefined
              ? undefined
              : await resolveDocumentLocation(tx, {
                  locationId: input.locationId,
                  docProjectId: (
                    await tx.document.findUniqueOrThrow({
                      where: { id },
                      select: { docProjectId: true },
                    })
                  ).docProjectId,
                })

          const updated = await tx.document.update({
            where: { id },
            data: {
              ...input,
              ...(locationPath !== undefined && { locationPath }),
              updatedById: userId,
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
