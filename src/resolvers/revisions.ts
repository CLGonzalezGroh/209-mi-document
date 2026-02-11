import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { userAuthorization } from "../utils/userAuthorization.js"
import { handleError } from "../utils/handleError.js"
import { RevisionStatus } from "../generated/prisma/enums.js"

const revisionIncludes = {
  document: {
    include: {
      documentType: true,
    },
  },
  versions: {
    orderBy: { versionNumber: "desc" as const },
  },
  workflow: {
    include: {
      steps: {
        orderBy: { stepOrder: "asc" as const },
      },
    },
  },
}

/**
 * Genera el siguiente revisionCode automáticamente.
 * Secuencia: A, B, C, ..., Z, AA, AB, ...
 */
function getNextRevisionCode(currentCode: string): string {
  if (!currentCode) return "A"

  const chars = currentCode.split("")
  let carry = true

  for (let i = chars.length - 1; i >= 0 && carry; i--) {
    if (chars[i] === "Z") {
      chars[i] = "A"
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
      carry = false
    }
  }

  if (carry) {
    chars.unshift("A")
  }

  return chars.join("")
}

export const revisionResolvers = {
  Query: {
    revisionById: async (
      _: any,
      { id }: { id: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_READ],
        context,
      })

      try {
        const revision = await context.orm.documentRevision.findFirst({
          where: { id },
          include: revisionIncludes,
        })

        if (!revision) {
          throw new GraphQLError("Revisión no encontrada", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        return revision
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "GET_REVISION_BY_ID",
          messages: {
            notFound: "La revisión solicitada no existe o no está disponible.",
            default: "Error al obtener la revisión.",
          },
        })
      }
    },
  },

  Mutation: {
    createRevision: async (
      _: any,
      {
        documentId,
        input,
      }: {
        documentId: number
        input: {
          revisionCode?: string
          comment?: string
          fileKey: string
          fileName: string
          fileSize: number
          mimeType: string
          checksum?: string
        }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENT_DOCUMENT_CREATE],
        context,
      })

      try {
        // Verificar que el documento existe
        const document = await context.orm.document.findFirst({
          where: { id: documentId },
          include: {
            revisions: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        })

        if (!document) {
          throw new GraphQLError("Documento no encontrado", {
            extensions: { code: "NOT_FOUND" },
          })
        }

        // Verificar que no hay una revisión en DRAFT o IN_REVIEW
        const activeRevision = await context.orm.documentRevision.findFirst({
          where: {
            documentId,
            status: { in: [RevisionStatus.DRAFT, RevisionStatus.IN_REVIEW] },
          },
        })

        if (activeRevision) {
          throw new GraphQLError(
            "Ya existe una revisión en borrador o en revisión para este documento. Debe completarla antes de crear una nueva.",
            { extensions: { code: "CONFLICT" } },
          )
        }

        // Determinar el revisionCode
        let revisionCode = input.revisionCode
        if (!revisionCode) {
          const lastRevision = document.revisions[0]
          revisionCode = lastRevision
            ? getNextRevisionCode(lastRevision.revisionCode)
            : "A"
        }

        // Crear la revisión con su primera versión
        const revision = await context.orm.documentRevision.create({
          data: {
            documentId,
            revisionCode,
            status: RevisionStatus.DRAFT,
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
                comment: input.comment,
                createdById: userId,
              },
            },
          },
          include: revisionIncludes,
        })

        return revision
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CREATE_REVISION",
          messages: {
            uniqueConstraint:
              "Ya existe una revisión con ese código para este documento.",
            notFound: "El documento no existe.",
            default: "Error al crear la revisión.",
          },
        })
      }
    },
  },
}
