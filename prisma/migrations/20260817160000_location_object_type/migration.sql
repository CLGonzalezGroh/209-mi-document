-- BLOQUE 02B, fase 1 — La ubicación como tipo de objeto de la traza.
--
-- Va en migración aparte porque PostgreSQL no admite usar un valor de
-- enumeración recién agregado dentro de la misma transacción que lo agrega. Es
-- el mismo motivo por el que BLOQUE 03B separó `DOC_REPLACEMENT` y BLOQUE 04
-- `DOC_QUALIFICATION` y `DOC_TRANSMITTAL_RESPONSE`.
--
-- El nodo tiene traza propia: quién agregó, renombró, movió o dio de baja una
-- ubicación explica por qué un documento quedó clasificado donde está. Y el
-- recálculo de rutas alcanza a nodos que nadie tocó, de modo que sin registro
-- del movimiento que lo originó esos cambios serían inexplicables después.

ALTER TYPE "DocObjectType" ADD VALUE 'DOC_LOCATION';
