-- =============================================================================
-- BLOQUE 02 — Verificación de precondición ANTES de migrar
--
-- Criterio de aceptación 3: la migración `add_project_context` contiene
-- DROP COLUMN sobre `documents` (entityType, entityId) y solo puede aplicarse
-- si el subsistema documental está vacío en esa base.
--
-- Es de SOLO LECTURA. No modifica nada.
--
-- Uso, desde 210-mi-deploy y por cada cliente:
--   ./deploy.sh <cliente> testing exec db \
--     "psql -U \$POSTGRES_USER -d mi_document -f -" < ../209-mi-document/prisma/checks/block02_precondicion.sql
--
-- O pegando el contenido en una sesión psql contra la base mi_document.
-- =============================================================================

\echo '--- Subsistema documental: DEBE estar todo en 0 para poder migrar ---'

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
\echo '--- Veredicto ---'

SELECT
    CASE
        WHEN (SELECT count(*) FROM documents)
           + (SELECT count(*) FROM document_revisions)
           + (SELECT count(*) FROM document_versions)
           + (SELECT count(*) FROM review_workflows)
           + (SELECT count(*) FROM review_steps)
           + (SELECT count(*) FROM transmittals)
           + (SELECT count(*) FROM transmittal_items)
           + (SELECT count(*) FROM task_document_references)
           + (SELECT count(*) FROM attachments) = 0
        THEN 'APTO PARA MIGRAR — subsistema documental vacío'
        ELSE 'NO MIGRAR — hay datos; el DROP COLUMN los perdería. Escalar antes de continuar.'
    END AS veredicto;

\echo ''
\echo '--- Legado en producción: NO lo toca la migración, se informa como control ---'

SELECT
    (SELECT count(*) FROM scanned_files)     AS scanned_files,
    (SELECT count(*) FROM areas)             AS areas,
    (SELECT count(*) FROM document_sys_logs) AS sys_logs;

\echo ''
\echo '--- Columnas a retirar: si no existen, la migración ya fue aplicada ---'

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'documents'
  AND column_name IN ('entityType', 'entityId', 'projectId')
ORDER BY column_name;
