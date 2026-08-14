# What's new in María Ingeniería API Documents 1.0.0

2026-02-10

## Setup

- Setup inicial completo de prisma y graphql con resolvers

---

# What's new in María Ingeniería API Documents 1.0.1

2026-02-11

## Attachments

- Agregar Attachments a prisma y a graphql

---

# What's new in María Ingeniería API Documents 1.0.2

2026-02-12

## DocumentClass && ScannedFiles

- Agregar DocumentClass y ScannedFiles a prisma y a graphql

---

# What's new in María Ingeniería API Documents 1.0.3

2026-02-12

## RevisionSchema

- Agregar RevisionSchema a los Documentos

---

# What's new in María Ingeniería API Documents 1.0.4

2026-02-12

## Areas

- Agregar Area a los ScannedDocuments

---

# What's new in María Ingeniería API Documents 1.0.5

2026-02-28

## Postgres & Docker

- Migración a Postgres. Incorporar Docker

---

# What's new in María Ingeniería API Documents 1.0.6

2026-02-28

## npm update

- Actualización de Librerías

---

# What's new in María Ingeniería API Documents 2.0.0

2026-03-03

## Docker

- Sacando el health check del Docker para ejecutarlo en el compose

---

# What's new in María Ingeniería API Documents 2.0.1

2026-03-06

## ScannedFiles

- Agregando code a ScannedFiles y Actualizando Documentación

---

# What's new in María Ingeniería API Documents 2.0.2

2026-03-07

## Documentación

- Actualiza la documentación del FileServer API: agrega secciones sobre autenticación, endpoints y ejemplos de uso.

---

# What's new in María Ingeniería API Documents 2.0.3

2026-03-07

## ScannedFiles

- Agrega consultas para listar archivos escaneados y obtener estadísticas de archivos escaneados por estado

---

# What's new in María Ingeniería API Documents 2.0.4

2026-03-08

## ScannedFiles

- Agrega funcionalidad para eliminar archivos escaneados y actualiza el esquema GraphQL

---

# What's new in María Ingeniería API Documents 2.0.5

2026-03-08

## DocumentType & DocumentClass

- Agrega funcionalidad para eliminar tipos y clases de documentos, y mejora la consulta de archivos escaneados por ID

---

# What's new in María Ingeniería API Documents 2.0.6

2026-03-09

## Areas

- Agrega funcionalidad para eliminar áreas

---

# What's new in María Ingeniería API Documents 2.0.7

2026-03-11

## Scanned Files

- Agrega funcionalidad para actualizar archivos escaneados y mejora la gestión de metadatos

---

# What's new in María Ingeniería API Documents 2.0.8

2026-03-12

## Logging de mutaciones

- Se implementaron los loggings de todas las mutaciones

---

# What's new in María Ingeniería API Documents 2.0.9

2026-03-15

## Enlace a M-Files

- Agrega la variable EXTERNAL_SYSTEM_BASE_URL al archivo .env.example, actualiza la acción de Docker a la versión 7 y modifica la URL externa en resolverTypes para incluir '/latest'.

---

# What's new in María Ingeniería API Documents 2.0.10

2026-03-15

## Enlace a M-Files

- Agrega la mutación updateExternalReference para corregir la referencia externa de archivos ya marcados como cargados

---

# What's new in María Ingeniería API Documents 2.0.11

2026-03-23

## ScannedFiles

- Agrega el campo PHYSICAL_LOCATION a los enums y resolvers de archivos escaneados

---

# What's new in María Ingeniería API Documents 2.0.12

2026-03-27

## Cache

- Actualiza resolvers para incluir permisos comunes en las funciones de selección

---

# What's new in María Ingeniería API Documents 2.0.13

2026-03-28

## Error Handle

- Agrega mensajes de error para la restricción de unicidad en la creación y actualización de archivos escaneados

---

# What's new in María Ingeniería API Documents 2.0.14

2026-03-29

## npm update

- Actualiza dependencias y corrige importaciones en varios archivos

---

# What's new in María Ingeniería API Documents 2.0.15

2026-03-29

## Ubicación Física

- Agrega filtro por ubicación física en la entrada de ScannedFileFilterInput

---

# What's new in María Ingeniería API Documents 2.0.16

2026-03-30

## Scanned Files

- Agrega nuevos campos de ordenación para archivos escaneados: AREA_NAME, CLASS_NAME y TYPE_NAME

---

# What's new in María Ingeniería API Documents 2.0.17

2026-04-01

## Postgres Pool

- Refactor la conexión de Prisma para usar un pool de conexiones con pg

---

# What's new in María Ingeniería API Documents 2.0.18

2026-04-02

## Cross References

- Agrega resolvers para verificar dependencias documentales entre entidades externas

---

# What's new in María Ingeniería API Documents 2.0.19

2026-04-03

## Logger

- Agrega configuración de logger y mejora el manejo de errores en varios resolvers y utilidades

---

# What's new in María Ingeniería API Documents 2.0.20

2026-04-05

## SysLogs

- Agregando el campo modulo para diferenciar de que módulo viene el log

---

# What's new in María Ingeniería API Documents 2.0.21

2026-04-05

## SysLogs

- Mejora la gestión de logs y errores: se actualizan tipos de datos en DocumentSysLog, se renombra la función de eliminación de logs y se maneja el registro de errores en la creación de logs.

---

# What's new in María Ingeniería API Documents 2.0.22

2026-04-12

## ScannedFiles

- Agrega filtros por fecha de última actualización y usuario que actualizó en los archivos escaneados

---

# What's new in María Ingeniería API Documents 2.0.23

2026-04-13

## ScannedFiles

- Agrega el estado 'BAD_QUALITY' a la enumeración DigitalDisposition y actualiza los resolvers para manejar este nuevo estado

---

# What's new in María Ingeniería API Documents 2.0.24

2026-05-11

## Modules

- Resolver discrepancias de nombre de módulos

---

# What's new in María Ingeniería API Documents 2.0.25

2026-05-15

## Areas

- Actualiza permisos en resolvers de áreas y clases de documentos para usar constantes de permisos

---

# What's new in María Ingeniería API Documents 2.0.26

2026-05-17

## ProjectTask Documents

- Agregar resolvers para Documentos de referencia para Tareas de Proyectos

---

# What's new in María Ingeniería API Documents 2.1.0

2026-05-30

## Disposición digital "Perdido" (LOST) para archivos escaneados

- Nuevo valor `LOST` en el enum `DigitalDisposition`: permite registrar un documento que se sabe debería existir pero cuya copia física no se encuentra, sin exigir subir una imagen escaneada.
- Los campos de archivo de `ScannedFile` (`fileKey`, `fileName`, `fileSize`, `mimeType`) pasan a ser **nullable** en la base de datos y en el schema GraphQL para soportar registros sin archivo.
- `CreateScannedFileInput` incorpora el flag `markAsLost`: cuando es `true`, el registro se crea con disposición `LOST` y sin archivo; cuando es `false`/omitido, se siguen exigiendo los 4 campos de archivo (`BAD_USER_INPUT` si faltan).
- `ScannedFileStats` agrega el conteo `lost`.
- La recuperación `LOST → PENDING` se realiza con el resolver existente `resetScannedFileToPending` (permiso `DOCUMENTS_SCANNED_FILE_ADMIN_UPDATE`); luego puede subirse la imagen vía `updateScannedFile`.
- Requiere aplicar la migración Prisma `add_lost_disposition_nullable_files` en la BD `mi_document` de cada cliente.

---

# What's new in María Ingeniería API Documents 2.1.1

2026-07-09

## Actualización de dependencias

- Migración a **TypeScript 7** (compilador nativo).
- Actualización de `@apollo/server` 5.5.1, `@apollo/subgraph` 2.14.2, `prisma`/`@prisma/*` 7.8, `pg` 8.22, `@types/node` 26, `tsx`, `graphql-tag` y `@CLGonzalezGroh/mi-common` 2.1.
- `graphql` se mantiene en `^16` (Apollo aún no soporta `graphql` 17).

---

# What's new in María Ingeniería API Documents 2.1.2

2026-07-17

## Módulo digitalization en el catálogo compartido

- Se agrega `digitalization` a `MODULE_IDS` de `@CLGonzalezGroh/mi-common` (2.3.0).
- `MODULE_ID_TO_PRISMA` mapea `digitalization → null`: el módulo de digitalización gestiona su propia metadata de archivos y **no** etiqueta documentos en `mi-document` (ADR-018). No requiere un valor nuevo en el enum Prisma `ModuleType` ni migración.
- Actualización de dependencia `@CLGonzalezGroh/mi-common` a `2.3`.

---

# What's new in María Ingeniería API Documents 2.2.0

2026-08-08

## Trazabilidad funcional del subsistema de Gestión Documental

Primer bloque de la evolución documentada en `docs/EVOLUTION/BLOCK_01_TRAZABILIDAD_FUNCIONAL.md`. **No modifica el comportamiento funcional**: sustituye el registro de la traza y agrega su consulta.

- Dos objetos de dominio nuevos, inmutables: **`DocWorkflowEvent`** registra transiciones de estado (qué objeto cambió, desde qué estado y hacia cuál) y **`DocAuditEvent`** registra acciones ejecutadas (quién hizo qué, con sus datos de contexto). Enum `DocObjectType` para el objeto afectado.
- Las **25 escrituras funcionales** del subsistema documental —documentos, revisiones, versiones, workflows, transmittals y catálogos— dejan de escribirse en `DocumentSysLog` y pasan a emitir eventos.
- **`DocumentSysLog` no se modifica.** Conserva los errores técnicos de todos los subsistemas vía `handleError`, la traza de `ScannedFile` y `Area`, y sus operaciones de archivado. Sus pantallas siguen operando sin cambios.
- La emisión ocurre **dentro de la misma transacción** que aplica el cambio de estado: deja de ser posible un cambio sin su registro. Las operaciones que antes ejecutaban una sola sentencia quedaron envueltas en `$transaction`.
- Una acción puede producir **varias transiciones**: aprobar el último paso de un circuito emite la aprobación del paso, la del circuito, la de la revisión y una por cada revisión que queda `SUPERSEDED`.
- Nuevas consultas de solo lectura: `docWorkflowEvents(objectType, objectId)` y `docAuditEvents(objectType, objectId)`, en orden cronológico. Exigen el permiso de lectura del objeto consultado; **no se introdujo un permiso nuevo**.
- Nuevo escalar **`JSON`**, portado de `mi-digitalization`, usado por `DocAuditEvent.meta`.
- Primeras **pruebas automatizadas del módulo** con `node:test`, sin dependencias nuevas: `npm run test:block01` (28 pruebas, sin base) y `npm run test:block01-db` (agrega la verificación de persistencia y de la garantía transaccional).
- La lógica de completitud del circuito de revisión se extrajo a `src/utils/reviewWorkflow.ts` para poder probarla. Reproduce el comportamiento vigente sin modificarlo.
- Requiere aplicar la migración Prisma `add_domain_events` en la BD `mi_document` de cada cliente. Es **puramente aditiva**: un enum, dos tablas y tres índices, sin `ALTER` ni `DROP`.

---

# What's new in María Ingeniería API Documents 2.3.0

2026-08-09

## Contexto de proyecto y rol documental

Segundo bloque de la evolución documentada en `docs/EVOLUTION/BLOCK_02_CONTEXTO_DE_PROYECTO.md`. Incorpora la pertenencia del documento a un proyecto y el alcance de acceso por membresía. **No modifica el ciclo de revisión ni la circulación.**

### Cambio incompatible del contrato

- Se retiran **`entityType` y `entityId`** del tipo `Document`, del input `CreateDocumentInput` —donde eran obligatorios— y de los argumentos de `documentsByModule`. Los reemplaza `projectId`.
- `rover subgraph check` los marca como incompatibles. Se aceptaron con evidencia: la comparación se hizo contra **0 operaciones registradas**, la webapp no los consumía y `mi-quality` tampoco. **No se tocaron** los argumentos homónimos de `checkDocumentDependencies`, que identifican la entidad a borrar y no columnas de `Document`, ni nada de `Attachment`.
- Consecuencia funcional declarada: `checkDocumentDependencies` deja de contar documentos en sus ramas `FINDING` y `ACTION`. La rama `PROJECT` mejora, porque pasa a contar por `projectId`.

### Modelo

- **`Document.projectId`**, referencia externa sin clave foránea. Obligatorio por invariante cuando el módulo es `PROJECTS`; nulo en el resto, donde identifica el régimen de publicación: documentación que no circula y se gobierna por permiso global y clasificación.
- La unicidad del código pasa a **dos índices únicos parciales**: por proyecto para los documentos en circulación, por módulo para los publicados. Reemplaza a `[code, module, entityType, entityId]`, cuya tupla con columnas anulables no impedía duplicados.
- **`DocProjectSettings`**: un registro por proyecto con el rol documental —`ISSUER`, `RECEIVER` o `INTERNAL`— y el nombre de la contraparte, exigido en los dos primeros y prohibido en el tercero. El rol es inmutable desde que el proyecto tiene documentos o transmittals.
- **`DocProjectMember`**: membresía que habilita el acceso a un proyecto y declara el lado, `HOST` o `COUNTERPARTY`. Única por par usuario–proyecto, con baja lógica que conserva alta, baja y actor. No define rol ni permisos.
- Los eventos de dominio incorporan **`projectId` y `module`**, derivados del objeto afectado y nunca informados por quien emite. `DocObjectType` suma `DOC_PROJECT_SETTINGS` y `DOC_PROJECT_MEMBER`.

### Autorización

- La autorización pasa a combinar **dos capas**: el permiso global de `mi-admin` y la membresía vigente en el proyecto. Se aplica a las **27 operaciones** del subsistema documental.
- Dos formas según la operación: las que recaen sobre un objeto **exigen** membresía y rechazan con `FORBIDDEN`; los listados que no nombran un proyecto **filtran** el resultado a los proyectos alcanzados. Un listado que rechazara sería inutilizable, y un objeto que solo filtrara dejaría el acceso abierto.
- Administrar la configuración y la membresía se gobierna **solo por el permiso global**: el primer miembro de un proyecto no puede exigir una membresía que todavía no existe.
- **`ScannedFile` y `Area` quedan explícitamente fuera.** Sus 22 operaciones conservan la autorización global vigente: son el único subsistema con datos en producción y ningún usuario tiene membresía todavía.

### API

- Consultas nuevas: `docProjectSettings(projectId)` y `docProjectMembers(projectId, includeRevoked)`.
- Mutaciones nuevas: `declareDocProjectSettings`, `assignDocProjectMember` —que reincorpora si la membresía existía— y `revokeDocProjectMember`.
- `docWorkflowEvents` y `docAuditEvents` admiten filtrar por `module` y `projectId`.
- Seis permisos nuevos sobre dos recursos, en `@CLGonzalezGroh/mi-common` **2.5.0**: `documentsProjectSettings` y `documentsProjectMember`. Requieren `npm run seed:permissions` en `mi-admin` de cada despliegue.

### Pruebas

- **72 pruebas** en total. `npm run test:block02` sin base, `test:block02-db` con base, y `test:block02-all` que agrega la integración.
- Arnés de **integración** nuevo (`test:block02-integration`): ejercita los resolvers con token firmado y primera capa validada contra `mi-admin`. **Requiere `mi-admin` corriendo.** Levanta la limitación que el bloque anterior había declarado insalvable.

### Migraciones

Dos, a aplicar en la BD `mi_document` de cada cliente:

- `add_project_context` — **contiene `DROP COLUMN`** de `entityType` y `entityId`, además de las altas. Solo debe aplicarse tras verificar que las tablas del subsistema documental están vacías en esa base.
- `add_project_context_object_types` — puramente aditiva, dos valores de enumeración.

---

# What's new in María Ingeniería API Documents 2.4.0

2026-08-12

## Ciclo interno de revisión

Tercer bloque de la evolución documentada en `docs/EVOLUTION/BLOCK_03_CICLO_INTERNO.md`. **Es el primer bloque que cambia reglas funcionales**: el circuito abarca ahora el ciclo completo, desde el armado hasta la toma de conocimiento.

**Aplicado en los cinco clientes desplegados —testing y producción— y promovido a la SFS.**

Antes de migrar cada cliente hay que correr `210-mi-deploy/check-document-precondition.sh <cliente> <ambiente>`: exige el subsistema documental vacío **y** los catálogos sin duplicados con módulo o clase nulos. Un duplicado no cancela la migración, obliga a limpiarlo antes. Verificado con veredicto `APTO PARA MIGRAR` en los cinco clientes desplegados.

**Modelo, operaciones y contrato se despliegan en la misma ventana.** La migración corre automáticamente al arrancar el contenedor, de modo que actualizar la imagen migra y sirve el código nuevo en el mismo acto.

**Al actualizar la webapp**: `DocumentType.requiresWorkflow` pasa a `requiresFormalReview`. Es el único campo retirado con consumidor real, y afecta también a las pantallas de archivos escaneados, que lo arrastran a través de `ScannedFile.documentType`.

### Permisos (fase A)

Requieren `@CLGonzalezGroh/mi-common` **2.6.0** y `npm run seed:permissions` en `mi-admin` de cada despliegue.

- **`documents:documentsSettings:read` y `:update`** — recurso nuevo, para el registro único de configuración documental del despliegue.
- **`documents:workflow:admin:update`** — permiso único sobre el trabajo ajeno del circuito: firmar por otro, reasignar un paso pendiente, registrar una versión sobre un paso ajeno y consultar pendientes ajenos. Sigue el precedente de `documents:scannedFile:admin:update`.
- Reparto: `doc-basic` lee la configuración del despliegue; `doc-full` suma su edición y la administración de circuitos ajenos.

### Modelo y migración (fase B)

Migración `add_internal_review_cycle`, a aplicar en la BD `mi_document` de cada cliente. **Dos precondiciones**, verificables con `prisma/checks/block03_precondicion.sql`: el subsistema documental debe estar vacío en esa base, y los catálogos no deben tener duplicados con `module` o `classId` nulos —si los hay, hay que limpiarlos antes o la creación de los índices falla—.

- **Enumeraciones**: `StepType` suma `ASSIGN` y `PREPARE`; `StepStatus` suma `COMPLETED`, estado terminal de los pasos que se cumplen sin juzgar; `WorkflowStatus` **pierde `PENDING`** y suma `CANCELLED`; `RevisionStatus` suma `CANCELLED`; `RevisionScheme` pasa a `ALPHA`, `NUMERIC` y `FREE_TEXT`.
- **El circuito se instancia con la revisión** y admite varios sucesivos: cae el `@unique` de `ReviewWorkflow.revisionId` y lo reemplaza un índice parcial que admite **un solo circuito abierto** por revisión. Es lo que deja salida al documento rechazado.
- **La revisión abandonada no consume código**: la unicidad de `[documentId, revisionCode]` pasa a un índice parcial que excluye a las abortadas, de modo que sobre `A` puede abrirse `B`, abortarse y volver a abrirse `B`.
- **`DocStepSignature`**: la firma como objeto propio e inmutable, con el payload canónico persistido junto al hash y el algoritmo. `ReviewStep` pierde `signatureHash` y suma `resolvedById` y el motivo de delegación.
- **`DocWorkflowTemplate`** y sus pasos: plantilla del circuito con alcance `[projectId, documentClassId, documentTypeId]`, donde gana la más específica. **`DocSettings`**: registro único con el esquema de revisión por defecto del despliegue.
- **`DocumentRevision`** suma el armador designado —obligatorio— y los tres campos del abandono; `ReviewWorkflow` suma los de la cancelación y la plantilla propuesta.
- **`DocumentVersion.checksum` pasa a obligatorio.** Declarado: hoy nadie lo calcula —`mi-fileserver` no ve los bytes por diseño—, de modo que hasta la interfaz debe enviarlo quien invoca la API.
- **`Document` pierde `revisionScheme`**: el esquema no se persiste, se elige al crear cada revisión. **`DocumentType.requiresWorkflow` se renombra a `requiresFormalReview`**, conservando los valores cargados.
- Las **cuatro restricciones de `DocumentClass` y `DocumentType`** pasan a `NULLS NOT DISTINCT`: hasta ahora dos entradas sin módulo no se consideraban duplicadas, que es el caso más frecuente en un catálogo recién sembrado.

### Utilidades (fase C)

- **`revisionScheme`**: sucesor del código, inferencia del esquema a partir del último código, y la validación que faltaba —bajo `ALPHA` y `NUMERIC` el sistema calcula el código y rechaza el informado; bajo `FREE_TEXT` lo ingresa el usuario—. Cambiar de esquema reinicia la secuencia: de `C` a `NUMERIC` da `0`. Las revisiones se ordenan **por creación y nunca por código**.
- **`stepSignature`**: construcción del payload canónico y verificación posterior sobre lo persistido. La firma pasa a acreditar la versión con su `checksum` y la metadata del documento vigente al firmar, además de quién estaba asignado y quién resolvió.
- **`reviewWorkflow`**: la partición entre pasos que **deciden** —`REVIEW` y `APPROVE`— y pasos que **se cumplen** —`ASSIGN`, `PREPARE` y `ACKNOWLEDGE`— deja de estar implícita.

### Operaciones (fase D)

- **`initiateReview` se retira** y se reparte en dos: **`defineWorkflow`** completa el armado y materializa los pasos, y **`submitRevision`** completa la elaboración, exige al menos una versión y pasa la revisión a revisión. **`switchRevisionScheme` se retira**: el esquema ya no se persiste.
- **Operaciones nuevas**: `acknowledgeStep` cierra la toma de conocimiento, que hasta ahora quedaba pendiente para siempre; `reassignStep` cambia el actor de un paso pendiente con motivo; `cancelRevision` abandona una revisión en curso; y la administración de plantillas y de la configuración del despliegue.
- **`createDocument` y `createRevision`** dejan de exigir archivo, designan armador, instancian el circuito y proponen código y plantilla. El archivo sigue siendo admisible, para el documento preexistente.
- **`registerVersion`** admite registrar durante la revisión, exige `checksum` y que exista un paso en curso: la versión la produce quien lo tiene asignado, o quien cuente con el permiso de administración del circuito.
- **`updateDocument`** rechaza editar la identificación cuando la revisión vigente está aprobada. Corregirla exige abrir una revisión nueva.
- **`approveStep` y `rejectStep`** verifican que el actor sea el asignado —o exigen permiso y motivo—, y **firman con payload verificable**. El rechazo abre un circuito nuevo desde la elaboración con el mismo elenco: **un documento rechazado ya no queda sin salida**.
- **`pendingReviewSteps`** devuelve los del usuario autenticado; consultar los de otro exige el permiso de administración. Ya no oculta los acuses de circuitos cerrados.
- **`Document.currentRevision`** pasa a devolver **solo la revisión aprobada**, o nada. La revisión en curso se lee en **`lastRevision`**. Es un cambio de significado sin cambio de forma: antes devolvía un borrador cuando no había ninguna aprobada.

### Trazabilidad

- El catálogo pasa de **28 a 35 acciones** de auditoría: retira `InitiateReview` y `SwitchRevisionScheme`, y suma `DefineWorkflow`, `SubmitRevision`, `AcknowledgeStep`, `ReassignStep`, `CancelRevision`, las tres de plantilla y `DeclareDocSettings`.
- Transiciones nuevas: `WorkflowCancelled` —que separa la cancelación del rechazo, hasta ahora indistinguibles en la traza—, `RevisionCancelled` y `StepCompleted`.
- Tipos de objeto nuevos: `DOC_STEP_SIGNATURE`, `DOC_WORKFLOW_TEMPLATE` y `DOC_SETTINGS`, con su derivador de contexto. Migración `add_internal_cycle_object_types`, puramente aditiva.
- Los tres quedan **consultables desde `docWorkflowEvents` y `docAuditEvents` sin cambios**: esas consultas resuelven el permiso desde el catálogo y el alcance desde el derivador.

### Contrato GraphQL

`rover subgraph check` ejecutado contra `Maria-Ingenieria@current`: **Operation Check y Linter Check aprobados**, con 179 cambios comparados contra 49 operaciones registradas y **ninguna afectada**.

**Cambios incompatibles aceptados**, ninguno con consumidor: se retiran `Document.revisionScheme`, `DocumentRevision.workflow`, `DocumentType.requiresWorkflow`, `ReviewStep.signatureHash`, las mutaciones `initiateReview` y `switchRevisionScheme`, el archivo obligatorio de los inputs de alta, el valor `ALPHABETICAL` y el valor `PENDING`; `checksum` pasa a obligatorio y `pendingReviewSteps.userId` a opcional.

> **Atención al migrar**: `Document.currentRevision` **cambia de significado sin cambiar de forma**, de modo que ninguna herramienta lo señala. Antes devolvía la revisión aprobada o, en su defecto, la que estuviera en curso; ahora devuelve **solo la aprobada**, y es nula hasta la primera aprobación. La revisión en curso se lee en el campo nuevo **`lastRevision`**.

Tipos nuevos: `DocStepSignature`, `DocWorkflowTemplate`, `DocWorkflowTemplateStep` y `DocSettings`.

**Corrección fuera del bloque**: el resolver de `DocumentSysLogArchive.user` estaba registrado con el nombre de tipo en plural y por lo tanto nunca corría —el usuario del log archivado devolvía nulo—. Apareció al cruzar el contrato contra los resolvers.

### Pruebas

**177 pruebas**, de 72: **101 puras**, **42 contra base** y **34 de integración**. `npm run test:block03` corre las suites sin base, `test:block03-db` agrega las de base y `test:block03-all` la integración completa.

- **Cuatro recorridos de punta a punta**: documento nuevo, documento preexistente con archivo adjunto, rechazo con circuito nuevo sobre la misma revisión, y abandono a mitad de circuito con recuperación del código.
- **Restricciones del modelo contra base**: los dos índices parciales, las cuatro restricciones de catálogo con nulos, el alcance de la plantilla, la firma única por paso y la continuidad de la secuencia de versiones entre circuitos.
- **Derivación de contexto de los trece tipos de objeto**, incluido que un objeto inexistente devuelva nulo en lugar de contexto vacío —la distinción de la que depende la autorización—.

---

# What's new in María Ingeniería API Documents 2.5.0

2026-08-14

## Titularidad por nivel (BLOQUE 03B)

Bloque en curso. Esta sección se extiende con cada fase.

### Fase A — Permisos

- Actualización de `@CLGonzalezGroh/mi-common` a `2.7.0`.
- **Permiso nuevo** `documents:document:obsolete`, dado de alta en `205-mi-admin` 2.2.6. Habilitará reemplazar un documento por otro que lo supera y declararlo obsoleto por fuera de alcance, cuando la fase E incorpore esas operaciones.
- Sin cambios de comportamiento todavía: ninguna operación exige el permiso nuevo.

### Fase B — Vocabulario de los estados terminales

Una palabra por nivel, y exclusiva de ese nivel: el circuito se **cancela**, la revisión se **abandona** y el documento queda **obsoleto**. Hasta acá el estado de la revisión abandonada se llamaba `CANCELLED`, la misma palabra del acto que retira el circuito **sin** abandonar la revisión.

- `RevisionStatus.CANCELLED` pasa a `ABANDONED`, y se retira `OBSOLETE`, que estaba declarado sin uso. `BLOCK_04` no lo necesita: la calificación de la contraparte es el resultado del paso y no un estado de la revisión.
- Los campos del abandono pasan a `abandonedAt`, `abandonedById` y `abandonReason`.
- La mutación `cancelRevision` pasa a `abandonRevision`.
- En la traza, `CancelRevision` pasa a `AbandonRevision` y `RevisionCancelled` a `RevisionAbandoned`.
- **`WorkflowStatus.CANCELLED` y las columnas `cancel*` de `review_workflows` no se tocan**: la palabra queda reservada al circuito.

`rover subgraph check` contra `Maria-Ingenieria@current`: **Operation Check y Linter Check aprobados**, con ocho cambios incompatibles y **ninguna operación registrada afectada**. Ningún consumidor escrito a mano en la webapp usaba los nombres viejos.

> **Atención al migrar**: la migración `20260814120000_terminal_state_vocabulary` recrea el tipo `RevisionStatus` para poder retirar `OBSOLETE`. **Verifica primero que ninguna fila lo use y aborta** en lugar de perder datos. El índice único parcial `document_revisions_code_key` se recrea sobre `status <> 'ABANDONED'`.

### Fase C — Modelo y migración

Los tres datos que el bloque mueve de nivel quedan en su lugar. **Sin cambios de comportamiento todavía**: las operaciones hacen lo mismo que antes sobre el modelo nuevo.

- **La metadata de identificación pasa a la revisión.** `DocumentRevision` incorpora `title`, `documentTypeId` y `documentClassId`. Vive ahí porque está impresa en el rótulo, y lo impreso pertenece a la emisión que lo produjo. Se copia de la revisión anterior al crear la siguiente.
- **El documento la conserva como copia, nombrada por su lectura.** `title`, `documentTypeId` y `documentClassId` pasan a `currentTitle`, `currentDocumentTypeId` y `currentDocumentClassId`: son la lectura de la revisión **en curso**. Lo que dice el rótulo aprobado se lee en `currentRevision.title`.
- **El documento incorpora su obsolescencia**: `obsoletedAt`, `obsoletedById` y `obsoleteReason`. Distinta de `terminatedAt`, que es baja lógica.
- **La versión pasa a ser un conjunto de archivos.** `DocumentVersion` deja de llevar el archivo en línea y expone `files`, cada uno con su rol —entregable, fuente o respaldo—. Las versiones existentes se migran con rol `DELIVERABLE`.
- **Entidades nuevas**: la copia de trabajo con sus archivos, y el acto de reemplazo N:M con sus ítems. Todavía sin operaciones que las produzcan.

`rover subgraph check`: **aprobado**, sin operaciones registradas afectadas. **180 pruebas, 0 fallos**, con tres nuevas sobre las restricciones incorporadas.

> **Atención al migrar**: la migración `20260814140000_ownership_by_level` respalda la metadata del documento a **todas** sus revisiones. Para la revisión en curso el valor es exacto; para las aprobadas es la mejor aproximación disponible, porque no existe historia de la que reconstruir lo que cada una decía. Se ejercitó sobre una base vacía: conviene contrastar los conteos de `document_revisions` y `doc_version_files` antes y después.

---
