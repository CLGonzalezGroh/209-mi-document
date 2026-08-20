-- BLOQUE 02D, fase 5 — La contraparte es una referencia, no un nombre (B4).
--
-- `counterpartyName` era texto libre porque cuando BLOQUE 02 lo definió, la
-- única `Company` del ecosistema vivía en `207-mi-comercial`, y hacerla
-- referencia habría atado la gestión documental a un módulo comercial que el
-- cliente puede no tener. **Esa atadura desapareció el 2026-08-19**, cuando
-- `Company` se mudó a `205-mi-admin` — y ese fue el motivo por el que la
-- mudanza tuvo que ir primero.
--
-- Se contrata con la EMPRESA y no con la razón social: a cuál se le factura es
-- un dato de facturación que este módulo no necesita. La referencia apunta a un
-- registro transversal, sin que documentos dependa nunca de `mi-comercial` ni
-- de `mi-management`.
--
-- **Sin clave foránea, y no por descuido**: `Company` vive en otra base, del
-- otro lado de la federación. Es la misma convención con que el módulo trata a
-- `User` y con la que trataba al proyecto antes de ser dueño del contrato.
--
-- **No se denormaliza el nombre.** A diferencia de la copia de rótulo de
-- BLOQUE 03B, acá no hay ningún acto pasado cuyo valor haya que congelar: el
-- nombre de la empresa contratante hoy es el que la empresa tiene hoy.

-- ---------------------------------------------------------------------------
-- 1. La guarda: un nombre no se convierte en una referencia
-- ---------------------------------------------------------------------------
--
-- Nadie puede decidir por el cliente a qué `Company` corresponde el texto
-- "Planta Sur SA". El control de precondición verificó cero contratos en los
-- cinco despliegues, de modo que esto no debería encontrar nada; si encuentra
-- algo, la conversión es un trabajo de datos y no una migración.
DO $$
DECLARE
  filas INTEGER;
BEGIN
  SELECT COUNT(*) INTO filas
    FROM "doc_projects"
   WHERE "counterpartyName" IS NOT NULL AND btrim("counterpartyName") <> '';

  IF filas > 0 THEN
    RAISE EXCEPTION
      'BLOQUE 02D: hay % contratos con contraparte por nombre. Convertir un nombre libre en una referencia a Company exige decidir a cual, y esa decision no la puede tomar una migracion.',
      filas;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. La referencia
-- ---------------------------------------------------------------------------
ALTER TABLE "doc_projects" DROP COLUMN "counterpartyName";
ALTER TABLE "doc_projects" ADD COLUMN "counterpartyId" INTEGER;

CREATE INDEX "doc_projects_counterpartyId_idx" ON "doc_projects"("counterpartyId");
