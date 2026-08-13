-- =============================================================================
-- BLOQUE 03 — Ciclo interno de revisión: modelo y migración (Fase B)
--
-- Precondición verificada antes de aplicar, con prisma/checks/block03_precondicion.sql:
--   1. el subsistema documental está vacío en el cliente (criterio 20);
--   2. los catálogos no tienen duplicados que impidan crear los índices de B15.
--
-- El orden NO es el que genera `prisma migrate diff`: la enumeración
-- RevisionScheme se altera después de que `documents` pierda su columna y antes
-- de que existan las tablas que la usan.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. El esquema de revisión deja de persistirse en el documento (B13)
-- ---------------------------------------------------------------------------

ALTER TABLE "documents" DROP COLUMN "revisionScheme";

-- ---------------------------------------------------------------------------
-- 2. Enumeraciones
-- ---------------------------------------------------------------------------

-- RevisionScheme: ALPHABETICAL → ALPHA, y se incorpora FREE_TEXT (B13).
-- Se renombra el valor en lugar de recrear el tipo: sin datos que convertir,
-- conserva la identidad del tipo y las dependencias existentes.
ALTER TYPE "RevisionScheme" RENAME VALUE 'ALPHABETICAL' TO 'ALPHA';
ALTER TYPE "RevisionScheme" ADD VALUE 'FREE_TEXT';

-- Los tres ADD VALUE que siguen fijan la POSICIÓN del valor nuevo. Sin BEFORE
-- ni AFTER el valor queda al final del tipo, y el orden físico de una
-- enumeración es el que PostgreSQL usa al ordenar por esa columna: `ASSIGN` y
-- `PREPARE` quedarían después de `ACKNOWLEDGE`, invirtiendo la secuencia del
-- circuito para cualquier consulta que ordene por el tipo del paso.

-- RevisionStatus: la revisión abandonada tiene estado propio (B11).
-- OBSOLETE se conserva SIN USO hasta que BLOCK_04 defina los estados
-- terminales por respuesta de la contraparte.
ALTER TYPE "RevisionStatus" ADD VALUE 'CANCELLED' AFTER 'SUPERSEDED';

-- StepStatus: estado terminal de cumplimiento para los pasos que no juzgan (B8).
ALTER TYPE "StepStatus" ADD VALUE 'COMPLETED' AFTER 'PENDING';

-- StepType: el circuito abarca el ciclo completo (B1). La secuencia se lee
-- ASSIGN ▸ PREPARE ▸ REVIEW ▸ APPROVE ▸ ACKNOWLEDGE.
ALTER TYPE "StepType" ADD VALUE 'ASSIGN' BEFORE 'REVIEW';
ALTER TYPE "StepType" ADD VALUE 'PREPARE' BEFORE 'REVIEW';

-- WorkflowStatus: se retira PENDING —el circuito nace iniciado (B2, H-08)— y se
-- incorpora CANCELLED (B11). Retirar un valor obliga a recrear el tipo.
BEGIN;
CREATE TYPE "WorkflowStatus_new" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');
ALTER TABLE "public"."review_workflows" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "review_workflows" ALTER COLUMN "status" TYPE "WorkflowStatus_new" USING ("status"::text::"WorkflowStatus_new");
ALTER TYPE "WorkflowStatus" RENAME TO "WorkflowStatus_old";
ALTER TYPE "WorkflowStatus_new" RENAME TO "WorkflowStatus";
DROP TYPE "public"."WorkflowStatus_old";
ALTER TABLE "review_workflows" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
COMMIT;

-- ---------------------------------------------------------------------------
-- 3. Restricciones que se reemplazan
-- ---------------------------------------------------------------------------

-- Los cuatro índices de catálogo se recrean con NULLS NOT DISTINCT (B15).
DROP INDEX "document_classes_name_module_key";
DROP INDEX "document_classes_code_module_key";
DROP INDEX "document_types_name_classId_module_key";
DROP INDEX "document_types_code_classId_module_key";

-- El código de revisión pasa a un índice único parcial que excluye a las
-- abortadas (B12), y el circuito a uno que admite varios por revisión (B2).
DROP INDEX "document_revisions_documentId_revisionCode_key";
DROP INDEX "review_workflows_revisionId_key";

-- ---------------------------------------------------------------------------
-- 4. Columnas
-- ---------------------------------------------------------------------------

-- El armado se designa al crear la revisión y es obligatorio (B3); el abandono
-- lleva su motivo en el modelo y no en el meta de un evento (B11, H-05).
ALTER TABLE "document_revisions" ADD COLUMN     "assignedOrganizerId" INTEGER NOT NULL,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" INTEGER;

-- Bajo D-03 toda revisión tiene circuito: el atributo pasa a distinguir el
-- formal del mínimo (B1). Se renombra para conservar los valores ya cargados.
ALTER TABLE "document_types" RENAME COLUMN "requiresWorkflow" TO "requiresFormalReview";

-- El checksum es obligatorio en toda versión (B4, H-27).
ALTER TABLE "document_versions" ALTER COLUMN "checksum" SET NOT NULL;

-- Quién resolvió efectivamente el paso, con el motivo cuando no es el asignado
-- (B9). El signatureHash se traslada a doc_step_signatures (B7): un hash sin
-- sus insumos no es verificable (H-06).
ALTER TABLE "review_steps" DROP COLUMN "signatureHash",
ADD COLUMN     "delegationReason" TEXT,
ADD COLUMN     "resolvedById" INTEGER;

-- La cancelación del circuito adopta identidad propia (B11) y el circuito
-- referencia la plantilla de la que se propuso (B3).
ALTER TABLE "review_workflows" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" INTEGER,
ADD COLUMN     "templateId" INTEGER;

-- El esquema de revisión y el armador por defecto del proyecto (B3, B13).
ALTER TABLE "doc_project_settings" ADD COLUMN     "defaultOrganizerId" INTEGER,
ADD COLUMN     "revisionScheme" "RevisionScheme";

-- ---------------------------------------------------------------------------
-- 5. Entidades nuevas
-- ---------------------------------------------------------------------------

-- La firma como objeto propio, con su payload canónico persistido (B7, D-05).
CREATE TABLE "doc_step_signatures" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "stepId" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'SHA-256',
    "payload" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "doc_step_signatures_pkey" PRIMARY KEY ("id")
);

-- Configuración del despliegue como registro único (B13, patrón CatalogSettings).
CREATE TABLE "doc_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "revisionScheme" "RevisionScheme" NOT NULL DEFAULT 'ALPHA',

    CONSTRAINT "doc_settings_pkey" PRIMARY KEY ("id")
);

-- La plantilla del circuito y sus pasos (B3).
CREATE TABLE "doc_workflow_templates" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "updatedById" INTEGER NOT NULL DEFAULT 1,
    "terminatedAt" TIMESTAMP(3),
    "isSys" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" INTEGER,
    "documentClassId" INTEGER,
    "documentTypeId" INTEGER,

    CONSTRAINT "doc_workflow_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_workflow_template_steps" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateId" INTEGER NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepType" "StepType" NOT NULL,
    "assignedToId" INTEGER,

    CONSTRAINT "doc_workflow_template_steps_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- 6. Índices
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "doc_step_signatures_stepId_key" ON "doc_step_signatures"("stepId");

CREATE INDEX "doc_workflow_templates_projectId_idx" ON "doc_workflow_templates"("projectId");
CREATE INDEX "doc_workflow_templates_documentClassId_idx" ON "doc_workflow_templates"("documentClassId");
CREATE INDEX "doc_workflow_templates_documentTypeId_idx" ON "doc_workflow_templates"("documentTypeId");

CREATE UNIQUE INDEX "doc_workflow_template_steps_templateId_stepOrder_key" ON "doc_workflow_template_steps"("templateId", "stepOrder");

CREATE INDEX "document_revisions_documentId_idx" ON "document_revisions"("documentId");
CREATE INDEX "review_steps_assignedToId_idx" ON "review_steps"("assignedToId");
CREATE INDEX "review_workflows_revisionId_idx" ON "review_workflows"("revisionId");
CREATE INDEX "review_workflows_templateId_idx" ON "review_workflows"("templateId");


-- Índices que Prisma NO expresa y por eso se declaran acá, con el mismo
-- tratamiento que B2 de BLOQUE 02 dio a los de `documents`.

-- Unicidad de los catálogos con NULLS NOT DISTINCT (B15). Cierra H-19: sin la
-- cláusula, dos entradas sin módulo —o sin clase— no se consideraban duplicadas,
-- que es el caso más frecuente en un catálogo recién sembrado.
CREATE UNIQUE INDEX "document_classes_name_module_key"
    ON "document_classes"("name", "module") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "document_classes_code_module_key"
    ON "document_classes"("code", "module") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "document_types_name_classId_module_key"
    ON "document_types"("name", "classId", "module") NULLS NOT DISTINCT;

CREATE UNIQUE INDEX "document_types_code_classId_module_key"
    ON "document_types"("code", "classId", "module") NULLS NOT DISTINCT;

-- Unicidad del alcance de la plantilla, con la misma cláusula (B3): una única
-- regla con refinamientos opcionales por clase y por tipo.
CREATE UNIQUE INDEX "doc_workflow_templates_scope_key"
    ON "doc_workflow_templates"("projectId", "documentClassId", "documentTypeId") NULLS NOT DISTINCT;

-- Un solo circuito abierto por revisión (B2). Reemplaza al @unique de
-- revisionId, que admitía un solo circuito por revisión y dejaba al documento
-- rechazado sin salida (H-01). Bajo B1 describe el estado normal y no un tope:
-- toda revisión viva tiene exactamente un circuito abierto.
CREATE UNIQUE INDEX "review_workflows_open_revision_key"
    ON "review_workflows"("revisionId")
    WHERE "status" = 'IN_PROGRESS';

-- El código de revisión es único entre las NO abortadas (B12). La revisión
-- abandonada no consume código: sobre A puede abrirse B, abortarse y volver a
-- abrirse B. Un documento puede tener varias abortadas con el mismo código.
CREATE UNIQUE INDEX "document_revisions_code_key"
    ON "document_revisions"("documentId", "revisionCode")
    WHERE "status" <> 'CANCELLED';

-- ---------------------------------------------------------------------------
-- 7. Claves foráneas
-- ---------------------------------------------------------------------------

ALTER TABLE "review_workflows" ADD CONSTRAINT "review_workflows_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "doc_workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "doc_step_signatures" ADD CONSTRAINT "doc_step_signatures_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "review_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "doc_workflow_templates" ADD CONSTRAINT "doc_workflow_templates_documentClassId_fkey" FOREIGN KEY ("documentClassId") REFERENCES "document_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "doc_workflow_templates" ADD CONSTRAINT "doc_workflow_templates_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "doc_workflow_template_steps" ADD CONSTRAINT "doc_workflow_template_steps_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "doc_workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
