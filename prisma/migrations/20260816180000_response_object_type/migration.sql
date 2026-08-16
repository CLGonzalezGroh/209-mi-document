-- BLOQUE 04, fase 4 — La respuesta como tipo de objeto de la traza.
--
-- Migración aparte porque PostgreSQL no admite usar un valor de enumeración
-- recién agregado dentro de la misma transacción que lo agrega.
--
-- Tiene tipo propio y no cuelga del transmittal: la respuesta es de un documento
-- concreto, y su traza —quién la registró, quién respondió, y cada corrección—
-- describe ese documento y no la carpeta en que salió.

ALTER TYPE "DocObjectType" ADD VALUE 'DOC_TRANSMITTAL_RESPONSE';
