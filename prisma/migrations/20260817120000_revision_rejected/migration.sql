-- BLOQUE 04, fase 6 — Estado terminal de la revisión rechazada por la contraparte.
--
-- Corrige la confirmación de D-26, que eliminó `RevisionStatus.OBSOLETE`
-- declarando que `BLOCK_04` no necesitaría un estado terminal por respuesta de
-- la contraparte. Esa confirmación se dio antes de implementar el circuito del
-- rol Receptor, y ahí sí hace falta.
--
-- No es el OBSOLETE que se retiró —obsoleto es lo que dejó de aplicar—: en
-- Emisor e Interno el rechazo devuelve la revisión a borrador y abre otro
-- circuito, pero en Receptor el elaborador está AFUERA y no hay a quién
-- devolverle el trabajo. Sin este estado la revisión quedaba en DRAFT para
-- siempre y bloqueaba la emisión siguiente, que es H-01 reapareciendo.
--
-- Consume código, a diferencia de ABANDONED: esta revisión salió y la
-- contraparte ya la recibió con su código, de modo que el índice único parcial
-- —que excluye solo a las abandonadas— sigue contándola sin cambios.

ALTER TYPE "RevisionStatus" ADD VALUE 'REJECTED';
