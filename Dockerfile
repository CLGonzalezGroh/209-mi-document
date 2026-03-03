# ============================================
# Dockerfile para APIs GraphQL (Apollo Subgraph + Prisma)
# Usado por: mi-admin, mi-quality, mi-project,
#            mi-management, mi-comercial, mi-document
# ============================================

# -- Stage 1: Build --
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias (el token se monta como secret, no queda en la imagen)
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/app/.npmrc npm ci

# Copiar código fuente, schema de Prisma y config
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY schema.graphql ./

# Dummy URL para prisma generate/build (no conecta, solo genera el client)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Generar Prisma Client y compilar TypeScript
RUN npx prisma generate
RUN npm run build

# -- Stage 2: Production --
FROM node:22-alpine

WORKDIR /app

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S api -u 1001

# Instalar solo dependencias de producción
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/app/.npmrc npm ci --omit=dev && npm cache clean --force

# Copiar build y archivos necesarios
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/schema.graphql ./
COPY --from=builder /app/src/generated ./src/generated

USER api

# Puerto por defecto (se sobreescribe con variable de entorno PORT)
EXPOSE 4209

# Healthcheck definido en docker-compose (evita zombies al ejecutar dentro del contenedor)

# Ejecutar migraciones y arrancar
CMD ["sh", "-c", "npx prisma migrate deploy && node ./dist/src/index.js"]
