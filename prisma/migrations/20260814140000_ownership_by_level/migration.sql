-- BLOQUE 03B — Qué le pertenece a cada nivel.
--
-- Tres datos cambian de nivel o de cardinalidad:
--   B1/B2  la metadata de identificación pasa a la revisión; el documento
--          conserva una COPIA de la revisión en curso, nombrada `current*`;
--   B5     el documento incorpora su obsolescencia y el acto de reemplazo N:M;
--   B6/B12 la versión pasa a ser un CONJUNTO de archivos, producido al
--          confirmar una copia de trabajo.
--
-- Sin uso productivo: los cambios incompatibles no rompen consumidores.

-- ---------------------------------------------------------------------------
-- 1. Enumeraciones nuevas
-- ---------------------------------------------------------------------------

CREATE TYPE "DocFileRole" AS ENUM ('DELIVERABLE', 'SOURCE', 'SUPPORT');
CREATE TYPE "DocReplacementRole" AS ENUM ('REPLACED', 'REPLACING');

-- ---------------------------------------------------------------------------
-- 2. Metadata de identificación en la revisión (B1)
-- ---------------------------------------------------------------------------

-- Se agregan anulables, se rellenan desde el documento y recién entonces se
-- vuelven obligatorias las que lo son.
ALTER TABLE "document_revisions"
  ADD COLUMN "title"           TEXT,
  ADD COLUMN "documentTypeId"  INTEGER,
  ADD COLUMN "documentClassId" INTEGER;

-- Cada revisión hereda la metadata que hoy vive en su documento. Para la
-- revisión en curso el valor es exacto; para las aprobadas es la MEJOR
-- APROXIMACIÓN DISPONIBLE, porque no existe historia de la que reconstruir lo
-- que cada una decía cuando se aprobó. Limitación conocida de la migración.
UPDATE "document_revisions" r
   SET "title"           = d."title",
       "documentTypeId"  = d."documentTypeId",
       "documentClassId" = d."documentClassId"
  FROM "documents" d
 WHERE d."id" = r."documentId";

ALTER TABLE "document_revisions"
  ALTER COLUMN "title"          SET NOT NULL,
  ALTER COLUMN "documentTypeId" SET NOT NULL;

ALTER TABLE "document_revisions"
  ADD CONSTRAINT "document_revisions_documentTypeId_fkey"
    FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "document_revisions_documentClassId_fkey"
    FOREIGN KEY ("documentClassId") REFERENCES "document_classes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. La copia del documento se nombra por su lectura (B2)
-- ---------------------------------------------------------------------------

-- El prefijo `current` dice cuál de las dos lecturas sirve el campo: la de la
-- revisión EN CURSO. La VIGENTE se lee de la revisión aprobada, que lleva la
-- suya. El renombre alcanza al modelo y no solo al contrato, porque un `title`
-- en la tabla y un `currentTitle` en la API obligarían a recordar la traducción
-- justo donde la confusión es cara.
ALTER TABLE "documents" RENAME COLUMN "title"           TO "currentTitle";
ALTER TABLE "documents" RENAME COLUMN "documentTypeId"  TO "currentDocumentTypeId";
ALTER TABLE "documents" RENAME COLUMN "documentClassId" TO "currentDocumentClassId";

ALTER INDEX "documents_documentClassId_idx" RENAME TO "documents_currentDocumentClassId_idx";

-- ---------------------------------------------------------------------------
-- 4. Obsolescencia del documento (B5)
-- ---------------------------------------------------------------------------

-- Dos causas llegan al mismo estado —reemplazo y fuera de alcance—, y por eso el
-- hecho se registra en lugar de derivarse. Lo que sí se deriva es la causa.
ALTER TABLE "documents"
  ADD COLUMN "obsoletedAt"    TIMESTAMP(3),
  ADD COLUMN "obsoletedById"  INTEGER,
  ADD COLUMN "obsoleteReason" TEXT;

-- ---------------------------------------------------------------------------
-- 5. Acto de reemplazo entre documentos, N:M (B5)
-- ---------------------------------------------------------------------------

CREATE TABLE "doc_replacements" (
    "id"          SERIAL       NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER      NOT NULL,
    "reason"      TEXT         NOT NULL,

    CONSTRAINT "doc_replacements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_replacement_items" (
    "id"            SERIAL               NOT NULL,
    "createdAt"     TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacementId" INTEGER              NOT NULL,
    "documentId"    INTEGER              NOT NULL,
    "role"          "DocReplacementRole" NOT NULL,

    CONSTRAINT "doc_replacement_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_replacement_items_replacementId_documentId_role_key"
    ON "doc_replacement_items"("replacementId", "documentId", "role");
CREATE INDEX "doc_replacement_items_documentId_idx"
    ON "doc_replacement_items"("documentId");

ALTER TABLE "doc_replacement_items"
  ADD CONSTRAINT "doc_replacement_items_replacementId_fkey"
    FOREIGN KEY ("replacementId") REFERENCES "doc_replacements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "doc_replacement_items_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. La versión pasa a ser un conjunto de archivos (B6, B7)
-- ---------------------------------------------------------------------------

CREATE TABLE "doc_version_files" (
    "id"        SERIAL        NOT NULL,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionId" INTEGER       NOT NULL,
    "role"      "DocFileRole" NOT NULL,
    "fileKey"   TEXT          NOT NULL,
    "fileName"  TEXT          NOT NULL,
    "fileSize"  INTEGER       NOT NULL,
    "mimeType"  TEXT          NOT NULL,
    "checksum"  TEXT          NOT NULL,

    CONSTRAINT "doc_version_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_version_files_versionId_fileKey_key"
    ON "doc_version_files"("versionId", "fileKey");
CREATE INDEX "doc_version_files_versionId_idx"
    ON "doc_version_files"("versionId");

ALTER TABLE "doc_version_files"
  ADD CONSTRAINT "doc_version_files_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "document_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Cada versión existente produce un archivo con rol DELIVERABLE: hasta acá la
-- versión ERA un archivo, y ese archivo era el entregable.
INSERT INTO "doc_version_files" ("versionId", "role", "fileKey", "fileName", "fileSize", "mimeType", "checksum")
SELECT "id", 'DELIVERABLE', "fileKey", "fileName", "fileSize", "mimeType", "checksum"
  FROM "document_versions";

ALTER TABLE "document_versions"
  DROP COLUMN "fileKey",
  DROP COLUMN "fileName",
  DROP COLUMN "fileSize",
  DROP COLUMN "mimeType",
  DROP COLUMN "checksum";

-- ---------------------------------------------------------------------------
-- 7. Copia de trabajo (B12)
-- ---------------------------------------------------------------------------

CREATE TABLE "doc_working_copies" (
    "id"            SERIAL       NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById"   INTEGER      NOT NULL,
    "revisionId"    INTEGER      NOT NULL,
    "confirmedAt"   TIMESTAMP(3),
    "confirmedById" INTEGER,
    "versionId"     INTEGER,
    "discardedAt"   TIMESTAMP(3),
    "discardedById" INTEGER,
    "discardReason" TEXT,

    CONSTRAINT "doc_working_copies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_working_copy_files" (
    "id"            SERIAL        NOT NULL,
    "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workingCopyId" INTEGER       NOT NULL,
    "role"          "DocFileRole" NOT NULL,
    "fileKey"       TEXT          NOT NULL,
    "fileName"      TEXT          NOT NULL,
    "fileSize"      INTEGER       NOT NULL,
    "mimeType"      TEXT          NOT NULL,
    "checksum"      TEXT          NOT NULL,

    CONSTRAINT "doc_working_copy_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_working_copies_versionId_key"
    ON "doc_working_copies"("versionId");
CREATE INDEX "doc_working_copies_revisionId_idx"
    ON "doc_working_copies"("revisionId");
CREATE UNIQUE INDEX "doc_working_copy_files_workingCopyId_fileKey_key"
    ON "doc_working_copy_files"("workingCopyId", "fileKey");
CREATE INDEX "doc_working_copy_files_workingCopyId_idx"
    ON "doc_working_copy_files"("workingCopyId");

ALTER TABLE "doc_working_copies"
  ADD CONSTRAINT "doc_working_copies_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "document_revisions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "doc_working_copies_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "document_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "doc_working_copy_files"
  ADD CONSTRAINT "doc_working_copy_files_workingCopyId_fkey"
    FOREIGN KEY ("workingCopyId") REFERENCES "doc_working_copies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ÍNDICE ÚNICO PARCIAL, creado en SQL porque Prisma no lo expresa: a lo sumo una
-- copia de trabajo ABIERTA por revisión. Es el mismo invariante que el módulo ya
-- aplica a la revisión en curso y al circuito abierto, en un tercer nivel.
CREATE UNIQUE INDEX "doc_working_copies_open_key"
    ON "doc_working_copies"("revisionId")
    WHERE "confirmedAt" IS NULL AND "discardedAt" IS NULL;
