-- BLOQUE 03 — Tipos de objeto del ciclo interno.
--
-- Puramente aditiva. Se separa de la migración del modelo por el mismo criterio
-- de BLOQUE 02: los valores de enumeración que la traza necesita no comparten
-- riesgo con los cambios de estructura, y conviene poder aplicarlos por separado.
--
-- DOC_SETTINGS no figura entre los dos tipos que el bloque enumera. Se incorpora
-- porque el bloque sí exige acciones de auditoría sobre la configuración del
-- despliegue, y toda acción declara el tipo del objeto que afecta: sin él, esas
-- acciones no tendrían dónde apuntar.

ALTER TYPE "DocObjectType" ADD VALUE 'DOC_STEP_SIGNATURE';
ALTER TYPE "DocObjectType" ADD VALUE 'DOC_WORKFLOW_TEMPLATE';
ALTER TYPE "DocObjectType" ADD VALUE 'DOC_SETTINGS';
