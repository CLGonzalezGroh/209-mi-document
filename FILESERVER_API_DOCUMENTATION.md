# FileServer API - Documentación

> Servicio REST dedicado a la gestión de archivos en Digital Ocean Spaces (S3 compatible).
> Genera presigned URLs para upload/download directo desde el browser al storage,
> sin que los archivos pasen por servidores intermedios.

---

## Conexión

| Dato                | Valor                               |
| ------------------- | ----------------------------------- |
| **Base URL (dev)**  | `http://localhost:4208`             |
| **Base URL (test)** | Configurar según entorno            |
| **Base URL (prod)** | Configurar según entorno            |
| **Autenticación**   | `Authorization: Bearer <API_TOKEN>` |
| **Content-Type**    | `application/json`                  |

### Autenticación

Todos los endpoints bajo `/api/files/*` requieren el header:

```
Authorization: Bearer <API_TOKEN>
```

El token se comparte como secreto entre el FileServer y la app consumidora.
**El endpoint `/api/health` es público** (no requiere token).

---

## Endpoints

### 1. Generar URL de Upload

Genera una presigned PUT URL para que el browser suba un archivo directamente al storage.

```
POST /api/files/presign-upload
```

**Request Body:**

| Campo         | Tipo     | Requerido | Descripción                                                                                                                                                                                                                                 |
| ------------- | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `module`      | `string` | Sí        | Módulo de la app (ver módulos válidos abajo)                                                                                                                                                                                                |
| `path`        | `string` | Sí        | Sub-ruta dentro del módulo (ej: `findings-evidence`)                                                                                                                                                                                        |
| `fileName`    | `string` | Sí        | Nombre original del archivo                                                                                                                                                                                                                 |
| `contentType` | `string` | Sí        | MIME type del archivo (ej: `application/pdf`)                                                                                                                                                                                               |
| `maxSize`     | `number` | No        | Tamaño máximo en bytes. Si se envía, se valida contra el límite del sistema según el MIME type (ej: 50MB para PDFs, 10MB para imágenes). Permite ser más restrictivo que el default. Si no se envía, aplica el límite por defecto del tipo. |

**Ejemplo:**

```json
{
  "module": "quality",
  "path": "findings-evidence",
  "fileName": "foto-hallazgo.jpg",
  "contentType": "image/jpeg",
  "maxSize": 5242880
}
```

**Response 200:**

```json
{
  "uploadUrl": "https://bucket.nyc3.digitaloceanspaces.com/quality/findings-evidence/abc123-foto-hallazgo.jpg?X-Amz-...",
  "fileKey": "quality/findings-evidence/abc123-foto-hallazgo.jpg",
  "expiresAt": "2026-02-10T15:30:00.000Z"
}
```

| Campo       | Descripción                                               |
| ----------- | --------------------------------------------------------- |
| `uploadUrl` | URL presigned para hacer PUT con el archivo binario       |
| `fileKey`   | Key única del archivo en el storage (guardar en metadata) |
| `expiresAt` | Fecha/hora de expiración de la URL (15 min por defecto)   |

**Cómo usar la `uploadUrl` desde el browser:**

```typescript
// PUT directo al storage (sin pasar por servidores)
const response = await fetch(uploadUrl, {
  method: "PUT",
  headers: { "Content-Type": file.type },
  body: file, // File object del input
})
```

---

### 2. Generar URL de Download

Genera una presigned GET URL para descargar un archivo.

```
POST /api/files/presign-download
```

**Request Body:**

| Campo     | Tipo     | Requerido | Descripción                |
| --------- | -------- | --------- | -------------------------- |
| `fileKey` | `string` | Sí        | Key del archivo en storage |

**Ejemplo:**

```json
{
  "fileKey": "quality/findings-evidence/abc123-foto-hallazgo.jpg"
}
```

**Response 200:**

```json
{
  "downloadUrl": "https://bucket.nyc3.digitaloceanspaces.com/quality/findings-evidence/abc123-foto-hallazgo.jpg?X-Amz-...",
  "expiresAt": "2026-02-10T15:30:00.000Z"
}
```

**Cómo usar la `downloadUrl`:**

```typescript
// Descarga directa en el browser
window.open(downloadUrl, "_blank")

// O con fetch si necesitas procesarlo
const response = await fetch(downloadUrl)
const blob = await response.blob()
```

---

### 3. Eliminar Archivo

Elimina un archivo del storage.

```
DELETE /api/files
```

**Request Body:**

| Campo     | Tipo     | Requerido | Descripción                |
| --------- | -------- | --------- | -------------------------- |
| `fileKey` | `string` | Sí        | Key del archivo a eliminar |

**Ejemplo:**

```json
{
  "fileKey": "quality/findings-evidence/abc123-foto-hallazgo.jpg"
}
```

**Response 200:**

```json
{
  "message": "Archivo eliminado correctamente",
  "fileKey": "quality/findings-evidence/abc123-foto-hallazgo.jpg"
}
```

---

### 4. Copiar Archivo

Copia un archivo dentro del storage. Útil para versionado de documentos.

```
POST /api/files/copy
```

**Request Body:**

| Campo            | Tipo     | Requerido | Descripción             |
| ---------------- | -------- | --------- | ----------------------- |
| `sourceKey`      | `string` | Sí        | Key del archivo origen  |
| `destinationKey` | `string` | Sí        | Key del archivo destino |

**Ejemplo:**

```json
{
  "sourceKey": "quality/procedures/rev-a/proc-001.pdf",
  "destinationKey": "quality/procedures/rev-b/proc-001.pdf"
}
```

**Response 200:**

```json
{
  "message": "Archivo copiado correctamente",
  "sourceKey": "quality/procedures/rev-a/proc-001.pdf",
  "destinationKey": "quality/procedures/rev-b/proc-001.pdf"
}
```

---

### 5. Información de Archivo

Consulta si un archivo existe y obtiene su metadata.

```
GET /api/files/info?fileKey=<fileKey>
```

**Query Parameters:**

| Parámetro | Tipo     | Requerido | Descripción                 |
| --------- | -------- | --------- | --------------------------- |
| `fileKey` | `string` | Sí        | Key del archivo a consultar |

**Ejemplo:**

```
GET /api/files/info?fileKey=quality/findings-evidence/abc123-foto-hallazgo.jpg
```

**Response 200 (archivo existe):**

```json
{
  "exists": true,
  "fileKey": "quality/findings-evidence/abc123-foto-hallazgo.jpg",
  "size": 245760,
  "lastModified": "2026-02-10T14:20:00.000Z",
  "contentType": "image/jpeg",
  "etag": "\"d41d8cd98f00b204e9800998ecf8427e\""
}
```

**Response 200 (archivo no existe):**

```json
{
  "exists": false,
  "fileKey": "quality/findings-evidence/abc123-foto-hallazgo.jpg"
}
```

---

### 6. Health Check (Público)

Verifica el estado del servicio y la conexión con el storage. **No requiere autenticación.**

```
GET /api/health
```

**Response 200:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-10T14:00:00.000Z",
  "uptime": 3600,
  "storage": {
    "connected": true,
    "bucket": "mi-testing"
  }
}
```

**Response 503 (storage desconectado):**

```json
{
  "status": "error",
  "timestamp": "2026-02-10T14:00:00.000Z",
  "uptime": 3600,
  "storage": {
    "connected": false,
    "bucket": "mi-testing"
  }
}
```

---

## Errores

Todas las respuestas de error siguen el mismo formato:

```json
{
  "error": "Tipo de Error",
  "message": "Descripción legible del error"
}
```

### Códigos de Error

| Código | Error                 | Causa                                                  |
| ------ | --------------------- | ------------------------------------------------------ |
| `400`  | Validation Error      | Campos faltantes, valores inválidos, MIME no permitido |
| `401`  | Unauthorized          | Falta el header Authorization                          |
| `403`  | Forbidden             | Token inválido                                         |
| `404`  | Not Found             | Archivo no encontrado en el storage                    |
| `429`  | Too Many Requests     | Rate limit excedido                                    |
| `500`  | Internal Server Error | Error inesperado del servidor                          |

### Rate Limiting

| Endpoint                      | Límite              |
| ----------------------------- | ------------------- |
| General (todos los endpoints) | 100 requests/minuto |
| Presign upload/download       | 30 requests/minuto  |

---

## Módulos Válidos

| Módulo       | Descripción              |
| ------------ | ------------------------ |
| `quality`    | Calidad / SGC            |
| `projects`   | Proyectos / Ingeniería   |
| `tags`       | Equipos / Tags           |
| `operations` | Operaciones              |
| `management` | Gestión / Administración |
| `comercial`  | Comercial                |

---

## MIME Types Permitidos por Módulo

### quality, management, comercial

| MIME Type                                                                 | Extensión   |
| ------------------------------------------------------------------------- | ----------- |
| `application/pdf`                                                         | .pdf        |
| `application/msword`                                                      | .doc        |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | .docx       |
| `application/vnd.ms-excel`                                                | .xls        |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`       | .xlsx       |
| `image/jpeg`                                                              | .jpg, .jpeg |
| `image/png`                                                               | .png        |

### projects (incluye los anteriores +)

| MIME Type            | Extensión   |
| -------------------- | ----------- |
| `application/acad`   | .dwg        |
| `image/vnd.dxf`      | .dxf        |
| `application/x-step` | .stp, .step |

### tags

| MIME Type          | Extensión   |
| ------------------ | ----------- |
| `application/pdf`  | .pdf        |
| `image/jpeg`       | .jpg, .jpeg |
| `image/png`        | .png        |
| `application/acad` | .dwg        |

### operations

| MIME Type                                                                 | Extensión   |
| ------------------------------------------------------------------------- | ----------- |
| `application/pdf`                                                         | .pdf        |
| `application/msword`                                                      | .doc        |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | .docx       |
| `image/jpeg`                                                              | .jpg, .jpeg |
| `image/png`                                                               | .png        |

---

## Tamaños Máximos por Tipo

| MIME Type            | Tamaño Máximo |
| -------------------- | ------------- |
| `application/pdf`    | 50 MB         |
| `image/jpeg`         | 10 MB         |
| `image/png`          | 10 MB         |
| `application/acad`   | 100 MB        |
| `image/vnd.dxf`      | 100 MB        |
| `application/x-step` | 100 MB        |
| Otros                | 25 MB         |

---

## Convención de File Keys

El FileServer genera automáticamente la `fileKey` con el formato:

```
{module}/{path}/{uuid}-{fileName-sanitizado}
```

Ejemplo:

```
quality/findings-evidence/a1b2c3d4-foto-hallazgo.jpg
projects/engineering/drawings/e5f6g7h8-PL-100-Planta-General.dwg
```

- El UUID previene colisiones de nombres.
- El nombre original se preserva (sanitizado) para legibilidad.
- **Guardar siempre la `fileKey`** en tu base de datos — es el identificador único para descargar, eliminar o consultar el archivo.

---

## Ejemplo de Integración (TypeScript)

### Cliente del FileServer (server-side only)

```typescript
const FILESERVER_URL = process.env.FILESERVER_API_URL
const FILESERVER_TOKEN = process.env.FILESERVER_API_TOKEN

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${FILESERVER_TOKEN}`,
}

// ─── Upload ───
export async function getUploadUrl(params: {
  module: string
  path: string
  fileName: string
  contentType: string
}) {
  const res = await fetch(`${FILESERVER_URL}/api/files/presign-upload`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`FileServer error: ${res.statusText}`)
  return res.json() as Promise<{
    uploadUrl: string
    fileKey: string
    expiresAt: string
  }>
}

// ─── Download ───
export async function getDownloadUrl(fileKey: string) {
  const res = await fetch(`${FILESERVER_URL}/api/files/presign-download`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fileKey }),
  })
  if (!res.ok) throw new Error(`FileServer error: ${res.statusText}`)
  return res.json() as Promise<{
    downloadUrl: string
    expiresAt: string
  }>
}

// ─── Delete ───
export async function deleteFile(fileKey: string) {
  const res = await fetch(`${FILESERVER_URL}/api/files`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ fileKey }),
  })
  if (!res.ok) throw new Error(`FileServer error: ${res.statusText}`)
}
```

### Variables de Entorno requeridas en la app consumidora

```env
FILESERVER_API_URL=http://localhost:4208
FILESERVER_API_TOKEN=<el_mismo_token_que_API_TOKEN_del_fileserver>
```

> **Importante:** El FileServer solo debe ser consumido desde el backend (server actions, API routes).
> Nunca exponer la URL ni el token al browser.
