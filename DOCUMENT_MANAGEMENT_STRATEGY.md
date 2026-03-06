# Estrategia de Gestión de Documentos

> Documento de referencia para la implementación del sistema de gestión documental
> con trazabilidad ISO 9001, workflows de revisión y transmittals de ingeniería.
>
> Fecha: 10 de febrero de 2026
> Actualizado: 6 de marzo de 2026

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Subgraph Document (Apollo Federation)](#3-subgraph-document-apollo-federation)
4. [FileServer API](#4-fileserver-api)
5. [Digital Ocean Spaces - Estructura de Storage](#5-digital-ocean-spaces---estructura-de-storage)
6. [Modelo de Datos](#6-modelo-de-datos)
7. [Schema GraphQL del Subgraph Document](#7-schema-graphql-del-subgraph-document)
8. [Integración con Federation (Subgraphs existentes)](#8-integración-con-federation-subgraphs-existentes)
9. [Integración con Next.js (Frontend)](#9-integración-con-nextjs-frontend)
10. [Flujo de Upload/Download con Presigned URLs](#10-flujo-de-uploaddownload-con-presigned-urls)
11. [Workflow de Revisión ISO 9001](#11-workflow-de-revisión-iso-9001)
12. [Transmittals de Ingeniería](#12-transmittals-de-ingeniería)
13. [Páginas a Migrar en el Frontend](#13-páginas-a-migrar-en-el-frontend)
14. [Plan de Implementación por Fases](#14-plan-de-implementación-por-fases)
15. [Variables de Entorno Requeridas](#15-variables-de-entorno-requeridas)
16. [Decisiones Arquitecturales](#16-decisiones-arquitecturales)

---

## 1. Visión General

### Problema

Actualmente los documentos están gestionados externamente (M-Files) con links hardcodeados
en las páginas de quality/documents y tags/documents. No hay trazabilidad integrada
de revisiones, aprobaciones ni un workflow de control documental ISO 9001.

### Solución

Un sistema centralizado de gestión documental compuesto por:

- **Subgraph `document`**: Nuevo subgraph en Apollo Federation para centralizar
  toda la metadata de documentos, revisiones, versiones, workflows y transmittals.
- **FileServer API**: Servicio dedicado (REST) que gestiona la comunicación con
  Digital Ocean Spaces para upload/download de archivos físicos.
- **Presigned URLs**: Los archivos viajan directamente del browser al storage
  (y viceversa), sin pasar por los servidores intermedios.

### Principio Clave

> **Separar metadata de archivos físicos.**
> La metadata (nombre, versión, revisión, estado, workflow, permisos) vive en el
> subgraph `document`. Los archivos físicos viven en DO Spaces, accedidos a través
> del FileServer API.

---

## 2. Arquitectura del Sistema

### Diagrama General

```
┌──────────────┐
│   Browser    │
│  (Next.js)   │
└──────┬───────┘
       │
       │  1. Server Actions / API Routes
       ▼
┌──────────────────┐
│  Next.js Backend │
│  (Server Actions │
│   + API Routes)  │
└───────┬──────────┘
        │
   ┌────┴────────────────────────────────────────────────┐
   │              │            │           │              │
   ▼              ▼            ▼           ▼              ▼
┌───────┐   ┌──────────┐  ┌────────┐  ┌───────┐   ┌───────────┐
│ admin │   │ projects │  │quality │  │ tags  │   │ document  │ ← NUEVO
│subgraph│  │ subgraph │  │subgraph│  │subgraph│  │ subgraph  │
└───────┘   └──────────┘  └────────┘  └───────┘   └─────┬─────┘
                                                         │
                                                         │  2. REST API
                                                         ▼
                                                  ┌────────────┐
                                                  │ FileServer │
                                                  │    API     │
                                                  └──────┬─────┘
                                                         │
                                                         │  3. S3 SDK
                                                         ▼
                                                  ┌────────────┐
                                                  │ DO Spaces  │
                                                  │ (S3 compat)│
                                                  └────────────┘

  NOTA: Upload/Download de archivos van directo:
  Browser ←──── presigned URL ────→ DO Spaces
```

### Flujo de Datos

| Componente         | Responsabilidad                                          |
| ------------------ | -------------------------------------------------------- |
| **Next.js**        | Orquestra: valida, pide presigned URL, guarda metadata   |
| **Subgraph doc**   | Metadata: documentos, revisiones, versiones, workflows   |
| **FileServer API** | Archivos: genera presigned URLs, gestiona keys en Spaces |
| **DO Spaces**      | Storage: almacena archivos físicos                       |

---

## 3. Subgraph Document (Apollo Federation)

### Justificación: Subgraph Centralizado vs. Documentos por Módulo

| Aspecto                  | Subgraph centralizado          | Documentos en cada subgraph      |
| ------------------------ | ------------------------------ | -------------------------------- |
| **DRY**                  | ✅ Una sola implementación     | ❌ Repetir lógica en 5 subgraphs |
| **Consistencia**         | ✅ Mismo modelo revisión/ver.  | ❌ Riesgo de divergencia         |
| **Workflow ISO 9001**    | ✅ Un solo motor de workflow   | ❌ Replicar en cada módulo       |
| **Transmittals**         | ✅ Consulta cross-module fácil | ❌ Joins complicados             |
| **FileServer**           | ✅ Un punto de integración     | ❌ Cada subgraph habla con FS    |
| **Migración gradual**    | ✅ Migrar módulos uno a uno    | ❌ Todo o nada por módulo        |
| **Queries cross-module** | ⚠️ Requiere entidades externas | ✅ Datos locales                 |

### Vínculo con otros Subgraphs: `moduleRef`

El subgraph `document` NO conoce los tipos `Finding`, `Project`, `Equipment`, etc.
Solo guarda una referencia genérica:

```typescript
moduleRef: {
  module: "QUALITY",         // Módulo de la webapp
  entityType: "finding",     // Tipo de entidad dentro del módulo
  entityId: 42               // ID de la entidad en el otro subgraph
}
```

Esto permite que el subgraph `document` sea 100% independiente de los demás.

---

## 4. FileServer API

### Tecnología sugerida

- **Runtime**: Node.js (Fastify o Express)
- **SDK**: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (compatible con DO Spaces)
- **Auth**: Bearer Token (API Key compartida con Next.js backend)
- **Deploy**: Docker en el mismo servidor o servicio separado

### Endpoints

```
POST   /api/files/presign-upload     → Genera presigned PUT URL
POST   /api/files/presign-download   → Genera presigned GET URL
DELETE /api/files                    → Elimina archivo del storage
POST   /api/files/copy               → Copia archivo (útil para versionado)
GET    /api/files/info               → Info del archivo (existe, tamaño, etc.)
GET    /api/health                   → Health check
```

### POST /api/files/presign-upload

**Request:**

```json
{
  "module": "quality",
  "path": "findings-evidence",
  "fileName": "foto-hallazgo.jpg",
  "contentType": "image/jpeg",
  "maxSize": 5242880
}
```

**Response:**

```json
{
  "uploadUrl": "https://bucket.nyc3.digitaloceanspaces.com/quality/findings-evidence/abc123-foto-hallazgo.jpg?X-Amz-...",
  "fileKey": "quality/findings-evidence/abc123-foto-hallazgo.jpg",
  "expiresAt": "2026-02-10T15:30:00Z"
}
```

**Lógica interna:**

1. Validar `module` y `contentType` contra whitelist.
2. Generar `fileKey` = `{module}/{path}/{uuid}-{fileName}`.
3. Crear presigned PUT URL con expiración (ej: 15 min).
4. Devolver URL y key.

### POST /api/files/presign-download

**Request:**

```json
{
  "fileKey": "quality/findings-evidence/abc123-foto-hallazgo.jpg"
}
```

**Response:**

```json
{
  "downloadUrl": "https://bucket.nyc3.digitaloceanspaces.com/quality/findings-evidence/abc123-foto-hallazgo.jpg?X-Amz-...",
  "expiresAt": "2026-02-10T15:30:00Z"
}
```

### DELETE /api/files

**Request:**

```json
{
  "fileKey": "quality/findings-evidence/abc123-foto-hallazgo.jpg"
}
```

### POST /api/files/copy

**Request:**

```json
{
  "sourceKey": "quality/procedures/rev-a/proc-001.pdf",
  "destinationKey": "quality/procedures/rev-b/proc-001.pdf"
}
```

### Seguridad del FileServer

- Comunicación solo desde Next.js backend (no expuesto al browser).
- Auth via `Authorization: Bearer <FILESERVER_API_TOKEN>`.
- Validación de tipos MIME permitidos.
- Validación de tamaño máximo por tipo.
- Rate limiting.
- Logs de acceso.

---

## 5. Digital Ocean Spaces - Estructura de Storage

### Un solo Bucket con prefijos por módulo

> **NO usar un bucket por módulo.** DO Spaces cobra por bucket y tiene límite de
> buckets por cuenta. Los prefijos (keys) dan la misma separación lógica con mejor
> gestión y menor costo.

```
mi-app-documents/                       ← Bucket único
│
├── quality/                            ← Prefijo módulo Quality
│   ├── procedures/                     ← Procedimientos SGC
│   ├── work-instructions/              ← Instrucciones de trabajo
│   ├── audit-reports/                  ← Informes de auditoría
│   ├── findings-evidence/              ← Evidencias de hallazgos
│   ├── corrective-actions/             ← Acciones correctivas
│   ├── management-review/              ← Revisión por la dirección
│   └── certifications/                 ← Certificados
│
├── projects/                           ← Prefijo módulo Projects
│   ├── engineering/                    ← Documentos de ingeniería
│   │   ├── drawings/                   ← Planos
│   │   ├── specifications/             ← Especificaciones técnicas
│   │   ├── calculations/               ← Memorias de cálculo
│   │   └── datasheets/                 ← Hojas de datos
│   ├── transmittals/                   ← Archivos asociados a transmittals
│   ├── progress-reports/               ← Informes de avance
│   └── plans/                          ← Planes de proyecto
│
├── tags/                               ← Prefijo módulo Tags
│   ├── technical-docs/                 ← Documentación técnica
│   ├── maintenance/                    ← Manuales de mantenimiento
│   └── datasheets/                     ← Hojas de datos de equipos
│
├── operations/                         ← Prefijo módulo Operations
│   ├── daily-reports/                  ← Informes diarios
│   ├── procedures/                     ← Procedimientos operativos
│   └── permits/                        ← Permisos de trabajo
│
├── management/                         ← Prefijo módulo Management
│   ├── invoices/                       ← Facturas
│   ├── contracts/                      ← Contratos
│   └── certifications/                 ← Certificaciones de empresa
│
└── comercial/                          ← Prefijo módulo Comercial
    ├── proposals/                      ← Propuestas comerciales
    └── contracts/                      ← Contratos comerciales
```

### Convención de nombres de archivos (fileKey)

```
{module}/{path}/{uuid}-{originalFileName}

Ejemplo:
quality/procedures/a1b2c3d4-PR-001-Procedimiento-de-Auditorias.pdf
projects/engineering/drawings/e5f6g7h8-PL-100-Planta-General.dwg
```

- El UUID previene colisiones de nombres.
- Se preserva el nombre original para legibilidad.
- La estructura de prefijos permite listar por módulo/tipo fácilmente.

### Configuración del Bucket

```
Bucket name:  mi-app-documents
Region:       nyc3 (o la más cercana al servidor)
CDN:          Habilitado (para descargas rápidas)
CORS:         Configurado para permitir PUT desde el dominio de la app
Permissions:  Private (todo acceso via presigned URLs)
```

### CORS del Bucket (requerido para upload desde browser)

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["https://mi-webapp.com", "http://localhost:3000"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 6. Modelo de Datos

### Diagrama ER

```
┌──────────────────┐       ┌──────────────────┐
│ document_classes │       │  document_types   │
│──────────────────│       │──────────────────│
│ id               │◄──┐   │ id               │
│ name             │   │   │ name             │
│ code             │   │   │ code             │
│ module           │   ├───│ class_id         │
│ description      │   │   │ module           │
│ sort_order       │   │   │ description      │
│ terminated_at    │   │   │ requires_workflow│
│ is_sys           │   │   │ terminated_at    │
└──────┬───────────┘   │   │ is_sys           │
       │               │   └────────┬─────────┘
       │               │            │
       ▼               │            ▼
┌─────────────────────────────────────────────┐
│                  documents                   │
│─────────────────────────────────────────────│
│ id                                           │
│ code                  title                  │
│ description           module                 │
│ entity_type           entity_id              │
│ document_type_id ──────────────────────────▶ │ document_types.id
│ document_class_id ─────────────────────────▶ │ document_classes.id
│ revision_scheme (ALPHABETICAL | NUMERIC)     │
│ created_by_id         created_at             │
│ updated_by_id         terminated_at          │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│            document_revisions                │
│──────────────────────────────────────────────│
│ id               document_id                 │
│ revision_code    status (DRAFT|IN_REVIEW|    │
│                    APPROVED|SUPERSEDED|       │
│                    OBSOLETE)                  │
│ approved_by_id   approved_at                 │
│ created_by_id    created_at                  │
└──────┬──────────────────┬────────────────────┘
       │                  │
       ▼                  ▼
┌──────────────────┐   ┌──────────────────────┐
│document_versions │   │  review_workflows    │
│──────────────────│   │──────────────────────│
│ id               │   │ id                   │
│ revision_id      │   │ revision_id (unique) │
│ version_number   │   │ status               │
│ file_key         │   │ initiated_by_id      │
│ file_name        │   │ initiated_at         │
│ file_size        │   │ completed_at         │
│ mime_type        │   └──────────┬───────────┘
│ checksum         │              │
│ comment          │              ▼
│ created_by_id    │   ┌──────────────────────┐
└──────────────────┘   │   review_steps       │
                       │──────────────────────│
                       │ id                   │
                       │ workflow_id          │
                       │ step_order           │
                       │ step_type            │
                       │ assigned_to_id       │
                       │ status               │
                       │ comments             │
                       │ completed_at         │
                       │ signature_hash       │
                       └──────────────────────┘

┌──────────────────────┐      ┌──────────────────────┐
│    transmittals      │      │  transmittal_items   │
│──────────────────────│      │──────────────────────│
│ id                   │◄─────│ transmittal_id       │
│ code (unique)        │      │ id                   │
│ project_id           │      │ document_revision_id │
│ status               │      │ purpose_code         │
│ issued_to            │      │ client_status        │
│ issued_by_id         │      │ client_comments      │
│ issued_at            │      └──────────────────────┘
│ response_at          │
│ response_comments    │
└──────────────────────┘

┌──────────────────────────────────────────────┐
│              attachments                      │
│──────────────────────────────────────────────│
│ id                                            │
│ module           entity_type     entity_id    │
│ file_key         file_name       file_size    │
│ mime_type        description                  │
│ created_by_id    created_at                   │
│                                               │
│ @@index([module, entity_type, entity_id])     │
└──────────────────────────────────────────────┘

                  ┌──────────────┐
                  │    areas     │
                  │──────────────│
                  │ id           │
                  │ name         │
                  │ code         │
                  │ project_id   │
                  │ description  │
                  │ sort_order   │
                  │ terminated   │
                  └──────┬───────┘
                         │
┌────────────────────────┼─────────────────────┐
│             scanned_files                     │
│──────────────────────────────────────────────│
│ id                                            │
│ code (unique per project)                     │
│ project_id           title                    │
│ description          original_reference       │
│ physical_location    file_key                 │
│ file_name            file_size    mime_type    │
│ document_type_id ──▶ document_types.id        │
│ document_class_id ─▶ document_classes.id      │
│ area_id ────────────▶ areas.id                │
│ digital_disposition (PENDING|ACCEPTED|        │
│                      UPLOADED|DISCARDED)      │
│ physical_disposition (PENDING|DESTROY|        │
│                      DESTROYED|ARCHIVE|       │
│                      ARCHIVED)                │
│ external_reference   classification_notes     │
│ discard_reason       classified_by_id         │
│ classified_at        physical_confirmed_by_id │
│ physical_confirmed_at terminated_at           │
│ created_by_id        created_at               │
└──────────────────────────────────────────────┘

┌───────────────────────┐    ┌─────────────────────────────┐
│  document_sys_logs    │    │ document_sys_logs_archive    │
│───────────────────────│    │─────────────────────────────│
│ id                    │    │ id                           │
│ user_id               │    │ user_id                      │
│ level (INFO|WARN|ERR) │    │ level                        │
│ name                  │    │ name                         │
│ message               │    │ message                      │
│ meta                  │    │ meta                         │
│ created_at            │    │ created_at                   │
└───────────────────────┘    └─────────────────────────────┘
```

### Jerarquía: Document → Revision → Version

#### Esquemas de revisión (`revisionScheme`)

Cada documento define su esquema de revisión al crearse. El sistema soporta dos esquemas:

| Esquema        | Secuencia                    | Uso típico                       |
| -------------- | ---------------------------- | -------------------------------- |
| `ALPHABETICAL` | A, B, C, ..., Z, AA, AB, ... | Documentos de ingeniería/calidad |
| `NUMERIC`      | 0, 1, 2, 3, ...              | Procedimientos, informes         |

El esquema se puede cambiar con la mutación `switchRevisionScheme` (solo si no hay revisiones aprobadas).

#### Ejemplo con esquema ALPHABETICAL

```
Document (PR-001 "Procedimiento de Auditorías", scheme: ALPHABETICAL)
│
├── Revision A (SUPERSEDED)
│   ├── Version 1 — PR-001-RevA-v1.pdf (borrador inicial)
│   ├── Version 2 — PR-001-RevA-v2.pdf (correcciones del revisor)
│   └── Version 3 — PR-001-RevA-v3.pdf (versión aprobada ✅)
│
├── Revision B (APPROVED) ← Revisión vigente
│   ├── Version 1 — PR-001-RevB-v1.pdf (borrador)
│   └── Version 2 — PR-001-RevB-v2.pdf (versión aprobada ✅)
│
└── Revision C (DRAFT) ← En desarrollo
    └── Version 1 — PR-001-RevC-v1.pdf (borrador en curso)
```

#### Ejemplo con esquema NUMERIC

```
Document (INF-042 "Informe de Avance", scheme: NUMERIC)
│
├── Revision 0 (SUPERSEDED)
│   └── Version 1 — INF-042-Rev0-v1.pdf
│
├── Revision 1 (APPROVED) ← Revisión vigente
│   └── Version 1 — INF-042-Rev1-v1.pdf
│
└── Revision 2 (DRAFT)
    └── Version 1 — INF-042-Rev2-v1.pdf
```

- **Document**: Entidad maestra, inmutable conceptualmente. Define el `revisionScheme`
  (ALPHABETICAL o NUMERIC) y opcionalmente una `DocumentClass` como clasificación.
- **Revision**: Ciclo de vida completo (draft → review → approved → superseded).
  Se crea nueva revisión cuando hay cambios significativos al documento aprobado.
  El código de revisión se auto-genera según el `revisionScheme` del documento.
- **Version**: Iteraciones de archivo dentro de una revisión. Cada vez que se sube
  un archivo nuevo durante el proceso de draft/review, se crea una nueva versión.

### Modelos complementarios

- **Attachment**: Adjuntos simples (evidencias, fotos, archivos de soporte) asociados
  a cualquier entidad de cualquier módulo. Sin workflow ni revisiones. Vinculados por
  `module` + `entityType` + `entityId`.
- **ScannedFile**: Archivos digitalizados (papel escaneado) pendientes de clasificación.
  Cada uno tiene un `code` único dentro del proyecto (ej: "SC-001").
  Contienen un flujo de disposición digital (`PENDING → ACCEPTED → UPLOADED` o
  `PENDING → DISCARDED`) y física (`PENDING → DESTROY → DESTROYED` o
  `PENDING → ARCHIVE → ARCHIVED`). Vinculados a un proyecto, y opcionalmente a
  `DocumentType`, `DocumentClass` y `Area`.
- **Area**: Áreas físicas o ubicaciones en planta (ej: "01 - Urea"). Pertenecen a
  un proyecto y se usan para catalogar la ubicación de donde provino el papel original.

---

## 7. Schema GraphQL del Subgraph Document

> **Nota**: El schema completo y actualizado se encuentra en el archivo `schema.graphql`
> en la raíz del proyecto. Esta sección documenta los aspectos más relevantes de diseño.

### Entidades principales

| Tipo                    | Descripción                                                   | Prisma model                |
| ----------------------- | ------------------------------------------------------------- | --------------------------- |
| `DocumentClass`         | Clasificación de nivel 1 (Especialidad, Categoría)            | `document_classes`          |
| `DocumentType`          | Tipo de documento (Procedimiento, Plano, Informe)             | `document_types`            |
| `Document`              | Documento maestro con `revisionScheme` (ALPHABETICAL/NUMERIC) | `documents`                 |
| `DocumentRevision`      | Revisión de un documento (A, B, C... o 0, 1, 2...)            | `document_revisions`        |
| `DocumentVersion`       | Versión de archivo dentro de una revisión                     | `document_versions`         |
| `ReviewWorkflow`        | Workflow de revisión ISO 9001 (1:1 con revisión)              | `review_workflows`          |
| `ReviewStep`            | Paso individual del workflow                                  | `review_steps`              |
| `Transmittal`           | Transmittal de ingeniería                                     | `transmittals`              |
| `TransmittalItem`       | Item de un transmittal (referencia a revisión)                | `transmittal_items`         |
| `Attachment`            | Adjunto simple (sin workflow ni revisiones)                   | `attachments`               |
| `ScannedFile`           | Archivo digitalizado pendiente de clasificación               | `scanned_files`             |
| `Area`                  | Área física o ubicación en planta                             | `areas`                     |
| `DocumentSysLog`        | Log operacional del sistema                                   | `document_sys_logs`         |
| `DocumentSysLogArchive` | Log archivado del sistema                                     | `document_sys_logs_archive` |

### Enums relevantes

| Enum                  | Valores                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `ModuleType`          | QUALITY, PROJECTS, TAGS, OPERATIONS, MANAGEMENT, COMERCIAL            |
| `RevisionScheme`      | ALPHABETICAL, NUMERIC                                                 |
| `RevisionStatus`      | DRAFT, IN_REVIEW, APPROVED, SUPERSEDED, OBSOLETE                      |
| `WorkflowStatus`      | PENDING, IN_PROGRESS, COMPLETED, REJECTED                             |
| `StepType`            | REVIEW, APPROVE, ACKNOWLEDGE                                          |
| `StepStatus`          | PENDING, APPROVED, REJECTED, SKIPPED                                  |
| `TransmittalStatus`   | DRAFT, ISSUED, ACKNOWLEDGED, RESPONDED, CLOSED                        |
| `PurposeCode`         | FOR_APPROVAL, FOR_INFORMATION, FOR_CONSTRUCTION, FOR_REVIEW, AS_BUILT |
| `ClientStatus`        | APPROVED, APPROVED_WITH_COMMENTS, REJECTED, REVIEWED_NO_EXCEPTION     |
| `DigitalDisposition`  | PENDING, ACCEPTED, UPLOADED, DISCARDED                                |
| `PhysicalDisposition` | PENDING, DESTROY, DESTROYED, ARCHIVE, ARCHIVED                        |
| `LogLevel`            | INFO, WARNING, ERROR                                                  |

### Queries implementadas

```graphql
type Query {
  # ─── Documentos ───
  documentById(id: Int!): Document
  documents(filter, pagination, orderBy): DocumentConnection!
  documentsByModule(module, entityType, entityId, pagination, orderBy): DocumentConnection!
  documentsSelectList(filter): [SelectList!]!

  # ─── Tipos de documento ───
  documentTypes(filter, pagination, orderBy): DocumentTypeConnection!
  documentTypeById(id: Int!): DocumentType
  documentTypesSelectList(module, classId): [SelectList!]!

  # ─── Clases de documento ───
  documentClasses(filter, pagination, orderBy): DocumentClassConnection!
  documentClassById(id: Int!): DocumentClass
  documentClassesSelectList(module): [SelectList!]!

  # ─── Áreas ───
  areas(filter, pagination, orderBy): AreaConnection!
  areaById(id: Int!): Area
  areasSelectList(projectId: Int!): [SelectList!]!

  # ─── Revisiones ───
  revisionById(id: Int!): DocumentRevision

  # ─── Transmittals ───
  transmittalById(id: Int!): Transmittal
  transmittals(filter, pagination, orderBy): TransmittalConnection!
  transmittalsByProject(projectId, pagination): TransmittalConnection!

  # ─── Workflows ───
  pendingReviewSteps(userId: Int!): [ReviewStep!]!
  workflowsByStatus(status): [ReviewWorkflow!]!

  # ─── Adjuntos ───
  attachmentById(id: Int!): Attachment
  attachmentsByModule(module, entityType, entityId, pagination): AttachmentConnection!

  # ─── Archivos escaneados ───
  scannedFileById(id: Int!): ScannedFile
  scannedFiles(filter, pagination, orderBy): ScannedFileConnection!
  scannedFileStats(projectId: Int!): ScannedFileStats!

  # ─── Logs ───
  documentSysLogById(id: Int!): DocumentSysLog
  documentSysLogs(filter, pagination, orderBy): DocumentSysLogConnection!
  documentSysLogArchiveById(id: Int!): DocumentSysLogArchive
  documentSysLogsArchive(filter, pagination, orderBy): DocumentSysLogArchiveConnection!
}
```

### Mutations implementadas

```graphql
type Mutation {
  # ─── Documentos ───
  createDocument(input: CreateDocumentInput!): Document!
  updateDocument(id, input): Document!
  terminateDocument(id): Document!
  activateDocument(id): Document!
  switchRevisionScheme(id, scheme): Document!

  # ─── Revisiones y Versiones ───
  createRevision(documentId, input): DocumentRevision!
  registerVersion(revisionId, input): DocumentVersion!

  # ─── Workflow de revisión ───
  initiateReview(revisionId, input): ReviewWorkflow!
  approveStep(stepId, comments): ReviewStep!
  rejectStep(stepId, comments!): ReviewStep!
  cancelWorkflow(workflowId, reason!): ReviewWorkflow!

  # ─── Transmittals ───
  createTransmittal(input): Transmittal!
  issueTransmittal(id): Transmittal!
  respondTransmittal(id, input): Transmittal!
  closeTransmittal(id): Transmittal!

  # ─── Tipos de documento ───
  createDocumentType(input): DocumentType!
  updateDocumentType(id, input): DocumentType!
  terminateDocumentType(id): DocumentType!
  activateDocumentType(id): DocumentType!

  # ─── Clases de documento ───
  createDocumentClass(input): DocumentClass!
  updateDocumentClass(id, input): DocumentClass!
  terminateDocumentClass(id): DocumentClass!
  activateDocumentClass(id): DocumentClass!

  # ─── Áreas ───
  createArea(input): Area!
  updateArea(id, input): Area!
  terminateArea(id): Area!
  activateArea(id): Area!

  # ─── Adjuntos ───
  createAttachment(input): Attachment!
  deleteAttachment(id): Boolean!

  # ─── Archivos escaneados ───
  createScannedFile(input): ScannedFile!
  classifyScannedFile(id, input): ScannedFile!
  markAsUploaded(id, input): ScannedFile!
  updatePhysicalDisposition(id, disposition): ScannedFile!
  confirmPhysicalDisposition(id): ScannedFile!
  terminateScannedFile(id): ScannedFile!
  activateScannedFile(id): ScannedFile!

  # ─── Logs ───
  archiveDocumentSysLogs(olderThanDays): Int!
  deleteArchivedDocumentSysLogs(olderThanDays): Int!
}
```

### Paginación

Todas las queries de listado usan `PaginationInput` (`skip`/`take`) y devuelven
un `*Connection` con `items` y `pagination: PaginationInfo` (currentPage, totalPages,
totalItems, hasNext, hasPrev).

### Flujos de ScannedFiles (Digitalización)

```
Subida                    Clasificación                Cierre digital
──────────                ─────────────                ──────────────
createScannedFile ──▶  classifyScannedFile         markAsUploaded
(PENDING)              ├── ACCEPTED (con tipo/clase)  (ACCEPTED → UPLOADED)
                       └── DISCARDED (con motivo)

Disposición física
──────────────────
updatePhysicalDisposition ──▶ confirmPhysicalDisposition
├── DESTROY ──────────────▶ DESTROYED
└── ARCHIVE ──────────────▶ ARCHIVED
```

---

## 8. Integración con Federation (Subgraphs existentes)

### En el subgraph `quality`

```graphql
# Extiende Document como entidad externa (solo necesita el ID)
extend type Document @key(fields: "id") {
  id: Int! @external
}

# Los Findings NO tienen campo "documents" directo.
# Se consultan via documentsByModule(module: QUALITY, entityType: "finding", entityId: X)
# desde el Gateway.
```

### En el subgraph `projects`

```graphql
extend type Document @key(fields: "id") {
  id: Int! @external
}

extend type Transmittal @key(fields: "id") {
  id: Int! @external
}

# El Project puede exponer transmittals via Federation
extend type Project @key(fields: "id") {
  id: Int! @external
  # Resuelto por el subgraph document via transmittalsByProject
}
```

### En el subgraph `tags`

```graphql
extend type Document @key(fields: "id") {
  id: Int! @external
}
```

### Query unificada desde el Gateway

```graphql
# El Apollo Gateway combina datos de múltiples subgraphs automáticamente
query GetFindingWithDocuments($findingId: Int!) {
  # Resuelto por subgraph quality
  findingById(id: $findingId) {
    id
    name
    status
  }

  # Resuelto por subgraph document
  documentsByModule(
    module: QUALITY
    entityType: "finding"
    entityId: $findingId
  ) {
    items {
      id
      code
      title
      currentRevision {
        revisionCode
        status
        currentVersion {
          fileName
          fileKey
        }
        workflow {
          status
          steps {
            assignedTo {
              id # Resuelto por subgraph admin (Federation)
            }
            status
          }
        }
      }
    }
  }
}
```

---

## 9. Integración con Next.js (Frontend)

### Server Actions - Estructura de archivos

```
lib/actions/documents/
├── document-queries.ts          # getDocuments, getDocumentById, getDocumentsByModule
├── document-actions.ts          # createDocument, updateDocument, terminateDocument
├── revision-actions.ts          # createRevision, registerVersion
├── workflow-actions.ts          # initiateReview, approveStep, rejectStep
├── transmittal-queries.ts       # getTransmittals, getTransmittalById
├── transmittal-actions.ts       # createTransmittal, issueTransmittal, respondTransmittal
└── fileserver-client.ts         # getPresignedUploadUrl, getPresignedDownloadUrl, deleteFile
```

### FileServer Client (Server-side only)

```typescript
// lib/actions/documents/fileserver-client.ts
// IMPORTANTE: Este módulo solo se ejecuta en el servidor (server actions)

const FILESERVER_URL = process.env.FILESERVER_API_URL
const FILESERVER_TOKEN = process.env.FILESERVER_API_TOKEN

type PresignedUploadResponse = {
  uploadUrl: string
  fileKey: string
  expiresAt: string
}

type PresignedDownloadResponse = {
  downloadUrl: string
  expiresAt: string
}

export async function getPresignedUploadUrl(params: {
  module: string
  path: string
  fileName: string
  contentType: string
}): Promise<PresignedUploadResponse> {
  const response = await fetch(`${FILESERVER_URL}/api/files/presign-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FILESERVER_TOKEN}`,
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`FileServer error: ${response.statusText}`)
  }

  return response.json()
}

export async function getPresignedDownloadUrl(
  fileKey: string,
): Promise<PresignedDownloadResponse> {
  const response = await fetch(`${FILESERVER_URL}/api/files/presign-download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FILESERVER_TOKEN}`,
    },
    body: JSON.stringify({ fileKey }),
  })

  if (!response.ok) {
    throw new Error(`FileServer error: ${response.statusText}`)
  }

  return response.json()
}

export async function deleteFile(fileKey: string): Promise<void> {
  const response = await fetch(`${FILESERVER_URL}/api/files`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FILESERVER_TOKEN}`,
    },
    body: JSON.stringify({ fileKey }),
  })

  if (!response.ok) {
    throw new Error(`FileServer error: ${response.statusText}`)
  }
}
```

### Upload Hook (Client-side)

```typescript
// hooks/use-document-upload.ts

import { useState, useCallback } from "react"

type UploadState = {
  progress: number
  isUploading: boolean
  error: string | null
}

export function useDocumentUpload() {
  const [state, setState] = useState<UploadState>({
    progress: 0,
    isUploading: false,
    error: null,
  })

  const uploadToPresignedUrl = useCallback(
    async (file: File, uploadUrl: string): Promise<boolean> => {
      setState({ progress: 0, isUploading: true, error: null })

      try {
        const xhr = new XMLHttpRequest()

        const uploadPromise = new Promise<boolean>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100)
              setState((prev) => ({ ...prev, progress }))
            }
          })

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setState({ progress: 100, isUploading: false, error: null })
              resolve(true)
            } else {
              reject(new Error(`Upload failed: ${xhr.statusText}`))
            }
          })

          xhr.addEventListener("error", () =>
            reject(new Error("Upload failed")),
          )
        })

        xhr.open("PUT", uploadUrl)
        xhr.setRequestHeader("Content-Type", file.type)
        xhr.send(file)

        return await uploadPromise
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error al subir archivo"
        setState({ progress: 0, isUploading: false, error: message })
        return false
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setState({ progress: 0, isUploading: false, error: null })
  }, [])

  return { ...state, uploadToPresignedUrl, reset }
}
```

### Server Action de ejemplo: Crear Documento

```typescript
// lib/actions/documents/document-actions.ts
"use server"

import { getClient } from "@/lib/apollo/client"
import { verifiedAuthorization } from "../admin/authorization-queries"
import { ActionsFormState } from "@/lib/types"
import { convertZodErrors } from "@/lib/utils/convertZodErrors"
import { revalidatePath } from "next/cache"
import { handleError } from "@/lib/utils/errorManagement/errorHandler"
import { createLogger } from "@/lib/utils/errorManagement/logger"
import { getPresignedUploadUrl } from "./fileserver-client"

export async function createDocument(
  input: unknown,
): Promise<ActionsFormState & { uploadUrl?: string; fileKey?: string }> {
  const actionName = "createDocument"
  const logger = createLogger(actionName)

  try {
    logger.info("Creando nuevo documento")

    // 1. Autorización
    const { hasPermission } =
      await verifiedAuthorization(/* permiso dinámico */)
    if (!hasPermission) {
      return { errorMessage: "No tienes permisos para crear documentos" }
    }

    // 2. Validar input con Zod schema

    // 3. Obtener presigned URL del FileServer
    const { uploadUrl, fileKey } = await getPresignedUploadUrl({
      module: validatedInput.module.toLowerCase(),
      path: validatedInput.entityType || "general",
      fileName: validatedInput.fileName,
      contentType: validatedInput.contentType,
    })

    // 4. Guardar metadata en GraphQL (subgraph document)
    const client = await getClient()
    await client.mutate({
      mutation: CreateDocumentMutation,
      variables: {
        input: {
          ...metadata,
          fileKey,
          fileName: validatedInput.fileName,
          fileSize: validatedInput.fileSize,
          mimeType: validatedInput.contentType,
        },
      },
    })

    // 5. Revalidar path
    revalidatePath(`/${validatedInput.module.toLowerCase()}/documents`)

    // 6. Devolver presigned URL al browser para upload directo
    return { successMsg: "Documento creado", uploadUrl, fileKey }
  } catch (error: unknown) {
    const { userMessage } = handleError(error, actionName)
    return { errorMessage: userMessage }
  }
}
```

---

## 10. Flujo de Upload/Download con Presigned URLs

### Upload (Crear documento con archivo)

```
Paso 1: Browser envía metadata del archivo al Server Action
        (nombre, tipo, tamaño, módulo, entityType, entityId)
        ↓
Paso 2: Server Action → FileServer API
        POST /api/files/presign-upload
        { module, path, fileName, contentType }
        ↓
Paso 3: FileServer → DO Spaces SDK
        Genera presigned PUT URL (expira en 15 min)
        ↓
Paso 4: Server Action → GraphQL (subgraph document)
        Mutation createDocument con metadata + fileKey
        ↓
Paso 5: Server Action → Browser
        Devuelve { successMsg, uploadUrl, fileKey }
        ↓
Paso 6: Browser → DO Spaces (DIRECTO, sin pasar por servidores)
        PUT uploadUrl con el archivo binario
        Hook useDocumentUpload muestra progreso
        ↓
Paso 7: Browser → Server Action (confirmación)
        Confirma upload exitoso (opcional: enviar checksum)
```

### Download (Descargar archivo)

```
Paso 1: Browser solicita descarga al Server Action
        { documentId, versionId }
        ↓
Paso 2: Server Action verifica permisos (authorization)
        ↓
Paso 3: Server Action → GraphQL (subgraph document)
        Query: obtiene fileKey de la versión solicitada
        ↓
Paso 4: Server Action → FileServer API
        POST /api/files/presign-download
        { fileKey }
        ↓
Paso 5: Server Action → Browser
        Devuelve { downloadUrl }
        ↓
Paso 6: Browser → DO Spaces (DIRECTO)
        GET downloadUrl para descargar el archivo
```

### Ventajas del patrón Presigned URLs

- **No hay doble transferencia**: El archivo NO pasa por Next.js ni por FileServer.
- **Progreso real**: El browser sube directo a S3, con eventos de progreso nativos.
- **Escalabilidad**: Los servidores no se saturan con transferencias de archivos grandes.
- **Timeout safe**: No hay riesgo de timeout en serverless/server actions.
- **Seguridad**: Las URLs expiran, y solo se generan tras verificar permisos.

---

## 11. Workflow de Revisión ISO 9001

### Diagrama de Estados

```
                  ┌────────────┐
         Crear    │            │    Subir nueva
      ──────────▶ │   DRAFT    │ ◄───versión──────┐
                  │            │                   │
                  └─────┬──────┘                   │
                        │                          │
                Iniciar │ review                   │
                        ▼                          │
                  ┌────────────┐                   │
                  │            │                   │
                  │ IN_REVIEW  │───── Rechazado ───┘
                  │            │
                  └─────┬──────┘
                        │
                 Todos  │ los steps
                aprobados│
                        ▼
                  ┌────────────┐       Nueva        ┌────────────┐
                  │            │     revisión        │            │
                  │  APPROVED  │ ─────────────────▶  │ SUPERSEDED │
                  │            │   (Rev A → Rev B)   │            │
                  └────────────┘                     └────────────┘
                                                           │
                                                    Si se marca
                                                    manualmente
                                                           ▼
                                                     ┌────────────┐
                                                     │  OBSOLETE  │
                                                     └────────────┘
```

### Reglas del Workflow

1. **Solo una revisión puede estar en DRAFT o IN_REVIEW** a la vez por documento.
2. **Al aprobar una revisión**, la revisión anterior pasa automáticamente a SUPERSEDED.
3. **Al rechazar un step**, el workflow completo pasa a REJECTED y la revisión vuelve a DRAFT.
4. **Los steps se ejecutan en orden** (stepOrder). El step N+1 no se puede evaluar
   hasta que el step N esté en APPROVED.
5. **Cada step genera un `signatureHash`** = SHA-256(stepId + userId + timestamp + action)
   para trazabilidad ISO.
6. **El workflow es inmutable una vez completado** (no se puede volver a PENDING).

### Tipos de Steps

| Step Type     | Significado                       | Requisito              |
| ------------- | --------------------------------- | ---------------------- |
| `REVIEW`      | Revisión técnica del contenido    | Puede aprobar/rechazar |
| `APPROVE`     | Aprobación formal del documento   | Puede aprobar/rechazar |
| `ACKNOWLEDGE` | Toma de conocimiento (no bloquea) | Solo marca como visto  |

### Ejemplo de Workflow para un Procedimiento

```
Step 1: REVIEW     → Jefe de Área        (revisa contenido técnico)
Step 2: APPROVE    → Responsable Calidad  (aprueba formalmente)
Step 3: ACKNOWLEDGE → Gerencia            (toma conocimiento)
```

### Trazabilidad ISO 9001

Para cumplir con ISO 9001:2015 cláusula 7.5 (Información documentada):

- **Identificación**: Código único por documento (generado automáticamente).
- **Revisión**: Registro completo de revisiones con fecha y autor.
- **Aprobación**: Workflow de aprobación con firma digital (hash).
- **Distribución**: Control de quién accedió al documento (logs).
- **Almacenamiento**: En DO Spaces con backup.
- **Control de cambios**: Historial de versiones y revisiones.
- **Retención**: Políticas de retención configurables por tipo.
- **Disposición**: Marca de documentos obsoletos (no se eliminan).

---

## 12. Transmittals de Ingeniería

### ¿Qué es un Transmittal?

Es un documento formal de envío que acompaña la emisión de documentos de ingeniería
al cliente. Permite trackear:

- Qué documentos se enviaron
- Con qué propósito (para aprobación, para información, etc.)
- Qué respondió el cliente a cada documento

### Flujo del Transmittal

```
┌─────────┐     ┌─────────┐     ┌──────────────┐     ┌────────────┐     ┌────────┐
│  DRAFT  │────▶│ ISSUED  │────▶│ ACKNOWLEDGED │────▶│ RESPONDED  │────▶│ CLOSED │
│         │     │         │     │              │     │            │     │        │
│Preparar │     │Enviar a │     │Cliente acusa │     │Cliente da  │     │Cerrar  │
│docs     │     │cliente  │     │recibo        │     │respuesta   │     │        │
└─────────┘     └─────────┘     └──────────────┘     └────────────┘     └────────┘
```

### Purpose Codes (Códigos de propósito)

| Código           | Significado                              |
| ---------------- | ---------------------------------------- |
| FOR_APPROVAL     | Requiere aprobación formal               |
| FOR_INFORMATION  | Solo informativo                         |
| FOR_CONSTRUCTION | Aprobado para uso en construcción        |
| FOR_REVIEW       | Para revisión y comentarios              |
| AS_BUILT         | Documentación as-built / como-construido |

### Client Status (Respuesta del cliente)

| Status                 | Significado                           |
| ---------------------- | ------------------------------------- |
| APPROVED               | Aprobado sin comentarios              |
| APPROVED_WITH_COMMENTS | Aprobado con comentarios a incorporar |
| REJECTED               | Rechazado, requiere nueva revisión    |
| REVIEWED_NO_EXCEPTION  | Revisado sin objeción                 |

### Integración con el Subgraph Document

El transmittal referencia `DocumentRevision` (no `Document`), porque se emite una
revisión específica de un documento. Si el cliente rechaza, se crea una nueva revisión
del documento y se puede incluir en un nuevo transmittal.

---

## 13. Páginas a Migrar en el Frontend

### Páginas actuales con documentos hardcodeados (links a M-Files)

| Página actual                                  | Migración                        |
| ---------------------------------------------- | -------------------------------- |
| `quality/documents/page.tsx`                   | Lista dinámica con DocumentTable |
| `tags/documents/page.tsx`                      | Lista dinámica con DocumentTable |
| `tags/displays/[id]/[eqId]/documents/page.tsx` | Docs por entityType="equipment"  |

### Nuevas páginas a crear

```
app/(withSidebar)/
├── quality/
│   └── documents/
│       ├── page.tsx                  # Lista de documentos de calidad
│       ├── new/page.tsx              # Crear nuevo documento
│       └── [documentId]/
│           ├── page.tsx              # Detalle del documento
│           ├── edit/page.tsx         # Editar metadata
│           └── revisions/
│               └── [revisionId]/
│                   └── page.tsx      # Detalle de revisión con workflow
│
├── projects/
│   └── [projectId]/
│       ├── documents/
│       │   ├── page.tsx              # Documentos del proyecto
│       │   └── [documentId]/page.tsx
│       ├── scanned-files/
│       │   ├── page.tsx              # Lista de archivos escaneados del proyecto
│       │   ├── new/page.tsx          # Subir nuevo archivo escaneado
│       │   └── [scannedFileId]/
│       │       └── page.tsx          # Detalle con clasificación y disposición
│       └── transmittals/
│           ├── page.tsx              # Lista de transmittals
│           ├── new/page.tsx          # Crear transmittal
│           └── [transmittalId]/
│               └── page.tsx          # Detalle con items y respuestas
│
├── tags/
│   └── documents/
│       ├── page.tsx                  # Documentos técnicos
│       └── [documentId]/page.tsx
│
└── management/
    └── documents/
        └── page.tsx                  # Documentos de gestión
```

> **Nota sobre Attachments**: Los adjuntos no tienen páginas propias. Se gestionan
> como componente embebido dentro de las páginas de detalle de cualquier entidad
> (findings, actions, equipos, etc.) usando `AttachmentPanel`.

### Componentes reutilizables a crear

```
components/documents/
├── DocumentTable.tsx              # Tabla de documentos (reutilizable por módulo)
├── DocumentForm.tsx               # Formulario crear/editar documento
├── DocumentDetail.tsx             # Vista de detalle del documento
├── DocumentUploadZone.tsx         # Zona de drag & drop para archivos
├── DocumentVersionHistory.tsx     # Historial de versiones
├── RevisionTimeline.tsx           # Timeline de revisiones
├── ReviewWorkflowPanel.tsx        # Panel de workflow de revisión
├── ReviewStepCard.tsx             # Card individual de un step
├── TransmittalTable.tsx           # Tabla de transmittals
├── TransmittalForm.tsx            # Formulario crear transmittal
├── TransmittalDetail.tsx          # Detalle con items y respuestas
├── TransmittalItemRow.tsx         # Fila de item con status de cliente
└── UploadProgressBar.tsx          # Barra de progreso de upload

components/attachments/
├── AttachmentPanel.tsx             # Panel de adjuntos embebible en cualquier detalle
├── AttachmentList.tsx              # Lista de adjuntos de una entidad
├── AttachmentUploadButton.tsx      # Botón + diálogo para subir adjunto
└── AttachmentRow.tsx               # Fila individual con preview, descarga y eliminar

components/scanned-files/
├── ScannedFileTable.tsx            # Tabla de archivos escaneados (por proyecto)
├── ScannedFileForm.tsx             # Formulario crear archivo escaneado (code, título, archivo)
├── ScannedFileDetail.tsx           # Detalle con estado de clasificación y disposición
├── ScannedFileClassifyForm.tsx     # Formulario de clasificación (ACCEPTED/DISCARDED)
├── ScannedFileDispositionPanel.tsx # Panel de disposición física (DESTROY/ARCHIVE)
├── ScannedFileStatsCard.tsx        # Card con estadísticas por proyecto
└── ScannedFileUploadZone.tsx       # Zona de drag & drop para escaneos
```

### Diferencias entre Attachments y ScannedFiles

| Aspecto              | Attachments                           | ScannedFiles                              |
| -------------------- | ------------------------------------- | ----------------------------------------- |
| **Propósito**        | Adjuntar evidencias/soporte a entidad | Digitalizar papel y clasificar            |
| **Ciclo de vida**    | Crear → Eliminar (simple)             | Crear → Clasificar → Cargar/Descartar     |
| **Código único**     | No tiene                              | `code` único por proyecto (ej: SC-001)    |
| **Ubicación UI**     | Panel embebido en detalle de entidad  | Páginas propias por proyecto              |
| **Vinculación**      | module + entityType + entityId        | projectId + opcionalmente tipo/clase/área |
| **Disposición física** | No aplica                           | DESTROY/ARCHIVE con confirmación          |
| **Workflow**         | No tiene                              | Flujo de clasificación digital + física   |

---

## 14. Plan de Implementación por Fases

### Fase 1: Fundamentos ✅ COMPLETADA

**Objetivo**: Infraestructura base funcional — subgraph document operativo.

- [x] **Crear Subgraph Document**
  - Setup del nuevo subgraph (Apollo Federation v2.7)
  - Schema Prisma completo: Document, DocumentClass, DocumentType,
    DocumentRevision, DocumentVersion, ReviewWorkflow, ReviewStep,
    Transmittal, TransmittalItem, Attachment, ScannedFile, Area,
    DocumentSysLog, DocumentSysLogArchive
  - Esquema de revisión configurable (`revisionScheme`: ALPHABETICAL / NUMERIC)
  - Implementar resolvers CRUD para todas las entidades
  - Migrations de base de datos (init migration)
  - Docker + docker-compose

- [x] **Schema GraphQL completo**
  - Tipos, enums, inputs, queries y mutations para todas las entidades
  - Paginación estándar (`PaginationInput` / `PaginationInfo`)
  - Filtros y ordenamiento por entidad
  - SelectList queries para selectores del frontend
  - Enums duplicados para inputs (ej: `ModuleTypeInput`, `RevisionSchemeInput`)

- [x] **Attachments (adjuntos simples)**
  - Modelo `Attachment`: archivos sin workflow ni revisiones
  - Vinculado por `module` + `entityType` + `entityId`
  - Queries: `attachmentById`, `attachmentsByModule`
  - Mutations: `createAttachment`, `deleteAttachment`

- [x] **ScannedFiles (digitalización)**
  - Modelo `ScannedFile` con campo `code` único por proyecto y flujo de clasificación digital y física
  - Enums `DigitalDisposition` y `PhysicalDisposition`
  - Modelo `Area` para ubicación en planta
  - Queries: `scannedFileById`, `scannedFiles`, `scannedFileStats`
  - Mutations: `createScannedFile`, `classifyScannedFile`, `markAsUploaded`,
    `updatePhysicalDisposition`, `confirmPhysicalDisposition`,
    `terminateScannedFile`, `activateScannedFile`
  - Queries de áreas: `areas`, `areaById`, `areasSelectList`
  - Mutations de áreas: `createArea`, `updateArea`, `terminateArea`, `activateArea`

- [x] **Logs del sistema**
  - Modelo `DocumentSysLog` y `DocumentSysLogArchive`
  - Queries paginadas y con filtros
  - Mutations: `archiveDocumentSysLogs`, `deleteArchivedDocumentSysLogs`

- [ ] **Crear proyecto FileServer API**
  - Setup Node.js + Fastify/Express
  - Integrar AWS SDK (S3 compatible) con DO Spaces
  - Implementar endpoints: presign-upload, presign-download, delete
  - Auth con Bearer Token
  - Tests
  - Dockerize + deploy

- [ ] **Configurar DO Spaces**
  - Crear bucket `mi-app-documents`
  - Configurar CORS para dominio de la app
  - Configurar políticas de acceso (private)
  - Probar presigned URLs manualmente

- [ ] **Integrar en Next.js**
  - Crear `lib/actions/documents/fileserver-client.ts`
  - Crear server actions básicas: create, list, download
  - Crear hook `useDocumentUpload`
  - Crear componente `DocumentTable`
  - Reemplazar `quality/documents/page.tsx` con datos dinámicos
  - Regenerar tipos con codegen

### Fase 2: Revisiones y Versionado

**Objetivo**: Sistema completo de revisiones y versiones.

- [x] Schema y resolvers: createRevision, registerVersion
- [x] Auto-generación de revisionCode según `revisionScheme` (A → B → C o 0 → 1 → 2)
- [x] Mutation `switchRevisionScheme` para cambiar esquema de revisión
- [ ] Lógica de SUPERSEDED automático al aprobar nueva revisión
- [ ] View: `DocumentVersionHistory` component
- [ ] View: `RevisionTimeline` component
- [ ] View: Detalle de documento con tabs (Info, Revisiones, Versiones)
- [ ] Formulario para subir nueva versión a revisión existente
- [ ] Formulario para crear nueva revisión

### Fase 3: Workflows de Revisión

**Objetivo**: Flujo de aprobación ISO 9001 completo.

- [x] Schema: ReviewWorkflow, ReviewStep (resolvers implementados)
- [x] Mutaciones: initiateReview, approveStep, rejectStep, cancelWorkflow
- [ ] Lógica de ejecución secuencial de steps
- [ ] Generación de signatureHash para trazabilidad
- [ ] Reglas de negocio: solo DRAFT puede ir a IN_REVIEW, etc.
- [ ] View: `ReviewWorkflowPanel` component
- [ ] View: `ReviewStepCard` component
- [ ] Dashboard de documentos pendientes de revisión
- [ ] Notificaciones por email al asignar reviewers
- [ ] Notificaciones al completar/rechazar revisión
- [ ] Audit log de todas las acciones del workflow

### Fase 4: Transmittals de Ingeniería

**Objetivo**: Gestión de emisiones de documentos a clientes.

- [x] Schema: Transmittal, TransmittalItem (resolvers implementados)
- [x] Mutaciones: createTransmittal, issueTransmittal, respondTransmittal, closeTransmittal
- [ ] Lógica de estados del transmittal
- [ ] View: Transmittal pages en projects/[id]/transmittals
- [ ] Formulario de creación con selección de documentos y purpose codes
- [ ] Vista de detalle con tracking de respuestas por item
- [ ] Generación de PDF/reporte del transmittal
- [ ] Dashboard: transmittals pendientes de respuesta

### Fase 5: Extensión a otros Módulos

**Objetivo**: Migrar documentos de todos los módulos al sistema centralizado.

- [ ] Migrar `tags/documents/page.tsx` a datos dinámicos
- [ ] Migrar `tags/displays/[id]/[eqId]/documents/page.tsx`
- [ ] Integrar documentos en módulo operations
- [ ] Integrar documentos en módulo management
- [ ] Integrar documentos en módulo comercial
- [ ] Migrar evidencias de findings/actions a DocumentVersion

### Fase 6: Mejoras y Optimización (ongoing)

- [ ] Búsqueda full-text en metadata de documentos
- [ ] Preview de documentos (PDF viewer, image viewer)
- [ ] Plantillas de workflow por tipo de documento
- [ ] Bulk upload de documentos
- [ ] Versionado automático (auto-increment)
- [ ] Integración con firmas digitales reales (PKI)
- [ ] Reportes de estado documental por módulo
- [ ] Políticas de retención y archivado
- [ ] Backup automático de DO Spaces

---

## 15. Variables de Entorno Requeridas

### Next.js (.env.local)

```env
# FileServer API
FILESERVER_API_URL=http://localhost:4000       # URL del FileServer
FILESERVER_API_TOKEN=fs_secret_token_here      # Token de autenticación
```

### FileServer API (.env)

```env
# DO Spaces
DO_SPACES_KEY=your_spaces_key
DO_SPACES_SECRET=your_spaces_secret
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_REGION=nyc3
DO_SPACES_BUCKET=mi-app-documents

# Presigned URLs
PRESIGNED_URL_EXPIRATION=900                   # 15 minutos en segundos

# Auth
API_TOKEN=fs_secret_token_here                 # Debe coincidir con FILESERVER_API_TOKEN

# Server
PORT=4000
```

### Subgraph Document (.env)

```env
# Base de datos
DATABASE_URL=postgresql://user:password@host:5432/document_db

# Para comunicación con FileServer (si necesita eliminar archivos al borrar documentos)
FILESERVER_API_URL=http://localhost:4000
FILESERVER_API_TOKEN=fs_secret_token_here
```

### Apollo Gateway/Router

```yaml
# Agregar el nuevo subgraph en la configuración del Router
supergraph:
  subgraphs:
    admin:
      routing_url: http://admin-service:4001/graphql
    projects:
      routing_url: http://projects-service:4002/graphql
    quality:
      routing_url: http://quality-service:4003/graphql
    tags:
      routing_url: http://tags-service:4004/graphql
    document: # ← NUEVO
      routing_url: http://document-service:4005/graphql
```

---

## 16. Decisiones Arquitecturales

| #   | Decisión                  | Elección                                          | Justificación                                                        |
| --- | ------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | **Storage**               | DO Spaces (1 bucket, prefijos por módulo)         | Compatible S3, económico, CDN incluido, simplifica gestión           |
| 2   | **Upload pattern**        | Presigned URLs (browser → S3 directo)             | No sobrecarga servidores, progreso real, sin timeout                 |
| 3   | **Metadata**              | Subgraph `document` nuevo (Apollo Federation)     | Centralizado, DRY, un solo workflow engine                           |
| 4   | **Archivos físicos**      | FileServer API dedicado (REST)                    | Separación de concerns, reutilizable, escalable                      |
| 5   | **Orquestación**          | Next.js Server Actions                            | Patrón ya consolidado en el codebase                                 |
| 6   | **Vínculo entre módulos** | `moduleRef` (module + entityType + entityId)      | Desacoplado, el subgraph document no conoce otros tipos              |
| 7   | **Versionado**            | Document → Revision → Version (3 niveles)         | Estándar para ISO 9001, máxima trazabilidad                          |
| 8   | **Workflows**             | En subgraph document (no externo)                 | Simplicidad, los workflows son intrínsecos a documentos              |
| 9   | **Transmittals**          | En subgraph document                              | Reutilizan las mismas revisiones del sistema de docs                 |
| 10  | **Buckets**               | Un solo bucket con prefijos                       | Menor costo, menor complejidad, misma separación lógica              |
| 11  | **Esquema de revisión**   | Configurable por documento (ALPHABETICAL/NUMERIC) | Flexibilidad: ingeniería usa letras, informes usan números           |
| 12  | **Adjuntos simples**      | Modelo `Attachment` separado de documentos        | Archivos sin ciclo de revisión ni workflow, vinculados por moduleRef |
| 13  | **Digitalización**        | Modelo `ScannedFile` con flujo dual               | Clasificación digital + disposición física independientes            |
| 14  | **Áreas de planta**       | Modelo `Area` vinculado a proyecto                | Catalogar origen físico de documentos escaneados                     |
| 15  | **Logs**                  | DocumentSysLog + archive con rotación             | Trazabilidad operacional con archivado para performance              |

---

## Notas Adicionales

### Tipos MIME permitidos (sugerencia por módulo)

```typescript
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  quality: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
  ],
  projects: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "application/acad", // AutoCAD DWG
    "image/vnd.dxf", // DXF
    "application/x-step", // STEP/STP (3D models)
  ],
  tags: ["application/pdf", "image/jpeg", "image/png", "application/acad"],
}
```

### Tamaños máximos (sugerencia)

```typescript
const MAX_FILE_SIZES: Record<string, number> = {
  "application/pdf": 50 * 1024 * 1024, // 50 MB
  "image/jpeg": 10 * 1024 * 1024, // 10 MB
  "image/png": 10 * 1024 * 1024, // 10 MB
  "application/acad": 100 * 1024 * 1024, // 100 MB (DWG)
  default: 25 * 1024 * 1024, // 25 MB default
}
```
