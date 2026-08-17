-- BLOQUE 02B, fase 1 — El catálogo jerárquico de ubicación física (B5, B6, B7).
--
-- Sitio ▸ planta ▸ área ▸ unidad, con profundidad libre: se carga como lista
-- plana de un nivel o como árbol de varios, según cómo cada organización
-- describa su instalación. El sitio no es una entidad aparte, es el nivel
-- superior del mismo árbol.
--
-- Esta fase deja el árbol DEL DESPLIEGUE. El alcance por proyecto —herencia con
-- ampliación, o catálogo propio— llega en la fase 2, que recrea la unicidad
-- incorporando la columna de alcance.
--
-- `Area` NO se toca ni se migra: es plana, atada al proyecto y pertenece al
-- subsistema de `ScannedFile`, que sale del módulo por su propio bloque.

-- ---------------------------------------------------------------------------
-- 1. El origen de la referencia externa
-- ---------------------------------------------------------------------------

-- ASSETS es el registro de activos de OperMask, dueño del árbol cuando ese
-- módulo exista; EXTERNAL, un sistema ajeno. Externo es respecto de este
-- módulo, que es el que resuelve la referencia.
CREATE TYPE "DocLocationOrigin" AS ENUM (
  'ASSETS',
  'EXTERNAL'
);

-- ---------------------------------------------------------------------------
-- 2. El catálogo
-- ---------------------------------------------------------------------------

CREATE TABLE "doc_locations" (
  "id"             SERIAL       NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById"    INTEGER      NOT NULL,
  "updatedAt"      TIMESTAMP(3),
  "updatedById"    INTEGER      NOT NULL DEFAULT 1,
  "terminatedAt"   TIMESTAMP(3),
  "isSys"          BOOLEAN      NOT NULL DEFAULT false,

  -- Nulo = nodo raíz.
  "parentId"       INTEGER,

  "code"           TEXT         NOT NULL,
  "name"           TEXT         NOT NULL,

  -- Ruta completa, denormalizada. Ver el comentario del modelo: es conveniencia
  -- y no evidencia, de modo que el recálculo es automático.
  "path"           TEXT         NOT NULL,

  "sortOrder"      INTEGER      NOT NULL DEFAULT 0,

  -- Los dos viajan juntos: un origen sin identificador no dice nada.
  "externalOrigin" "DocLocationOrigin",
  "externalRef"    TEXT,

  CONSTRAINT "doc_locations_pkey" PRIMARY KEY ("id")
);

-- El árbol. RESTRICT y no CASCADE: eliminar un nodo con descendencia se
-- rechaza en la operación, y la base no debe resolverlo borrando en silencio.
ALTER TABLE "doc_locations"
  ADD CONSTRAINT "doc_locations_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "doc_locations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unicidad del código dentro de su nivel. NULLS NOT DISTINCT es lo que la
-- vuelve efectiva para los nodos RAÍZ —donde `parentId` es nulo, y que son
-- todos los de un catálogo plano—, con el mecanismo que B15 de BLOQUE 03 dejó
-- decidido para H-19.
CREATE UNIQUE INDEX "doc_locations_code_level_key"
    ON "doc_locations"("code", "parentId") NULLS NOT DISTINCT;

CREATE INDEX "doc_locations_parentId_idx" ON "doc_locations"("parentId");
CREATE INDEX "doc_locations_path_idx"     ON "doc_locations"("path");

-- Los dos campos de la referencia externa viajan juntos.
ALTER TABLE "doc_locations"
  ADD CONSTRAINT "doc_locations_external_reference_complete"
  CHECK (
    ("externalOrigin" IS NULL AND "externalRef" IS NULL)
    OR ("externalOrigin" IS NOT NULL AND "externalRef" IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 3. Sin siembra
-- ---------------------------------------------------------------------------

-- A diferencia del catálogo de calificaciones, acá no hay nada que sembrar: no
-- existe un árbol por defecto que sirva a ninguna instalación, y el atributo es
-- opcional en los tres roles (B4). Un despliegue sin ubicaciones cargadas
-- atraviesa el ciclo completo.
--
-- El tipo de objeto de la traza va en la migración siguiente, por el motivo que
-- ya obligó a separarlo en BLOQUE 03B y en BLOQUE 04.
