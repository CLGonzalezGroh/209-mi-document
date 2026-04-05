import jwt from "jsonwebtoken"
import { GraphQLError } from "graphql"
import { ResolverContext } from "../types.js"
import { ApiToken } from "@CLGonzalezGroh/mi-common"
import { createLogger } from "@CLGonzalezGroh/mi-common/logger"

const logger = createLogger("userAuthorization")

type UserAuthorizationProps = {
  requiredPermissions: string[]
  context: ResolverContext
}

/**
 * Función para validar la autorización de un usuario basada en JWT y roles.
 *
 * @param requiredPermissions - Permisos requeridos para acceder al recurso
 * @param context - Contexto del resolver de GraphQL que contiene el token
 * @returns ID del usuario autenticado si tiene permisos
 * @throws GraphQLError si no está autenticado o no tiene permisos
 */

export const userAuthorization = async ({
  requiredPermissions,
  context,
}: UserAuthorizationProps): Promise<number> => {
  // 1. Validar variables de entorno
  if (!process.env.AUTH_JWT_SECRET) {
    logger.error("AUTH_JWT_SECRET no está configurado")
    throw new GraphQLError("Error de configuración del servidor", {
      extensions: { code: "INTERNAL_SERVER_ERROR" },
    })
  }

  if (!process.env.ADMIN_API_URL) {
    logger.error("ADMIN_API_URL no está configurado")
    throw new GraphQLError("Error de configuración del servidor", {
      extensions: { code: "INTERNAL_SERVER_ERROR" },
    })
  }

  // 2. Extraer y validar token
  let token = ""
  const bearerToken = context.token

  if (!bearerToken) {
    throw new GraphQLError("Se requiere un token JWT", {
      extensions: { code: "UNAUTHENTICATED" },
    })
  }

  if (bearerToken.startsWith("Bearer ")) {
    token = bearerToken.split(" ")[1]
  } else {
    throw new GraphQLError("El formato del token es inválido", {
      extensions: { code: "UNAUTHENTICATED" },
    })
  }

  try {
    // 3. Verificar y decodificar JWT localmente (para obtener roles y userId)
    const decodeToken = jwt.verify(
      token,
      process.env.AUTH_JWT_SECRET as string,
    ) as ApiToken

    if (!decodeToken.id) {
      logger.auth("Token válido pero sin ID de usuario", { tokenError: "missing id" })
      throw new GraphQLError("Se debe iniciar sesión", {
        extensions: { code: "UNAUTHENTICATED" },
      })
    }

    // 4. Consultar a la API admin para verificar permisos
    // La API admin validará el token nuevamente por seguridad
    const response = await fetch(`${process.env.ADMIN_API_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pasar el token para que admin API lo valide
        Authorization: bearerToken,
      },
      body: JSON.stringify({
        query: `
          query HasPermissions($roleIds: [Int!]!, $permissionCodes: [String!]!) {
            hasPermissions(roleIds: $roleIds, permissionCodes: $permissionCodes)
          }
        `,
        variables: {
          roleIds: decodeToken.roles,
          permissionCodes: requiredPermissions,
        },
      }),
    })

    if (!response.ok) {
      logger.error(`Error al consultar admin API: ${response.status}`)
      throw new GraphQLError("Error al verificar permisos", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      })
    }

    const json = (await response.json()) as {
      data?: { hasPermissions?: boolean }
      errors?: Array<{ message?: string; extensions?: { code?: string } }>
    }
    const { data, errors } = json

    // Si admin API retorna errores (ej: token inválido/expirado), propagarlos
    if (errors && errors.length > 0) {
      const firstError = errors[0]
      const errorCode = firstError.extensions?.code || "INTERNAL_SERVER_ERROR"
      const errorMessage = firstError.message || "Error al verificar permisos"

      logger.error(`Error en respuesta de admin API: ${errorMessage}`)
      throw new GraphQLError(errorMessage, {
        extensions: { code: errorCode },
      })
    }

    // 5. Verificar si tiene permisos
    const hasPermission = data?.hasPermissions

    if (!hasPermission) {
      logger.auth("Acceso denegado", {
        userId: decodeToken.id,
        roles: decodeToken.roles,
        requiredPermissions,
      })
      throw new GraphQLError("No estás autorizado", {
        extensions: {
          code: "FORBIDDEN",
        },
      })
    }

    logger.debug("Auth OK", { userId: decodeToken.id, permissions: requiredPermissions })

    return decodeToken.id
  } catch (error) {
    // Manejar errores específicos de JWT
    if (error instanceof jwt.JsonWebTokenError) {
      logger.auth("Token JWT inválido", { tokenError: error.message })
      throw new GraphQLError("Token inválido. Reinicie sesión", {
        extensions: {
          code: "UNAUTHENTICATED",
        },
      })
    }

    if (error instanceof jwt.TokenExpiredError) {
      logger.auth("Token JWT expirado", { tokenError: error.message })
      throw new GraphQLError("Su sesión ha expirado. Reinicie sesión", {
        extensions: {
          code: "UNAUTHENTICATED",
        },
      })
    }

    // Si ya es un GraphQLError (de nuestras validaciones), lo re-lanzamos
    if (error instanceof GraphQLError) {
      throw error
    }

    // Error genérico no esperado
    logger.error("Error inesperado en autorización", error)
    throw new GraphQLError("Error interno del servidor", {
      extensions: {
        code: "INTERNAL_SERVER_ERROR",
      },
    })
  }
}
