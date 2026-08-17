-- BLOQUE 02B, fase 2 — El mecanismo de alcance por proyecto (B1).
--
-- Dos modos que el proyecto declara por catálogo: heredar el del despliegue y
-- ampliarlo, o tener el propio sin verlo. En una planta rige el primero, porque
-- cada proyecto interviene sobre la misma instalación; en una empresa de
-- ingeniería el global queda vacío o mínimo y cada proyecto carga la estructura
-- de su cliente.
--
-- **La migración es aditiva.** La ausencia de fila de alcance es `INHERIT`, de
-- modo que todo proyecto existente hereda y nada cambia de comportamiento hasta
-- que alguien declare lo contrario. Los nodos ya cargados quedan en el árbol del
-- despliegue, que es donde la fase 1 los dejó.
--
-- El mecanismo es UNO para los tres catálogos documentales. `BLOCK_02C` lo
-- reutiliza sobre clase y tipo agregando valores a `DocCatalogKind`, sin migrar
-- estructura, y por eso lo estrena acá: el catálogo de ubicación no tiene datos
-- ni interfaz en producción, y clase y tipo sí.

-- ---------------------------------------------------------------------------
-- 1. Los dos ejes del mecanismo
-- ---------------------------------------------------------------------------

CREATE TYPE "DocCatalogKind" AS ENUM (
  'LOCATION',
  'DOCUMENT_CLASS',
  'DOCUMENT_TYPE'
);

CREATE TYPE "DocScopeMode" AS ENUM (
  'INHERIT',
  'OWN'
);

-- ---------------------------------------------------------------------------
-- 2. La declaración: una fila por proyecto y catálogo
-- ---------------------------------------------------------------------------

-- Y no columnas en `doc_project_settings`: las demás configuraciones por
-- proyecto son VALORES donde lo específico reemplaza a lo general; un catálogo
-- es un CONJUNTO, y lo que se declara es si se hereda. Es la distinción que
-- D-21 ya había hecho.
CREATE TABLE "doc_catalog_scopes" (
  "id"          SERIAL       NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" INTEGER      NOT NULL,
  "updatedAt"   TIMESTAMP(3),
  "updatedById" INTEGER      NOT NULL DEFAULT 1,

  -- Referencia externa sin FK: Project vive en mi-project.
  "projectId"   INTEGER      NOT NULL,

  "catalog"     "DocCatalogKind" NOT NULL,
  "mode"        "DocScopeMode"   NOT NULL,

  CONSTRAINT "doc_catalog_scopes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_catalog_scopes_projectId_catalog_key"
    ON "doc_catalog_scopes"("projectId", "catalog");

CREATE INDEX "doc_catalog_scopes_projectId_idx"
    ON "doc_catalog_scopes"("projectId");

-- ---------------------------------------------------------------------------
-- 3. El alcance del nodo de ubicación
-- ---------------------------------------------------------------------------

-- Nulo = árbol del despliegue, del que los proyectos heredan. Todo lo ya
-- cargado queda ahí, que es donde la fase 1 lo dejó.
ALTER TABLE "doc_locations" ADD COLUMN "projectId" INTEGER;

CREATE INDEX "doc_locations_projectId_idx" ON "doc_locations"("projectId");

-- La unicidad incorpora el alcance: dos proyectos pueden nombrar igual su
-- propio nodo, y un proyecto puede agregar un código que el despliegue no tiene
-- sin chocar con otro proyecto. `NULLS NOT DISTINCT` sigue siendo lo que la
-- vuelve efectiva, ahora sobre dos columnas anulables en lugar de una.
DROP INDEX "doc_locations_code_level_key";

CREATE UNIQUE INDEX "doc_locations_code_level_key"
    ON "doc_locations"("code", "parentId", "projectId") NULLS NOT DISTINCT;

-- La relación de padre puede cruzar alcances en un solo sentido —un nodo del
-- proyecto cuelga de uno del despliegue, que es lo que significa *ampliar*— y
-- eso NO es expresable en un CHECK, porque exige mirar el padre. Vive en la
-- operación, con su prueba: un nodo del despliegue no puede colgar de uno de
-- proyecto, y declarar catálogo propio se rechaza mientras algún nodo del
-- proyecto cuelgue del árbol global.

-- ---------------------------------------------------------------------------
-- 4. El tipo de objeto de la traza va en la migración siguiente
-- ---------------------------------------------------------------------------

-- Mismo motivo de siempre: PostgreSQL no admite usar un valor de enumeración
-- recién agregado dentro de la misma transacción que lo agrega.
