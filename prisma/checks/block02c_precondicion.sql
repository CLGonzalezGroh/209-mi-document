-- =============================================================================
-- BLOQUE 02C — Verificación de precondición ANTES de migrar
--
-- **A diferencia de BLOQUE 02B, este control sí tiene veredictos que pueden
-- cancelar la migración**, y conviene decir por qué: aquel bloque era
-- enteramente aditivo sobre tablas que nacían vacías, y este toca los dos
-- catálogos con datos e interfaz en producción, retira dos valores de una
-- enumeración y cambia la obligatoriedad de una columna.
--
-- Qué hace la migración:
--   · `document_classes.projectId` y `document_types.projectId`, columnas NUEVAS
--     y anulables, con un CHECK que exige `module = 'PROJECTS'` cuando hay
--     proyecto;
--   · los cuatro índices únicos de esos catálogos, recreados con el eje nuevo y
--     `NULLS NOT DISTINCT`, y renombrados a la convención;
--   · `DocCatalogKind` pasa de tres valores a dos: `DOCUMENT_CLASS` y
--     `DOCUMENT_TYPE` se retiran y aparece `CLASSIFICATION`;
--   · `doc_catalog_scopes` incorpora `module` NOT NULL —con las filas existentes
--     llevadas a `PROJECTS`— y `projectId` pasa a anulable;
--   · dos constraints de `documents` se renombran, sin cambiar comportamiento.
--
-- Toda entrada ya cargada queda con `projectId` nulo, o sea en el alcance del
-- despliegue: es el único que hoy existe y el que las pantallas administran. El
-- CHECK no puede fallar sobre lo existente, justamente porque nace todo nulo.
--
-- Es de SOLO LECTURA. No modifica nada.
--
-- VEREDICTO: ninguna fila debe devolver `bloquea = true`. Las filas informativas
-- describen la escala y conviene leerlas igual.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ninguna declaración de alcance usa los valores que se retiran (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- Es el único control que puede fallar por DATOS y no por una aplicación
-- parcial. `DOCUMENT_CLASS` y `DOCUMENT_TYPE` quedaron declarados en BLOQUE 02B
-- sin que ninguna operación los asignara, y este bloque los retira porque clase
-- y tipo declaran juntos (B1). Si alguna fila los tuviera, la conversión del
-- tipo la perdería.
--
-- La migración lo verifica sola —el `USING` falla y se detiene— pero conviene
-- saberlo ANTES y no a mitad de la transacción.
SELECT
  'alcances con los valores retirados'                     AS control,
  COUNT(*)                                                AS cantidad,
  COUNT(*) > 0                                            AS bloquea
FROM doc_catalog_scopes
WHERE catalog::text IN ('DOCUMENT_CLASS', 'DOCUMENT_TYPE');

-- -----------------------------------------------------------------------------
-- 2. Las columnas del bloque no deben existir todavía (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- No por los datos del cliente sino por una aplicación parcial previa: una
-- migración interrumpida a mitad dejaría la columna creada y el registro de
-- migraciones sin la marca.
SELECT
  'columnas del bloque ya existentes'                      AS control,
  COUNT(*)                                                AS cantidad,
  COUNT(*) > 0                                            AS bloquea
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'document_classes'   AND column_name = 'projectId')
    OR (table_name = 'document_types'  AND column_name = 'projectId')
    OR (table_name = 'doc_catalog_scopes' AND column_name = 'module')
  );

-- -----------------------------------------------------------------------------
-- 3. Las constraints que se renombran existen con su nombre viejo (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- El renombre es cosmético —corrige nombres que quedaron de las columnas que
-- BLOQUE 03B llevó a `current*`— pero falla si no encuentra el nombre de origen.
-- Deben ser exactamente dos.
SELECT
  'constraints a renombrar encontradas'                    AS control,
  COUNT(*)                                                AS cantidad,
  COUNT(*) <> 2                                           AS bloquea
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'documents'
  AND constraint_name IN (
    'documents_documentTypeId_fkey',
    'documents_documentClassId_fkey'
  );

-- -----------------------------------------------------------------------------
-- 4. Línea base de los catálogos que el bloque altera (INFORMATIVO)
-- -----------------------------------------------------------------------------
--
-- Es la escala real del bloque en cada despliegue. Todas estas entradas quedan
-- con `projectId` nulo, o sea exactamente donde están hoy: la migración es
-- aditiva y las pantallas siguen mostrando lo mismo (B4).
SELECT
  'clases de documento (línea base)'                       AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM document_classes;

SELECT
  'tipos de documento (línea base)'                        AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM document_types;

-- Con módulo declarado frente a compartidas. La distinción importa para leer el
-- efecto de B6: cuando un módulo declare catálogo propio, el `module` nulo pasará
-- a significar *disponible para los módulos que heredan* y no *para todos*.
SELECT
  'clases sin módulo (compartidas)'                        AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM document_classes
WHERE module IS NULL;

SELECT
  'tipos sin módulo (compartidos)'                         AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM document_types
WHERE module IS NULL;

-- Las declaraciones de alcance existentes, todas de ubicación y todas de
-- proyecto: son las que la migración lleva a `module = 'PROJECTS'`.
SELECT
  'declaraciones de alcance existentes'                    AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM doc_catalog_scopes;

-- -----------------------------------------------------------------------------
-- 5. Los consumidores de los catálogos, que el bloque NO altera (INFORMATIVO)
-- -----------------------------------------------------------------------------
--
-- Cinco tablas los referencian. Ninguna cambia: el alcance se agrega en la
-- entrada y no en quien la usa, y lo ya clasificado no se revalida (D-13).
SELECT
  'documentos clasificados'                                AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM documents;

SELECT
  'plantillas de circuito'                                 AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM doc_workflow_templates;

-- -----------------------------------------------------------------------------
-- 6. El subsistema legado, que este bloque NO toca (INFORMATIVO)
-- -----------------------------------------------------------------------------
--
-- `ScannedFile` referencia los dos catálogos y es el ÚNICO subsistema con uso
-- productivo: sus selectores siguen viendo el catálogo del despliegue, tal como
-- hoy (B3). Estos números son la línea base del criterio 10 y deben dar
-- exactamente igual después de migrar.
SELECT
  'archivos escaneados (línea base)'                       AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM scanned_files;

SELECT
  'escaneados con clase declarada (línea base)'            AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM scanned_files
WHERE "documentClassId" IS NOT NULL;

SELECT
  'escaneados con tipo declarado (línea base)'             AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM scanned_files
WHERE "documentTypeId" IS NOT NULL;

SELECT
  'áreas del subsistema legado (línea base)'               AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM areas;
