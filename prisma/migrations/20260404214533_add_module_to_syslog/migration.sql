-- CreateEnum
CREATE TYPE "SysLogModule" AS ENUM ('DOCUMENT', 'QUALITY', 'PROJECTS', 'TAGS', 'OPERATIONS', 'MANAGEMENT', 'COMERCIAL');

-- DropIndex
DROP INDEX "document_sys_logs_userId_level_createdAt_idx";

-- DropIndex
DROP INDEX "document_sys_logs_archive_userId_level_createdAt_idx";

-- AlterTable
ALTER TABLE "document_sys_logs" ADD COLUMN     "module" "SysLogModule";

-- AlterTable
ALTER TABLE "document_sys_logs_archive" ADD COLUMN     "module" "SysLogModule";

-- CreateIndex
CREATE INDEX "document_sys_logs_module_userId_level_createdAt_idx" ON "document_sys_logs"("module", "userId", "level", "createdAt");

-- CreateIndex
CREATE INDEX "document_sys_logs_archive_module_userId_level_createdAt_idx" ON "document_sys_logs_archive"("module", "userId", "level", "createdAt");
