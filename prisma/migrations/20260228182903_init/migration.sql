-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('QUALITY', 'PROJECTS', 'TAGS', 'OPERATIONS', 'MANAGEMENT', 'COMERCIAL');

-- CreateEnum
CREATE TYPE "RevisionScheme" AS ENUM ('ALPHABETICAL', 'NUMERIC');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('REVIEW', 'APPROVE', 'ACKNOWLEDGE');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TransmittalStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'RESPONDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PurposeCode" AS ENUM ('FOR_APPROVAL', 'FOR_INFORMATION', 'FOR_CONSTRUCTION', 'FOR_REVIEW', 'AS_BUILT');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('APPROVED', 'APPROVED_WITH_COMMENTS', 'REJECTED', 'REVIEWED_NO_EXCEPTION');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "DigitalDisposition" AS ENUM ('PENDING', 'ACCEPTED', 'UPLOADED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "PhysicalDisposition" AS ENUM ('PENDING', 'DESTROY', 'DESTROYED', 'ARCHIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "document_classes" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "terminatedAt" TIMESTAMP(3),
    "isSys" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" "ModuleType",
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "terminatedAt" TIMESTAMP(3),
    "isSys" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" "ModuleType",
    "classId" INTEGER,
    "description" TEXT,
    "requiresWorkflow" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "terminatedAt" TIMESTAMP(3),
    "isSys" BOOLEAN NOT NULL DEFAULT false,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "module" "ModuleType" NOT NULL,
    "entityType" TEXT,
    "entityId" INTEGER,
    "documentTypeId" INTEGER NOT NULL,
    "documentClassId" INTEGER,
    "revisionScheme" "RevisionScheme" NOT NULL DEFAULT 'ALPHABETICAL',

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_revisions" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "documentId" INTEGER NOT NULL,
    "revisionCode" TEXT NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "document_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "revisionId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT,
    "comment" TEXT,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_workflows" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisionId" INTEGER NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedById" INTEGER NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "review_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_steps" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowId" INTEGER NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepType" "StepType" NOT NULL,
    "assignedToId" INTEGER NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "completedAt" TIMESTAMP(3),
    "signatureHash" TEXT,

    CONSTRAINT "review_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transmittals" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "code" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "status" "TransmittalStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedTo" TEXT NOT NULL,
    "issuedById" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "responseAt" TIMESTAMP(3),
    "responseComments" TEXT,

    CONSTRAINT "transmittals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transmittal_items" (
    "id" SERIAL NOT NULL,
    "transmittalId" INTEGER NOT NULL,
    "documentRevisionId" INTEGER NOT NULL,
    "purposeCode" "PurposeCode" NOT NULL,
    "clientStatus" "ClientStatus",
    "clientComments" TEXT,

    CONSTRAINT "transmittal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "module" "ModuleType" NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "fileKey" VARCHAR(500) NOT NULL,
    "fileName" VARCHAR(300) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scanned_files" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "projectId" INTEGER NOT NULL,
    "documentTypeId" INTEGER,
    "documentClassId" INTEGER,
    "areaId" INTEGER,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "originalReference" VARCHAR(255),
    "physicalLocation" VARCHAR(500),
    "fileKey" VARCHAR(500) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "digitalDisposition" "DigitalDisposition" NOT NULL DEFAULT 'PENDING',
    "physicalDisposition" "PhysicalDisposition" NOT NULL DEFAULT 'PENDING',
    "externalReference" VARCHAR(500),
    "discardReason" TEXT,
    "classificationNotes" TEXT,
    "classifiedById" INTEGER,
    "classifiedAt" TIMESTAMP(3),
    "physicalConfirmedById" INTEGER,
    "physicalConfirmedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),

    CONSTRAINT "scanned_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "terminatedAt" TIMESTAMP(3),
    "isSys" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sys_logs" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "level" "LogLevel" NOT NULL,
    "name" VARCHAR(200),
    "message" VARCHAR(2048) NOT NULL,
    "meta" TEXT,

    CONSTRAINT "document_sys_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sys_logs_archive" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "level" "LogLevel" NOT NULL,
    "name" VARCHAR(200),
    "message" VARCHAR(2048) NOT NULL,
    "meta" TEXT,

    CONSTRAINT "document_sys_logs_archive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_classes_name_module_key" ON "document_classes"("name", "module");

-- CreateIndex
CREATE UNIQUE INDEX "document_classes_code_module_key" ON "document_classes"("code", "module");

-- CreateIndex
CREATE INDEX "document_types_classId_idx" ON "document_types"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_name_classId_module_key" ON "document_types"("name", "classId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_code_classId_module_key" ON "document_types"("code", "classId", "module");

-- CreateIndex
CREATE INDEX "documents_module_entityType_entityId_idx" ON "documents"("module", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "documents_documentClassId_idx" ON "documents"("documentClassId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_code_module_entityType_entityId_key" ON "documents"("code", "module", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "document_revisions_documentId_revisionCode_key" ON "document_revisions"("documentId", "revisionCode");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_revisionId_versionNumber_key" ON "document_versions"("revisionId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "review_workflows_revisionId_key" ON "review_workflows"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "review_steps_workflowId_stepOrder_key" ON "review_steps"("workflowId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "transmittals_code_key" ON "transmittals"("code");

-- CreateIndex
CREATE INDEX "transmittals_projectId_idx" ON "transmittals"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "transmittal_items_transmittalId_documentRevisionId_key" ON "transmittal_items"("transmittalId", "documentRevisionId");

-- CreateIndex
CREATE INDEX "attachments_module_entityType_entityId_idx" ON "attachments"("module", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "scanned_files_projectId_idx" ON "scanned_files"("projectId");

-- CreateIndex
CREATE INDEX "scanned_files_documentClassId_idx" ON "scanned_files"("documentClassId");

-- CreateIndex
CREATE INDEX "scanned_files_areaId_idx" ON "scanned_files"("areaId");

-- CreateIndex
CREATE INDEX "scanned_files_digitalDisposition_idx" ON "scanned_files"("digitalDisposition");

-- CreateIndex
CREATE INDEX "scanned_files_physicalDisposition_idx" ON "scanned_files"("physicalDisposition");

-- CreateIndex
CREATE INDEX "scanned_files_projectId_digitalDisposition_idx" ON "scanned_files"("projectId", "digitalDisposition");

-- CreateIndex
CREATE INDEX "areas_projectId_idx" ON "areas"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "areas_code_projectId_key" ON "areas"("code", "projectId");

-- CreateIndex
CREATE INDEX "document_sys_logs_userId_level_createdAt_idx" ON "document_sys_logs"("userId", "level", "createdAt");

-- CreateIndex
CREATE INDEX "document_sys_logs_archive_userId_level_createdAt_idx" ON "document_sys_logs_archive"("userId", "level", "createdAt");

-- AddForeignKey
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_classId_fkey" FOREIGN KEY ("classId") REFERENCES "document_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_documentClassId_fkey" FOREIGN KEY ("documentClassId") REFERENCES "document_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "document_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_workflows" ADD CONSTRAINT "review_workflows_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "document_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_steps" ADD CONSTRAINT "review_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "review_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transmittal_items" ADD CONSTRAINT "transmittal_items_transmittalId_fkey" FOREIGN KEY ("transmittalId") REFERENCES "transmittals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transmittal_items" ADD CONSTRAINT "transmittal_items_documentRevisionId_fkey" FOREIGN KEY ("documentRevisionId") REFERENCES "document_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scanned_files" ADD CONSTRAINT "scanned_files_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scanned_files" ADD CONSTRAINT "scanned_files_documentClassId_fkey" FOREIGN KEY ("documentClassId") REFERENCES "document_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scanned_files" ADD CONSTRAINT "scanned_files_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
