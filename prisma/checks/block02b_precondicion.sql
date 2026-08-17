-- =============================================================================
-- BLOQUE 02B — Verificación de precondición ANTES de migrar
--
-- **Este bloque es enteramente aditivo, y por eso este control no tiene ningún
-- veredicto que pueda cancelar la migración.** Se conserva igual, por dos
-- motivos: para dejar por escrito *por qué* no hay nada que bloquear, y para
-- medir la escala de lo que las cuatro migraciones tocan antes de tocarlo.
--
-- Qué incorpora el bloque:
--   · `doc_locations` y `doc_catalog_scopes`, tablas NUEVAS;
--   · `documents.locationId` y `documents.locationPath`, columnas NUEVAS y
--     anulables, con clave RESTRICT hacia una tabla que nace vacía;
--   · tres columnas NUEVAS en `doc_project_settings`, con valor por defecto
--     —habilitado, no obligatorio, sin etiqueta—;
--   · dos valores nuevos en `DocObjectType`, en migraciones separadas.
--
-- Nada se retira, nada se renombra, y ninguna columna existente cambia de tipo
-- ni de obligatoriedad. Un documento ya cargado queda válido sin ubicación, y un
-- proyecto ya configurado sigue operando igual: el atributo nace opcional en los
-- tres roles (B4).
--
-- Es de SOLO LECTURA. No modifica nada.
--
-- VEREDICTO: ninguna fila puede devolver `bloquea = true`. Las filas informativas
-- describen la escala y conviene leerlas igual.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Las tablas del bloque no deben existir todavía (BLOQUEA)
-- -----------------------------------------------------------------------------
--
-- Es lo único que podría impedir la migración, y no por los datos del cliente
-- sino por una aplicación parcial previa: una migración interrumpida a mitad
-- dejaría la tabla creada y el registro de migraciones sin la marca.
SELECT
  'tablas del bloque ya existentes'                        AS control,
  COUNT(*)                                                AS cantidad,
  COUNT(*) > 0                                            AS bloquea
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('doc_locations', 'doc_catalog_scopes');

-- -----------------------------------------------------------------------------
-- 2. Las columnas del bloque tampoco (BLOQUEA)
-- -----------------------------------------------------------------------------

SELECT
  'columnas del bloque ya existentes'                      AS control,
  COUNT(*)                                                AS cantidad,
  COUNT(*) > 0                                            AS bloquea
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'documents'            AND column_name IN ('locationId', 'locationPath'))
    OR (table_name = 'doc_project_settings' AND column_name IN ('locationEnabled', 'locationRequired', 'locationLabel'))
  );

-- -----------------------------------------------------------------------------
-- 3. Escala de lo que las migraciones tocan (INFORMATIVO)
-- -----------------------------------------------------------------------------
--
-- Las dos columnas nuevas de `documents` nacen nulas, de modo que ningún
-- documento existente cambia de contenido. El número dice cuántas filas quedan
-- con la clasificación vacía, que es lo que después habrá que cargar si el
-- cliente quiere usar el atributo.
SELECT
  'documentos que quedarán sin ubicación'                  AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM documents;

-- Cada proyecto configurado recibe el atributo habilitado y no obligatorio. Nadie
-- tiene que declarar nada para seguir operando.
SELECT
  'proyectos con configuración documental'                 AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM doc_project_settings;

-- -----------------------------------------------------------------------------
-- 4. El subsistema legado, que este bloque NO toca (INFORMATIVO)
-- -----------------------------------------------------------------------------
--
-- `Area` y `ScannedFile` no se modifican: la ubicación documental es una
-- jerarquía propia y no reutiliza la entidad plana del subsistema que sale del
-- módulo (D-14). Estos dos números son la línea base del criterio 11, y deben
-- dar exactamente igual después de migrar.
SELECT
  'archivos escaneados (línea base)'                       AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM scanned_files;

SELECT
  'áreas del subsistema legado (línea base)'               AS control,
  COUNT(*)                                                AS cantidad,
  false                                                   AS bloquea
FROM areas;
