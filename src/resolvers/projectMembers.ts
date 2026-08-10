import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { DocProjectSide } from "../generated/prisma/enums.js"
import { AuditAction } from "../events/catalog.js"
import { emitAuditEvent } from "../events/emit.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("projectMembers")

/**
 * Membresía documental del proyecto (BLOQUE 02, D-15 y B6).
 *
 * Habilita el acceso de un usuario a un proyecto y declara de qué lado está.
 * NO define rol ni permisos: provienen del servicio de administración global.
 *
 * **Administrar la membresía es un acto administrativo y se gobierna únicamente
 * por el permiso global, sin la segunda capa.** Aplicársela sería circular: el
 * primer miembro de un proyecto no puede exigir una membresía que todavía no
 * existe. Es el criterio de OperMask Digitalization para el mismo objeto.
 *
 * Consecuencia a tener presente: quien tenga `documentsProjectMember:list` ve la
 * membresía de TODOS los proyectos. Ese permiso no debe otorgarse a un rol de
 * contraparte.
 */
export const projectMemberResolvers = {
  Query: {
    docProjectMembers: async (
      _: any,
      { projectId, includeRevoked }: { projectId: number; includeRevoked?: boolean },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_PROJECT_MEMBER_LIST],
        context,
      })
      logger.info("docProjectMembers", { userId })

      try {
        return await context.orm.docProjectMember.findMany({
          where: {
            projectId,
            ...(includeRevoked ? {} : { isActive: true, revokedAt: null }),
          },
          orderBy: [{ side: "asc" }, { assignedAt: "asc" }],
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_DOC_PROJECT_MEMBERS",
          messages: {
            default: "Error al obtener los miembros del proyecto.",
          },
        })
      }
    },
  },

  Mutation: {
    assignDocProjectMember: async (
      _: any,
      {
        input,
      }: {
        input: { projectId: number; userId: number; side: DocProjectSide }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_PROJECT_MEMBER_CREATE],
        context,
      })
      logger.info("assignDocProjectMember", { userId })

      try {
        return await context.orm.$transaction(async (tx) => {
          // Reactiva si la membresía ya existía, dada de baja o no. La unicidad
          // del par usuario–proyecto hace que un alta repetida sea una
          // reincorporación, no un duplicado.
          const member = await tx.docProjectMember.upsert({
            where: {
              projectId_userId: { projectId: input.projectId, userId: input.userId },
            },
            update: {
              side: input.side,
              isActive: true,
              revokedAt: null,
              revokedById: null,
              assignedAt: new Date(),
              assignedById: userId,
              updatedById: userId,
            },
            create: {
              projectId: input.projectId,
              userId: input.userId,
              side: input.side,
              assignedById: userId,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.AssignProjectMember,
            objectId: member.id,
            actorId: userId,
            meta: {
              projectId: input.projectId,
              memberUserId: input.userId,
              side: input.side,
            },
          })

          return member
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "ASSIGN_DOC_PROJECT_MEMBER",
          messages: {
            default: "Error al incorporar el miembro al proyecto.",
          },
        })
      }
    },

    revokeDocProjectMember: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_PROJECT_MEMBER_DELETE],
        context,
      })
      logger.info("revokeDocProjectMember", { userId })

      const member = await context.orm.docProjectMember.findUnique({ where: { id } })

      if (!member) {
        throw new GraphQLError("Miembro no encontrado", {
          extensions: { code: "NOT_FOUND" },
        })
      }

      try {
        return await context.orm.$transaction(async (tx) => {
          // Baja lógica: la membresía conserva alta, baja y actor (D-15)
          const revoked = await tx.docProjectMember.update({
            where: { id },
            data: {
              isActive: false,
              revokedAt: new Date(),
              revokedById: userId,
              updatedById: userId,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.RevokeProjectMember,
            objectId: revoked.id,
            actorId: userId,
            meta: { projectId: revoked.projectId, memberUserId: revoked.userId },
          })

          return revoked
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "REVOKE_DOC_PROJECT_MEMBER",
          messages: {
            default: "Error al dar de baja el miembro del proyecto.",
          },
        })
      }
    },
  },
}
