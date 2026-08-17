-- BLOQUE 02C, fase 1 — Alcance por proyecto de clase y tipo (B1, B5, B6).
--
-- El mecanismo lo construyó BLOQUE 02B sobre el catálogo de ubicación, que no
-- tenía datos ni interfaz en producción. Esta migración lo aplica a los dos que
-- sí los tienen: `optimal` tiene 7 clases y 57 tipos, la webapp tiene pantallas
-- vivas de ambos, y `ScannedFile` los referencia.
--
-- **Es aditiva y no cambia el comportamiento de nada existente.** Toda entrada
-- ya cargada queda con `projectId` nulo, o sea en el alcance del despliegue,
-- que es el único que hoy existe y el que esas pantallas administran. La
-- ausencia de fila de alcance sigue siendo `INHERIT`.

-- ---------------------------------------------------------------------------
-- 1. El alcance de la entrada
-- ---------------------------------------------------------------------------

-- Nulo = catálogo del despliegue, del que los proyectos heredan.
ALTER TABLE "document_classes" ADD COLUMN "projectId" INTEGER;
ALTER TABLE "document_types"   ADD COLUMN "projectId" INTEGER;

CREATE INDEX "document_classes_projectId_idx" ON "document_classes"("projectId");
CREATE INDEX "document_types_projectId_idx"   ON "document_types"("projectId");

-- El proyecto solo tiene sentido como alcance dentro del módulo que lo tiene.
-- Es la misma forma del invariante que D-06 fija para `Document`, y a
-- diferencia del cruce entre clase y tipo, este sí es expresable: mira dos
-- columnas de la propia fila.
ALTER TABLE "document_classes"
  ADD CONSTRAINT "document_classes_project_scope_check"
  CHECK ("projectId" IS NULL OR "module" = 'PROJECTS');

ALTER TABLE "document_types"
  ADD CONSTRAINT "document_types_project_scope_check"
  CHECK ("projectId" IS NULL OR "module" = 'PROJECTS');

-- ---------------------------------------------------------------------------
-- 2. La unicidad incorpora el alcance
-- ---------------------------------------------------------------------------

-- Dos proyectos pueden nombrar igual su propia clase, y un proyecto puede
-- agregar un código que el despliegue no tiene sin chocar con otro proyecto.
-- `NULLS NOT DISTINCT` sigue siendo lo que vuelve efectiva la restricción
-- (BLOQUE 03, B15), ahora sobre una columna anulable más.
--
-- **Los cuatro cambian de nombre y no solo de definición.** El nombre declara
-- las columnas que cubre, de modo que conservar `..._name_module_key` sobre un
-- índice de tres columnas sería crear la misma deriva que el punto 5 corrige en
-- `documents`. Se adopta el nombre que la convención genera.
DROP INDEX "document_classes_name_module_key";
DROP INDEX "document_classes_code_module_key";
DROP INDEX "document_types_name_classId_module_key";
DROP INDEX "document_types_code_classId_module_key";

CREATE UNIQUE INDEX "document_classes_name_module_projectId_key"
    ON "document_classes"("name", "module", "projectId") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "document_classes_code_module_projectId_key"
    ON "document_classes"("code", "module", "projectId") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "document_types_name_classId_module_projectId_key"
    ON "document_types"("name", "classId", "module", "projectId") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "document_types_code_classId_module_projectId_key"
    ON "document_types"("code", "classId", "module", "projectId") NULLS NOT DISTINCT;

-- ---------------------------------------------------------------------------
-- 3. Los catálogos documentales son dos y no tres
-- ---------------------------------------------------------------------------

-- `CLASSIFICATION` cubre clase y tipo juntos (B1). Los dos valores que se
-- retiran quedaron declarados sin que ninguna operación los asignara, que es la
-- misma corrección que el módulo hizo con `WorkflowStatus.PENDING` (H-08).
--
-- El `USING` es además la precondición que se verifica sola: si alguna fila
-- tuviera uno de los dos valores retirados, la conversión falla y la migración
-- se detiene en lugar de perder el dato.
ALTER TYPE "DocCatalogKind" RENAME TO "DocCatalogKind_old";

CREATE TYPE "DocCatalogKind" AS ENUM (
  'LOCATION',
  'CLASSIFICATION'
);

ALTER TABLE "doc_catalog_scopes"
  ALTER COLUMN "catalog" TYPE "DocCatalogKind"
  USING ("catalog"::text::"DocCatalogKind");

DROP TYPE "DocCatalogKind_old";

-- ---------------------------------------------------------------------------
-- 4. El alcance se declara con los mismos dos ejes que la entrada
-- ---------------------------------------------------------------------------

-- Hasta acá solo un proyecto podía declarar su modo, de modo que la ausencia de
-- proyecto equivalía al despliegue — exactamente lo que el plan advierte que no
-- debe construirse. Con `module` presente y `projectId` anulable, calidad,
-- comercial y activos pueden declarar el suyo sin migrar estructura (B6).
--
-- No son dos columnas anulables con exclusión mutua: un proyecto siempre
-- pertenece al módulo de proyectos, así que los dos ejes conviven.
ALTER TABLE "doc_catalog_scopes" ADD COLUMN "module" "ModuleType";

-- Todas las filas existentes son declaraciones de proyecto, que es lo único que
-- la estructura anterior admitía.
UPDATE "doc_catalog_scopes" SET "module" = 'PROJECTS' WHERE "module" IS NULL;

ALTER TABLE "doc_catalog_scopes" ALTER COLUMN "module" SET NOT NULL;
ALTER TABLE "doc_catalog_scopes" ALTER COLUMN "projectId" DROP NOT NULL;

DROP INDEX "doc_catalog_scopes_projectId_catalog_key";

CREATE UNIQUE INDEX "doc_catalog_scopes_module_projectId_catalog_key"
    ON "doc_catalog_scopes"("module", "projectId", "catalog") NULLS NOT DISTINCT;

-- ---------------------------------------------------------------------------
-- 5. La deriva declarada por BLOQUE 02B (B5)
-- ---------------------------------------------------------------------------

-- `document_revisions_documentClassId_fkey` NO se toca: la base ya la declara
-- `RESTRICT`, que es lo correcto —la clase integra el payload de la firma, y
-- borrarla no puede vaciar en silencio la clasificación de una revisión
-- firmada—. Lo que estaba mal era el modelo, que al no declarar `onDelete` en
-- una relación opcional dejaba a Prisma suponiendo `SetNull`. Se corrige en
-- `schema.prisma` y no acá, que es donde estaba el defecto.
--
-- Lo que sí corrige esta migración son los dos nombres que quedaron viejos:
-- PostgreSQL no renombra las constraints al renombrar la columna, y BLOQUE 03B
-- renombró `documentTypeId` y `documentClassId` a `current*`. Es cosmético y no
-- cambia comportamiento, pero es deriva que el diff seguía reportando.
ALTER TABLE "documents"
  RENAME CONSTRAINT "documents_documentTypeId_fkey"
  TO "documents_currentDocumentTypeId_fkey";

ALTER TABLE "documents"
  RENAME CONSTRAINT "documents_documentClassId_fkey"
  TO "documents_currentDocumentClassId_fkey";
