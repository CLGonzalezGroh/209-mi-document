import "dotenv/config"
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Base descartable que `prisma migrate diff` y `migrate dev` usan para
    // reconstruir el estado de las migraciones. Solo entorno de desarrollo.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
