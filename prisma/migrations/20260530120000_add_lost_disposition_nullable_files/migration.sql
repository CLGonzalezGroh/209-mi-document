-- AlterEnum
ALTER TYPE "DigitalDisposition" ADD VALUE 'LOST';

-- AlterTable
ALTER TABLE "scanned_files" ALTER COLUMN "fileKey" DROP NOT NULL,
ALTER COLUMN "fileName" DROP NOT NULL,
ALTER COLUMN "fileSize" DROP NOT NULL,
ALTER COLUMN "mimeType" DROP NOT NULL;
