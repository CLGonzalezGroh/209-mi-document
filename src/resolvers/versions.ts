import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { RevisionStatus } from "../generated/prisma/enums.js"

const versionIncludes = {
  revision: {
    include: {
      document: true,
    },
  },
}

export const versionResolvers = {
  Mutation: {
    registerVersion: async (
      _: any,
      {
        revisionId,
        input,
      }: {
        revisionId: number
        input: {
          fileKey: string
          fileName: string
          fileSize: number
          mimeType: string
          checksum?: string
          comment?: string
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_CREATE],
        context,
      })

      try {
        // Verificar que la revisión existe y está en DRAFT
        const revision = await context.orm.documentRevision.findFirst({
          where: { id: revisionId },
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
            },
          },
        })

        if (!revision) {
          throw new GraphQLError("Revisión no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        if (revision.status !== RevisionStatus.DRAFT) {
          throw new GraphQLError(
            "Solo se pueden agregar versiones a revisiones en estado DRAFT.",
            { extensions: { code: "BAD_REQUEST" } },
          )
        }

        // Determinar el próximo versionNumber
        const lastVersion = revision.versions[0]
        const nextVersionNumber = lastVersion
          ? lastVersion.versionNumber + 1
          : 1

        // Crear la versión
        const version = await context.orm.documentVersion.create({
          data: {
            revisionId,
            versionNumber: nextVersionNumber,
            fileKey: input.fileKey,
            fileName: input.fileName,
            fileSize: input.fileSize,
            mimeType: input.mimeType,
            checksum: input.checksum,
            comment: input.comment,
            createdById: userId,
          },
          include: versionIncludes,
        })

        return version
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "REGISTER_VERSION",
          messages: {
            notFound: "La revisión no existe.",
            uniqueConstraint:
              "Ya existe una versión con ese número para esta revisión.",
            default: "Error al registrar la versión.",
          },
        })
      }
    },
  },
}
