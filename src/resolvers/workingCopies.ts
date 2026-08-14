import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import {
  holdsPermission,
  userAuthorization,
} from "../utils/userAuthorization.js"
import { assertObjectAccess } from "../utils/projectAuthorization.js"
import { handleError } from "../utils/handleError.js"
import {
  DocFileRole,
  DocObjectType,
  RevisionStatus,
  WorkflowStatus,
} from "../generated/prisma/enums.js"
import type { Prisma } from "../generated/prisma/client.js"
import { AuditAction, WorkflowEvent } from "../events/catalog.js"
import { emitAuditEvent, emitWorkflowEvent } from "../events/emit.js"
import { currentStep } from "../utils/reviewWorkflow.js"
import {
  hasChanges,
  incompleteReason,
  INCOMPLETE_MESSAGE,
  preloadFrom,
  type CopyFile,
} from "../utils/workingCopy.js"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("workingCopies")

const copyIncludes = {
  files: { orderBy: { fileKey: "asc" as const } },
}

type FileInput = {
  role: DocFileRole
  fileKey: string
  fileName: string
  fileSize: number
  mimeType: string
  checksum: string
}

const assertChecksum = (input: FileInput) => {
  if (!input.checksum?.trim()) {
    throw new GraphQLError(
      "Todo archivo exige checksum: es lo que la firma acredita como contenido.",
      { extensions: { code: "BAD_USER_INPUT" } },
    )
  }
}

/**
 * La copia ABIERTA de la revisión, con el permiso del momento ya verificado.
 *
 * La versión la produce quien tiene el paso vigente (BLOQUE 03, B5): no es una
 * restricción de identidad sino de momento, y por eso se comprueba en cada
 * operación y no solo al abrir. El permiso especial habilita hacerlo por otro.
 */
const openCopyOf = async (
  tx: Prisma.TransactionClient,
  {
    revisionId,
    userId,
    context,
  }: { revisionId: number; userId: number; context: ResolverContext },
) => {
  const revision = await tx.documentRevision.findFirst({
    where: { id: revisionId },
    include: {
      workflows: {
        where: { status: WorkflowStatus.IN_PROGRESS },
        include: { steps: true },
      },
      workingCopies: {
        where: { confirmedAt: null, discardedAt: null },
        include: copyIncludes,
      },
    },
  })

  if (!revision) {
    throw new GraphQLError("Revisión no encontrada", {
      extensions: { code: "NOT_FOUND" },
    })
  }

  const abierto = revision.workflows[0]
  const vigente = abierto ? currentStep(abierto.steps) : null
  if (!vigente) {
    throw new GraphQLError(
      "La revisión no tiene un paso en curso que produzca la versión.",
      { extensions: { code: "BAD_REQUEST" } },
    )
  }

  if (vigente.assignedToId !== userId) {
    const esAdmin = await holdsPermission({
      permission: PERMISSIONS.DOCUMENTS_WORKFLOW_ADMIN_UPDATE,
      context,
    })
    if (!esAdmin) {
      throw new GraphQLError(
        "La versión la produce quien tiene asignado el paso en curso.",
        { extensions: { code: "FORBIDDEN" } },
      )
    }
  }

  return { revision, copia: revision.workingCopies[0] ?? null, vigente }
}

const requireOpenCopy = <T>(copia: T | null): T => {
  if (!copia) {
    throw new GraphQLError(
      "La revisión no tiene ninguna copia de trabajo abierta.",
      { extensions: { code: "BAD_REQUEST" } },
    )
  }
  return copia
}

export const workingCopyResolvers = {
  Mutation: {
    /**
     * Abre la copia de trabajo, precargada con la versión vigente (B12).
     *
     * Precargar es lo que vuelve barata la edición: el que corrige el entregable
     * abre, lo reemplaza y confirma, y la fuente y el respaldo viajan solos
     * conservando su `fileKey` y su `checksum`, sin volver a subirse.
     *
     * No descarga ni bloquea. Leer un archivo nunca fue un acto del ciclo, y la
     * exclusividad ya la da el circuito.
     */
    openWorkingCopy: async (
      _: any,
      { revisionId }: { revisionId: number },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CREATE],
        context,
      })
      logger.info("openWorkingCopy", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: revisionId,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      try {
        return await context.orm.$transaction(async (tx) => {
          const { revision, copia } = await openCopyOf(tx, {
            revisionId,
            userId,
            context,
          })

          if (
            revision.status !== RevisionStatus.DRAFT &&
            revision.status !== RevisionStatus.IN_REVIEW
          ) {
            throw new GraphQLError(
              "Solo se producen versiones mientras la revisión está en curso.",
              { extensions: { code: "BAD_REQUEST" } },
            )
          }

          // A lo sumo una abierta por revisión. El índice único parcial lo
          // garantiza; el mensaje explica por qué.
          if (copia) {
            throw new GraphQLError(
              "La revisión ya tiene una copia de trabajo abierta. Confírmela o descártela antes de abrir otra.",
              { extensions: { code: "CONFLICT" } },
            )
          }

          const vigente = await tx.documentVersion.findFirst({
            where: { revisionId },
            include: { files: true },
            orderBy: { versionNumber: "desc" },
          })

          const created = await tx.docWorkingCopy.create({
            data: {
              revisionId,
              createdById: userId,
              files: {
                create: preloadFrom(vigente?.files as CopyFile[] | undefined),
              },
            },
            include: copyIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.OpenWorkingCopy,
            objectId: revisionId,
            actorId: userId,
            meta: {
              workingCopyId: created.id,
              precargados: created.files.length,
              desdeVersion: vigente?.versionNumber ?? null,
            },
          })

          return created
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "OPEN_WORKING_COPY",
          messages: {
            notFound: "La revisión no existe.",
            default: "Error al abrir la copia de trabajo.",
          },
        })
      }
    },

    /**
     * Incorpora un archivo al conjunto en preparación (B12).
     *
     * Sirve tanto para **adjuntar** —el archivo no estaba— como para
     * **reemplazar** —el archivo estaba y llega corregido—. Es la misma
     * operación porque es el mismo hecho: el conjunto pasa a tener este archivo
     * con este contenido. Distinguirlas obligaría al llamador a saber qué había
     * antes, que es justamente lo que la copia precargada le evita.
     */
    putWorkingCopyFile: async (
      _: any,
      { revisionId, input }: { revisionId: number; input: FileInput },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CREATE],
        context,
      })
      logger.info("putWorkingCopyFile", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: revisionId,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      assertChecksum(input)

      try {
        return await context.orm.$transaction(async (tx) => {
          const { copia } = await openCopyOf(tx, { revisionId, userId, context })
          const abierta = requireOpenCopy(copia)

          await tx.docWorkingCopyFile.upsert({
            where: {
              workingCopyId_fileKey: {
                workingCopyId: abierta.id,
                fileKey: input.fileKey,
              },
            },
            create: { workingCopyId: abierta.id, ...input },
            update: {
              role: input.role,
              fileName: input.fileName,
              fileSize: input.fileSize,
              mimeType: input.mimeType,
              checksum: input.checksum,
            },
          })

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateWorkingCopy,
            objectId: revisionId,
            actorId: userId,
            meta: {
              workingCopyId: abierta.id,
              accion: "PUT",
              fileKey: input.fileKey,
              role: input.role,
            },
          })

          return tx.docWorkingCopy.findUniqueOrThrow({
            where: { id: abierta.id },
            include: copyIncludes,
          })
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "PUT_WORKING_COPY_FILE",
          messages: {
            notFound: "La revisión no existe.",
            default: "Error al incorporar el archivo.",
          },
        })
      }
    },

    /** Retira un archivo del conjunto en preparación (B12). */
    removeWorkingCopyFile: async (
      _: any,
      { revisionId, fileKey }: { revisionId: number; fileKey: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CREATE],
        context,
      })
      logger.info("removeWorkingCopyFile", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: revisionId,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      try {
        return await context.orm.$transaction(async (tx) => {
          const { copia } = await openCopyOf(tx, { revisionId, userId, context })
          const abierta = requireOpenCopy(copia)

          const borrados = await tx.docWorkingCopyFile.deleteMany({
            where: { workingCopyId: abierta.id, fileKey },
          })
          if (borrados.count === 0) {
            throw new GraphQLError(
              "El conjunto no tiene ese archivo.",
              { extensions: { code: "NOT_FOUND" } },
            )
          }

          await emitAuditEvent(tx, {
            action: AuditAction.UpdateWorkingCopy,
            objectId: revisionId,
            actorId: userId,
            meta: { workingCopyId: abierta.id, accion: "REMOVE", fileKey },
          })

          return tx.docWorkingCopy.findUniqueOrThrow({
            where: { id: abierta.id },
            include: copyIncludes,
          })
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "REMOVE_WORKING_COPY_FILE",
          messages: {
            notFound: "El conjunto no tiene ese archivo.",
            default: "Error al retirar el archivo.",
          },
        })
      }
    },

    /**
     * Confirma la copia: el conjunto se convierte en la versión siguiente (B12).
     *
     * **Acá nace la versión**, completa e inmutable. Es la respuesta a la
     * pregunta que `B6` deja abierta —cuándo existe—, y lo que permite que
     * abrir, reemplazar y adjuntar ocurran sin tocar nada que acredite.
     *
     * Admite recibir el conjunto completo de una vez, creando y cerrando la
     * copia en un solo acto: no son dos modelos sino la misma transición sin
     * acumulación previa, y es lo que necesita un cliente automático.
     */
    confirmWorkingCopy: async (
      _: any,
      {
        revisionId,
        input,
      }: {
        revisionId: number
        input?: { comment?: string; files?: FileInput[] }
      },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CREATE],
        context,
      })
      logger.info("confirmWorkingCopy", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: revisionId,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      input?.files?.forEach(assertChecksum)

      try {
        return await context.orm.$transaction(async (tx) => {
          const { revision, copia } = await openCopyOf(tx, {
            revisionId,
            userId,
            context,
          })

          if (
            revision.status !== RevisionStatus.DRAFT &&
            revision.status !== RevisionStatus.IN_REVIEW
          ) {
            throw new GraphQLError(
              "Solo se producen versiones mientras la revisión está en curso.",
              { extensions: { code: "BAD_REQUEST" } },
            )
          }

          // El atajo: sin copia abierta, el conjunto completo llega en el input.
          if (!copia && !input?.files?.length) {
            throw new GraphQLError(
              "La revisión no tiene ninguna copia de trabajo abierta, y no se informó el conjunto completo.",
              { extensions: { code: "BAD_REQUEST" } },
            )
          }

          const conjunto: CopyFile[] = input?.files?.length
            ? input.files
            : (copia!.files as CopyFile[])

          const falta = incompleteReason(conjunto)
          if (falta) {
            throw new GraphQLError(INCOMPLETE_MESSAGE[falta], {
              extensions: { code: "BAD_USER_INPUT" },
            })
          }

          const vigente = await tx.documentVersion.findFirst({
            where: { revisionId },
            include: { files: true },
            orderBy: { versionNumber: "desc" },
          })

          // Confirmar exige al menos un cambio: la versión solo existe con
          // contenido nuevo, y el principio se hace cumplir solo.
          if (
            vigente &&
            !hasChanges(vigente.files as CopyFile[], conjunto)
          ) {
            throw new GraphQLError(
              "No hay nada que confirmar: el conjunto es el mismo de la versión vigente.",
              { extensions: { code: "BAD_REQUEST" } },
            )
          }

          const version = await tx.documentVersion.create({
            data: {
              revisionId,
              versionNumber: (vigente?.versionNumber ?? 0) + 1,
              comment: input?.comment,
              createdById: userId,
              files: {
                create: conjunto.map((f) => ({
                  role: f.role,
                  fileKey: f.fileKey,
                  fileName: f.fileName,
                  fileSize: f.fileSize,
                  mimeType: f.mimeType,
                  checksum: f.checksum,
                })),
              },
            },
            include: { files: { orderBy: { fileKey: "asc" } } },
          })

          if (copia) {
            await tx.docWorkingCopy.update({
              where: { id: copia.id },
              data: {
                confirmedAt: new Date(),
                confirmedById: userId,
                versionId: version.id,
              },
            })
          }

          await emitAuditEvent(tx, {
            action: AuditAction.ConfirmWorkingCopy,
            objectId: revisionId,
            actorId: userId,
            meta: {
              workingCopyId: copia?.id ?? null,
              versionId: version.id,
              versionNumber: version.versionNumber,
              archivos: version.files.length,
            },
          })
          await emitWorkflowEvent(tx, {
            name: WorkflowEvent.VersionRegistered,
            objectId: version.id,
            fromState: null,
            toState: String(version.versionNumber),
            actorId: userId,
          })

          return version
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "CONFIRM_WORKING_COPY",
          messages: {
            notFound: "La revisión no existe.",
            default: "Error al confirmar la copia de trabajo.",
          },
        })
      }
    },

    /**
     * Descarta la copia sin producir versión (B12).
     *
     * Palabra propia del nivel: el circuito se cancela, la revisión se abandona,
     * el documento queda obsoleto y la copia se **descarta**.
     */
    discardWorkingCopy: async (
      _: any,
      { revisionId, reason }: { revisionId: number; reason: string },
      context: ResolverContext,
    ) => {
      const userId = await userAuthorization({
        requiredPermissions: [PERMISSIONS.DOCUMENTS_DOCUMENT_CREATE],
        context,
      })
      logger.info("discardWorkingCopy", { userId })

      await assertObjectAccess({
        userId,
        objectType: DocObjectType.DOCUMENT_REVISION,
        objectId: revisionId,
        context,
        notFoundMessage: "Revisión no encontrada",
      })

      if (!reason?.trim()) {
        throw new GraphQLError("Descartar la copia de trabajo exige motivo.", {
          extensions: { code: "BAD_USER_INPUT" },
        })
      }

      try {
        return await context.orm.$transaction(async (tx) => {
          const { copia } = await openCopyOf(tx, { revisionId, userId, context })
          const abierta = requireOpenCopy(copia)

          const descartada = await tx.docWorkingCopy.update({
            where: { id: abierta.id },
            data: {
              discardedAt: new Date(),
              discardedById: userId,
              discardReason: reason.trim(),
            },
            include: copyIncludes,
          })

          await emitAuditEvent(tx, {
            action: AuditAction.DiscardWorkingCopy,
            objectId: revisionId,
            actorId: userId,
            meta: {
              workingCopyId: abierta.id,
              reason: reason.trim(),
              archivos: abierta.files.length,
            },
          })

          return descartada
        })
      } catch (error) {
        return handleError({
          error,
          userId,
          context,
          logName: "DISCARD_WORKING_COPY",
          messages: {
            notFound: "La revisión no existe.",
            default: "Error al descartar la copia de trabajo.",
          },
        })
      }
    },
  },
}
