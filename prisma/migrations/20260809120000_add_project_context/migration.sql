-- CreateEnum
CREATE TYPE "DocumentRole" AS ENUM ('ISSUER', 'RECEIVER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "DocProjectSide" AS ENUM ('HOST', 'COUNTERPARTY');

-- DropIndex
DROP INDEX "documents_code_module_entityType_entityId_key";

-- DropIndex
DROP INDEX "documents_module_entityType_entityId_idx";

-- AlterTable
ALTER TABLE "doc_audit_events" ADD COLUMN     "module" "ModuleType",
ADD COLUMN     "projectId" INTEGER;

-- AlterTable
ALTER TABLE "doc_workflow_events" ADD COLUMN     "module" "ModuleType",
ADD COLUMN     "projectId" INTEGER;

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "entityId",
DROP COLUMN "entityType",
ADD COLUMN     "projectId" INTEGER;

-- CreateTable
CREATE TABLE "doc_project_settings" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "projectId" INTEGER NOT NULL,
    "documentRole" "DocumentRole" NOT NULL,
    "counterpartyName" TEXT,

    CONSTRAINT "doc_project_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_project_members" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "isSys" BOOLEAN NOT NULL DEFAULT false,
    "projectId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "side" "DocProjectSide" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedById" INTEGER,

    CONSTRAINT "doc_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doc_project_settings_projectId_key" ON "doc_project_settings"("projectId");

-- CreateIndex
CREATE INDEX "doc_project_members_projectId_idx" ON "doc_project_members"("projectId");

-- CreateIndex
CREATE INDEX "doc_project_members_userId_idx" ON "doc_project_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "doc_project_members_projectId_userId_key" ON "doc_project_members"("projectId", "userId");

-- CreateIndex
CREATE INDEX "doc_audit_events_projectId_createdAt_idx" ON "doc_audit_events"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "doc_audit_events_module_createdAt_idx" ON "doc_audit_events"("module", "createdAt");

-- CreateIndex
CREATE INDEX "doc_workflow_events_projectId_createdAt_idx" ON "doc_workflow_events"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "doc_workflow_events_module_createdAt_idx" ON "doc_workflow_events"("module", "createdAt");

-- CreateIndex
CREATE INDEX "documents_projectId_idx" ON "documents"("projectId");

-- CreateIndex
CREATE INDEX "documents_module_idx" ON "documents"("module");


-- Unicidad del código de documento por ÍNDICES ÚNICOS PARCIALES (BLOQUE 02, B2).
-- Prisma no los expresa, por eso se declaran acá. Reemplazan a
-- documents_code_module_entityType_entityId_key, cuya tupla con columnas
-- anulables no impedía duplicados (H-19).

-- En circulación: el código es único dentro del proyecto.
CREATE UNIQUE INDEX "documents_code_projectId_key"
    ON "documents"("code", "projectId")
    WHERE "projectId" IS NOT NULL;

-- Publicados (sin proyecto): el código es único dentro del módulo.
CREATE UNIQUE INDEX "documents_code_module_key"
    ON "documents"("code", "module")
    WHERE "projectId" IS NULL;
