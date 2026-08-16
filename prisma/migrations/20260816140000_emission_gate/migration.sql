-- BLOQUE 04, fase 3 — La puerta de emisión y el candidato (B3).
--
-- Una revisión se emite UNA SOLA VEZ. La unicidad anterior era por transmittal,
-- de modo que solo impedía el duplicado dentro de la misma carpeta: la misma
-- revisión podía salir en dos transmittals distintos.
--
-- El índice es el árbitro de "no emitidas", y absorbe dos reglas que estaban
-- planteadas por separado: una revisión respondida tampoco vuelve a emitirse
-- —ya salió— y un reintento del emisor no puede duplicar la emisión.
--
-- Va sin condiciones porque solo los transmittals de emisión llevan ítems: la
-- respuesta cuelga del ítem de la emisión que contesta, y no crea uno propio.

DROP INDEX "transmittal_items_transmittalId_documentRevisionId_key";

CREATE UNIQUE INDEX "transmittal_items_documentRevisionId_key"
    ON "transmittal_items"("documentRevisionId");

-- El acceso por transmittal deja de estar cubierto por el índice compuesto que
-- se retira, y se repone como índice común.
CREATE INDEX "transmittal_items_transmittalId_idx"
    ON "transmittal_items"("transmittalId");
