import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import {
  PERMISSIONS,
  SelectOption,
  TerminatedFilter,
} from "@CLGonzalezGroh/mi-common"
import {
  DocObjectType,
  QualificationEffect,
  SysLogModule,
} from "../generated/prisma/enums.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { emitAuditEvent, emitWorkflowEvent } from "../events/emit.js"
import { userAuthorization } from "../utils/userAuthorization.js"
import {
  assertObjectAccess,
  projectAuthorization,
} from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { resolveScope } from "../utils/qualifications.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("qualifications")

interface QualificationFilterInput {
  projectId?: number
  terminatedFilter?: TerminatedFilter
}

/**
 * Catálogo de calificaciones de la contraparte (BLOQUE 04, B11).
 *
 * Autorización en dos capas cuando la operación declara proyecto, y global
 * cuando el alcance es el despliegue: es el criterio de B7 de BLOQUE 02, con la
 * misma forma que ya tienen los catálogos de clase y tipo.
 */
export const qualificationResolvers = {
  Query: {
    /**
     * El catálogo tal como está declarado, sin resolver alcance: lista lo del
     * despliegue o lo de un proyecto según se pida. Es la vista de
     * administración.
     */
    qualifications: async (
      _: any,
      { filter }: { filter?: QualificationFilterInput },
      context: ResolverContext,
    ) => {
      const userId =
        filter?.projectId !== undefined
          ? await projectAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_QUALIFICATION_LIST],
              projectId: filter.projectId,
              context,
            })
          : await userAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_QUALIFICATION_LIST],
              context,
            })
      logger.info("qualifications", { userId })

      try {
        const where: any = {
          projectId: filter?.projectId ?? null,
        }

        if (filter?.terminatedFilter === TerminatedFilter.ACTIVE) {
          where.terminatedAt = null
        } else if (filter?.terminatedFilter === TerminatedFilter.DISABLED) {
          where.terminatedAt = { not: null }
        }

        return await context.orm.docQualification.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_QUALIFICATIONS",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener el catálogo de calificaciones.",
          },
        })
      }
    },

    qualificationById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_QUALIFICATION_READ],
        context,
      })
      logger.info("qualificationById", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      // La calificación de un proyecto exige membresía; la del despliegue no
      // pertenece a ninguno y se resuelve con el permiso global (BLOQUE 02, B7).
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_QUALIFICATION,
        objectId: id,
        context,
        notFoundMessage: "Calificación no encontrada",
      })

      try {
        const qualification = await context.orm.docQualification.findFirst({
          where: { id },
        })

        if (!qualification) {
          throw new GraphQLError("Calificación no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return qualification
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_QUALIFICATION_BY_ID",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La calificación solicitada no existe.",
            default: "Error al obtener la calificación.",
          },
        })
      }
    },

    /**
     * Las calificaciones con que se puede responder en un proyecto.
     *
     * Resuelve el alcance —las propias del proyecto si declaró alguna, las del
     * despliegue si no— y filtra las dadas de baja. La resolución se expone acá
     * y no se deriva en cada consumidor, con el criterio del §13.
     */
    projectQualifications: async (
      _: any,
      { projectId }: { projectId: number },
      context: ResolverContext,
    ) => {
      const userId = await projectAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_QUALIFICATION_LIST],
        projectId,
        context,
      })
      logger.info("projectQualifications", { userId })

      try {
        const catalogo = await context.orm.docQualification.findMany({
          where: { OR: [{ projectId }, { projectId: null }] },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })

        // El alcance se decide sobre el catálogo COMPLETO y la baja lógica se
        // filtra después: dar de baja la última calificación propia no devuelve
        // el proyecto al catálogo del despliegue.
        return resolveScope(catalogo, projectId).filter(
          (q) => q.terminatedAt === null,
        )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_PROJECT_QUALIFICATIONS",
          module: SysLogModule.DOCUMENT,
          messages: {
            default:
              "Error al obtener las calificaciones vigentes del proyecto.",
          },
        })
      }
    },

    qualificationsSelectList: async (
      _: any,
      { projectId }: { projectId: number },
      context: ResolverContext,
    ) => {
      const userId = await projectAuthorization({
        requiredPermissions: [
          PERMISSIONS.DOCUMENTS_QUALIFICATION_SELECT,
          PERMISSIONS.COMMON_SELECT_LIST_ACCESS,
        ],
        projectId,
        context,
      })
      logger.info("qualificationsSelectList", { userId })

      try {
        const catalogo = await context.orm.docQualification.findMany({
          where: { OR: [{ projectId }, { projectId: null }] },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })

        return resolveScope(catalogo, projectId)
          .filter((q) => q.terminatedAt === null)
          .map(
            (q): SelectOption => ({
              value: String(q.id),
              label: q.label,
            }),
          )
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_QUALIFICATIONS_SELECT_LIST",
          module: SysLogModule.DOCUMENT,
          messages: {
            default: "Error al obtener la lista de calificaciones.",
          },
        })
      }
    },
  },

  Mutation: {
    createQualification: async (
      _: any,
      {
        input,
      }: {
        input: {
          projectId?: number
          code: string
          label: string
          effect: QualificationEffect
          sortOrder?: number
        }
      },
      context: ResolverContext,
    ) => {
      const userId =
        input.projectId !== undefined
          ? await projectAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_QUALIFICATION_CREATE],
              projectId: input.projectId,
              context,
            })
          : await userAuthorization({
              requiredPermissions: [PERMISSIONS.DOCUMENTS_QUALIFICATION_CREATE],
              context,
            })
      logger.info("createQualification", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          const created = await tx.docQualification.create({
            data: {
              projectId: input.projectId ?? null,
              code: input.code,
              label: input.label,
              effect: input.effect,
              sortOrder: input.sortOrder ?? 0,
              createdById: userId,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CreateQualification,
            objectId: created.id,
            actorId: userId,
            meta: {
              code: created.code,
              label: created.label,
              effect: created.effect,
            },
          })

          return created
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_QUALIFICATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            uniqueConstraint:
              "Ya existe una calificación con ese código en ese alcance.",
            default: "Error al crear la calificación.",
          },
        })
      }
    },

    /**
     * El alcance no se edita.
     *
     * Mover una calificación del despliegue a un proyecto, o al revés, cambia
     * qué juego de valores tiene disponible cada proyecto sin que nadie lo
     * declare. Se crea en el alcance que corresponde y se da de baja la que
     * sobra, que además deja la traza de las dos cosas.
     */
    updateQualification: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: {
          code?: string
          label?: string
          effect?: QualificationEffect
          sortOrder?: number
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_QUALIFICATION_UPDATE],
        context,
      })
      logger.info("updateQualification", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      // La calificación de un proyecto exige membresía; la del despliegue no
      // pertenece a ninguno y se resuelve con el permiso global (BLOQUE 02, B7).
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_QUALIFICATION,
        objectId: id,
        context,
        notFoundMessage: "Calificación no encontrada",
      })

      try {
        return await context.orm.$transaction(async (tx) => {
          const updated = await tx.docQualification.update({
            where: { id },
            data: { ...input, updatedById: userId },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateQualification,
            objectId: id,
            actorId: userId,
            meta: { input },
          })

          return updated
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "UPDATE_QUALIFICATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La calificación no existe.",
            uniqueConstraint:
              "Ya existe una calificación con ese código en ese alcance.",
            default: "Error al actualizar la calificación.",
          },
        })
      }
    },

    /**
     * Baja lógica. Lo ya calificado con ella NO se revalida: la validación
     * ocurre solo en escritura, según la orientación de D-13.
     */
    terminateQualification: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_QUALIFICATION_DELETE],
        context,
      })
      logger.info("terminateQualification", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      // La calificación de un proyecto exige membresía; la del despliegue no
      // pertenece a ninguno y se resuelve con el permiso global (BLOQUE 02, B7).
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_QUALIFICATION,
        objectId: id,
        context,
        notFoundMessage: "Calificación no encontrada",
      })

      try {
        return await context.orm.$transaction(async (tx) => {
          const updated = await tx.docQualification.update({
            where: { id },
            data: { terminatedAt: new Date(), updatedById: userId },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.TerminateQualification,
            objectId: id,
            actorId: userId,
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.QualificationTerminated,
            objectId: id,
            fromState: "ACTIVE",
            toState: "TERMINATED",
            actorId: userId,
          })

          return updated
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_QUALIFICATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La calificación no existe.",
            default: "Error al deshabilitar la calificación.",
          },
        })
      }
    },

    activateQualification: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_QUALIFICATION_UPDATE],
        context,
      })
      logger.info("activateQualification", { userId })

      // Fuera del try: un rechazo de autorización no es un error del servicio.
      // La calificación de un proyecto exige membresía; la del despliegue no
      // pertenece a ninguno y se resuelve con el permiso global (BLOQUE 02, B7).
      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOC_QUALIFICATION,
        objectId: id,
        context,
        notFoundMessage: "Calificación no encontrada",
      })

      try {
        return await context.orm.$transaction(async (tx) => {
          const updated = await tx.docQualification.update({
            where: { id },
            data: { terminatedAt: null, updatedById: userId },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.ActivateQualification,
            objectId: id,
            actorId: userId,
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.QualificationActivated,
            objectId: id,
            fromState: "TERMINATED",
            toState: "ACTIVE",
            actorId: userId,
          })

          return updated
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ACTIVATE_QUALIFICATION",
          module: SysLogModule.DOCUMENT,
          messages: {
            notFound: "La calificación no existe.",
            default: "Error al habilitar la calificación.",
          },
        })
      }
    },
  },
}
