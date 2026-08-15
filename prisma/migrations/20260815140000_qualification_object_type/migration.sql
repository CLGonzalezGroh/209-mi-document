-- BLOQUE 04, fase 1 — El catálogo de calificaciones como tipo de objeto de la traza.
--
-- Va en migración aparte porque PostgreSQL no admite usar un valor de
-- enumeración recién agregado dentro de la misma transacción que lo agrega. Es
-- el mismo motivo por el que BLOQUE 03B separó `DOC_REPLACEMENT`.
--
-- Tiene traza propia y no cuelga del transmittal: es configuración del contrato,
-- y quién agregó o dio de baja una calificación explica por qué una respuesta
-- pudo registrarse con ese valor.

ALTER TYPE "DocObjectType" ADD VALUE 'DOC_QUALIFICATION';
