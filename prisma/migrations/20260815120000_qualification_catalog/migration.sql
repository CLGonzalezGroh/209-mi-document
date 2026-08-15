-- BLOQUE 04, fase 1 — El catálogo de calificaciones (B11).
--
-- `ClientStatus` es hoy una enumeración fija de cuatro valores. Cada cliente
-- tiene su propio juego de calificaciones, con SUS códigos y SU cantidad, y el
-- rótulo que el usuario ve es el del cliente y no una traducción nuestra.
--
-- Esta fase INCORPORA el catálogo y no retira `ClientStatus`, que sigue en
-- `transmittal_items` hasta que la fase 4 lo reemplace junto con la respuesta.
-- Separarlo evita dejar el módulo sin forma de registrar una respuesta entre
-- una fase y la otra.

-- ---------------------------------------------------------------------------
-- 1. El efecto, como enumeración
-- ---------------------------------------------------------------------------

-- Solo tres de las cuatro combinaciones de las dos preguntas existen: si el
-- documento no sirve, hay que volver a emitirlo. Con dos indicadores la cuarta
-- podría escribirse y habría que impedirla por validación.
CREATE TYPE "QualificationEffect" AS ENUM (
  'ACCEPTED',
  'ACCEPTED_WITH_COMMENTS',
  'REJECTED'
);

-- ---------------------------------------------------------------------------
-- 2. El catálogo
-- ---------------------------------------------------------------------------

CREATE TABLE "doc_qualifications" (
  "id"           SERIAL       NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById"  INTEGER      NOT NULL,
  "updatedAt"    TIMESTAMP(3),
  "updatedById"  INTEGER      NOT NULL DEFAULT 1,
  "terminatedAt" TIMESTAMP(3),
  "isSys"        BOOLEAN      NOT NULL DEFAULT false,

  -- Nulo = catálogo del despliegue. Referencia externa sin FK.
  "projectId"    INTEGER,

  "code"         TEXT         NOT NULL,
  "label"        TEXT         NOT NULL,
  "effect"       "QualificationEffect" NOT NULL,
  "sortOrder"    INTEGER      NOT NULL DEFAULT 0,

  CONSTRAINT "doc_qualifications_pkey" PRIMARY KEY ("id")
);

-- Unicidad del código dentro de su alcance. NULLS NOT DISTINCT es lo que la
-- vuelve efectiva para el caso más frecuente —el catálogo del despliegue, donde
-- `projectId` es nulo en todas las entradas—, con el mecanismo que B15 de
-- BLOQUE 03 dejó decidido.
CREATE UNIQUE INDEX "doc_qualifications_code_scope_key"
    ON "doc_qualifications"("code", "projectId") NULLS NOT DISTINCT;

CREATE INDEX "doc_qualifications_projectId_idx"
    ON "doc_qualifications"("projectId");

-- ---------------------------------------------------------------------------
-- 3. Siembra del despliegue
-- ---------------------------------------------------------------------------

-- Las cuatro entradas que `ClientStatus` tenía, con el efecto que les
-- corresponde. Preserva la práctica relevada: el despliegue queda operativo sin
-- que nadie configure nada, y cada proyecto que necesite las suyas las declara.
--
-- `isSys` las marca como provistas por el sistema, con el criterio del resto de
-- los catálogos sembrados.
INSERT INTO "doc_qualifications"
  ("createdById", "projectId", "code", "label", "effect", "sortOrder", "isSys")
VALUES
  (1, NULL, 'APPROVED',              'Aprobado',                 'ACCEPTED',               10, true),
  (1, NULL, 'APPROVED_WITH_COMMENTS','Aprobado con comentarios', 'ACCEPTED_WITH_COMMENTS', 20, true),
  (1, NULL, 'REVIEWED_NO_EXCEPTION', 'Revisado sin objeción',    'ACCEPTED',               30, true),
  (1, NULL, 'REJECTED',              'Rechazado',                'REJECTED',               40, true);
