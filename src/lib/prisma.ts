import "dotenv/config"
import pg from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client.js"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida en las variables de entorno")
}

const pool = new pg.Pool({ connectionString, max: 3 })
const adapter = new PrismaPg(pool)

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
