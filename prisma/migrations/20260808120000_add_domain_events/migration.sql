-- CreateEnum
CREATE TYPE "DocObjectType" AS ENUM ('DOCUMENT', 'DOCUMENT_REVISION', 'DOCUMENT_VERSION', 'REVIEW_WORKFLOW', 'REVIEW_STEP', 'TRANSMITTAL', 'DOCUMENT_CLASS', 'DOCUMENT_TYPE');

-- CreateTable
CREATE TABLE "doc_workflow_events" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    "objectType" "DocObjectType" NOT NULL,
    "objectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT,

    CONSTRAINT "doc_workflow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_audit_events" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    "objectType" "DocObjectType" NOT NULL,
    "objectId" INTEGER,
    "action" TEXT NOT NULL,
    "meta" JSONB,

    CONSTRAINT "doc_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doc_workflow_events_objectType_objectId_createdAt_idx" ON "doc_workflow_events"("objectType", "objectId", "createdAt");

-- CreateIndex
CREATE INDEX "doc_audit_events_objectType_objectId_createdAt_idx" ON "doc_audit_events"("objectType", "objectId", "createdAt");

-- CreateIndex
CREATE INDEX "doc_audit_events_createdById_createdAt_idx" ON "doc_audit_events"("createdById", "createdAt");
