-- BLOQUE 02D, fase 2 — La raíz de alcance propia del módulo (B1, B2).
--
-- El módulo deja de referenciar el Project de mi-project y pasa a ser dueño de
-- su propia entidad: `doc_projects`, que es lo que D-15 ya había nombrado sin
-- darle objeto —cada proyecto documental ES UN CONTRATO—.
--
-- `doc_project_settings` se disuelve por completo dentro suyo: era la entidad
-- de contrato sin identidad propia. Lo que le faltaba —código, nombre, estado y
-- cierre— es exactamente lo que esta migración agrega.
--
-- **Sin datos que migrar, y verificado.** El control de precondición del bloque
-- se corrió en los cinco despliegues el 2026-08-20: cero configuraciones, cero
-- membresías y cero documentos. Aun así el paso 1 se niega a correr si aparece
-- una fila, porque un contrato exige identidad —código y nombre— y esa no la
-- puede inventar una migración por el cliente.
--
-- **El uno a uno con mi-project se conserva en esta fase.** La unicidad de
-- `projectId` cae en la fase 4, que es la que habilita varios contratos por
-- obra; hasta entonces los catorce lugares que hoy leen la configuración por
-- proyecto siguen funcionando sin cambiar de clave de búsqueda.

-- ---------------------------------------------------------------------------
-- 1. La guarda: identidad que nadie puede inventar
-- ---------------------------------------------------------------------------
--
-- Una fila de configuración existente sería un contrato a crear, y le falta
-- justamente lo que este bloque agrega. Antes que elegir un código por el
-- cliente, la migración se detiene.
DO $$
DECLARE
  filas INTEGER;
BEGIN
  SELECT COUNT(*) INTO filas FROM "doc_project_settings";
  IF filas > 0 THEN
    RAISE EXCEPTION
      'BLOQUE 02D: hay % configuraciones de proyecto cargadas. Cada una es un contrato que exige codigo y nombre, y la migracion no puede inventarlos. Resolver antes de migrar.',
      filas;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. El estado del contrato
-- ---------------------------------------------------------------------------
--
-- Dos estados y un solo efecto (B9), con el precedente literal de ProjectStatus
-- en digitalización. La puerta de escritura la implementa la fase 7: acá el
-- estado es parte de la identidad del contrato, y nada más.
CREATE TYPE "DocProjectStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- ---------------------------------------------------------------------------
-- 3. El contrato
-- ---------------------------------------------------------------------------
CREATE TABLE "doc_projects" (
  "id"          SERIAL           NOT NULL,
  "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" INTEGER          NOT NULL,
  "updatedAt"   TIMESTAMP(3),
  "updatedById" INTEGER          NOT NULL DEFAULT 1,
  "isSys"       BOOLEAN          NOT NULL DEFAULT false,

  -- Identidad. Hasta acá el módulo no podía nombrar sus propios contratos.
  "code"        TEXT             NOT NULL,
  "name"        TEXT             NOT NULL,
  "description" TEXT,

  "status"      "DocProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "closedAt"    TIMESTAMP(3),
  "closedById"  INTEGER,

  -- Gestión PMI. Referencia externa sin FK: Project vive en mi-project, y el
  -- nulo significa que el contrato NO tiene gestión PMI asociada (B3, B6).
  "projectId"   INTEGER,

  -- Lo que venía de doc_project_settings, sin un solo cambio de forma.
  "documentRole"       "DocumentRole"   NOT NULL,
  "counterpartyName"   TEXT,
  "revisionScheme"     "RevisionScheme",
  "defaultOrganizerId" INTEGER,
  "locationEnabled"    BOOLEAN          NOT NULL DEFAULT true,
  "locationRequired"   BOOLEAN          NOT NULL DEFAULT false,
  "locationLabel"      TEXT,

  CONSTRAINT "doc_projects_pkey" PRIMARY KEY ("id")
);

-- El código identifica al contrato dentro del módulo, y no cambia: es el mismo
-- criterio con que D-24 lo fija para el documento.
CREATE UNIQUE INDEX "doc_projects_code_key" ON "doc_projects"("code");

-- Uno a uno con mi-project MIENTRAS DURA ESTA FASE. Postgres trata los nulos
-- como distintos en un índice único, de modo que la unicidad no estorba a los
-- contratos sin gestión PMI: pueden ser muchos desde ahora.
CREATE UNIQUE INDEX "doc_projects_projectId_key" ON "doc_projects"("projectId");

CREATE INDEX "doc_projects_projectId_idx" ON "doc_projects"("projectId");
CREATE INDEX "doc_projects_status_idx"    ON "doc_projects"("status");

-- ---------------------------------------------------------------------------
-- 4. La tabla que se disuelve
-- ---------------------------------------------------------------------------
--
-- Se cae entera, sin traspaso de filas: el paso 1 ya garantizó que no hay
-- ninguna. Nada la referencia con clave foránea —el vínculo con el resto del
-- módulo era `projectId` contra mi-project, y ese lo renombra la fase 3—.
DROP TABLE "doc_project_settings";

-- ---------------------------------------------------------------------------
-- 5. El tipo de objeto de la traza
-- ---------------------------------------------------------------------------
--
-- La auditoría nombra al objeto por lo que es, y el objeto cambió de nombre.
-- `ALTER TYPE ... RENAME VALUE` conserva las filas existentes sin tocarlas: no
-- es una conversión de datos sino un cambio de etiqueta, de modo que ningún
-- evento ya emitido se pierde ni queda apuntando a un valor que el contrato no
-- declara —que es la rotura latente que BLOQUE 02C encontró y corrigió—.
ALTER TYPE "DocObjectType" RENAME VALUE 'DOC_PROJECT_SETTINGS' TO 'DOC_PROJECT';

-- La acción de la traza es texto libre y nombra el acto, no el objeto: declarar
-- la configuración de un proyecto pasa a ser declarar el contrato. Se convierte
-- por las dudas, aunque el control de precondición garantizó que ninguna
-- configuración llegó a declararse en ningún despliegue.
UPDATE "doc_audit_events"
   SET "action" = 'DeclareDocProject'
 WHERE "action" = 'DeclareProjectSettings';
