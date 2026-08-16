-- BLOQUE 04, fase 5 — El acuse de recibo y el cierre (B8, B10).
--
-- Cierra H-12 y H-15.
--
-- El acuse NO es una calificación: no dice nada sobre el documento, dice que el
-- envío llegó. Forzarlo dentro del catálogo de calificaciones lo dejaría en la
-- cuarta combinación de efectos que D-22 declara inexistente.
--
-- El cierre es un acto documental explícito y no una precondición: las
-- respuestas parciales son la práctica normal, de modo que un cierre derivado de
-- que todos los ítems estuvieran respondidos no ocurriría nunca.

ALTER TABLE "transmittals"
  -- Acuse, con la misma autoría diferenciada que la respuesta: quien acusa es el
  -- cliente y no es usuario del sistema (D-12).
  ADD COLUMN "acknowledgedBy"            TEXT,
  ADD COLUMN "acknowledgedAt"            TIMESTAMP(3),
  ADD COLUMN "acknowledgeRegisteredById" INTEGER,
  ADD COLUMN "acknowledgeRegisteredAt"   TIMESTAMP(3),

  -- Cierre, con su motivo en el modelo y no en el meta de un evento.
  ADD COLUMN "closedAt"    TIMESTAMP(3),
  ADD COLUMN "closedById"  INTEGER,
  ADD COLUMN "closeReason" TEXT;
