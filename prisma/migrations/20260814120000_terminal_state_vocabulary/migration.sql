-- BLOQUE 03B, B11 — Una palabra por nivel para terminar mal.
--
-- El circuito se CANCELA, la revisión se ABANDONA y el documento queda OBSOLETO.
-- Hasta acá el estado de la revisión abandonada se llamaba CANCELLED, la misma
-- palabra con que se nombra el acto que retira el circuito SIN abandonar la
-- revisión: dos actos de efecto opuesto bajo un mismo término.
--
-- WorkflowStatus.CANCELLED NO se toca: la palabra pasa a ser exclusiva del circuito.
--
-- Sin datos que convertir: el subsistema documental no tiene uso productivo, y
-- OBSOLETE nunca se usó.

-- ---------------------------------------------------------------------------
-- 1. RevisionStatus: CANCELLED -> ABANDONED, y baja de OBSOLETE
-- ---------------------------------------------------------------------------

-- El índice parcial filtra por el valor viejo, y depende del tipo. Se retira
-- antes de tocarlo y se recrea al final sobre el valor nuevo.
DROP INDEX IF EXISTS "document_revisions_code_key";

-- Renombrar el valor conserva las filas existentes sin convertirlas.
ALTER TYPE "RevisionStatus" RENAME VALUE 'CANCELLED' TO 'ABANDONED';

-- Retirar un valor exige recrear el tipo: PostgreSQL no admite quitarlo.
-- Se verifica primero que nadie lo use, para que la migración falle en lugar de
-- perder filas si algún despliegue lo hubiera empezado a usar.
DO $$
DECLARE
  en_uso INTEGER;
BEGIN
  SELECT COUNT(*) INTO en_uso
  FROM "document_revisions"
  WHERE "status"::text = 'OBSOLETE';

  IF en_uso > 0 THEN
    RAISE EXCEPTION 'RevisionStatus.OBSOLETE tiene % filas y se declaró sin uso', en_uso;
  END IF;
END $$;

ALTER TYPE "RevisionStatus" RENAME TO "RevisionStatus_old";

CREATE TYPE "RevisionStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'SUPERSEDED',
  'ABANDONED'
);

ALTER TABLE "document_revisions"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "RevisionStatus" USING ("status"::text::"RevisionStatus"),
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "RevisionStatus_old";

-- ---------------------------------------------------------------------------
-- 2. Campos del abandono de la revisión
-- ---------------------------------------------------------------------------

-- Los homónimos de review_workflows NO se renombran: ahí el acto sí es cancelar.
ALTER TABLE "document_revisions" RENAME COLUMN "cancelledAt" TO "abandonedAt";
ALTER TABLE "document_revisions" RENAME COLUMN "cancelledById" TO "abandonedById";
ALTER TABLE "document_revisions" RENAME COLUMN "cancelReason" TO "abandonReason";

-- ---------------------------------------------------------------------------
-- 3. Índice único parcial, recreado sobre el valor nuevo
-- ---------------------------------------------------------------------------

-- El código de revisión es único entre las NO abandonadas (BLOQUE 03, B12). La
-- revisión abandonada no consume código: sobre A puede abrirse B, abandonarse y
-- volver a abrirse B. Un documento puede tener varias abandonadas con el mismo
-- código, distinguidas por su fecha y su motivo.
CREATE UNIQUE INDEX "document_revisions_code_key"
    ON "document_revisions"("documentId", "revisionCode")
    WHERE "status" <> 'ABANDONED';
