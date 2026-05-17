-- CreateEnum
CREATE TYPE "TaskDocumentRole" AS ENUM ('INPUT', 'OUTPUT', 'REFERENCE');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "projectTaskId" INTEGER;

-- CreateTable
CREATE TABLE "task_document_references" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "projectTaskId" INTEGER NOT NULL,
    "documentId" INTEGER NOT NULL,
    "role" "TaskDocumentRole" NOT NULL,

    CONSTRAINT "task_document_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_document_references_projectTaskId_idx" ON "task_document_references"("projectTaskId");

-- CreateIndex
CREATE INDEX "task_document_references_documentId_idx" ON "task_document_references"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "task_document_references_projectTaskId_documentId_role_key" ON "task_document_references"("projectTaskId", "documentId", "role");

-- CreateIndex
CREATE INDEX "documents_projectTaskId_idx" ON "documents"("projectTaskId");

-- AddForeignKey
ALTER TABLE "task_document_references" ADD CONSTRAINT "task_document_references_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
