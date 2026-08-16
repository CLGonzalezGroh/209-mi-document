-- =============================================================================
-- BLOQUE 04 — Verificación de precondición ANTES de migrar
--
-- La circulación cambia de estructura sin compatibilidad hacia atrás: el
-- transmittal gana naturaleza, pierde `issuedTo` y su código pasa a ser único
-- por proyecto; el ítem pierde `clientStatus` y `clientComments`, y la
-- enumeración `ClientStatus` se elimina.
--
-- La línea base del plan afirma que **ningún cliente utiliza el subsistema de
-- Gestión Documental**. Esto lo verifica en lugar de suponerlo.
--
-- Es de SOLO LECTURA. No modifica nada.
--
-- VEREDICTO: cualquier fila devuelta con `bloquea = true` CANCELA la migración.
-- Las filas informativas no la cancelan y conviene leerlas igual.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Circulación con datos (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- Las tres migraciones del bloque asumen circulación vacía. Con transmittals
-- registrados, la naturaleza se poblaría con el default `EMISSION` —correcto,
-- porque la respuesta no existía como objeto— pero `issuedTo` se perdería sin
-- que nadie haya decidido a dónde va, y las respuestas de los ítems se
-- descartarían con las columnas que las alojaban.
SELECT
  'transmittals con datos'                       AS control,
  COUNT(*)                                       AS cantidad,
  COUNT(*) > 0                                   AS bloquea
FROM "transmittals"

UNION ALL

SELECT
  'items de transmittal con datos',
  COUNT(*),
  COUNT(*) > 0
FROM "transmittal_items"

UNION ALL

-- -----------------------------------------------------------------------------
-- 2. Respuestas del cliente ya registradas (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- Se cuenta aparte de los ítems porque es el dato que la migración descarta sin
-- destino: la respuesta pasa a ser un objeto propio con archivos, autoría
-- diferenciada y fecha real, y no hay forma de derivar esos campos desde dos
-- columnas. Si aparecen filas acá, hay que decidir su traslado ANTES.
SELECT
  'items con respuesta del cliente registrada',
  COUNT(*),
  COUNT(*) > 0
FROM "transmittal_items"
WHERE "clientStatus" IS NOT NULL
   OR "clientComments" IS NOT NULL

UNION ALL

-- -----------------------------------------------------------------------------
-- 3. Códigos de transmittal repetidos dentro de un proyecto (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- La unicidad pasa de global a `[projectId, code]`. Es una restricción MÁS
-- LAXA, de modo que nada que hoy sea válido deja de serlo: este control existe
-- solo para el caso de que la tabla se haya poblado por fuera de la aplicación.
SELECT
  'codigos de transmittal repetidos por proyecto',
  COALESCE(SUM("repetidos"), 0),
  COALESCE(SUM("repetidos"), 0) > 0
FROM (
  SELECT COUNT(*) - 1 AS "repetidos"
  FROM "transmittals"
  GROUP BY "projectId", "code"
  HAVING COUNT(*) > 1
) AS duplicados

UNION ALL

-- -----------------------------------------------------------------------------
-- 4. Revisiones emitidas más de una vez (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- `documentRevisionId` pasa a ser único a secas: una revisión se emite una sola
-- vez. La unicidad anterior era por transmittal, de modo que la misma revisión
-- podía figurar en dos. Si eso ocurrió, la creación del índice FALLA.
SELECT
  'revisiones incluidas en mas de un transmittal',
  COUNT(*),
  COUNT(*) > 0
FROM (
  SELECT "documentRevisionId"
  FROM "transmittal_items"
  GROUP BY "documentRevisionId"
  HAVING COUNT(*) > 1
) AS multiples

UNION ALL

-- -----------------------------------------------------------------------------
-- 5. Proyectos con documentos y sin rol declarado (INFORMATIVO)
-- -----------------------------------------------------------------------------
--
-- No bloquea la migración, que es puramente estructural. Pero después de ella
-- **la circulación exige el rol declarado**: sin él no se puede crear un
-- transmittal, porque es el rol el que dice si sale, si entra o si no existe.
--
-- Conviene declararlo antes de que alguien intente emitir.
SELECT
  'proyectos con documentos y sin rol documental declarado (informativo)',
  COUNT(*),
  false
FROM (
  SELECT DISTINCT d."projectId"
  FROM "documents" d
  LEFT JOIN "doc_project_settings" s ON s."projectId" = d."projectId"
  WHERE d."projectId" IS NOT NULL
    AND s."id" IS NULL
) AS sin_rol;
