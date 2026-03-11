import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client.js"

// Suprimir DeprecationWarning de pg v8 causado internamente por @prisma/adapter-pg
// El adapter WASM envía queries concurrentes en un solo PoolClient durante transacciones implícitas.
// pg v8 los encola correctamente, pero avisa que en v9 se eliminará este comportamiento.
const originalEmit = process.emit.bind(process)
process.emit = function (event: string, ...args: unknown[]) {
  if (
    event === "warning" &&
    (args[0] as { name?: string; message?: string })?.name ===
      "DeprecationWarning" &&
    (args[0] as { message?: string })?.message?.includes(
      "Calling client.query()",
    )
  ) {
    return false
  }
  return originalEmit(event, ...args)
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida en las variables de entorno")
}

const adapter = new PrismaPg({ connectionString })

// Singleton pattern para evitar múltiples instancias
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
