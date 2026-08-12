-- =============================================================================
-- BLOQUE 03 — Verificación de precondición ANTES de migrar
--
-- Dos precondiciones distintas, y conviene no confundirlas:
--
--   1. SUBSISTEMA DOCUMENTAL VACÍO (criterio 20). Igual que en el Bloque 02:
--      la migración cambia estructura sin compatibilidad hacia atrás.
--
--   2. CATÁLOGOS SIN DUPLICADOS (decisión B15). ES DISTINTA DE LA ANTERIOR:
--      `DocumentClass` y `DocumentType` SÍ tienen datos productivos, y sus
--      cuatro restricciones pasan a `NULLS NOT DISTINCT`. Si ya existen
--      duplicados con `module` o `classId` nulos, la creación del índice
--      FALLA y la migración aborta.
--
--      Un resultado no vacío acá NO cancela la migración: obliga a LIMPIAR
--      los duplicados antes. Es lo contrario del veredicto del Bloque 02.
--
-- Es de SOLO LECTURA. No modifica nada.
--
-- Uso, desde 210-mi-deploy y por cada cliente:
--   ./deploy.sh <cliente> testing exec db \
--     "psql -U \$POSTGRES_USER -d mi_document -f -" < ../209-mi-document/prisma/checks/block03_precondicion.sql
--
-- O pegando el contenido en una sesión psql contra la base mi_document.
-- =============================================================================

\echo '--- Versión del servidor: NULLS NOT DISTINCT requiere PostgreSQL 15 o superior ---'

SELECT
    current_setting('server_version')                       AS server_version,
    CASE
        WHEN current_setting('server_version_num')::int >= 150000
        THEN 'OK — NULLS NOT DISTINCT disponible'
        ELSE 'NO APTO — se requieren índices únicos parciales por combinación de nulos'
    END AS veredicto_version;

\echo ''
\echo '--- 1. Subsistema documental: DEBE estar todo en 0 para poder migrar ---'

SELECT
    (SELECT count(*) FROM documents)                 AS documents,
    (SELECT count(*) FROM document_revisions)        AS revisions,
    (SELECT count(*) FROM document_versions)         AS versions,
    (SELECT count(*) FROM review_workflows)          AS workflows,
    (SELECT count(*) FROM review_steps)              AS steps,
    (SELECT count(*) FROM transmittals)              AS transmittals,
    (SELECT count(*) FROM transmittal_items)         AS transmittal_items,
    (SELECT count(*) FROM task_document_references)  AS task_refs,
    (SELECT count(*) FROM attachments)               AS attachments;

\echo ''
\echo '--- 2. Catálogos: duplicados que impedirían crear los índices de B15 ---'
\echo '    GROUP BY trata los nulos como iguales, que es la semántica de NULLS NOT DISTINCT.'

\echo ''
\echo 'document_classes — duplicados por [name, module]'
SELECT name, module, count(*) AS repeticiones
FROM document_classes
GROUP BY name, module
HAVING count(*) > 1
ORDER BY count(*) DESC, name;

\echo ''
\echo 'document_classes — duplicados por [code, module]'
SELECT code, module, count(*) AS repeticiones
FROM document_classes
GROUP BY code, module
HAVING count(*) > 1
ORDER BY count(*) DESC, code;

\echo ''
\echo 'document_types — duplicados por [name, classId, module]'
SELECT name, "classId", module, count(*) AS repeticiones
FROM document_types
GROUP BY name, "classId", module
HAVING count(*) > 1
ORDER BY count(*) DESC, name;

\echo ''
\echo 'document_types — duplicados por [code, classId, module]'
SELECT code, "classId", module, count(*) AS repeticiones
FROM document_types
GROUP BY code, "classId", module
HAVING count(*) > 1
ORDER BY count(*) DESC, code;

\echo ''
\echo '--- Veredicto ---'

WITH documental AS (
    SELECT
        (SELECT count(*) FROM documents)
      + (SELECT count(*) FROM document_revisions)
      + (SELECT count(*) FROM document_versions)
      + (SELECT count(*) FROM review_workflows)
      + (SELECT count(*) FROM review_steps)
      + (SELECT count(*) FROM transmittals)
      + (SELECT count(*) FROM transmittal_items)
      + (SELECT count(*) FROM task_document_references)
      + (SELECT count(*) FROM attachments) AS filas
),
duplicados AS (
    SELECT
        (SELECT count(*) FROM (SELECT 1 FROM document_classes GROUP BY name, module HAVING count(*) > 1) d)
      + (SELECT count(*) FROM (SELECT 1 FROM document_classes GROUP BY code, module HAVING count(*) > 1) d)
      + (SELECT count(*) FROM (SELECT 1 FROM document_types GROUP BY name, "classId", module HAVING count(*) > 1) d)
      + (SELECT count(*) FROM (SELECT 1 FROM document_types GROUP BY code, "classId", module HAVING count(*) > 1) d) AS grupos
)
SELECT
    documental.filas   AS filas_subsistema,
    duplicados.grupos  AS grupos_duplicados,
    CASE
        WHEN documental.filas > 0
        THEN 'NO MIGRAR — el subsistema documental tiene datos. Escalar antes de continuar.'
        WHEN duplicados.grupos > 0
        THEN 'LIMPIAR PRIMERO — hay duplicados en los catálogos; la creación del índice de B15 fallaría.'
        ELSE 'APTO PARA MIGRAR'
    END AS veredicto
FROM documental, duplicados;

\echo ''
\echo '--- Versiones sin checksum: B4 lo vuelve obligatorio ---'

SELECT count(*) AS versiones_sin_checksum
FROM document_versions
WHERE checksum IS NULL;

\echo ''
\echo '--- Legado: NO lo toca la migración, se informa como control ---'

SELECT
    (SELECT count(*) FROM scanned_files)     AS scanned_files,
    (SELECT count(*) FROM areas)             AS areas,
    (SELECT count(*) FROM document_sys_logs) AS sys_logs;

\echo ''
\echo '--- Estado de la migración: si revisionScheme ya no está en documents, fue aplicada ---'

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'documents'
  AND column_name IN ('revisionScheme', 'projectId')
ORDER BY column_name;
