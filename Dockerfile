# ============================================
# Dockerfile para APIs GraphQL (Apollo Subgraph + Prisma)
# Usado por: mi-admin, mi-quality, mi-project,
#            mi-management, mi-comercial, mi-document
# ============================================

# -- Stage 1: Build --
FROM node:20-alpine AS builder

WORKDIR /app

# Configurar acceso a GitHub Packages para @CLGonzalezGroh/mi-common
ARG GITHUB_TOKEN
RUN echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > .npmrc && \
    echo "@CLGonzalezGroh:registry=https://npm.pkg.github.com" >> .npmrc

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código fuente y schema de Prisma
COPY prisma/ ./prisma/
COPY tsconfig.json ./
COPY src/ ./src/
COPY schema.graphql ./

# Generar Prisma Client y compilar TypeScript
RUN npx prisma generate
RUN npm run build

# Limpiar token de .npmrc
RUN rm -f .npmrc

# -- Stage 2: Production --
FROM node:20-alpine

WORKDIR /app

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S api -u 1001

# Configurar acceso a GitHub Packages (necesario para npm ci --omit=dev)
ARG GITHUB_TOKEN
RUN echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" > .npmrc && \
    echo "@CLGonzalezGroh:registry=https://npm.pkg.github.com" >> .npmrc

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Limpiar token
RUN rm -f .npmrc

# Copiar build y archivos necesarios
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated

USER api

# Puerto por defecto (se sobreescribe con variable de entorno PORT)
EXPOSE 4209

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-4209}/.well-known/apollo/server-health || exit 1

# Ejecutar migraciones y arrancar
CMD ["sh", "-c", "npx prisma migrate deploy && node ./dist/src/index.js"]
