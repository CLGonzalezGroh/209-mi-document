-- BLOQUE 02B, fase 4 — La ubicación en el documento y su configuración (B3, B4).
--
-- El atributo pertenece al DOCUMENTO y no a la revisión, y se edita siempre: no
-- entra en el congelamiento de D-05 ni en el payload de la firma. Que aparezca
-- impreso en el rótulo no lo vuelve identificación — el código identifica, el
-- título describe la emisión, y la ubicación clasifica.
--
-- **Aditiva y sin efecto sobre lo existente.** El atributo es opcional en los tres
-- roles, y la configuración nace habilitada y no obligatoria, de modo que todo
-- documento ya cargado queda válido y todo proyecto sigue operando igual.

-- ---------------------------------------------------------------------------
-- 1. El atributo del documento
-- ---------------------------------------------------------------------------

-- Un nodo, habitualmente la hoja. El documento que alcanza dos áreas apunta al
-- ancestro común, que un árbol de profundidad libre ya permite: no se modela N:M.
ALTER TABLE "documents" ADD COLUMN "locationId"   INTEGER;

-- El snapshot de la ruta. Es denormalización de conveniencia y no evidencia:
-- evita el join en cada listado, y renombrar o mover un nodo lo recalcula de
-- forma automática. Nulo cuando el documento no declara ubicación.
ALTER TABLE "documents" ADD COLUMN "locationPath" TEXT;

-- RESTRICT y no SET NULL: eliminar definitivamente un nodo referenciado se
-- rechaza en la operación, y la base no debe resolverlo vaciando en silencio la
-- clasificación de un documento. La baja LÓGICA del nodo sí se admite, y no
-- revalida lo ya clasificado (D-13).
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "doc_locations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "documents_locationId_idx" ON "documents"("locationId");

-- ---------------------------------------------------------------------------
-- 2. La configuración por proyecto
-- ---------------------------------------------------------------------------

-- Habilitado y NO obligatorio por defecto, en los tres roles. Se corrige acá la
-- expectativa de D-14 de que "una planta lo exigirá": la planta lo usa para
-- filtrar, no para exigir.
ALTER TABLE "doc_project_settings"
  ADD COLUMN "locationEnabled"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "locationRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "locationLabel"    TEXT;

-- La etiqueta sí es configurable, a diferencia del esquema de revisión: "área",
-- "unidad" o "sector" son nombres que cada organización usa distinto, mientras
-- que "revisión" es terminología establecida del dominio documental.

-- ---------------------------------------------------------------------------
-- 3. Lo que no vive en la base
-- ---------------------------------------------------------------------------

-- Que el nodo elegido esté DENTRO DEL ALCANCE del documento —el árbol que su
-- proyecto ve, o el del despliegue si no tiene proyecto— no es expresable en un
-- CHECK: exige resolver el modo declarado por el proyecto. Vive en la operación,
-- con sus pruebas, como la invariante de cruce de la fase 2.
--
-- Tampoco la obligatoriedad, que es configuración y se valida solo en escritura.
