import { GraphQLError } from "graphql"
import { LogLevel } from "../generated/prisma/enums.js"
import { ResolverContext } from "../types.js"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client.js"

type HandleErrorParams = {
  error: unknown
  userId: number
  context: ResolverContext
  logName: string
  messages: {
    notFound?: string
    uniqueConstraint?: string
    foreignKeyConstraint?: string
    default?: string
  }
}

export const handleError = async ({
  error,
  userId,
  context,
  logName,
  messages,
}: HandleErrorParams): Promise<never> => {
  // Registrar el error sin modificaciones
  const data = {
    name: logName,
    message: error instanceof Error ? error.message : "Unknown error",
    meta: JSON.stringify(error, null, 2),
    userId,
    level: LogLevel.ERROR,
  }
  await context.orm.documentSysLog.create({ data })

  // Lanzar un nuevo error con un mensaje personalizado
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      throw new GraphQLError(messages.notFound || "El recurso no existe.", {
        extensions: { code: "NOT_FOUND" },
      })
    }
    if (error.code === "P2002") {
      throw new GraphQLError(
        messages.uniqueConstraint || "Ya existe un recurso con ese valor.",
        {
          extensions: { code: "CONFLICT" },
        },
      )
    }
    if (error.code === "P2003") {
      throw new GraphQLError(
        messages.foreignKeyConstraint ||
          "No se puede eliminar el recurso porque tiene información asociada.",
        {
          extensions: { code: "CONFLICT" },
        },
      )
    }
  }

  // Re-lanzar otros errores tal como están
  if (error instanceof GraphQLError) {
    throw error
  }

  // Mensaje genérico para otros errores
  throw new GraphQLError(messages.default || "Ocurrió un error interno.", {
    extensions: { code: "INTERNAL_SERVER_ERROR" },
  })
}
