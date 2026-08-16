-- BLOQUE 04, fase 4 — La respuesta como objeto propio del ítem (B5, B6, B7).
--
-- Cierra H-30, H-33 y H-14, y retira `ClientStatus` en favor del catálogo de
-- calificaciones que la fase 1 incorporó.
--
-- La respuesta deja de ser dos columnas del ítem. El archivo marcado que devuelve
-- la contraparte NO es una versión: llega de afuera del circuito, sin paso
-- vigente que lo produzca ni firma que lo acredite, de modo que es evidencia de
-- una respuesta (B6).

-- ---------------------------------------------------------------------------
-- 1. La respuesta
-- ---------------------------------------------------------------------------

CREATE TABLE "doc_transmittal_responses" (
  "id"        SERIAL       NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3),

  -- Una respuesta por ítem: la contraparte califica una emisión UNA vez.
  "transmittalItemId" INTEGER NOT NULL,

  -- Único dato obligatorio de la respuesta.
  "qualificationId" INTEGER NOT NULL,

  "comments" TEXT,

  -- Quién respondió, como TEXTO: el cliente no es usuario del sistema (D-12).
  "respondedBy" TEXT,

  -- La fecha real, frente a `createdAt` que es la de registro (H-33).
  "respondedAt" TIMESTAMP(3),

  -- Quién la registró, ese sí como referencia a User.
  "registeredById" INTEGER NOT NULL,
  "updatedById"    INTEGER NOT NULL DEFAULT 1,

  -- El sobre en que viajó, si vino consolidada. Nulo documento a documento.
  "responseTransmittalId" INTEGER,

  CONSTRAINT "doc_transmittal_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_transmittal_responses_transmittalItemId_key"
    ON "doc_transmittal_responses"("transmittalItemId");

CREATE INDEX "doc_transmittal_responses_qualificationId_idx"
    ON "doc_transmittal_responses"("qualificationId");

CREATE INDEX "doc_transmittal_responses_responseTransmittalId_idx"
    ON "doc_transmittal_responses"("responseTransmittalId");

ALTER TABLE "doc_transmittal_responses"
  ADD CONSTRAINT "doc_transmittal_responses_transmittalItemId_fkey"
  FOREIGN KEY ("transmittalItemId") REFERENCES "transmittal_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "doc_transmittal_responses_qualificationId_fkey"
  FOREIGN KEY ("qualificationId") REFERENCES "doc_qualifications"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "doc_transmittal_responses_responseTransmittalId_fkey"
  FOREIGN KEY ("responseTransmittalId") REFERENCES "transmittals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Los archivos devueltos
-- ---------------------------------------------------------------------------

-- No son ninguno de los tres roles de D-25: no integran la entrega, son lo que
-- la contraparte dijo sobre la entrega. `checksum` opcional, porque nadie firma
-- la respuesta y no hay firma cuya verificabilidad dependa de él.
CREATE TABLE "doc_response_files" (
  "id"        SERIAL       NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  "responseId" INTEGER NOT NULL,

  "fileKey"  TEXT    NOT NULL,
  "fileName" TEXT    NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT    NOT NULL,
  "checksum" TEXT,

  CONSTRAINT "doc_response_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_response_files_responseId_fileKey_key"
    ON "doc_response_files"("responseId", "fileKey");

CREATE INDEX "doc_response_files_responseId_idx"
    ON "doc_response_files"("responseId");

ALTER TABLE "doc_response_files"
  ADD CONSTRAINT "doc_response_files_responseId_fkey"
  FOREIGN KEY ("responseId") REFERENCES "doc_transmittal_responses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Lo que la respuesta reemplaza
-- ---------------------------------------------------------------------------

-- Sin etapa de convivencia: no hay datos productivos, y convivir obligaría a
-- sostener dos vocabularios y a decidir cuál gana (D-22).
ALTER TABLE "transmittal_items"
  DROP COLUMN "clientStatus",
  DROP COLUMN "clientComments";

DROP TYPE "ClientStatus";

-- La respuesta consolidada dejó de ser dos campos del transmittal: el remito de
-- respuesta es un registro propio desde la fase 2, y lo que califica cada
-- documento vive en la respuesta de su ítem.
ALTER TABLE "transmittals"
  DROP COLUMN "responseAt",
  DROP COLUMN "responseComments";
