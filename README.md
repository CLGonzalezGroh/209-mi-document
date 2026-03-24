# 209-mi-document — Subgraph Gestión Documental

> Subgraph Apollo Federation v2 para gestión del ciclo de vida completo de documentos.
> Módulo transversal — todos los demás módulos (quality, projects, management, comercial) se apoyan en este para documentos.
> Incluye workflows ISO 9001, transmittals de ingeniería y digitalización de documentos físicos.

---

## Conexión

| Dato              | Valor                                                |
| ----------------- | ---------------------------------------------------- |
| **Puerto**        | `4209`                                               |
| **Tipo**          | Subgraph Apollo Federation v2.7                      |
| **BD**            | PostgreSQL (`mi_document_db`)                        |
| **Autenticación** | JWT HS256 via header `Authorization: Bearer <token>` |

---

## Stack

- Apollo Server + @apollo/subgraph (Federation v2.7)
- Prisma 7 ORM + PostgreSQL (adapter `@prisma/adapter-pg`)
- TypeScript (ESM, target ES2023, strict)
- jsonwebtoken para validación JWT

---

## Desarrollo

```bash
# Levantar PostgreSQL local (puerto 5409)
docker compose up -d

# Servidor en modo desarrollo (watch)
npm run dev

# Build producción
npm run build       # prisma generate + tsc + copy schema.graphql

# Iniciar en producción
npm run start
```

### Requisitos previos

1. PostgreSQL corriendo (local via `docker compose up -d` o externo)
2. Archivo `.env` configurado (ver `.env.example`)
3. Paquete `@CLGonzalezGroh/mi-common` instalable (requiere `.npmrc` con GitHub PAT)

---

## Variables de entorno

| Variable                   | Descripción                            | Ejemplo                                                                                |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | Conexión PostgreSQL                    | `postgresql://mi_document:mi_document_dev@localhost:5409/mi_document_db?schema=public` |
| `AUTH_JWT_SECRET`          | Clave secreta para verificar JWT HS256 | (string base64)                                                                        |
| `ADMIN_API_URL`            | URL del gateway/admin para permisos    | `http://localhost:4200`                                                                |
| `EXTERNAL_SYSTEM_BASE_URL` | URL base del sistema externo (M-Files) | `https://mfiles.empresa.com`                                                           |
| `PORT`                     | Puerto del servidor (default: `4209`)  | `4209`                                                                                 |

---

## Arquitectura

```
src/
  index.ts                # Entry point — Apollo Server standalone
  types.ts                # ResolverContext (orm + token)
  lib/
    prisma.ts             # Instancia Prisma con pg adapter (singleton)
  resolvers/
    index.ts              # Barrel export de resolvers
    documents.ts          # CRUD documentos + switch revision scheme
    documentTypes.ts      # CRUD tipos de documento
    documentClasses.ts    # CRUD clases de documento
    revisions.ts          # Crear revisiones (alfabéticas/numéricas)
    versions.ts           # Registrar versiones de archivo
    workflows.ts          # Flujo de aprobación ISO 9001
    transmittals.ts       # Envíos de documentos al cliente
    attachments.ts        # Adjuntos simples (sin versionado)
    scannedFiles.ts       # Digitalización de documentos físicos
    areas.ts              # Ubicaciones físicas de planta
    documentSysLogs.ts    # Consulta y archivo de bitácora
    resolversTypes/
      index.ts            # __resolveReference + field resolvers federados
  utils/
    userAuthorization.ts    # Validación JWT + delegación permisos a admin
    handleError.ts          # Manejo centralizado de errores Prisma/GraphQL
    orderByHelper.ts        # Builders de ordenamiento dinámico
  scalars/                # Scalar DateTime
schema.graphql            # Schema Federation v2
prisma/
  schema.prisma           # Modelo de datos (14 tablas + 8 enums)
  seed.ts                 # Entry point del seed (pendiente)
  migrations/
    20260228182903_init/                        # Schema inicial completo
    20260306120000_add_code_to_scanned_files/   # Campo code en ScannedFile
```

---

## Modelo de datos

### Documentos

| Modelo               | Descripción                                                                         |
| -------------------- | ----------------------------------------------------------------------------------- |
| **DocumentClass**    | Clasificación nivel 1 — especialidad (ej: "Civil", "Procesos")                      |
| **DocumentType**     | Clasificación nivel 2 — tipo de documento (ej: "Procedimiento", "Plano", "Reporte") |
| **Document**         | Registro maestro (código, título, módulo, esquema de revisión)                      |
| **DocumentRevision** | Revisiones (A, B, C o 0, 1, 2) con status de aprobación                             |
| **DocumentVersion**  | Versiones de archivo dentro de una revisión (SHA-256, fileKey a DO Spaces)          |

### Workflows ISO 9001

| Modelo             | Descripción                                                        |
| ------------------ | ------------------------------------------------------------------ |
| **ReviewWorkflow** | Flujo de aprobación multi-paso (PENDING → IN_PROGRESS → COMPLETED) |
| **ReviewStep**     | Pasos individuales (REVIEW, APPROVE, ACKNOWLEDGE) con firma hash   |

### Transmittals

| Modelo              | Descripción                                                           |
| ------------------- | --------------------------------------------------------------------- |
| **Transmittal**     | Envíos de documentos al cliente (DRAFT → ISSUED → RESPONDED → CLOSED) |
| **TransmittalItem** | Documentos individuales con propósito y feedback del cliente          |

### Digitalización

| Modelo          | Descripción                                                                     |
| --------------- | ------------------------------------------------------------------------------- |
| **ScannedFile** | Documentos físicos digitalizados con clasificación en dos ejes (digital/físico) |
| **Area**        | Ubicaciones físicas de planta (ej: "01 - Planta Urea")                          |

### Utilidades

| Modelo                    | Descripción                                          |
| ------------------------- | ---------------------------------------------------- |
| **Attachment**            | Adjuntos simples (sin workflow ni versionado)        |
| **DocumentSysLog**        | Bitácora operativa (level, name, message, meta JSON) |
| **DocumentSysLogArchive** | Bitácora archivada                                   |

### Diagrama de relaciones

```mermaid
erDiagram
    DocumentClass ||--o{ DocumentType : "contiene"
    DocumentType ||--o{ Document : "clasifica"
    Document ||--o{ DocumentRevision : "tiene"
    DocumentRevision ||--o{ DocumentVersion : "tiene"
    DocumentRevision ||--o{ ReviewWorkflow : "tiene"
    ReviewWorkflow ||--o{ ReviewStep : "tiene"
    Transmittal ||--o{ TransmittalItem : "contiene"
    TransmittalItem }o--|| DocumentRevision : "referencia"
    Area ||--o{ ScannedFile : "ubica"

    DocumentClass {
        int id PK
        string name UK
        string description
        boolean isSys
        datetime terminatedAt
    }
    DocumentType {
        int id PK
        string name UK
        string description
        int documentClassId FK
        boolean isSys
        datetime terminatedAt
    }
    Document {
        int id PK
        string code UK
        string title
        string description
        enum module "QUALITY | PROJECTS | TAGS | OPERATIONS | MANAGEMENT | COMERCIAL"
        string entityType
        int entityId
        enum revisionScheme "ALPHABETICAL | NUMERIC"
        datetime terminatedAt
    }
    DocumentRevision {
        int id PK
        int documentId FK
        string revisionCode "A, B, C o 0, 1, 2"
        enum status "DRAFT | IN_REVIEW | APPROVED | SUPERSEDED | OBSOLETE"
        int createdById FK
        int approvedById FK
        datetime approvedAt
    }
    DocumentVersion {
        int id PK
        int revisionId FK
        int versionNumber
        string fileKey
        string fileName
        int fileSize
        string mimeType
        string checksum "SHA-256"
    }
    ReviewWorkflow {
        int id PK
        int revisionId FK
        enum status "PENDING | IN_PROGRESS | COMPLETED | REJECTED"
    }
    ReviewStep {
        int id PK
        int workflowId FK
        int stepOrder
        enum stepType "REVIEW | APPROVE | ACKNOWLEDGE"
        int assignedToId FK
        string signatureHash
        string comments
    }
    Transmittal {
        int id PK
        string code UK "TR-001, TR-002..."
        int projectId
        string title
        enum status "DRAFT | ISSUED | ACKNOWLEDGED | RESPONDED | CLOSED"
    }
    TransmittalItem {
        int id PK
        int transmittalId FK
        int revisionId FK
        string purposeCode
        string clientFeedback "APPROVED | APPROVED_WITH_COMMENTS | REJECTED | REVIEWED_NO_EXCEPTION"
    }
    ScannedFile {
        int id PK
        string code UK
        string fileName
        string fileKey
        int projectId
        int areaId FK
        enum digitalDisposition "PENDING | ACCEPTED | UPLOADED | DISCARDED"
        enum physicalDisposition "PENDING | DESTROY | DESTROYED | ARCHIVE | ARCHIVED"
        string externalReference
        string physicalLocation
    }
    Area {
        int id PK
        string name UK
        string description
        int projectId
        datetime terminatedAt
    }
```

### Restricciones de unicidad

- `Document.code`, `DocumentClass.name`, `DocumentType.name`, `Area.name`, `ScannedFile.code` son únicos
- `Transmittal.code` es único (auto-generado: TR-001, TR-002...)
- `DocumentVersion` es único por (revisionId, versionNumber)
- Soft delete via `terminatedAt` en entidades principales
- Registros de sistema marcados con `isSys: true`

---

## Jerarquía de documentos

```
Document (registro maestro)
  └─ Revisions (A, B, C... o 0, 1, 2...)
      └─ Versions (1, 2, 3...)
          └─ FileKey (archivo en DO Spaces)
```

### Esquemas de revisión

- **ALPHABETICAL:** A → B → C → ... → Z → AA → AB → AC ...
- **NUMERIC:** 0 → 1 → 2 → 3 ...
- Se puede cambiar con `switchRevisionScheme`
- Auto-generación del código en `revisions.ts`

---

## Flujo de autorización

1. El request llega con JWT en header `Authorization: Bearer <token>`
2. `userAuthorization.ts` verifica el JWT localmente con `AUTH_JWT_SECRET`
3. Extrae `userId` y `roles[]` del token decodificado
4. Consulta a `ADMIN_API_URL` si algún rol tiene el permiso requerido
5. Retorna el `userId` si está autorizado, o lanza `GraphQLError` (UNAUTHENTICATED / FORBIDDEN)

### Federation v2

- Tipo `UserName` declarado con `@key(fields: "id")` — permite resolver nombres de usuario desde mi-admin
- Tipos `SelectList` y `PaginationInfo` son `@shareable`

---

## API GraphQL

### Enums

| Enum                  | Valores                                                    |
| --------------------- | ---------------------------------------------------------- |
| `ModuleType`          | QUALITY, PROJECTS, TAGS, OPERATIONS, MANAGEMENT, COMERCIAL |
| `RevisionScheme`      | ALPHABETICAL, NUMERIC                                      |
| `RevisionStatus`      | DRAFT, IN_REVIEW, APPROVED, SUPERSEDED, OBSOLETE           |
| `WorkflowStatus`      | PENDING, IN_PROGRESS, COMPLETED, REJECTED                  |
| `StepType`            | REVIEW, APPROVE, ACKNOWLEDGE                               |
| `TransmittalStatus`   | DRAFT, ISSUED, ACKNOWLEDGED, RESPONDED, CLOSED             |
| `DigitalDisposition`  | PENDING, ACCEPTED, UPLOADED, DISCARDED                     |
| `PhysicalDisposition` | PENDING, DESTROY, DESTROYED, ARCHIVE, ARCHIVED             |
| `LogLevel`            | INFO, WARNING, ERROR                                       |

### Queries

| Query                                                           | Descripción                                | Permiso                         |
| --------------------------------------------------------------- | ------------------------------------------ | ------------------------------- |
| `documentById(id)`                                              | Documento con revisiones y versiones       | `document:document:read`        |
| `documents(filter, pagination, orderBy)`                        | Listado paginado de documentos             | `document:document:list`        |
| `documentsByModule(module, entityType?, entityId?)`             | Documentos de un módulo/entidad específica | `document:document:list`        |
| `documentsSelectList(filter?)`                                  | Lista para selects                         | `document:document:list`        |
| `documentTypeById(id)` / `documentTypes(...)`                   | Tipos de documento                         | `document:documentType:read`    |
| `documentTypesSelectList(filter?)`                              | Lista para selects                         | `document:documentType:select`  |
| `documentClassById(id)` / `documentClasses(...)`                | Clases de documento                        | `document:documentClass:read`   |
| `documentClassesSelectList(filter?)`                            | Lista para selects                         | `document:documentClass:select` |
| `revisionById(id)`                                              | Revisión con versiones y workflow          | `document:document:read`        |
| `pendingReviewSteps(userId)`                                    | Pasos de revisión pendientes del usuario   | `document:workflow:list`        |
| `workflowsByStatus(status)`                                     | Workflows filtrados por estado             | `document:workflow:list`        |
| `transmittalById(id)` / `transmittals(...)`                     | Transmittals                               | `document:transmittal:read`     |
| `transmittalsByProject(projectId)`                              | Transmittals de un proyecto                | `document:transmittal:list`     |
| `attachmentById(id)`                                            | Adjunto por ID                             | `document:attachment:read`      |
| `attachmentsByModule(module, entityType, entityId)`             | Adjuntos de una entidad                    | `document:attachment:list`      |
| `scannedFileById(id)` / `scannedFiles(filter)`                  | Archivos escaneados                        | `document:scannedFile:read`     |
| `scannedFileStats(projectId)`                                   | Estadísticas de digitalización             | `document:scannedFile:list`     |
| `areaById(id)` / `areas(...)` / `areasSelectList(projectId)`    | Áreas de planta                            | `document:area:read`            |
| `documentSysLogById(id)` / `documentSysLogs(...)`               | Bitácora operativa                         | `document:sysLog:read`          |
| `documentSysLogArchiveById(id)` / `documentSysLogsArchive(...)` | Bitácora archivada                         | `document:sysLog:read`          |

### Mutations — Documentos

| Mutation                                         | Descripción                                                   |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `createDocument(input)`                          | Crea documento + primera revisión + primera versión en una tx |
| `updateDocument(id, input)`                      | Actualizar título, descripción, tipo, clase                   |
| `terminateDocument(id)` / `activateDocument(id)` | Soft delete / restaurar                                       |
| `switchRevisionScheme(id, scheme)`               | Cambiar esquema de revisión (ALPHABETICAL ↔ NUMERIC)          |

### Mutations — Revisiones y versiones

| Mutation                             | Descripción                                                    |
| ------------------------------------ | -------------------------------------------------------------- |
| `createRevision(documentId, input)`  | Nueva revisión (valida que no exista DRAFT o IN_REVIEW previa) |
| `registerVersion(revisionId, input)` | Agregar versión de archivo a revisión (debe estar en DRAFT)    |

### Mutations — Workflows ISO 9001

| Mutation                             | Descripción                                                            |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `initiateReview(revisionId, input)`  | Iniciar flujo: crea workflow + pasos → revisión pasa a IN_REVIEW       |
| `approveStep(stepId, comments?)`     | Aprobar paso (valida orden secuencial, genera firma hash)              |
| `rejectStep(stepId, comments)`       | Rechazar: pasos posteriores SKIPPED, workflow REJECTED, revisión DRAFT |
| `cancelWorkflow(workflowId, reason)` | Cancelar workflow en curso                                             |

### Mutations — Transmittals

| Mutation                        | Descripción                                      |
| ------------------------------- | ------------------------------------------------ |
| `createTransmittal(input)`      | Crear transmittal (auto-genera código TR-001...) |
| `issueTransmittal(id)`          | DRAFT → ISSUED                                   |
| `respondTransmittal(id, input)` | Registrar feedback del cliente por item          |
| `closeTransmittal(id)`          | → CLOSED                                         |

### Mutations — Digitalización

| Mutation                                         | Descripción                                        |
| ------------------------------------------------ | -------------------------------------------------- |
| `createScannedFile(input)`                       | Registrar documento escaneado                      |
| `updateScannedFile(id, input)`                   | Editar metadata (opcionalmente reemplazar archivo) |
| `classifyScannedFile(id, input)`                 | PENDING → ACCEPTED o DISCARDED                     |
| `markAsUploaded(id, externalReference)`          | ACCEPTED → UPLOADED (referencia a sistema externo) |
| `updateExternalReference(id, externalReference)` | Corregir referencia de archivo ya subido           |
| `updatePhysicalDisposition(id, disposition)`     | Definir destino físico: DESTROY o ARCHIVE          |
| `confirmPhysicalDisposition(id)`                 | DESTROY → DESTROYED, ARCHIVE → ARCHIVED            |
| `resetScannedFileToPending(id)`                  | Revertir a estado inicial de clasificación         |
| `deleteScannedFile(id)`                          | Eliminación permanente + limpieza                  |

### Mutations — Otros

| Mutation                                                   | Descripción                                    |
| ---------------------------------------------------------- | ---------------------------------------------- |
| CRUD completo para `DocumentType`, `DocumentClass`, `Area` | Crear, actualizar, terminar, activar, eliminar |
| `createAttachment` / `deleteAttachment`                    | Adjuntos simples                               |
| `archiveDocumentSysLogs(olderThanDays)`                    | Mover logs antiguos a archivo                  |
| `deleteArchivedDocumentSysLogs(olderThanDays)`             | Eliminar logs archivados permanentemente       |

---

## Flujos de estado

### Revisión de documentos (ISO 9001)

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> IN_REVIEW : initiateReview()
    IN_REVIEW --> APPROVED : approveStep() (todos los pasos)
    IN_REVIEW --> DRAFT : rejectStep()
    APPROVED --> SUPERSEDED : al crear nueva revisión
    APPROVED --> OBSOLETE : obsolescencia manual
```

### Transmittals

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> ISSUED : issueTransmittal()
    ISSUED --> ACKNOWLEDGED : cliente acusa recibo
    ISSUED --> RESPONDED : respondTransmittal()
    ACKNOWLEDGED --> RESPONDED : respondTransmittal()
    RESPONDED --> CLOSED : closeTransmittal()
```

### Digitalización — Disposición digital

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> ACCEPTED : classifyScannedFile()
    PENDING --> DISCARDED : classifyScannedFile()
    ACCEPTED --> UPLOADED : markAsUploaded()
    ACCEPTED --> PENDING : resetScannedFileToPending()
    DISCARDED --> PENDING : resetScannedFileToPending()
```

### Digitalización — Disposición física

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> DESTROY : updatePhysicalDisposition()
    PENDING --> ARCHIVE : updatePhysicalDisposition()
    DESTROY --> DESTROYED : confirmPhysicalDisposition()
    ARCHIVE --> ARCHIVED : confirmPhysicalDisposition()
```

---

## Soporte multi-módulo

Este subgraph es **transversal**. Al crear un documento se indica a qué módulo pertenece:

| Campo        | Descripción                           | Ejemplo               |
| ------------ | ------------------------------------- | --------------------- |
| `module`     | Módulo propietario                    | `QUALITY`, `PROJECTS` |
| `entityType` | Tipo de entidad vinculada (opcional)  | `finding`, `action`   |
| `entityId`   | ID de la entidad vinculada (opcional) | `42`                  |

La combinación `module + entityType + entityId` permite vincular documentos a entidades externas de cualquier subgraph.

---

## Rover (Federation)

```bash
# Verificar schema contra el supergraph
npm run rover-check-current

# Publicar schema al supergraph
npm run rover-publish-current
```

---

## Deploy

Dockerfile multi-stage (Node 22 Alpine) compartido con los demás subgraphs. En producción ejecuta:

```bash
npx prisma migrate deploy && node ./dist/src/index.js
```

Docker Compose local levanta PostgreSQL 17 en puerto **5409**:

```bash
docker compose up -d
```
