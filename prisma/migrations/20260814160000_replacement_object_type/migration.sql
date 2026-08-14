-- BLOQUE 03B, fase F — El acto de reemplazo como tipo de objeto de la traza.
--
-- Tiene identidad propia y toca VARIOS documentos: colgar su traza de uno de
-- ellos obligaría a elegir cuál, y la elección sería arbitraria.
--
-- La copia de trabajo NO recibe tipo propio: su traza cuelga de la revisión,
-- porque no es un objeto del dominio sino el conjunto en preparación de esa
-- revisión, y lo que se consulta es qué le pasó a la revisión.

ALTER TYPE "DocObjectType" ADD VALUE 'DOC_REPLACEMENT';
