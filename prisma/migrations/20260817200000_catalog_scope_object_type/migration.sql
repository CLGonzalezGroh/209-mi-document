-- BLOQUE 02B, fase 2 — El alcance del catálogo como tipo de objeto de la traza.
--
-- Va en migración aparte por el motivo de siempre: PostgreSQL no admite usar un
-- valor de enumeración recién agregado dentro de la misma transacción que lo
-- agrega.
--
-- Tiene traza propia porque declarar que un proyecto deja de heredar **cambia
-- qué entradas tiene disponibles sin tocar ninguna entrada**. Sin registro, un
-- catálogo que de un día para el otro muestra tres valores en lugar de sesenta
-- no tendría explicación en ninguna parte.

ALTER TYPE "DocObjectType" ADD VALUE 'DOC_CATALOG_SCOPE';
