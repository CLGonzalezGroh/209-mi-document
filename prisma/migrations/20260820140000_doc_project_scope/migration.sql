-- BLOQUE 02D, fase 3 — El alcance cuelga del contrato (B7).
--
-- `projectId` pasa a `docProjectId` en los ONCE modelos del subsistema
-- documental, y en nueve de ellos gana CLAVE FORÁNEA REAL contra `doc_projects`.
-- Hasta hoy nada impedía que un documento apuntara a un proyecto inexistente:
-- no había clave foránea porque no había tabla. Ahora la base lo garantiza, y
-- el invariante deja de ser una convención entre servicios.
--
-- **`scanned_files` y `areas` quedan afuera, intactos.** Conservan su
-- `projectId` apuntando a `mi-project`: su destino es salir hacia
-- `212-mi-digitalization`, y renombrarlos exigiría inventarles contratos a un
-- subsistema que se va. Es el mismo criterio con que BLOQUE 02C los excluyó del
-- alcance, y aquella exclusión quedó medida sobre el 96% de sus filas.
--
-- **Las dos tablas de eventos llevan la columna sin clave foránea.** Es el
-- criterio de ADR-022 de digitalización —FK en las raíces, columna de scoping
-- en lo que solo denormaliza el contexto— y además el correcto para un registro
-- inmutable: una traza de auditoría no debe depender del ciclo de vida de lo que
-- audita.
--
-- **Sin datos que convertir, y medido.** El control de precondición del bloque
-- dio cero en los cinco despliegues el 2026-08-20: ninguna entrada de catálogo
-- declara proyecto, y el subsistema documental está vacío. El paso 1 lo vuelve a
-- exigir acá, porque una fila con proyecto apuntaría a un `Project` de
-- `mi-project` para el que no existe ningún contrato, y la clave foránea nueva
-- no tendría a qué apuntar.

-- ---------------------------------------------------------------------------
-- 1. La guarda: ningún valor puede quedar huérfano
-- ---------------------------------------------------------------------------
--
-- Se verifica ANTES de renombrar, y **solo sobre las nueve que van a llevar
-- clave foránea**. Un valor no nulo ahí nombra un proyecto del esquema anterior
-- para el que no hay contrato, y la decisión de cuál lo representa no la puede
-- tomar una migración.
--
-- Las dos tablas de eventos se tratan distinto, en el paso 2b, y por una razón
-- de fondo: sin clave foránea no hay decisión que tomar, y lo que hay es un
-- valor cuyo significado dejó de existir.
DO $$
DECLARE
  t     TEXT;
  filas INTEGER;
  total INTEGER := 0;
  detalle TEXT := '';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'documents', 'transmittals', 'document_classes', 'document_types',
    'doc_workflow_templates', 'doc_project_members', 'doc_qualifications',
    'doc_catalog_scopes', 'doc_locations'
  ] LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "projectId" IS NOT NULL', t) INTO filas;
    IF filas > 0 THEN
      total := total + filas;
      detalle := detalle || format('%s=%s ', t, filas);
    END IF;
  END LOOP;

  IF total > 0 THEN
    RAISE EXCEPTION
      'BLOQUE 02D: hay % filas con proyecto declarado (%). Cada una apunta a un Project de mi-project para el que no existe contrato, y la FK nueva no tendria a que apuntar. Resolver antes de migrar.',
      total, trim(detalle);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. El renombre
-- ---------------------------------------------------------------------------
--
-- `RENAME COLUMN` conserva los índices y las constraints que la usan, y les
-- ajusta la definición sola: no hay que recrearlos. Lo que sí queda con el
-- nombre viejo es el IDENTIFICADOR de cada índice, que el paso 4 corrige.

ALTER TABLE "documents" RENAME COLUMN "projectId" TO "docProjectId";
ALTER TABLE "transmittals" RENAME COLUMN "projectId" TO "docProjectId";
ALTER TABLE "document_classes" RENAME COLUMN "projectId" TO "docProjectId";
ALTER TABLE "document_types" RENAME COLUMN "projectId" TO "docProjectId";
ALTER TABLE "doc_workflow_templates" RENAME COLUMN "projectId" TO "docProjectId";
ALTER TABLE "doc_project_members" RENAME COLUMN "projectId" TO "docProjectId";
ALTER TABLE "doc_qualifications" RENAME COLUMN "projectId" TO "docProjectId";
ALTER TABLE "doc_catalog_scopes" RENAME COLUMN "projectId" TO "docProjectId";
ALTER TABLE "doc_locations" RENAME COLUMN "projectId" TO "docProjectId";

-- Las dos de eventos: misma columna, sin clave foránea.
ALTER TABLE "doc_workflow_events" RENAME COLUMN "projectId" TO "docProjectId";
ALTER TABLE "doc_audit_events" RENAME COLUMN "projectId" TO "docProjectId";

-- ---------------------------------------------------------------------------
-- 2b. El contexto huérfano de las trazas
-- ---------------------------------------------------------------------------
--
-- La columna de las dos tablas de eventos es un SNAPSHOT del contexto del
-- objeto afectado, derivado y nunca informado por quien emite (BLOQUE 02, B9).
-- Un valor que sobrevive acá nombra un proyecto de `mi-project` bajo el esquema
-- anterior, y después del renombre esa columna significa otra cosa: dejarlo
-- haría que el evento pareciera pertenecer a un contrato que no es.
--
-- **Se anula, y no se bloquea.** Es la diferencia con el paso 1: allá hay una
-- decisión que la migración no puede tomar —cuál contrato representa a ese
-- proyecto—; acá no hay ninguna, porque el valor no puede seguir significando
-- lo que significaba. El evento conserva su objeto, su acción, su actor y su
-- fecha; lo único que pierde es un alcance derivado que ya no existe.
DO $$
DECLARE
  eventos INTEGER;
  trazas  INTEGER;
BEGIN
  UPDATE "doc_workflow_events" SET "docProjectId" = NULL WHERE "docProjectId" IS NOT NULL;
  GET DIAGNOSTICS eventos = ROW_COUNT;
  UPDATE "doc_audit_events" SET "docProjectId" = NULL WHERE "docProjectId" IS NOT NULL;
  GET DIAGNOSTICS trazas = ROW_COUNT;

  IF eventos > 0 OR trazas > 0 THEN
    RAISE NOTICE 'BLOQUE 02D: contexto de proyecto anulado en % eventos de workflow y % trazas de auditoria. Nombraban proyectos de mi-project bajo el esquema anterior.', eventos, trazas;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Las claves foráneas
-- ---------------------------------------------------------------------------
--
-- RESTRICT en las nueve, y no CASCADE ni SET NULL: dar de baja un contrato con
-- documentación colgando se rechaza en la operación, y la base no debe
-- resolverlo borrando historia ni vaciando en silencio el alcance de una
-- entrada de catálogo. Es el mismo criterio con que BLOQUE 02B trató la
-- ubicación del documento.

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_docProjectId_fkey"
  FOREIGN KEY ("docProjectId") REFERENCES "doc_projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transmittals"
  ADD CONSTRAINT "transmittals_docProjectId_fkey"
  FOREIGN KEY ("docProjectId") REFERENCES "doc_projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_classes"
  ADD CONSTRAINT "document_classes_docProjectId_fkey"
  FOREIGN KEY ("docProjectId") REFERENCES "doc_projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_types"
  ADD CONSTRAINT "document_types_docProjectId_fkey"
  FOREIGN KEY ("docProjectId") REFERENCES "doc_projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "doc_workflow_templates"
  ADD CONSTRAINT "doc_workflow_templates_docProjectId_fkey"
  FOREIGN KEY ("docProjectId") REFERENCES "doc_projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "doc_project_members"
  ADD CONSTRAINT "doc_project_members_docProjectId_fkey"
  FOREIGN KEY ("docProjectId") REFERENCES "doc_projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "doc_qualifications"
  ADD CONSTRAINT "doc_qualifications_docProjectId_fkey"
  FOREIGN KEY ("docProjectId") REFERENCES "doc_projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "doc_catalog_scopes"
  ADD CONSTRAINT "doc_catalog_scopes_docProjectId_fkey"
  FOREIGN KEY ("docProjectId") REFERENCES "doc_projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "doc_locations"
  ADD CONSTRAINT "doc_locations_docProjectId_fkey"
  FOREIGN KEY ("docProjectId") REFERENCES "doc_projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Los identificadores de índices y constraints
-- ---------------------------------------------------------------------------
--
-- Cosméticos y sin efecto sobre el comportamiento, pero un índice llamado
-- `..._projectId_key` sobre una columna que ya no se llama así es una trampa
-- para el próximo que lea el esquema. Es la misma corrección que BLOQUE 02C
-- hizo con las dos constraints que habían quedado del renombre a `current*`.
--
-- Los cinco últimos son los índices únicos con `NULLS NOT DISTINCT`, creados en
-- SQL crudo por BLOQUE 02C y 03: no los nombra Prisma, y por eso no aparecen en
-- la convención automática. Los delató `prisma migrate diff`, que es el control
-- que existe para esto.

DO $$
DECLARE
  par TEXT[];
BEGIN
  FOREACH par SLICE 1 IN ARRAY ARRAY[ARRAY['documents_projectId_idx','documents_docProjectId_idx'],
    ARRAY['transmittals_projectId_code_key','transmittals_docProjectId_code_key'],
    ARRAY['transmittals_projectId_idx','transmittals_docProjectId_idx'],
    ARRAY['document_classes_projectId_idx','document_classes_docProjectId_idx'],
    ARRAY['document_types_projectId_idx','document_types_docProjectId_idx'],
    ARRAY['doc_workflow_templates_projectId_idx','doc_workflow_templates_docProjectId_idx'],
    ARRAY['doc_project_members_projectId_userId_key','doc_project_members_docProjectId_userId_key'],
    ARRAY['doc_project_members_projectId_idx','doc_project_members_docProjectId_idx'],
    ARRAY['doc_qualifications_projectId_idx','doc_qualifications_docProjectId_idx'],
    ARRAY['doc_catalog_scopes_projectId_idx','doc_catalog_scopes_docProjectId_idx'],
    ARRAY['doc_locations_projectId_idx','doc_locations_docProjectId_idx'],
    ARRAY['doc_workflow_events_projectId_createdAt_idx','doc_workflow_events_docProjectId_createdAt_idx'],
    ARRAY['doc_audit_events_projectId_createdAt_idx','doc_audit_events_docProjectId_createdAt_idx'],
    ARRAY['doc_catalog_scopes_module_projectId_catalog_key','doc_catalog_scopes_module_docProjectId_catalog_key'],
    ARRAY['document_classes_code_module_projectId_key','document_classes_code_module_docProjectId_key'],
    ARRAY['document_classes_name_module_projectId_key','document_classes_name_module_docProjectId_key'],
    ARRAY['document_types_code_classId_module_projectId_key','document_types_code_classId_module_docProjectId_key'],
    ARRAY['document_types_name_classId_module_projectId_key','document_types_name_classId_module_docProjectId_key']
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = par[1]) THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', par[1], par[2]);
    END IF;
  END LOOP;
END $$;
