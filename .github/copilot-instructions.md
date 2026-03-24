# 209-mi-document — Subgraph Gestión Documental

Subgraph Apollo Federation v2 para gestión del ciclo de vida completo de documentos. Módulo transversal — todos los demás módulos (quality, projects, management, comercial) se apoyan en este para documentos.

## Stack

- Apollo Server + @apollo/subgraph (Federation v2.7)
- Prisma ORM + PostgreSQL
- TypeScript (ESM)
- Puerto: 4209

## Development

```bash
npm run dev    # desarrollo con watch
npm run build  # prisma generate + tsc + copy schema
npm run start  # producción
```

## Modelo de dominio

### Documentos
- **DocumentClass / DocumentType** — Clasificación en dos niveles (ej: "Civil" → "Procedimiento")
- **Document** — Registro maestro (código, título, módulo: QUALITY/PROJECTS/TAGS/OPERATIONS/MANAGEMENT/COMERCIAL)
- **DocumentRevision** — Revisiones (A, B, C o 0, 1, 2 según esquema)
- **DocumentVersion** — Versiones de archivo dentro de una revisión (fileName, fileSize, mimeType, checksum SHA-256)

### Workflows ISO 9001
- **ReviewWorkflow / ReviewStep** — Flujo de aprobación: REVIEW → APPROVE → ACKNOWLEDGE
- **Document status:** DRAFT → IN_REVIEW → APPROVED / REJECTED / SUPERSEDED / OBSOLETE

### Transmittals
- **Transmittal** — Envíos de documentos al cliente (DRAFT → ISSUED → ACKNOWLEDGED → RESPONDED → CLOSED)
- **TransmittalItem** — Documentos dentro de un transmittal con feedback del cliente
- **Client feedback:** APPROVED, APPROVED_WITH_COMMENTS, REJECTED, REVIEWED_NO_EXCEPTION

### Digitalización
- **ScannedFile** — Digitalización de documentos físicos
  - Disposición digital: PENDING → ACCEPTED → UPLOADED
  - Disposición física: DESTROY / ARCHIVE
- **Area** — Ubicaciones físicas de planta (ej: "01 - Planta Urea")

### Adjuntos
- **Attachment** — Archivos adjuntos simples (evidencias, fotos)

## Patrones importantes

- **Transversal:** Al crear un documento se indica el módulo (`module` field). Permite vincular documentos a entidades externas (findings, actions, projects) via IDs
- **Esquema de revisiones:** Flexible — alfabético (A-Z, AA-AB) o numérico (0, 1, 2)
- **Trazabilidad completa:** createdById, approvedById, classifiedById, physicalConfirmedById
- **Checksums:** Versiones de documentos almacenan SHA-256 para verificación de integridad
- **Auth:** JWT + delegación permisos a mi-admin
- **Seeding:** Per-client + per-environment
