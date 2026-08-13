import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { StepType } from "../generated/prisma/enums.js"
import { AuditAction } from "../events/catalog.js"
import { emitAuditEvent } from "../events/emit.js"
import {
  resolveTemplate,
  TEMPLATE_STEP_TYPES,
} from "../utils/workflowTemplate.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("workflowTemplates")

const templateIncludes = {
  documentClass: true,
  documentType: true,
  steps: { orderBy: { stepOrder: "asc" as const } },
}

type TemplateStepInput = {
  stepOrder: number
  stepType: StepType
  assignedToId?: number
}

/**
 * Los pasos que la plantilla admite declarar (BLOQUE 03, B3).
 *
 * `ASSIGN` y `PREPARE` los pone el sistema: una plantilla que pudiera omitirlos
 * permitiría circuitos sin elaborador, y una que pudiera incluirlos permitiría
 * dos armados. El elaborador, además, **nunca se preasigna**: designarlo es
 * distribuir carga de trabajo y se decide documento por documento.
 */
const assertTemplateSteps = (steps: TemplateStepInput[]) => {
  if (steps.length === 0) {
    throw new GraphQLError("La plantilla debe declarar al menos un paso.", {
      extensions: { code: "BAD_USER_INPUT" },
    })
  }

  if (steps.some((s) => !TEMPLATE_STEP_TYPES.includes(s.stepType))) {
    throw new GraphQLError(
      "La plantilla declara solo revisión, aprobación y toma de conocimiento: el armado y la elaboración los pone el sistema.",
      { extensions: { code: "BAD_USER_INPUT" } },
    )
  }

  const ordenes = steps.map((s) => s.stepOrder)
  if (new Set(ordenes).size !== ordenes.length) {
    throw new GraphQLError("Los pasos de la plantilla repiten el orden.", {
      extensions: { code: "BAD_USER_INPUT" },
    })
  }
}

/**
 * Plantillas del circuito.
 *
 * **Autorización global, sin segunda capa**: aunque una plantilla declare un
 * proyecto en su alcance, administrarlas es un acto sobre la configuración del
 * despliegue —el mismo criterio con que se tratan los catálogos de clase y
 * tipo—. Se gobierna con el permiso de circuito, que es el objeto que proponen.
 */
export const workflowTemplateResolvers = {
  Query: {
    docWorkflowTemplates: async (
      _: any,
      { projectId }: { projectId?: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_LIST],
        context,
      })
      logger.info("docWorkflowTemplates", { userId })

      try {
        return await context.orm.docWorkflowTemplate.findMany({
          where:
            projectId === undefined
              ? {}
              : { OR: [{ projectId }, { projectId: null }] },
          include: templateIncludes,
          orderBy: [{ projectId: "asc" }, { name: "asc" }],
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOC_WORKFLOW_TEMPLATES",
          messages: { default: "Error al obtener las plantillas de circuito." },
        })
      }
    },

    /**
     * Plantilla que regiría para un documento con ese alcance, con la más
     * específica ganando. Es la misma resolución que hace el alta: se expone
     * para que la interfaz pueda mostrar el circuito propuesto antes de crear.
     */
    proposedWorkflowTemplate: async (
      _: any,
      {
        projectId,
        documentClassId,
        documentTypeId,
      }: {
        projectId?: number
        documentClassId?: number
        documentTypeId?: number
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_LIST],
        context,
      })
      logger.info("proposedWorkflowTemplate", { userId })

      try {
        const candidates = await context.orm.docWorkflowTemplate.findMany({
          where: { OR: [{ projectId: null }, { projectId: projectId ?? undefined }] },
          include: templateIncludes,
        })

        return resolveTemplate(candidates, {
          projectId: projectId ?? null,
          documentClassId: documentClassId ?? null,
          documentTypeId: documentTypeId ?? null,
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_PROPOSED_WORKFLOW_TEMPLATE",
          messages: { default: "Error al resolver la plantilla propuesta." },
        })
      }
    },
  },

  Mutation: {
    createDocWorkflowTemplate: async (
      _: any,
      {
        input,
      }: {
        input: {
          name: string
          description?: string
          projectId?: number
          documentClassId?: number
          documentTypeId?: number
          steps: TemplateStepInput[]
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_CREATE],
        context,
      })
      logger.info("createDocWorkflowTemplate", { userId })

      assertTemplateSteps(input.steps)

      try {
        return await context.orm.$transaction(async (tx) => {
          const created = await tx.docWorkflowTemplate.create({
            data: {
              name: input.name,
              description: input.description,
              projectId: input.projectId,
              documentClassId: input.documentClassId,
              documentTypeId: input.documentTypeId,
              createdById: userId,
              updatedById: userId,
              steps: {
                create: input.steps.map((s) => ({
                  stepOrder: s.stepOrder,
                  stepType: s.stepType,
                  assignedToId: s.assignedToId ?? null,
                })),
              },
            },
            include: templateIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.CreateWorkflowTemplate,
            objectId: created.id,
            actorId: userId,
            meta: {
              name: created.name,
              projectId: created.projectId,
              documentClassId: created.documentClassId,
              documentTypeId: created.documentTypeId,
              stepsCount: input.steps.length,
            },
          })

          return created
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_DOC_WORKFLOW_TEMPLATE",
          messages: {
            uniqueConstraint:
              "Ya existe una plantilla para ese alcance de proyecto, clase y tipo.",
            foreignKeyConstraint: "La clase o el tipo indicados no existen.",
            default: "Error al crear la plantilla de circuito.",
          },
        })
      }
    },

    /**
     * Actualiza la plantilla. Los pasos se **reemplazan** en bloque: una
     * plantilla es una propuesta completa, y editarla paso por paso invitaría a
     * dejarla a medias.
     *
     * **No altera circuitos en curso**: los valores se copian al materializarse
     * (B3), con el mismo criterio del payload firmado.
     */
    updateDocWorkflowTemplate: async (
      _: any,
      {
        id,
        input,
      }: {
        id: number
        input: {
          name?: string
          description?: string
          steps?: TemplateStepInput[]
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_UPDATE],
        context,
      })
      logger.info("updateDocWorkflowTemplate", { userId })

      if (input.steps) assertTemplateSteps(input.steps)

      try {
        return await context.orm.$transaction(async (tx) => {
          if (input.steps) {
            await tx.docWorkflowTemplateStep.deleteMany({
              where: { templateId: id },
            })
            await tx.docWorkflowTemplateStep.createMany({
              data: input.steps.map((s) => ({
                templateId: id,
                stepOrder: s.stepOrder,
                stepType: s.stepType,
                assignedToId: s.assignedToId ?? null,
              })),
            })
          }

          const updated = await tx.docWorkflowTemplate.update({
            where: { id },
            data: {
              name: input.name,
              description: input.description,
              updatedById: userId,
            },
            include: templateIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateWorkflowTemplate,
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
          logName: "UPDATE_DOC_WORKFLOW_TEMPLATE",
          messages: {
            notFound: "La plantilla no existe.",
            default: "Error al actualizar la plantilla de circuito.",
          },
        })
      }
    },

    /**
     * Da de baja la plantilla. **No se elimina**: los circuitos que la
     * referencian conservan de dónde salió su propuesta, y una plantilla dada de
     * baja deja de proponerse sin perder esa traza.
     */
    terminateDocWorkflowTemplate: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_WORKFLOW_UPDATE],
        context,
      })
      logger.info("terminateDocWorkflowTemplate", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          const updated = await tx.docWorkflowTemplate.update({
            where: { id },
            data: { terminatedAt: new Date(), updatedById: userId },
            include: templateIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.DeleteWorkflowTemplate,
            objectId: id,
            actorId: userId,
            meta: { name: updated.name },
          })

          return updated
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "TERMINATE_DOC_WORKFLOW_TEMPLATE",
          messages: {
            notFound: "La plantilla no existe.",
            default: "Error al dar de baja la plantilla de circuito.",
          },
        })
      }
    },
  },
}
