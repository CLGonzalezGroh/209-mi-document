-- =============================================================================
-- BLOQUE 02D — Verificación de precondición ANTES de migrar
--
-- **Este control es condición de arranque y no contexto.** El bloque entero se
-- apoya en un supuesto —que no hay filas que colgar de un contrato que todavía
-- no existe—, y este es el único lugar donde ese supuesto se prueba en vez de
-- argumentarse. Si algo bloquea, la fase 2 no empieza.
--
-- Qué hace la migración:
--   · crea `doc_projects`, la raíz de alcance del módulo, con identidad propia
--     y absorbiendo por completo a `doc_project_settings`, que se da de baja;
--   · renombra `projectId` a `docProjectId` en los once modelos del subsistema
--     documental, y le pone CLAVE FORÁNEA real contra `doc_projects`;
--   · deja `scanned_files` y `areas` intactos: conservan su `projectId` hacia
--     `mi-project`, porque su destino es salir hacia `212-mi-digitalization` (B7);
--   · recrea los dos índices únicos parciales de `documents` discriminando por
--     `module` en lugar de por el nulo de proyecto (B5);
--   · `counterpartyName` se retira y aparece `counterpartyId`, referencia a
--     `Company` de `mi-admin` (B4).
--
-- El renombre es gratis solo si toda fila existente tiene `projectId` nulo. Una
-- que declare proyecto apunta a un `Project` de `mi-project` para el que no hay
-- ningún `DocProject`, y la clave foránea nueva no tendría a qué apuntar: habría
-- que decidir qué contrato lo representa, y esa decisión no la puede tomar una
-- migración.
--
-- Lo que ya se sabía y por qué no alcanza: BLOQUE 02C verificó en PRODUCCIÓN que
-- las 7 clases y los 57 tipos de `optimal` declaran módulo y que no existía
-- ninguna declaración de alcance. Eso no dice nada de los tres despliegues de
-- testing, ni de lo que pudo cargarse desde entonces.
--
-- Es de SOLO LECTURA. No modifica nada.
--
-- VEREDICTO: ninguna fila debe devolver `bloquea = true`. Las filas informativas
-- describen la escala y conviene leerlas igual.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ninguna entrada de catálogo declara proyecto (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- Es el control central del bloque, y el que ningún relevamiento previo cubrió
-- en los cinco despliegues. Clase y tipo son los dos catálogos con datos e
-- interfaz en producción, y `ScannedFile` los referencia en el 96% de sus filas.
SELECT
  'clases con proyecto declarado'                          AS control,
  COUNT(*)                                                 AS cantidad,
  COUNT(*) > 0                                             AS bloquea
FROM document_classes
WHERE "projectId" IS NOT NULL;

SELECT
  'tipos con proyecto declarado'                           AS control,
  COUNT(*)                                                 AS cantidad,
  COUNT(*) > 0                                             AS bloquea
FROM document_types
WHERE "projectId" IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Ningún archivo escaneado se apoya en una entrada con proyecto (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- El control 1 dice si el problema existe; este dice si además llegó al único
-- subsistema con uso productivo. Una entrada con proyecto y sin consumidores se
-- puede retirar; una que clasifica 3.000 archivos escaneados, no.
SELECT
  'escaneados clasificados por una entrada con proyecto'   AS control,
  COUNT(*)                                                 AS cantidad,
  COUNT(*) > 0                                             AS bloquea
FROM scanned_files sf
WHERE EXISTS (
        SELECT 1 FROM document_classes dc
        WHERE dc.id = sf."documentClassId" AND dc."projectId" IS NOT NULL)
   OR EXISTS (
        SELECT 1 FROM document_types dt
        WHERE dt.id = sf."documentTypeId" AND dt."projectId" IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 3. Las otras tres tablas con alcance por proyecto están sin declarar (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- Son las que pudieron cargarse a mano desde que BLOQUE 02B y 02C se
-- desplegaron. Cada fila con proyecto es, igual que en el control 1, una fila
-- sin contrato al que colgarse.
SELECT
  'declaraciones de alcance con proyecto'                  AS control,
  COUNT(*)                                                 AS cantidad,
  COUNT(*) > 0                                             AS bloquea
FROM doc_catalog_scopes
WHERE "projectId" IS NOT NULL;

SELECT
  'ubicaciones con proyecto'                               AS control,
  COUNT(*)                                                 AS cantidad,
  COUNT(*) > 0                                             AS bloquea
FROM doc_locations
WHERE "projectId" IS NOT NULL;

SELECT
  'plantillas de circuito con proyecto'                    AS control,
  COUNT(*)                                                 AS cantidad,
  COUNT(*) > 0                                             AS bloquea
FROM doc_workflow_templates
WHERE "projectId" IS NOT NULL;

SELECT
  'calificaciones con proyecto'                            AS control,
  COUNT(*)                                                 AS cantidad,
  COUNT(*) > 0                                             AS bloquea
FROM doc_qualifications
WHERE "projectId" IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. No hay configuración ni membresía de proyecto cargada (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- `doc_project_settings` se disuelve dentro de `doc_projects` (B2). Cada fila
-- existente sería un contrato a crear, y le falta justamente lo que el bloque
-- agrega: identidad. Código y nombre no se pueden inventar por el cliente.
SELECT
  'configuraciones de proyecto cargadas'                   AS control,
  COUNT(*)                                                 AS cantidad,
  COUNT(*) > 0                                             AS bloquea
FROM doc_project_settings;

SELECT
  'membresías de proyecto cargadas'                        AS control,
  COUNT(*)                                                 AS cantidad,
  COUNT(*) > 0                                             AS bloquea
FROM doc_project_members;

-- -----------------------------------------------------------------------------
-- 5. El subsistema documental sigue vacío (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- Es el mismo supuesto que BLOQUE 02 verificó y que cada bloque volvió a
-- confirmar. Acá vuelve a importar por un motivo propio: cada documento con
-- proyecto exigiría un contrato, y cada transmittal también.
SELECT
  'subsistema documental con datos'                        AS control,
  (SELECT COUNT(*) FROM documents)
  + (SELECT COUNT(*) FROM document_revisions)
  + (SELECT COUNT(*) FROM document_versions)
  + (SELECT COUNT(*) FROM review_workflows)
  + (SELECT COUNT(*) FROM review_steps)
  + (SELECT COUNT(*) FROM transmittals)
  + (SELECT COUNT(*) FROM transmittal_items)
  + (SELECT COUNT(*) FROM task_document_references)
  + (SELECT COUNT(*) FROM attachments)                     AS cantidad,
  (
    (SELECT COUNT(*) FROM documents)
    + (SELECT COUNT(*) FROM document_revisions)
    + (SELECT COUNT(*) FROM document_versions)
    + (SELECT COUNT(*) FROM review_workflows)
    + (SELECT COUNT(*) FROM review_steps)
    + (SELECT COUNT(*) FROM transmittals)
    + (SELECT COUNT(*) FROM transmittal_items)
    + (SELECT COUNT(*) FROM task_document_references)
    + (SELECT COUNT(*) FROM attachments)
  ) > 0                                                    AS bloquea;

-- -----------------------------------------------------------------------------
-- 6. El bloque no fue aplicado ni a medias (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- No por los datos del cliente sino por una aplicación parcial previa: una
-- migración interrumpida dejaría la tabla o la columna creadas y el registro de
-- migraciones sin la marca.
SELECT
  'objetos del bloque ya existentes'                       AS control,
  COUNT(*)                                                 AS cantidad,
  COUNT(*) > 0                                             AS bloquea
FROM (
  SELECT 1 FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'doc_projects'
  UNION ALL
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public'
     AND column_name IN ('docProjectId', 'counterpartyId')
) AS objetos;

-- -----------------------------------------------------------------------------
-- 7. Línea base de lo que el bloque renombra (INFORMATIVO)
-- -----------------------------------------------------------------------------
--
-- La escala real en cada despliegue. Se espera que todo lo de acá quede idéntico
-- después de migrar: el renombre no agrega ni quita filas.
SELECT
  'clases de documento (línea base)'                       AS control,
  COUNT(*)                                                 AS cantidad,
  false                                                    AS bloquea
FROM document_classes;

SELECT
  'tipos de documento (línea base)'                        AS control,
  COUNT(*)                                                 AS cantidad,
  false                                                    AS bloquea
FROM document_types;

SELECT
  'declaraciones de alcance (línea base)'                  AS control,
  COUNT(*)                                                 AS cantidad,
  false                                                    AS bloquea
FROM doc_catalog_scopes;

SELECT
  'ubicaciones (línea base)'                               AS control,
  COUNT(*)                                                 AS cantidad,
  false                                                    AS bloquea
FROM doc_locations;

-- -----------------------------------------------------------------------------
-- 8. El subsistema legado, que este bloque NO toca (INFORMATIVO)
-- -----------------------------------------------------------------------------
--
-- B7 los excluye del renombre: conservan su `projectId` hacia `mi-project`.
-- Estos números son la línea base del criterio 5 y deben dar exactamente igual
-- después de migrar.
SELECT
  'archivos escaneados (línea base)'                       AS control,
  COUNT(*)                                                 AS cantidad,
  false                                                    AS bloquea
FROM scanned_files;

SELECT
  'escaneados con clase declarada (línea base)'            AS control,
  COUNT(*)                                                 AS cantidad,
  false                                                    AS bloquea
FROM scanned_files
WHERE "documentClassId" IS NOT NULL;

SELECT
  'escaneados con tipo declarado (línea base)'             AS control,
  COUNT(*)                                                 AS cantidad,
  false                                                    AS bloquea
FROM scanned_files
WHERE "documentTypeId" IS NOT NULL;

SELECT
  'áreas del subsistema legado (línea base)'               AS control,
  COUNT(*)                                                 AS cantidad,
  false                                                    AS bloquea
FROM areas;

SELECT
  'registros de log (línea base)'                          AS control,
  COUNT(*)                                                 AS cantidad,
  false                                                    AS bloquea
FROM document_sys_logs;

-- Cuántos proyectos de `mi-project` referencia el legado. Dimensiona lo que B7
-- deja afuera del renombre: son los vínculos que NO se convierten en contratos.
SELECT
  'proyectos distintos referenciados por el legado'        AS control,
  (SELECT COUNT(DISTINCT "projectId") FROM scanned_files)
  + (SELECT COUNT(DISTINCT "projectId") FROM areas)        AS cantidad,
  false                                                    AS bloquea;
