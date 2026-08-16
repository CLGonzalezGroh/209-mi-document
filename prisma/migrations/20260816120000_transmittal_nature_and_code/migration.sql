-- BLOQUE 04, fase 2 — Naturaleza del transmittal y código por proyecto (B1, B2).
--
-- Cierra H-29 y H-16, y resuelve B11 de BLOQUE 02 en la dirección que aquel
-- bloque anticipó: hacia DocProjectSettings y no hacia el transmittal.
--
-- Sin uso productivo: ningún cliente emitió nunca un transmittal, de modo que
-- los cambios incompatibles no rompen consumidores.

-- ---------------------------------------------------------------------------
-- 1. La naturaleza (B1)
-- ---------------------------------------------------------------------------

-- La clasificación relevante no es la dirección sino el propósito (D-18). El
-- SENTIDO se deriva del rol del proyecto y de la naturaleza, y no se almacena.
CREATE TYPE "TransmittalNature" AS ENUM ('EMISSION', 'RESPONSE');

-- Se agrega con default para poblar lo existente —todo transmittal registrado
-- hasta hoy es una emisión, porque la respuesta no existía como objeto— y el
-- default se retira enseguida: la naturaleza debe informarse al crear.
ALTER TABLE "transmittals"
  ADD COLUMN "nature" "TransmittalNature" NOT NULL DEFAULT 'EMISSION';

ALTER TABLE "transmittals" ALTER COLUMN "nature" DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- 2. El vínculo entre la respuesta y la emisión que contesta (B1)
-- ---------------------------------------------------------------------------

ALTER TABLE "transmittals"
  ADD COLUMN "respondsToTransmittalId" INTEGER,
  ADD COLUMN "counterpartyReference"   TEXT;

ALTER TABLE "transmittals"
  ADD CONSTRAINT "transmittals_respondsToTransmittalId_fkey"
  FOREIGN KEY ("respondsToTransmittalId") REFERENCES "transmittals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "transmittals_respondsToTransmittalId_idx"
    ON "transmittals"("respondsToTransmittalId");

-- ---------------------------------------------------------------------------
-- 3. El destinatario deja de guardarse por registro (B1)
-- ---------------------------------------------------------------------------

-- El destinatario de una emisión es la contraparte del proyecto, que es única
-- (D-15) y ya vive en DocProjectSettings.counterpartyName desde BLOQUE 02.
-- Guardarla acá permitía que dos transmittals del mismo proyecto declararan
-- destinatarios distintos, que es lo que la unidad contractual considera
-- inválido.
ALTER TABLE "transmittals" DROP COLUMN "issuedTo";

-- ---------------------------------------------------------------------------
-- 4. El código pasa a ser único POR PROYECTO (B2)
-- ---------------------------------------------------------------------------

-- La unicidad global era la mitad de H-16: el transmittal pertenece a un
-- proyecto, que es la unidad contractual, con el mismo criterio con que BLOQUE
-- 02 resolvió el código del documento. La otra mitad —el cálculo fuera de la
-- transacción— la cierra el resolver, con este índice como árbitro.
DROP INDEX "transmittals_code_key";

CREATE UNIQUE INDEX "transmittals_projectId_code_key"
    ON "transmittals"("projectId", "code");
