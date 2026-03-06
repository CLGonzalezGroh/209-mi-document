-- AlterTable: Add code column to scanned_files
ALTER TABLE "scanned_files" ADD COLUMN "code" VARCHAR(50) NOT NULL;

-- CreateIndex: Unique constraint on code per project
CREATE UNIQUE INDEX "scanned_files_code_projectId_key" ON "scanned_files"("code", "projectId");
