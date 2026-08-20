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

### Fase D — Utilidades puras

Cuatro derivaciones, todavía sin operaciones que las usen.

- **El payload firmado pasa a `v2`.** La identificación —título, clase y tipo— se muda de `document` a `revision`, porque es ahí donde vive; bajo `document` queda el código, que no necesita snapshot porque no cambia. Y la versión acredita **todos** los archivos de su conjunto, incluida la fuente que nadie revisó: que hayan sido firmados juntos es lo que sostiene su correspondencia con el entregable.
- **Las firmas anteriores siguen verificándose.** Verificar es recalcular sobre el payload guardado, y `payloadVersion` declara con qué reglas leer cada uno.
- **Los archivos se ordenan por rol y después por key antes de firmar.** La serialización canónica ordena las claves de los objetos pero conserva el orden de los arreglos: sin fijarlo, la misma versión habría producido hashes distintos según cómo viniera de la consulta.
- **La réplica de metadata reusa `lastLiveRevision`**, la misma función de la que sale el código sucesor. De ahí cae sola la propiedad buscada: abandonar una revisión devuelve la metadata anterior sin revertir nada.
- **La causa de la obsolescencia se deriva del papel en el acto de reemplazo**, no de su existencia.
- **La copia de trabajo distingue cambio de reordenamiento**: cambió si cambió el checksum o el rol. Arrastrar la fuente sin volver a subirla no es un cambio.

**210 pruebas, 0 fallos.** Suites nuevas `test:document-metadata` y `test:working-copy`, y los guiones `test:block03b`, `test:block03b-db` y `test:block03b-all`.

### Fase E — Operaciones

Primera fase que cambia comportamiento.

- **`updateRevisionMetadata`** — la identificación (título, clase, tipo) se edita sobre la revisión, y la copia del documento se replica en el mismo acto.
- **`updateDocument`** queda solo con lo administrativo, y **pierde su precondición de congelamiento**: lo que edita no aparece en ningún rótulo, de modo que corregir una descripción ya no exige abrir una revisión.
- **`correctDocumentCode`** — corrige el código mientras el documento no tenga ninguna revisión aprobada, con acción propia en la traza.
- **`replaceDocuments`** — el acto N:M entre documentos del mismo ámbito. Los reemplazados quedan obsoletos en el mismo acto.
- **`obsoleteDocument`** — la segunda causa: fuera de alcance, sin que nada reemplace.
- **La copia de trabajo**, con cinco operaciones: `openWorkingCopy`, `putWorkingCopyFile`, `removeWorkingCopyFile`, `confirmWorkingCopy` y `discardWorkingCopy`. La versión nace al confirmar. Abrir precarga los archivos de la versión vigente, de modo que corregir el PDF arrastra el DWG sin volver a subirlo.
- **Resolver un paso —y someter— exige no tener copia abierta.** Declarar que se terminó con una iteración en curso es una contradicción.
- **`registerVersion` queda obsoleta.** Sigue funcionando; internamente escribe el conjunto con el archivo como entregable. Use `confirmWorkingCopy`, que recibe el conjunto completo en un solo acto.

**220 pruebas, 0 fallos.**

> **Atención**: `rover subgraph check` ahora informa *"Compared 47 schema changes against 0 operations"* y marca los retiros como fallo. **No cambió el código: no queda ninguna operación registrada en la ventana**, y sin operaciones el veredicto por defecto de un cambio incompatible es el fallo. Lo que el `PASSED` de las fases anteriores afirmaba era que ninguna operación registrada usaba lo retirado, no que el cambio no fuera incompatible. La evidencia que sostiene los retiros es la búsqueda del nombre viejo en `201-mi-webapp`, donde ningún consumidor escrito a mano los usa.

### Fase F — Trazabilidad

- **Tipo de objeto nuevo `DOC_REPLACEMENT`.** El acto de reemplazo toca varios documentos y ninguno lo representa: su traza cuelga del acto, que es lo que tiene identidad propia. Su contexto se deriva de cualquiera de sus documentos, y eso está bien definido porque comparten ámbito.
- **La copia de trabajo no recibe tipo propio**: su traza cuelga de la revisión. No es un objeto del dominio sino el conjunto en preparación de esa revisión, y lo que se consulta es qué le pasó a la revisión.
- La derivación de contexto pasa a cubrir **los catorce tipos**.

**224 pruebas, 0 fallos.**

> **Atención al migrar**: la migración `20260814160000_replacement_object_type` agrega un valor a `DocObjectType`. Es puramente aditiva.

### Fase G — Contrato GraphQL

- **Tipos nuevos**: `DocVersionFile`, `DocWorkingCopy`, `DocWorkingCopyFile`, `DocReplacement` y `DocReplacementItem`.
- **Enumeraciones nuevas**: `DocFileRole`, `DocReplacementRole` y `ObsolescenceCause`, más `DOC_REPLACEMENT` en `DocObjectType`.
- **Nueve mutaciones nuevas**: `updateRevisionMetadata`, `correctDocumentCode`, `replaceDocuments`, `obsoleteDocument` y las cinco de la copia de trabajo.
- `Document` expone `obsoletedAt`, `obsoletedBy`, `obsoleteReason`, `obsolescenceCause` —derivada— y `replacementItems`.

> **Cambios incompatibles**, ninguno con consumidor escrito a mano: se retiran `registerVersion` y `RegisterVersionInput`; `Document.title`, `documentType` y `documentClass` —pasan a `currentTitle`, `currentDocumentType` y `currentDocumentClass`—; los campos de archivo de `DocumentVersion`, que ahora viven en `files`; y `title`, `documentTypeId` y `documentClassId` de `UpdateDocumentInput`, que se editan sobre la revisión.

> **Atención al migrar**: quien invocaba `registerVersion` debe usar `confirmWorkingCopy`, que recibe el conjunto completo en un solo acto y hace exactamente lo mismo para un archivo.

**230 pruebas, 0 fallos**, con una suite nueva que verifica que el contrato y los resolvers digan lo mismo en las dos direcciones — el defecto que ni `tsc` ni `rover` detectan.

### Fase H — Pruebas de las tres capas

**238 pruebas, 0 fallos**: 138 puras, 46 contra base y 54 de integración.

- **Un documento obsoleto ya no admite revisiones nuevas.** El invariante estaba especificado y **no implementado**: `createRevision` no miraba la obsolescencia. Lo encontró la auditoría de los criterios de aceptación, no la compilación ni las pruebas acumuladas. Emitir sobre lo que fue superado, o sobre lo que salió del alcance, es contradictorio; todo lo demás del documento se conserva.
- Ocho criterios cubiertos a medias quedaron completos: la firma con los tres archivos y sus checksum, el filtro resolviendo sobre el documento, las dos lecturas del título a la vez, el acto alcanzable desde los tres documentos, el código de un obsoleto que sigue tomado, la causa derivada distinguiendo las dos, la ausencia de `CANCELLED` en toda revisión, y la equivalencia entre el atajo de confirmación y la secuencia incremental.

### Fase I — Cierre

El bloque queda **promovido a la SFS**. Ocho documentos de dominio actualizados, dos de ellos nuevos —`DocReplacement` y `DocWorkingCopy`—, y los principios pasan de trece a diecisiete.

- El contrato se publicó en `Maria-Ingenieria@current` y **el supergrafo compuso sin errores**, que es la verificación que el `rover check` no podía dar con cero operaciones registradas.
- La webapp regeneró sus artefactos con `npm run codegen` y **compila limpio**: ningún consumidor quedó apuntando a lo retirado.

> Los guiones de publicación usan `--routing-url http://localhost:4209`, de modo que solo afectan al desarrollo local. Testing y producción leen el supergrafo de un archivo montado.

---

# What's new in María Ingeniería API Documents 2.6.0

2026-08-15

## Emisión y respuesta (BLOQUE 04)

Bloque en curso. Esta sección se extiende con cada fase.

### Fase 1 — El catálogo de calificaciones

La respuesta de la contraparte se expresaba con `ClientStatus`, **enumeración fija de cuatro valores**. No resiste el uso real: cada cliente tiene su propio juego de calificaciones, con sus códigos y su cantidad, y el rótulo que el usuario ve es el del cliente y no una traducción nuestra.

- **`DocQualification`**, con código, rótulo y efecto. Los dos primeros son lo que el usuario ve; el efecto es lo único que el sistema interpreta.
- **El efecto es una enumeración de tres valores** —`ACCEPTED`, `ACCEPTED_WITH_COMMENTS`, `REJECTED`— y no dos indicadores. Responde dos preguntas independientes: ¿habilita usar el documento? ¿obliga a emitir una revisión nueva? Solo tres de las cuatro combinaciones existen, porque si el documento no sirve hay que volver a emitirlo. Con dos booleanos la cuarta puede escribirse en la base y hay que impedirla por validación; así no puede expresarse. Las dos preguntas se **exponen derivadas** en el contrato, para que ningún consumidor las deduzca por su cuenta.
- **Alcance por despliegue y por proyecto, sin herencia.** El proyecto que declara una calificación propia usa las suyas y solo las suyas. Es una diferencia deliberada con el alcance de los catálogos de clase y tipo: la lista de calificaciones es la del **contrato**, y una lista mezclada no es la de nadie y admite calificar con un valor que la contraparte no usa.
- **La baja lógica no cambia el alcance.** El alcance se decide sobre el catálogo completo y las dadas de baja se filtran después: dar de baja la última calificación propia no devuelve el proyecto al catálogo del despliegue. Y lo ya calificado no se revalida — la validación ocurre solo en escritura.
- **El alcance no se edita.** Mover una calificación entre el despliegue y un proyecto cambiaría los valores disponibles sin que nadie lo declare: se crea en el alcance que corresponde y se da de baja la que sobra, que además deja la traza de las dos cosas.
- **Autorización en dos capas**, con el criterio de `BLOQUE 02`: la calificación de un proyecto exige membresía, la del despliegue se resuelve con el permiso global.
- **Cuatro acciones nuevas de auditoría y dos transiciones**, más `DOC_QUALIFICATION` como tipo de objeto con su derivador de contexto. El catálogo tiene traza propia porque es configuración del contrato: quién agregó o dio de baja una calificación explica por qué una respuesta pudo registrarse con ese valor.

**`ClientStatus` no se retira todavía.** Sigue en `transmittal_items` hasta que la fase 4 lo reemplace junto con la respuesta: retirarlo ahora dejaría al módulo sin forma de registrar una respuesta entre una fase y la otra.

- Actualización de `@CLGonzalezGroh/mi-common` a `2.8.0`.
- **Permisos nuevos** `documents:qualification:{read,list,select,create,update,delete}`, dados de alta en `205-mi-admin`. El rol básico lee y selecciona; el rol completo administra.

> **Atención al migrar**: `20260815120000_qualification_catalog` crea la tabla y **siembra el catálogo del despliegue** con las cuatro entradas que `ClientStatus` tenía, de modo que el despliegue queda operativo sin configurar nada. `20260815140000_qualification_object_type` agrega el valor a `DocObjectType` y va aparte porque PostgreSQL no admite usar un valor de enumeración recién creado en la misma transacción.

**247 pruebas, 0 fallos.**

### Fase 2 — Naturaleza, sentido derivado y código por proyecto

Cierra **H-29** y **H-16**, y resuelve `B11` de `BLOQUE 02` en la dirección que aquel bloque anticipó.

- **`TransmittalNature`** con dos valores, `EMISSION` y `RESPONSE`. La clasificación relevante no es la dirección sino el **propósito**, que es lo que determina qué reglas lo gobiernan.
- **El sentido no se almacena: se deriva** del rol del proyecto y de la naturaleza, y se expone resuelto en el contrato como `direction`. Un dato guardado puede contradecir a los hechos y obliga a inventar una precondición que tape la incoherencia — es el criterio con que `BLOQUE 03` retiró el esquema de revisión del documento.
- **Tres invariantes salen de esa misma tabla**, sin configuración: un proyecto interno no admite transmittals de ninguna naturaleza; en modo Receptor no existe el de respuesta; y una respuesta referencia **necesariamente** una emisión del mismo proyecto. Hay una prueba que recorre las seis combinaciones y verifica que el sentido sea nulo exactamente donde la naturaleza es inválida: un sentido nulo sin violación dejaría un transmittal creable cuyo sentido nadie puede establecer.
- **`issuedTo` se retira.** El destinatario de una emisión es la contraparte del proyecto, que es única y ya vive en `DocProjectSettings.counterpartyName`. Guardarla por registro permitía que dos transmittals del mismo proyecto declararan destinatarios distintos, que es lo que la unidad contractual considera inválido.
- **`counterpartyReference`**: cómo la contraparte nombra el transmittal en su sistema. Aplica a los dos casos entrantes y es un dato del remito ajeno, no un remito propio.
- **El código es único por proyecto y se calcula dentro de la transacción**, con el índice `[projectId, code]` como árbitro y reintento acotado. Eran los dos defectos de H-16 en el mismo lugar: numeración global —cuando el proyecto es la unidad contractual— y cálculo fuera de la transacción, de modo que dos emisiones simultáneas obtenían el mismo número. La prueba de concurrencia crea cinco a la vez y verifica que salgan `TR-001` a `TR-005`.
- **El proyecto debe haber declarado su rol** para que circule documentación. El rol se declara y no se deduce (D-19): es el rol el que dice si el transmittal sale, si entra, o si no existe.

> **Atención al migrar**: `20260816120000_transmittal_nature_and_code` agrega `nature` con default `EMISSION` para poblar lo existente y **retira el default enseguida** —la naturaleza debe informarse al crear—, elimina la columna `issuedTo` y reemplaza la unicidad global de `code` por `[projectId, code]`.

> **Cambios incompatibles**, sin consumidores: `Transmittal.issuedTo` desaparece del tipo y del input, `CreateTransmittalInput` exige `nature`, y la búsqueda del listado pasa de buscar en el destinatario a buscar en la referencia de la contraparte.

**269 pruebas, 0 fallos**, con una suite de integración nueva para la circulación.

### Fase 3 — La puerta de emisión y las reglas del propósito

Cierra **H-11** y le da a `PurposeCode` sus dos primeras reglas de comportamiento: existía desde el origen del módulo y ninguna validación lo consultaba.

- **La puerta se aplica al incorporar el ítem, y no solo al emitir.** Una revisión en circuito no es candidata a salir, de modo que tampoco es candidata a entrar en la carpeta: admitirla en borrador para rechazarla después obliga a armar el transmittal con documentos que van a trabar la emisión, y a descubrirlo al final. Se verifica de nuevo al emitir, porque entre una cosa y la otra la revisión pudo abandonarse.
- **Sin excepción por propósito**, según D-18. Y **solo donde la emisión es saliente**: en modo Receptor no hay puerta, y no es una excepción a la regla sino su consecuencia — la puerta exige aprobación **interna**, y el contratista no la hace dentro del sistema.
- **Una revisión se emite una sola vez**, sostenido por unicidad de `documentRevisionId` en el ítem y no por validación. La unicidad anterior era por transmittal, de modo que la misma revisión podía salir en dos. Absorbe dos reglas que estaban planteadas por separado: una revisión respondida tampoco vuelve a emitirse —ya salió— y un reintento del emisor no puede duplicar la emisión.
- **Primera regla del propósito**: declara si se espera calificación. Para aprobación y revisión sí; para información, construcción y conforme a obra no. Es expectativa y no permiso — una respuesta sobre una emisión informativa se registra igual. Sin ella, la bandeja de lo que falta contestar acumula para siempre emisiones que nadie va a responder.
- **Segunda regla**: qué archivos espera. La emisión final —apto para construcción, conforme a obra— espera el editable además del entregable. **Es advertencia y no puerta**, por dos motivos. El caso legítimo existe: el editable pesa cientos de megabytes o llega en un formato que no viaja por el mismo canal. Y el que decide: al emitir, la revisión ya está aprobada y su versión es inmutable, de modo que **no hay forma legal de agregar la fuente que falta** — una puerta dura exigiría algo que el propio sistema hace imposible. De ahí el principio: *una puerta solo puede ser dura si existe una manera legal de satisfacerla*.
- **La advertencia se adelanta al momento en que sirve.** `DocumentRevision.missingFileRoles(purpose:)` la responde mientras la revisión está abierta y la copia de trabajo sin confirmar, tomando el propósito por argumento porque la revisión todavía no sabe con cuál va a salir. En la emisión se repite, ya sin remedio, y **el hecho queda en la auditoría**: el caso legítimo pasa a ser un dato registrado en lugar de un silencio.

**Un defecto que encontraron las pruebas y no la compilación.** La advertencia leía los archivos de la versión que el padre traía precargada, y varias consultas la incluyen **sin ellos**: daba "faltan todos" con la misma confianza que una respuesta correcta. Ahora la precarga se usa solo si trae sus archivos, que es la distinción que el módulo ya hacía un nivel más arriba entre *no vinieron* y *no hay*.

> **Atención al migrar**: `20260816140000_emission_gate` reemplaza la unicidad `[transmittalId, documentRevisionId]` del ítem por una sobre `documentRevisionId` a secas, y repone el índice de acceso por transmittal.

**287 pruebas, 0 fallos.**

**Los ítems se editan en borrador**, adelantado desde la fase 5 (`B9`, cierra **H-13**). `addTransmittalItem` y `removeTransmittalItem` permiten crear el transmittal vacío y vincular los documentos después.

El adelanto tiene un motivo y no es solo comodidad: `B3` formula la puerta **al incorporar el ítem**, y sin estas operaciones el único momento en que un ítem se incorporaba era la creación — la regla quedaba escrita para un caso que no podía probarse. Ahora tiene su caso propio, y con él la contracara de la unicidad: **quitar el ítem libera la revisión** para otra carpeta, porque nunca salió.

- **Emitido, el contenido queda fijo.** Corregir una emisión ya salida no es editarla sino emitir otra. Es el tercer nivel en que el módulo aplica el mismo corte: la versión no se modifica, la revisión aprobada tampoco.
- **Solo la emisión lleva ítems.** La respuesta cuelga del ítem de la emisión que contesta y no crea uno propio — es lo que justifica que la unicidad de la fase 3 vaya sin condiciones.
- Dos acciones de auditoría nuevas. Quitar un ítem libera una revisión, y sin registro esa liberación sería inexplicable después.

**292 pruebas, 0 fallos.**

### Fase 4 — La respuesta como objeto propio del ítem

Cierra **H-30**, **H-33** y **H-14**, y retira `ClientStatus` en favor del catálogo que incorporó la fase 1.

- **`DocTransmittalResponse`, una por ítem.** La respuesta deja de ser dos columnas del ítem y pasa a ser un objeto, con un solo dato obligatorio —la calificación— y todo lo demás opcional. **H-14 desaparece por construcción**: ya no existe la operación que actualizaba ítems por identificador sin verificar a qué transmittal pertenecían.
- **El archivo que devuelve la contraparte no es una versión.** La regla vale para los dos modos con un solo enunciado: *un archivo producido dentro del circuito, por quien tiene el paso vigente, es una versión; un archivo que llega de afuera es evidencia de una respuesta*. En modo Emisor el cliente no tiene paso ni firma nuestra; en modo Receptor la misma regla da el resultado contrario, y las marcas de la planta sí son versiones. Los archivos devueltos no son ninguno de los tres roles de `DocFileRole` porque no integran la entrega, y su `checksum` es opcional: nadie firma la respuesta.
- **Autoría diferenciada.** Quién respondió va como **texto** —el cliente que contesta por correo no es usuario del sistema y no tiene `User` que lo represente—, quién la registró como referencia a `User`, y la fecha real frente a la de registro. La divergencia se **deriva** de que ambos existan, en lugar de almacenarse como indicador, con el criterio de D-04 sobre la firma delegada.
- **Las dos vías de D-18 con un solo objeto.** Si la respuesta llegó consolidada en un remito, la respuesta declara ese sobre; si llegó documento a documento —la práctica actual— va nulo. El sobre debe contestar **la emisión por la que ese documento salió**: sin esa condición, un remito podría transportar la calificación de documentos que nunca contestó.
- **La calificación debe pertenecer al catálogo vigente del proyecto.** El alcance de la fase 1 deja de ser decorativo: una lista mezclada admite calificar con un valor que la contraparte no usa.
- **La respuesta no cambia el estado de la revisión**, y `currentRevision` devuelve lo mismo antes y después. Es lo que D-26 resolvió al eliminar `RevisionStatus.OBSOLETE`: la respuesta no es un estado de la revisión, y dos máquinas de estados sobre el mismo hecho es el defecto que el §1 previene. Lo que sí acompaña es el transmittal, que pasa a respondido con la primera respuesta — parciales y sin bloquear, según D-18.
- **La respuesta se corrige, con auditoría.** Nadie la firma, de modo que la inmutabilidad de la versión no le aplica; y siendo transcripta a mano, el error es esperable. El evento conserva **el valor anterior**: sin él, la corrección registraría que algo cambió sin decir desde qué.
- **Solo se responde lo que salió** (D-18). Un transmittal cerrado sí admite respuesta tardía: cerrar declara que se dejó de esperar, no que se dejó de escuchar.

> **Cambios incompatibles**, sin consumidores: se retiran `respondTransmittal` y `RespondTransmittalInput`, la enumeración `ClientStatus` en sus dos formas, `TransmittalItem.clientStatus` y `clientComments`, y `Transmittal.responseAt` y `responseComments`. Las reemplazan `registerItemResponse` y `correctItemResponse`.

> **Atención al migrar**: `20260816160000_item_response` crea las dos tablas y **elimina el tipo `ClientStatus`** junto con las columnas que lo usaban. `20260816180000_response_object_type` agrega el valor a `DocObjectType`, aparte por lo mismo de siempre.

**312 pruebas, 0 fallos.**

### Fase 5 — El acuse de recibo y el cierre

Cierra **H-12** y **H-15**.

- **El acuse le da operación al `ACKNOWLEDGED` que nadie asignaba.** Es el defecto que H-12 denunciaba: un valor de la enumeración que se aceptaba como estado de origen y ninguna operación ponía.
- **No es una calificación**, y hay una prueba de por qué: no dice nada sobre el documento, dice que el envío llegó. Forzarlo dentro del catálogo de calificaciones lo dejaría en la **cuarta combinación de efectos que D-22 declara inexistente** —no habilita nada y no obliga a nada— y rompería la regla que les da sentido a los dos efectos. Por eso vive en el transmittal y no en el ítem.
- **Solo en modo Emisor**, donde la emisión viaja afuera y no se sabe si llegó. En modo Receptor el contratista carga el transmittal dentro del sistema: no hay nada que acusar, y el acto equivalente es la confirmación de la recepción, que pertenece al circuito del rol Receptor. Declararlo evita implementar un estado que ahí no significa nada — el mismo defecto de H-12 al otro lado.
- **Misma autoría diferenciada que la respuesta**: quién acusó como texto, quién lo registró como `User`, fecha real y fecha de registro. Y **no es precondición de responder**: un cliente puede contestar sin haber acusado nunca.
- **El cierre es un acto documental explícito**, con motivo opcional, actor y fecha en el modelo. No exige respuestas completas: las parciales son la práctica normal, de modo que un cierre derivado de que todos los ítems estuvieran respondidos no ocurriría nunca.
- **Cerrar no impide una respuesta tardía.** Cerrar declara que se dejó de esperar, no que se dejó de escuchar; y la respuesta tardía tampoco reabre lo cerrado.
- **`responseProgress`, derivado**: cuántos ítems esperaban calificación y cuántos la tienen. Cuenta solo los que la esperan según su propósito — *faltan 3 de las 5 que esperaban respuesta* en lugar de *faltan 3 de 8*. Es lo que el cierre muestra, no lo que lo condiciona.

**El mismo riesgo de carga parcial de la fase 3, atajado antes de que mordiera.** El avance se deriva de si cada ítem tiene respuesta, y varias consultas los incluyen sin ella: contaría cero respondidos con la misma confianza que un conteo correcto. Los ítems precargados se usan solo si traen su respuesta, y `transmittalIncludes` ahora la incluye.

> **Cambios de contrato**, compatibles: `acknowledgeTransmittal` es nueva, y `closeTransmittal` gana un input opcional con el motivo.

**324 pruebas, 0 fallos.**

### Fase 6 — El circuito del rol Receptor

Ejecuta lo que `B16` de `BLOQUE 03` dejó habilitado y no implementó. Las dos diferencias del rol se desprenden de **un solo hecho**: allí la elaboración no ocurre dentro del sistema.

- **Armar es confirmar la recepción.** El circuito sin paso de elaboración ya funcionaba desde `BLOQUE 03`; lo que faltaba era que el armado dejara la revisión **sometida**, porque no hay elaboración que esperar. Sin eso quedaba en borrador con el circuito armado y ninguna operación capaz de moverla: `submitRevision` completa un paso que en este rol no existe.
- **La calificación es la conclusión del circuito**, no un dato al lado. Se exige exactamente cuando la resolución cierra el circuito —al aprobar el último paso que decide, o al rechazar en cualquiera— y se prohíbe fuera del modo Receptor, donde la calificación la produce el cliente y la transcribe el control documental. Queda registrada en la respuesta del ítem: **el mismo lugar donde los dos modos la leen igual**.
- **La operación elegida no puede contradecir al efecto.** Sin esa verificación el desenlace no se derivaría del efecto: se podría rechazar el paso con una calificación que habilita el documento, y el circuito quedaría diciendo lo contrario que la respuesta que la contraparte lee.
- **El rechazo concluye la revisión y no abre circuito nuevo.** La regla uniforme sigue siendo que el rechazo devuelve el trabajo a quien elabora; lo que cambia es dónde vive esa persona. En modo Emisor todo queda exactamente igual, con prueba que lo verifica.

**`RevisionStatus.REJECTED`, y una corrección a D-26.** Aquella decisión eliminó `OBSOLETE` afirmando que este bloque no necesitaría un estado terminal por respuesta de la contraparte. La confirmación se dio **antes** de construir este circuito, y es el único lugar donde el problema aparece: sin estado terminal la revisión rechazada quedaba en `DRAFT` para siempre y `createRevision` bloqueaba la emisión siguiente — **H-01 reapareciendo en el otro modo**.

No es el `OBSOLETE` retirado —obsoleto es lo que dejó de aplicar, y esto es una emisión que la contraparte no aceptó— y **consume código**, a diferencia de `ABANDONED`, porque salió y la contraparte la recibió con él. La secuencia sigue de largo en los tres desenlaces: rechazada la `A`, la siguiente es la `B`, igual que si hubiera sido aprobada. Que el rechazo no implique avance contractual es un asunto del progreso del proyecto, no del código de revisión. Lo que D-26 sostiene sigue en pie: la respuesta de la contraparte no es un estado de la revisión; `REJECTED` expresa la conclusión del **circuito**, que en este rol es interno a la planta.

> **Atención al migrar**: `20260817120000_revision_rejected` agrega el valor a `RevisionStatus`. Es aditiva, y el índice único parcial del código —que excluye solo a las abandonadas— sigue contando a las rechazadas sin cambios.

**No hay acto de armado del lado de la planta.** Emitir el transmittal entrante **arma el circuito de cada documento y somete su revisión**, sin intervención: quién revisa y quién califica está predefinido.

El mecanismo ya estaba construido y sin usar. `DocWorkflowTemplate` resuelve por **proyecto, clase y tipo con actores preasignados**, y al crear el documento el sistema ya deja adherida la plantilla aplicable al circuito. En proyectos **clase significa disciplina** —el nombre es genérico para que otros módulos clasifiquen con otro criterio—, de modo que la plantilla **es** la matriz de responsabilidad para los ejes que hoy existen; lo que la matriz diferida agregaría es el **área**, que depende de D-14.

Que el sistema pueda resolver ese armado se apoya en D-03: el armado siempre tiene contenido **porque el elaborador nunca se preasigna**, y acá no hay elaborador. Se resuelve con `resolvedById` nulo, en lugar de atribuirle el acto al contratista que emitió.

**Con red**: sin plantilla, o con algún paso sin actor, ese documento conserva su armado pendiente y la planta lo resuelve a mano, mientras el resto del transmittal avanza. Rechazar la emisión dejaría al contratista trabado por una configuración ajena.

**346 pruebas, 0 fallos.**

### Fase 7 — El documento pendiente, derivado

Cierra **H-31 sin incorporar ningún concepto**, que es lo contrario de lo que el plan anticipaba al anotarlo como *un concepto nuevo, sin correlato en el modelo actual*.

- **No hay documento esperado: hay documento.** Todo el que se da de alta en el proyecto lo es, y el que aparece después del alcance inicial también — nació más tarde, no es de otra clase. Esperado y adicional describen **cuándo apareció** y no **qué es**, y el cuándo ya lo registra la auditoría. Hay prueba de que los dos figuran igual.
- **Pendiente es el que todavía no salió**, y no necesita atributo: se deriva de la ausencia de ítem de transmittal, que es la misma relación que la fase 3 volvió única, leída al revés.
- **Se mira la revisión en curso, no cualquiera.** Mirar *ninguna revisión salió* sería más simple y estaría mal: después de que la contraparte rechaza, el documento debe la revisión siguiente, y con aquella lectura dejaría de figurar para siempre por haber salido una vez. Es la misma `lastRevision` de `BLOQUE 03` y la misma de la que se deriva el código sucesor — una regla con tres usos.
- **En modo Emisor es también la lista de candidatos**: lo que el control documental mira para armar el próximo transmittal y lo que mira para saber qué debe todavía es la misma consulta. Lo que está en circuito no figura — es trabajo en curso, no deuda.
- **En modo Interno devuelve vacío, y no es un error**: sin contraparte no hay emisión, de modo que no hay nada pendiente de salir. Es literalmente cero.

La condición se resuelve en memoria y no como `where`: la regla de cuál es la revisión en curso ya vive en `lastLiveRevision`, y reescribirla en el lenguaje de la consulta la duplicaría con el riesgo de que las dos versiones se separen.

**360 pruebas, 0 fallos.**

### Fase 8 — Migración, contrato y auditoría de los criterios

- **La ruta completa de migración se verificó de punta a punta**, reconstruyendo en una base limpia el estado **previo a todo el bloque** —catorce migraciones— y aplicando encima las ocho del bloque. Aplican limpio y en orden.
- **`prisma/checks/block04_precondicion.sql`**, de solo lectura, para correr contra cada cliente antes de migrar: transmittals e ítems con datos, respuestas del cliente ya registradas —el dato que la migración descartaría sin destino—, códigos repetidos por proyecto y revisiones emitidas más de una vez. Probado en los dos sentidos: **cero bloqueos con el subsistema vacío, y bloqueo con un transmittal registrado**. Suma un control informativo: los proyectos con documentos y sin rol documental declarado, que después de migrar no van a poder emitir.
- **Ningún consumidor escrito a mano quedó apuntando a lo retirado.** `issuedTo`, `clientStatus`, `clientComments`, `responseAt`, `responseComments`, `ClientStatus` y `respondTransmittal` aparecen en la webapp **solo** en artefactos generados por `codegen` y en un manual. Es la verificación que `BLOQUE 03` aprendió a hacer a mano, porque ni `rover` ni `tsc` la dan.

**Dos cosas que encontró la auditoría de los 22 criterios, y no la compilación:**

**Los permisos de la fase 1 nunca se habían sembrado.** Las pruebas de las fases 4 y 6 pasaban porque crean calificaciones con acceso directo a la base; la primera que ejercitó el resolver falló con *no estás autorizado*. Es exactamente el tercer paso del alta de un permiso —la constante, el alta en `mi-admin`, y **`npm run seed:permissions` en cada despliegue**— y sin él el catálogo es inoperable aunque todo compile.

**El criterio 22 estaba mal enunciado.** Afirmaba que `documents.ts` no registraba cambios, y sí los registra: la consulta de pendientes de la fase 7. Medido, resulta ser **puramente aditivo** —ninguna línea retirada ni modificada— y `revisions.ts`, `versions.ts`, `workingCopies.ts`, `replacements.ts` y `stepSignature.ts` no registran **una sola línea**. El criterio se corrigió para decir lo que la diferencia muestra, con las dos excepciones declaradas.

**Siete pruebas nuevas** cubren los criterios que estaban cubiertos a medias: el sobre que transporta respuestas sin ítems propios, la operación en lote retirada, la respuesta sin calificación, el actor de la corrección, el alcance del catálogo por proyecto resuelto por el resolver, el paso que queda rechazado, y que una respuesta fallida no deja evento suelto.

**El contrato se publicó y el supergrafo compuso.** `rover subgraph check` reportó **composición y linter en verde**, y su verificación de operaciones falla con **exactamente los 25 cambios incompatibles declarados** —`issuedTo`, `clientStatus`, `clientComments`, `responseAt`, `responseComments`, `respondTransmittal` y las enumeraciones e inputs que los acompañaban—, ninguno inesperado. La webapp regeneró sus artefactos con `codegen` y **compila limpio**: lo retirado desapareció y lo nuevo está.

**Dos defectos del contrato que solo apareció al verificar:**

**El esquema no parseaba.** Al retirar `ClientStatus` quedaron sus descripciones huérfanas, y las descripciones de tres tipos quedaron separadas de lo que describían. Ninguna verificación anterior lo vio: `tsc` no lee el `.graphql`, y la suite de contrato lo recorre con expresiones regulares, que no distinguen SDL válido de texto parecido a SDL. Se agrega **una prueba que lo parsea**, más otra que verifica que esa prueba detecta el defecto que la motivó — el error deja de necesitar credenciales y red para aparecer.

**`qualificationsSelectList` declaraba `SelectOption`**, que no existe en el contrato: el tipo del módulo es `SelectList`. Compilaba, porque el nombre venía del tipo de TypeScript de `mi-common`.

**369 pruebas, 0 fallos.**

---

# What's new in María Ingeniería API Documents 2.7.0

2026-08-17

## Ubicación física del documento (BLOQUE 02B)

Bloque en curso. Esta sección se extiende con cada fase.

### Fase 1 — El catálogo jerárquico, con rutas y baja lógica

El documento se ubica en una jerarquía física —**sitio ▸ planta ▸ área ▸ unidad de proceso**— que para el operador de una planta es el criterio principal de orden y de búsqueda: la documentación se consulta por dónde está el equipo, no por qué proyecto la produjo.

- **`DocLocation`**, auto-referencial y de **profundidad libre**: se carga como lista plana de un nivel o como árbol de varios, según cómo cada organización describa su instalación. El **sitio no es una entidad aparte**, es el nivel superior del mismo árbol — modelarlo por separado duplicaría la estructura sin agregar capacidad.
- **La ruta completa es denormalización y no evidencia.** Existe para evitar el recorrido recursivo en cada listado y en cada filtro, y ordenar por ella agrupa cada rama con su descendencia, que es lo que una pantalla de árbol necesita. Como la ubicación se edita siempre y **no integra el payload de la firma**, renombrar o mover un nodo recalcula las rutas de su descendencia **de forma automática**: no hay propagación explícita ni auditada, que es donde este catálogo se aparta del precedente de digitalización, donde el snapshot forma parte de una publicación.
- **Mover tiene operación y acción propias**, separadas de editar. Reescribe la ruta de toda una rama, de modo que sin registro del movimiento los cambios de nodos que nadie tocó serían inexplicables después. Y **verifica el ciclo**: una ubicación no puede colgarse de sí misma ni de su propia descendencia, porque la rama quedaría desconectada de toda raíz y ningún recálculo la alcanzaría. El precedente no lo necesita porque no admite mover un nodo.
- **La unicidad del código es por nivel, con `NULLS NOT DISTINCT`.** Dos plantas pueden tener su área "100"; dos raíces con el mismo código, no. Sin la cláusula los nodos raíz —que en un catálogo plano son **todos**— no se considerarían duplicados: es H-19 aplicado al árbol, con el mecanismo que `BLOQUE 03` dejó decidido.
- **La baja lógica no alcanza a la descendencia.** Un nodo dado de baja con hijos vigentes es un estado legítimo —el área sigue existiendo, la unidad intermedia dejó de usarse— y cerrar la rama de oficio decidiría por el usuario algo que nadie pidió. Lo ya clasificado no se revalida.
- **La eliminación definitiva exige no tener descendencia**, verificada en la operación para dar mensaje y garantizada por la clave, que es **RESTRICT y no CASCADE**: la base no debe resolver el pedido borrando en silencio una rama entera.
- **El nodo admite una referencia externa opcional** —origen e identificador, que viajan juntos y lo sostiene un `CHECK`—. Es el puente con el registro de activos, dueño del árbol cuando ese módulo exista, y con un sistema documental externo. Se modela ahora porque cuesta dos columnas, y porque el precedente disponible —`ScannedFile.externalReference`, una cadena más una URL armada por variable de entorno— no modela el concepto.
- **Seis acciones nuevas de auditoría y dos transiciones**, más `DOC_LOCATION` como tipo de objeto con su derivador de contexto. El nodo tiene traza propia porque administrar el árbol de la instalación es distinto de operar los documentos que se clasifican con él.

**Es un catálogo de clasificación y no un registro de activos.** Afirma cómo nombra el cliente sus sectores, no que un equipo exista y sea propio. Es lo que resuelve a quién pertenece el árbol cuando la respuesta parecía depender de qué módulos tenga cada despliegue: el registro de activos tiene un dueño —activos, con su propio ciclo de vida, incluido el decomisionamiento— y el catálogo de clasificación lo administra cada módulo que clasifica. La divergencia entre los dos **no es un defecto**, porque no dicen lo mismo.

**Lo que esta fase todavía no trae**, y es deliberado: el catálogo es **del despliegue** y la autorización es global —el alcance por proyecto, con herencia y ampliación, es la fase 2, y con él la segunda capa de autorización—; y el documento **no tiene atributo de ubicación** todavía, que es la fase 4. Esta fase deja el árbol, que es el escalón del que ese mecanismo hereda.

**El atributo no tiene ningún consumidor de comportamiento.** Ninguna regla del módulo lo lee: es clasificación y filtrado. Su único consumidor previsto era el eje de área de la matriz de responsabilidad, **descartado al abrir el bloque** — los revisores de un proyecto son los mismos sin importar el sector, y si cambiaran serían proyectos distintos, porque cada proyecto es un contrato. Sin ese eje la matriz queda sin contenido propio, y el bloque diferido se cierra.

- **Permisos nuevos** `documents:location:{read,list,select,create,update,delete}`, dados de alta en `205-mi-admin`. Requiere `@CLGonzalezGroh/mi-common` con esas constantes y **`npm run seed:permissions` en cada despliegue**: sin el seed el catálogo es inoperable aunque todo compile, que es lo que la fase 1 de `BLOQUE 04` aprendió a los golpes.
- **Trece pruebas puras** sobre la composición de rutas, el recálculo por rama y el ciclo, más **cuatro contra la base** sobre la unicidad por nivel, el rechazo del borrado con descendencia y el par de la referencia externa.

**386 pruebas, 0 fallos.**

### Fase 2 — El mecanismo de alcance por proyecto

Un catálogo es un **conjunto**, y esa es la diferencia con las demás configuraciones por proyecto: en el esquema de revisión o en la plantilla del circuito la definición más específica **reemplaza** a la general, mientras que acá lo que se resuelve es qué entradas están disponibles.

- **Dos modos que el proyecto declara**: `INHERIT`, vínculo vivo con el árbol del despliegue más lo que el proyecto agregue, y `OWN`, sin vínculo. En una planta rige el primero, porque cada proyecto interviene sobre la misma instalación; en una empresa de ingeniería el global queda vacío o mínimo y cada proyecto carga la estructura de su cliente.
- **La ausencia de declaración es heredar**, y es lo que vuelve la migración **aditiva**: todo proyecto existente hereda y nada cambia de comportamiento hasta que alguien declare lo contrario. La consulta de lo declarado **no completa** con `INHERIT` los catálogos sin declarar — fabricar filas inexistentes haría indistinguible lo declarado de lo supuesto—, y el modo que rige se expone resuelto por su lado.
- **Una fila por proyecto y catálogo, y no columnas de la configuración del proyecto.** `DocCatalogScope` con `DocCatalogKind` de tres valores: el mecanismo es **uno** para los tres catálogos documentales, y esta es la única forma en que eso es cierto en el modelo. `BLOCK_02C` lo reutiliza sobre clase y tipo agregando un valor a esa enumeración, sin migrar estructura, y por eso el mecanismo se estrena acá: el catálogo de ubicación no tiene datos ni interfaz en producción, y clase y tipo sí.
- **Heredar SUMA, y no reemplaza.** Es una diferencia deliberada con el catálogo de calificaciones, donde el proyecto que declara una propia usa las suyas y solo las suyas porque la lista es la del contrato. Acá ampliar es el caso normal, y por eso el modo **se declara** en lugar de derivarse de que existan entradas propias.
- **La autorización en dos capas sale del alcance del propio nodo**, sin una regla por operación: un nodo del despliegue se resuelve con el permiso global, uno de proyecto exige membresía. Lo da el derivador de contexto de `BLOQUE 02`, y por eso incorporarla costó una línea por operación.
- **La unicidad del código incorpora el alcance**: dos proyectos pueden nombrar igual su propio nodo, y un proyecto puede agregar un código que el despliegue no tiene sin chocar con otro. `NULLS NOT DISTINCT` sigue siendo lo que la vuelve efectiva, ahora sobre dos columnas anulables.
- **El alcance no se edita.** Mover un nodo entre el despliegue y un proyecto cambiaría qué ve cada proyecto sin que nadie lo declare, y arrastraría a su descendencia. Es el criterio con que el catálogo de calificaciones ya trata el suyo.
- **El permiso es el de la configuración del proyecto** y no uno propio: declarar si un proyecto hereda es configurarlo, de la misma familia que el rol documental y el armador por defecto. Administrar las entradas del catálogo es otra cosa y tiene el suyo. **No hace falta publicar `mi-common` para esta fase.**

**La arruga que solo tiene el árbol**, y que clase y tipo no van a enfrentar porque son planos: *ampliar* significa que el proyecto cuelga un nodo suyo de uno del despliegue, de modo que la relación de padre **cruza alcances**.

- **El cruce se admite en un solo sentido.** Un nodo de proyecto cuelga de uno del despliegue; al revés no, porque volvería el árbol global dependiente de un proyecto —quien mira el catálogo del despliegue vería una rama ajena, y borrar el proyecto dejaría huérfano un nodo global—. Y un proyecto no cuelga del árbol de otro proyecto, que no ve. La invariante **no es expresable en un `CHECK`** porque exige mirar el padre: vive en la operación, con su prueba.
- **Declarar catálogo propio se rechaza mientras algún nodo del proyecto cuelgue del árbol global**, y el mensaje **nombra las rutas** que lo impiden. La alternativa —convertirlos en raíces— reescribiría rutas de nodos que nadie tocó por un cambio de configuración. Mover es la vía para acomodarlos, y por eso esa operación es la que habilita después el cambio de modo.
- **El recálculo de rutas lee sin acotar por alcance, y debe hacerlo**: renombrar o mover un nodo del despliegue cambia la ruta de las ampliaciones que le colgaron los proyectos. Lo mismo la cuenta de descendencia que protege el borrado — un nodo global con ampliaciones tiene descendencia, aunque quien lo mira no la vea desde su propio catálogo.

**406 pruebas, 0 fallos.** Quince puras sobre el modo efectivo, la resolución, la coincidencia entre el criterio de consulta y el filtro en memoria, y las dos invariantes de cruce; tres contra la base sobre la unicidad con alcance, la ampliación admitida y la declaración única por par.

### Fase 3 — La siembra por copia

Un proyecto que declara catálogo propio arranca vacío, y con clase y tipo obligatorios eso lo dejaría sin poder dar de alta un documento. La siembra es lo que vuelve manejable el modo propio: no una hoja en blanco, sino una copia privada para podar.

- **La copia es puntual y no deja vínculo.** Una copia permanente **es** herencia, y llamarla de otro modo daría dos formas de lo mismo.
- **La fuente es el árbol del despliegue o el de otro proyecto.** El global suele ser el estándar de la propia organización; el catálogo de un proyecto es el estándar de un cliente, y el segundo proyecto para el mismo cliente lo copia en lugar de recargarlo a mano. Los dos casos son **una sola regla**, porque la fuente es siempre "lo que la fuente ve" con su alcance resuelto.
- **La identidad de un nodo es su ruta completa, y de ahí sale todo lo demás.** Copiar un árbol no es copiar una lista: dos nodos son el mismo cuando su ruta coincide, y no cuando coincide su código —el mismo código puede repetirse en dos plantas—. Por eso sembrar es **incremental e idempotente**: dos veces no duplica, y una fuente parcialmente solapada agrega solo las ramas que faltan, **colgándolas de los nodos que el destino ya tiene** en lugar de recrearlos.
- **El destino se compara por lo que VE, no por lo que tiene propio.** Nunca se crea una copia propia que tape a una heredada.
- **Solo se copia lo vigente con ascendencia vigente.** Un nodo dado de baja no viaja, y su descendencia tampoco: la rama no tendría de qué colgar. Se informa aparte, y no se confunde con lo que ya estaba.
- **La referencia externa y el orden viajan con el nodo.** La referencia identifica el **mismo objeto real** —el mismo activo—, de modo que copiar el nodo sin ella perdería el vínculo que `B7` existe para sostener.
- **Leer la fuente exige alcanzarla**: la del despliegue con el permiso global, la de otro proyecto con **membresía en ese proyecto**. Alcanzar el destino no habilita leer el catálogo de otro cliente. Son dos verificaciones y no una.
- **El resultado son tres números que dicen cosas distintas**: lo agregado, lo que el destino ya veía, y lo que no viajó por estar dado de baja. Un solo total los confundiría.

**Cada nodo copiado emite su creación**, como cualquier otro —un nodo que apareciera sin registro de haber sido creado sería la excepción— y **la siembra emite además su propio acto**. Ese acto va **sin objeto**, y es deliberado: no recae sobre un nodo sino sobre el catálogo del proyecto, y elegir uno de los creados para colgarle la traza sería la atribución arbitraria que el acto de reemplazo evitó con un tipo propio. Existe por un caso que las creaciones no cubren: **una siembra que no agrega nada no dejaría rastro**, y saber que alguien la intentó es justamente lo que se quiere poder responder.

**El orden importa, y no es una restricción del mecanismo: es el orden natural.** Primero se declara catálogo propio y después se siembra. Un proyecto que todavía hereda ya **ve** el árbol del despliegue, de modo que sembrárselo no agrega nada — y eso es correcto, no un defecto: crear copias propias de lo que ya ve lo taparía con duplicados. Lo descubrió una prueba de integración que esperaba lo contrario, y la expectativa era la equivocada.

**435 pruebas, 0 fallos.** Once puras sobre el plan de copia —orden, idempotencia, solapamiento, bajas y determinismo— y **una suite de integración nueva con dieciocho casos** que verifica contra la base lo que el plan puro no alcanza: que la jerarquía se reconstruya de verdad en el destino, que el cruce de alcances se rechace donde corresponde, y que declarar propio nombre las rutas que lo impiden.

### Fase 4 — El atributo en el documento, y su configuración

- **La ubicación pertenece al documento y se edita siempre**, como la descripción. No entra en el congelamiento de D-05 ni en el payload de la firma: que aparezca impresa en el rótulo no la vuelve identificación. Lo que D-23 sostiene es que la **identificación** pertenece a la emisión, no que todo lo impreso lo haga — el código identifica, el título describe la emisión, y la ubicación **clasifica**.
- **Un nodo, habitualmente la hoja.** El documento que alcanza dos áreas apunta al ancestro común, que un árbol de profundidad libre ya permite: no se modela N:M, que agregaría una tabla de unión y la ambigüedad de qué ruta mostrar en un listado, para un atributo cuyo único uso es filtrar.
- **Opcional en los tres roles, con la obligatoriedad configurable por proyecto** —habilitado, obligatorio y etiqueta, en `DocProjectSettings`—. Nace habilitado y no obligatorio, de modo que la migración es aditiva y todo proyecto sigue operando igual. **Deshabilitado no exige, aunque quede marcado como obligatorio**: exigir lo que no se puede declarar sería una contradicción, no una regla estricta, y es la combinación que una pantalla puede producir sin querer.
- **La etiqueta sí es configurable**, a diferencia del esquema de revisión: "área", "unidad" o "sector" son nombres que cada organización usa distinto, mientras que "revisión" es terminología establecida del dominio documental.
- **El nodo elegido debe estar en el alcance que el documento resuelve** — el árbol que su proyecto ve, o el del despliegue si no tiene proyecto—. Es la misma regla de visibilidad de la fase 2 aplicada a una sola entrada, y no una segunda: `visibleEntries` y la validación del documento comparten el predicado.
- **El régimen de publicación usa el árbol del despliegue, y solo él.** Sin proyecto no se hereda de ninguno, porque no pertenece a ninguno.
- **Un nodo dado de baja no se elige, y lo ya clasificado con él lo conserva.** La validación ocurre solo en escritura y nunca revalida lo existente (D-13). Y la baja se verifica antes que el alcance, para que el motivo sea el que el usuario puede corregir eligiendo otro y no el que sugiere un problema de configuración.
- **Al editar, el alcance se resuelve contra el proyecto del documento y no contra el del input**: cambiar de proyecto no es una edición.
- **La eliminación definitiva gana su otra mitad**: se rechaza si algún documento lo referencia, diciendo cuántos. La clave es `RESTRICT` y la base lo rechazaría igual, pero un error de restricción no dice qué hacer. La baja lógica sigue admitiéndose, que es la salida correcta.

**El snapshot del documento se recalcula solo** cuando el nodo se renombra o se mueve, con la misma escritura que reescribe la rama: es la misma denormalización un nivel más abajo, y la ruta del documento no acredita nada. El evento de la ubicación informa **cuántos documentos** se recalcularon, además de cuántos nodos.

**Y ahí apareció algo que una prueba de integración detectó y el diseño no:** ese recálculo movía el `updatedAt` de cada documento, porque Prisma dispara `@updatedAt` también en una actualización masiva. Nadie editó esos documentos —el snapshot es consecuencia de haber tocado el nodo— y dejar *"modificado en T por X"* con un X que no hizo nada en T es exactamente el ruido que esta denormalización no debe producir. Se resuelve con una actualización en SQL de la sola columna, parametrizada por Prisma, y queda una prueba que lo fija.

**457 pruebas, 0 fallos**, con once puras nuevas sobre la regla del atributo y once casos de integración más, hasta veintinueve en su suite.

### Fase 5 — Listado y filtrado por ubicación

Es la fase donde el atributo empieza a servir para lo que existe: **filtrar**.

- **Tres formas de preguntar por la ubicación de un documento**, y una sola rige por consulta: el **nodo exacto**, la **rama** —el nodo y toda su descendencia— y los **no clasificados**.
- **La rama es la pregunta que el negocio hace.** Quien pregunta por un área pregunta por lo que hay dentro, de modo que los documentos de sus unidades cuentan.
- **La precedencia se declara y no se descubre**: `withoutLocation` gana sobre los otros dos, con la misma forma que `rootsOnly` sobre `parentId` en el catálogo —es el caso especial de *"sin nodo"*—, y la rama gana sobre el nodo exacto porque lo contiene. Está enunciada en un solo lugar del código y en el contrato.
- **El catálogo también se lista por rama**, con el mismo `branchOf`: es lo que una pantalla necesita para abrir un sector sin recorrer el árbol.
- **Una rama inexistente devuelve vacío y no devuelve todo.** Es la diferencia entre un filtro que no encuentra y un filtro que se desactiva solo, que es la clase de defecto que aparece cuando un identificador inválido produce un criterio vacío.

**La rama se resuelve como conjunto de identificadores y no por prefijo de la ruta**, aunque el snapshot invitara a lo segundo. El motivo es concreto: dos nodos de alcances distintos pueden tener **la misma ruta** —el propio de un proyecto y el del despliegue del que salió, después de una siembra— y un filtro por prefijo los mezclaría. El recorrido reutiliza la travesía que ya calcula las rutas, de modo que hay una sola implementación y una sola batería de pruebas sobre ella.

El snapshot conserva su razón de ser, que era otra: mostrar y ordenar sin un join, y agrupar cada rama con su descendencia en un listado plano.

**467 pruebas, 0 fallos**, con cuatro puras nuevas sobre la rama y seis casos de integración más.

### Fase 6 — Migración, contrato y auditoría de los criterios

- **La ruta completa de migración se verificó de punta a punta**, en los dos sentidos: reconstruyendo el estado **previo a todo el bloque** en una base limpia —veintitrés migraciones— y aplicando encima las cinco del bloque, y también aplicando las veintiocho de una sola vez sobre una base vacía. Aplican limpio y en orden en los dos caminos.
- **`prisma/checks/block02b_precondicion.sql`**, de solo lectura, para correr contra cada cliente antes de migrar. **Es el primer control del módulo que no tiene ningún veredicto capaz de cancelar la migración**, y se conserva igual para dejar por escrito *por qué*: el bloque no retira ni renombra nada, ninguna columna existente cambia de tipo ni de obligatoriedad, y el atributo nace opcional. Lo único que bloquea es una aplicación parcial previa —tabla o columna ya creada sin la marca en el registro de migraciones—. Probado en los dos sentidos: **verde sobre una base pre-bloque, y detectando el estado ya aplicado sobre la local**.
- **El diff del modelo es 206 líneas agregadas y ninguna eliminada**, que es la evidencia de la afirmación anterior y no una promesa.

**Dos discrepancias entre las migraciones y el modelo, encontradas por `prisma migrate diff` y no por la compilación:**

**Las dos claves nuevas quedaban declaradas con `SET NULL`.** Las migraciones dicen `ON DELETE RESTRICT` —eliminar un nodo con descendencia, o con documentos clasificados, se rechaza— pero el modelo no lo declaraba, y Prisma pone `SetNull` por defecto en una relación opcional. Con eso, un `prisma migrate dev` habría "corregido" la base en la dirección equivocada, y borrar un nodo habría **vaciado en silencio la clasificación de cada documento que lo usaba** — exactamente lo que el comentario de la migración dice que no debe pasar. Se declara `onDelete: Restrict` en las dos relaciones, y el diff queda limpio de lo que este bloque agrega.

**Queda declarada una deriva anterior que este bloque no toca**: `documents_documentClassId_fkey` y `documents_documentTypeId_fkey` conservan el nombre viejo de las columnas que `BLOQUE 03B` renombró a `current*`, y `document_revisions.documentClassId` tiene la misma diferencia de `onDelete` que se corrige acá. Son de otro bloque, ya promovido, y corregirlas es una migración con su propia decisión.

**La auditoría de los once criterios cerró cuatro que estaban cubiertos a medias:**

- **el criterio 4 pedía una lista que no existía.** Las pruebas verificaban que sembrar de un proyecto ajeno se rechace, pero *"no aparece como fuente"* es una consulta, y no la había. Se incorpora **`locationSeedSources`**: los proyectos que el usuario alcanza por membresía vigente **y que tienen catálogo propio**, sin el destino, con cuántos nodos aportaría cada uno. El segundo filtro es lo que evita ofrecer una siembra que no agregaría nada;
- **el criterio 6 tenía una mitad sin verificar.** Que el payload de la firma no contenga la ubicación era cierto por construcción y por eso no estaba probado; ahora lo fija una prueba, para que agregarla al payload falle acá y no en una verificación de firma futura. Y que la ubicación se edite con la revisión **aprobada** se prueba de verdad, aprobando la revisión por la base a propósito: lo que se verifica es la ausencia de precondición en la operación, no el circuito, que tiene su propia suite;
- **el criterio 7 se probaba en un solo rol.** Ahora los tres atraviesan el alta sin declarar ubicación, que es lo que sostiene que el atributo sea opcional en los tres y no solo en el interno;
- **el criterio 2 comparaba cada siembra por separado** y no que las dos fuentes produjeran el mismo árbol. Ahora se comparan las jerarquías resultantes, que es lo que afirma que el mecanismo es uno.

**473 pruebas, 0 fallos**, con cinco casos de integración más y uno puro sobre la firma.

### Fase 7 — Promoción a la SFS

**Promovido**, en un ámbito propio: `domain/20_classification/`, con `DocLocation`, `DocCatalogScope` y sus principios en siete puntos.

El ámbito es propio y no un agregado al ciclo interno, por el mismo criterio con que la circulación se separó: **clasificar no es identificar**. El código identifica y no cambia, el título describe la emisión y por eso vive en la revisión, y la ubicación clasifica — de modo que se edita siempre, no se congela con la revisión aprobada y no integra el payload de la firma.

`Document` y `DocProjectSettings` se actualizaron por lo que el bloque les cambió: el atributo con su snapshot en el primero, y la configuración en el segundo, con la distinción de que ahí viven los **valores** y no los **conjuntos** — un catálogo se hereda, un valor se reemplaza.

**Desplegado y verificado en testing** —`rbb`, `optimal`, `proion`— **y en producción** —`optimal`, `proion`—, con las cinco migraciones aplicadas y los permisos sembrados. El contrato servido por la imagen desplegada da verde en los dos bloques en los cinco despliegues, y los seis permisos de ubicación están repartidos por rol: `doc-basic` con tres, `doc-full` con seis.

**La línea base del subsistema legado quedó intacta, y esta vez medida.** En `optimal` de producción —el único cliente con uso real de `ScannedFile`— se comparó la misma consulta antes y después de migrar y **la diferencia es vacía**: 3.289 archivos escaneados, 52 áreas y 5.124 registros de log, idénticos. `proion` no usa el subsistema legado y da cero en las tres.

Es el criterio 10 **medido** y no argumentado, que es lo que en testing había quedado pendiente. Lo respalda además que las cinco migraciones no mencionan `scanned_files` ni `areas` **ni una sola vez**, verificado sobre su texto.

**Dos controles nuevos en `210-mi-deploy`, y los dos por defectos reales:** `check-document-contract.sh` ahora verifica **por bloque** —fundidas en una lista sola, informaba que faltaba el bloque equivocado— y **`check-document-permissions.sh` es nuevo**, para el hueco que ninguna verificación cubría: el contrato en verde no significa operable.







---

# What's new in María Ingeniería API Documents 2.8.2

2026-08-17

## Definiciones del BLOQUE 02C, y el plan saldado

Sin cambios de código. El bloque queda definido y el plan al día antes de implementarlo.

### Alcance por proyecto de clase y tipo (BLOQUE 02C)

El mecanismo ya existe: `BLOQUE 02B` lo construyó y lo probó sobre el caso difícil —una jerarquía, con vínculos de padre y recálculo de rutas—. Lo que este bloque agrega es aplicarlo al **par de la clasificación**, que es el caso fácil salvo en un punto.

- **Clase y tipo declaran su alcance juntos.** El tipo cuelga de la clase, de modo que declararlos por separado admite un estado que no describe ninguna práctica: un proyecto con clasificación propia heredando tipos que apuntan a clases que no ve. Los catálogos documentales pasan a ser **dos y no tres** —clasificación y ubicación—, y `DocCatalogKind` queda en `{ LOCATION, CLASSIFICATION }`. Retirar los dos valores no cuesta migración de datos: nunca se les escribió una fila, que es la misma corrección que el módulo ya hizo con `WorkflowStatus.PENDING` y `RevisionStatus.OBSOLETE`.
- **La siembra es conjunta, y la identidad es el código dentro de su clase.** Un catálogo plano no tiene ruta completa, que es con lo que la siembra del árbol identifica un nodo. Sembrar un tipo **arrastra su clase** cuando falta en el destino, que es la consecuencia directa de lo anterior.
- **El cruce de alcance va en un solo sentido.** Un tipo del proyecto puede colgar de una clase del despliegue —eso **es** ampliar—; uno del despliegue no puede colgar de una clase de proyecto. Alcanza también a `DocWorkflowTemplate`: sin eso, la plantilla global quedaría dependiendo de un catálogo privado.
- **La ausencia de ámbito nombra el despliegue.** Sin argumento de proyecto, la consulta devuelve `projectId` nulo y no todo: un filtro que no encuentra no se desactiva solo. Es lo único que sostiene que la webapp no se toque, porque devolver todo dejaría la pantalla de catálogos mostrando las entradas privadas de cada cliente mezcladas con el estándar de la organización.
- **El alcance se declara con los mismos dos ejes que la entrada.** `DocCatalogScope` pasa a llevar `module` obligatorio y `projectId` anulable, de modo que calidad, comercial y activos puedan declarar su modo sin migrar estructura. No son dos columnas anulables con exclusión mutua: un proyecto siempre pertenece al módulo de proyectos, así que los ejes conviven en lugar de excluirse.
- **La deriva de claves foráneas se corrige acá.** De las seis referencias a los dos catálogos, **una diverge de verdad**: `document_revisions.documentClassId` está en `RESTRICT` en la base y el modelo implica `SET NULL`, que es el default de Prisma en una relación opcional. La consecuencia es peor que en la ubicación, porque **la clase integra el payload de la firma**: borrar una clase habría vaciado en silencio la clasificación de revisiones firmadas, que es lo que la firma existe para impedir. Las dos de `documents` solo arrastran el nombre de constraint previo al renombre a `current*`.

**Es el primer bloque sobre objetos con datos e interfaz en producción** —7 clases y 57 tipos en `optimal`, pantallas vivas de ambos catálogos y `ScannedFile` referenciándolos—, y por eso es enteramente de backend: las pantallas existentes se **verifican** y no se tocan, y la administración del catálogo por proyecto se construye con la interfaz, ya en su ubicación definitiva.

### El plan saldado

- **La trazabilidad cierra su último pendiente.** Los campos de fecha de las entidades —`approvedAt`, `issuedAt`, `completedAt`— **complementan al evento y no lo reemplazan**, con la fórmula que la ubicación fijó para el snapshot de la ruta: son denormalización de conveniencia y no evidencia. No pueden separarse del evento, porque se emite dentro de la transacción del cambio; son campos del contrato que cada listado va a mostrar; y `issuedAt` además ordena. De ahí la regla que vuelve legítima la redundancia: **si divergen, gana el evento**. Lo que se descarta es el estado intermedio —conservarlos sin declarar qué son—, que es el que mantuvo este pendiente abierto tres bloques.
- **El ámbito determina dónde vive la pantalla.** Los mismos objetos existen en tres ámbitos y el usuario debe saber en cuál está parado sin deducirlo: el despliegue en `documents/`, el módulo en `<modulo>/documents/`, el proyecto en `projects/[projectId]/documents/`. No es una preferencia de navegación — el ámbito gobierna la resolución de los catálogos, el alcance de acceso y la precedencia de la configuración, y una pantalla fuera de su ámbito obliga a pasarlo por parámetro y a que cada consumidor decida cuál rige. La bandeja de trabajo es transversal y su filtro por proyecto es una vista: `pendingReviewSteps` ya es transversal por construcción, de modo que falta el filtro y no la consulta.
- **La interfaz nacerá en su ubicación definitiva.** La ruta implementada hoy invierte el orden, y construir sobre ella para mudar después es levantar dos veces las mismas pantallas y sus enlaces. Queda declarada la dependencia externa: la reorganización del módulo de proyectos por workspace, con su plan propio, y el precedente construido en digitalización.

---

# What's new in María Ingeniería API Documents 2.9.0

2026-08-18

## Alcance por proyecto de clase y tipo (BLOQUE 02C)

Bloque en curso. Esta sección se extiende con cada fase.

### Fase 1 — El modelo y la migración

El mecanismo de alcance ya existía: `BLOQUE 02B` lo construyó y lo probó sobre el catálogo de ubicación, que no tenía datos ni interfaz en producción. Esta fase lo lleva a los dos que sí los tienen.

- **`projectId` en `DocumentClass` y `DocumentType`.** Nulo es el catálogo del despliegue, del que los proyectos heredan; con valor, la entrada la agregó ese proyecto. Un `CHECK` exige `module = PROJECTS` cuando hay proyecto, con la forma del invariante que D-06 fija para `Document`. A diferencia del cruce entre clase y tipo, este **sí** es expresable: mira dos columnas de la propia fila.
- **Los cuatro índices únicos incorporan el alcance**, con `NULLS NOT DISTINCT`, que es lo que los vuelve efectivos sobre tres y cuatro columnas anulables. Dos proyectos pueden nombrar igual su propia clase, y un proyecto puede agregar un código que el despliegue no tiene sin chocar con otro proyecto.
- **Los catálogos documentales son dos y no tres.** `DocCatalogKind` queda en `LOCATION` y `CLASSIFICATION`: clase y tipo son **un solo sistema de clasificación** —el tipo cuelga de la clase—, de modo que declararlos por separado admitiría un proyecto con clasificación propia heredando tipos que apuntan a clases que no ve. Los dos valores retirados estaban declarados sin que ninguna operación los asignara, que es la corrección que el módulo ya hizo con `WorkflowStatus.PENDING`. La conversión del tipo es además **la precondición que se verifica sola**: con una sola fila de los valores retirados, la migración se detiene en lugar de perder el dato.
- **El alcance se declara con los mismos dos ejes que la entrada.** `DocCatalogScope` pasa a llevar `module` obligatorio y `projectId` anulable, de modo que calidad, comercial y activos puedan declarar el suyo sin migrar estructura. No son dos columnas anulables con exclusión mutua: un proyecto siempre pertenece al módulo de proyectos, así que los ejes conviven en lugar de excluirse. Hasta acá, la ausencia de proyecto equivalía al despliegue — exactamente lo que el plan advierte que no debe construirse.
- **La deriva de claves foráneas, corregida donde estaba el defecto.** `document_revisions.documentClassId` **no se toca en la base**: ya estaba en `RESTRICT`, que es lo correcto, porque la clase integra el payload de la firma y borrarla no puede vaciar en silencio la clasificación de una revisión firmada. Lo que estaba mal era el modelo, que al no declarar `onDelete` en una relación opcional dejaba a Prisma suponiendo `SetNull` — un `prisma migrate dev` la habría "corregido" en la dirección equivocada. La migración solo renombra las dos constraints de `documents` que conservaban el nombre previo al renombre a `current*`.

**El diff volvió a encontrar lo que la compilación no ve**, y van dos bloques seguidos: los cuatro índices recreados conservaban su nombre anterior, que declaraba dos columnas cuando ya cubrían tres o cuatro. Es la misma deriva que esta migración repara en `documents`, y se habría creado en el mismo archivo que la corrige.

**Verificado en los dos sentidos** —el diff contra la base queda vacío, y las 28 migraciones replicadas desde cero producen exactamente el modelo—, con **474 pruebas y 0 fallos**.

**La migración es aditiva y no cambia el comportamiento de nada existente.** Toda entrada ya cargada queda en el alcance del despliegue, que es el único que hoy existe y el que las pantallas administran; la ausencia de fila de alcance sigue siendo heredar. Las consultas todavía resuelven como antes: el alcance está en el modelo y aún no lo lee nadie. La webapp no registra una sola línea modificada.

---

# What's new in María Ingeniería API Documents 2.9.1

2026-08-18

## Alcance por proyecto de clase y tipo (BLOQUE 02C)

### Fase 2 — La resolución del alcance, y la autorización en dos capas

El alcance dejó de ser una columna que nadie lee.

- **Dos vistas separadas, con el precedente de la ubicación.** La **lista es de administración y no resuelve alcance**: muestra lo que ese ámbito declaró, el catálogo del despliegue o el propio de un proyecto. El **selector resuelve**: es lo que se puede elegir para clasificar, las propias más las heredadas o solo las propias. Confundirlas habría dejado la pantalla de administración de un proyecto mostrando entradas que no puede editar.
- **Omitir el ámbito nombra el despliegue**, y es lo que sostiene que la webapp no se toque: la pantalla global llama sin proyecto y sigue devolviendo exactamente lo mismo. La ausencia de argumento no desactiva el filtro — un filtro que no encuentra no se apaga solo.
- **La autorización sale del alcance de la entrada y no de una regla por operación.** El derivador de contexto de clase y tipo **afirmaba que los catálogos eran globales del despliegue**, con `projectId` fijo en nulo y su comentario explicándolo; dejó de ser cierto en la fase anterior. Ahora lee el alcance real, y con eso la entrada de un proyecto exige membresía y la del despliegue se resuelve con el permiso global, sin que ninguna mutación tenga que saberlo. Es el mismo mecanismo que la ubicación.
- **Clase y tipo leen una sola declaración**, `CLASSIFICATION`, en un util propio. Son cuatro los consumidores —la lista y el selector de cada catálogo— y ninguno debe poder discrepar de otro.

**Un defecto encontrado al componer los filtros.** El selector de tipos armaba módulo y clase sobre el mismo `OR` de nivel superior, moviéndolo de lugar cuando aparecía el segundo. Con el alcance —que también puede aportar un `OR`— el último en escribirse habría borrado a los anteriores **sin ruido**: un proyecto con catálogo propio habría visto el del despliegue. Los tres ejes pasan a componerse como condiciones independientes.

**El alcance no reemplaza al eje de módulo**: los dos filtran a la vez, de modo que un proyecto que hereda ve el catálogo del despliegue de su módulo y no el de calidad.

**486 pruebas, 0 fallos**, con doce de integración nuevas. Las tres negativas verifican **por qué** se rechaza y no solo que se rechace: un `catch` que acepta cualquier error habría quedado en verde el día que la operación fallara por un código duplicado.

El contrato solo suma argumentos y campos opcionales, y la webapp sigue sin una línea modificada.

---

# What's new in María Ingeniería API Documents 2.9.2

2026-08-18

## Alcance por proyecto de clase y tipo (BLOQUE 02C)

### Fase 3 — La siembra conjunta

Copiar el catálogo de un ámbito a otro, con clase y tipo en un acto.

- **La identidad es toda la diferencia con la siembra del árbol.** Allá un nodo **es** su ruta completa; acá una clase es su código y un tipo su código **dentro de su clase**, porque el mismo código de tipo puede repetirse bajo dos clases distintas y son entradas distintas. Es la identidad que la base ya declara, y no una convención nueva.
- **El paso lleva el código de la clase y no su identificador**, por el mismo motivo que el paso del árbol lleva la ruta del padre: la clase del destino todavía no existe cuando el plan se arma, y puede ser una que el destino ya tenía o una que esta misma siembra crea unos pasos antes.
- **Un tipo arrastra su clase** cuando el destino no la tiene, y **no viaja si su clase no viaja** —dada de baja, o ausente de lo que la fuente ve—. Las dos caras de lo mismo: un tipo sin su clase es un huérfano.
- **El plan no sabe de alcance ni de módulo**, igual que el del árbol: recibe lo que cada lado **ve**, ya resuelto. Por eso el filtro de módulo vive en la lectura, y una clase de calidad no viaja a un proyecto que nunca la vería.
- **La entrada copiada queda en el módulo de proyectos**, que es lo que la base exige y lo que la entrada pasa a ser: la clase compartida del despliegue, al copiarse al alcance de un proyecto, deja de estar disponible para todos los módulos.
- **Las cuatro reglas de la siembra se conservan enteras**: la fuente es lo que la fuente ve, el destino se compara por lo que ve, solo viaja lo vigente, y sembrar es incremental e idempotente — dos veces no duplica, y una fuente parcialmente solapada agrega solo lo que falta.
- **La fuente admite el despliegue o un proyecto existente**, con la autorización aplicada aparte sobre cada lado: alcanzar el destino no habilita leer el catálogo de un proyecto ajeno.

**La siembra vive en un archivo propio** y no en el de clases ni en el de tipos, porque no es de ninguno de los dos: recae sobre el par.

**El resultado es el del mecanismo y el desglose vive en la traza.** El tipo del resultado sirve a los tres catálogos, de modo que sus números no se abren por clase y tipo; el evento del acto sí los lleva. La siembra emite además la creación de cada entrada, y el acto una vez —sin objeto— por el caso que las creaciones no cubren: una siembra que no agrega nada no dejaría rastro.

**509 pruebas, 0 fallos**, con 14 puras y 9 de integración nuevas.

---

# What's new in María Ingeniería API Documents 2.9.4

2026-08-18

## Alcance por proyecto de clase y tipo (BLOQUE 02C)

### Fase 4 — Las invariantes de cruce, y el alcance al clasificar

El alcance deja de ser solo una vista y pasa a ser un límite.

- **El cruce va en un solo sentido, y se verifica en las dos escrituras del tipo.** Un tipo del proyecto puede colgar de una clase del despliegue —eso **es** ampliar—; uno del despliegue no puede colgar de una clase de proyecto, porque el catálogo global quedaría dependiendo de un proyecto. Se verifica al crear **y al editar**: mover un tipo a otra clase lo cruza igual que crearlo ahí. La regla se reutiliza de la del árbol, que no era del árbol: compara dos alcances y no dos nodos.
- **Declarar catálogo propio se rechaza mientras haya tipos del proyecto colgando de una clase del despliegue.** Al dejar de heredar quedarían apuntando a una clase que el proyecto ya no ve. Se rechaza nombrándolos, en lugar de dejarlos sin clase por decisión del sistema: eso reclasificaría entradas que nadie tocó, por un cambio de configuración. Es el mismo tratamiento que la ubicación ya le daba a sus nodos.
- **Una plantilla de circuito del despliegue no referencia entradas de proyecto**, por el mismo motivo.
- **El documento se clasifica solo con lo que su ámbito ve**, en los dos caminos por los que una clase o un tipo entran a una revisión: el alta del documento y la edición de la identificación. Sin esto el selector sería una sugerencia y no un límite — quien conoce un identificador clasificaría con una entrada que su proyecto no ve.

**516 pruebas, 0 fallos**, con siete de integración nuevas. Dos fallaron al escribirse y tenían razón: el control del alta del tipo no se había insertado —el de la edición sí—, y la prueba negativa lo encontró enseguida.

**Y una asimetría con la ubicación, resuelta aparte: una entrada dada de baja no se elige.** El catálogo declaraba la baja lógica sin efecto sobre lo que se podía elegir, de modo que la entrada seguía siendo elegible por quien conociera su identificador. Rige ahora la misma regla que la ubicación, con el límite que la vuelve compatible con la orientación del módulo: **se valida solo lo que se escribe**. Lo ya clasificado conserva su entrada aunque se dé de baja después, y editar el título de una revisión cuya clase caducó no se rechaza — es lo que distingue *no se elige* de *deja de valer*.

**519 pruebas, 0 fallos.**

---

# What's new in María Ingeniería API Documents 2.9.5

2026-08-18

## Alcance por proyecto de clase y tipo (BLOQUE 02C)

### Fase 5 — La ruta de migración, verificada en los dos sentidos

- **El control de precondición de este bloque sí puede cancelar la migración**, a diferencia del anterior: aquel era enteramente aditivo sobre tablas que nacían vacías, y este retira dos valores de una enumeración y cambia la obligatoriedad de una columna. Bloquea por filas con los valores retirados, por aplicación parcial previa, y si no encuentra las dos constraints a renombrar.
- **Se probó disparando, y no solo en verde.** Con una fila en el valor retirado sobre una base pre-bloque, el control bloquea **y la migración se detiene sola**: la conversión del tipo no puede interpretar el valor. Dentro de una transacción —como la aplica Prisma— revierte entera. Un control que solo se prueba en verde no prueba que bloquee.
- **La base pre-bloque se reconstruyó con el SQL real de las 27 migraciones anteriores**, y el resultado es estructuralmente idéntico a la base migrada de forma incremental: la única diferencia es la tabla de registro de Prisma, ausente por haberse aplicado el SQL a mano.

**Un hallazgo sobre la herramienta, con consecuencia sobre cómo se verifica.** El primer intento reconstruyó la base con `prisma migrate diff`, y esa base **no era fiel**: el diff de Prisma **no expresa `NULLS NOT DISTINCT`, los índices parciales ni los `CHECK`**, de modo que los perdía todos. De ahí que un diff limpio sea **necesario y no suficiente** — dice que el modelo y la base coinciden en lo que Prisma sabe expresar, y las cláusulas que este módulo escribe a mano quedan fuera. Lo que las sostiene es la base, y lo que lo verifica son las pruebas de persistencia, que existen justamente por eso. Se les incorporaron cuatro casos: la unicidad con nulos en los dos catálogos, que dos proyectos puedan repetir un código, que el mismo código de tipo conviva bajo dos clases, y los dos CHECK del alcance.

**Y un defecto propio, encontrado por una prueba ajena**: al generalizar el reconocimiento de violaciones de CHECK a un sufijo común, quedó fuera el del catálogo de ubicación, que no lo tiene. Se nombran los tres del módulo en lugar de buscar un patrón.

**523 pruebas, 0 fallos.**

**Y el criterio de que la webapp no se toque, verificado y no argumentado.** Los 45 documentos GraphQL del subgraph documental validan **idénticamente** contra el esquema anterior al bloque y contra el actual —se compararon los dos resultados y la diferencia es vacía—, ninguno de los seis de clase y tipo menciona el ámbito, y la webapp compila sin una sola línea modificada. Lo que sostiene la equivalencia de comportamiento es la migración: toda entrada preexistente queda en el ámbito del despliegue, que es exactamente el que la consulta sin argumento resuelve.

Queda del lado del despliegue correr el control en cada cliente antes de migrar, y medir la línea base de `ScannedFile` en producción antes y después.

---

# What's new in María Ingeniería API Documents 2.9.6

2026-08-18

## El contrato y el modelo dicen lo mismo, también en sus enumeraciones

Al preparar la actualización de testing e incorporar BLOQUE 02C al control de contrato del despliegue apareció que **el `schema.graphql` conservaba los tres valores viejos de `DocCatalogKind`**: la fase 1 cambió la enumeración de Prisma y el contrato quedó atrás. La consecuencia era peor que una inconsistencia de documentación — el valor nuevo **no era enviable** y los dos retirados sí, hacia una base que ya no los tenía, de modo que declarar el alcance de la clasificación era **inalcanzable por GraphQL**. Las pruebas de integración no lo veían porque llaman al resolver directamente.

**Ninguna verificación del módulo podía verlo**, y por eso la suite del contrato gana la que faltaba: **las enumeraciones del contrato coinciden con las del modelo**, en las dos direcciones y también en las variantes `...Input`.

Al correrla aparecieron **tres divergencias más, anteriores a este bloque**:

- **`RevisionStatus` no declaraba `REJECTED`**, que BLOQUE 04 agregó al corregir el estado terminal del rol Receptor;
- **`DocObjectType` no declaraba `DOC_LOCATION`, `DOC_CATALOG_SCOPE` ni `DOC_TRANSMITTAL_RESPONSE`**;
- su variante `Input`, esas tres más `DOC_QUALIFICATION`.

**Son roturas latentes y no inconsistencias de forma.** Un valor que la base puede contener y el contrato no declara hace **fallar la serialización** de cualquier consulta que lo devuelva: una revisión rechazada en el rol Receptor, o un evento de auditoría de una ubicación — que BLOQUE 02B emite y está en producción. Las correcciones son aditivas y no rompen a ningún cliente.

**525 pruebas, 0 fallos.**

---

# What's new in María Ingeniería API Documents 2.9.7

2026-08-18

## Alcance por proyecto de clase y tipo (BLOQUE 02C)

### Desplegado y verificado en testing

`rbb`, `optimal` y `proion`, con la migración aplicada y las tres verificaciones en verde.

**La línea base es idéntica antes y después en los tres**, medida con el mismo control corrido dos veces. En `optimal` —el único con datos— 2 clases, 3 tipos, 9 archivos escaneados con 4 clasificados por clase y 4 por tipo, y 3 áreas, sin una sola diferencia. El subsistema legado no participa del alcance y ahora está medido, no argumentado.

**Dos controles del despliegue se ampliaron, y los dos por huecos reales:**

- **el de contrato verifica ahora valores de enumeración.** Sin eso, una imagen anterior al bloque lo pasaba: `DocCatalogKind` existe en las dos versiones, con contenido distinto. Es la verificación que encontró que el contrato había quedado atrás;
- **el de permisos no miraba clase ni tipo.** El bloque no crea permisos —usa los que existen desde el origen— y por eso nadie los había verificado nunca, siendo que la siembra exige crear sobre los dos catálogos. Están completos y repartidos.

**Y un defecto propio, con moraleja.** Al ampliar el control de permisos se nombraron los recursos con el prefijo del módulo, que los posteriores llevan y estos dos no. El control informó cero permisos en los tres despliegues: un **veredicto en falso**, que es el peor resultado posible porque manda a arreglar lo que está bien. Lo desarmó contrastarlo con un hecho conocido —las pantallas de catálogos funcionan en producción desde siempre—, y queda anotado en el propio script.

---

# What's new in María Ingeniería API Documents 2.9.8

2026-08-18

## Alcance por proyecto de clase y tipo (BLOQUE 02C)

### Desplegado y verificado en producción

`optimal` y `proion`, con las mismas tres verificaciones en verde.

**Acá el criterio del subsistema legado se midió de verdad.** En testing `optimal` tenía 4 archivos escaneados con clase y 4 con tipo; en producción son **3.182 y 3.164 sobre 3.289**, el 96% del subsistema apoyado en los dos catálogos que este bloque altera. La comparación antes y después no registra **una sola diferencia**: 7 clases, 57 tipos, 3.289 archivos escaneados, 3.182 con clase, 3.164 con tipo y 52 áreas, idénticos.

Que `ScannedFile` no participe del alcance deja de ser una decisión de diseño y pasa a ser un hecho verificado sobre el único cliente con uso real.

**Dos observaciones de la línea base que conviene retener:** las 7 clases y los 57 tipos **declaran módulo** —cero compartidos—, de modo que todos pasan al alcance del despliegue sin ambigüedad; y **no existía ninguna declaración de alcance en producción**, porque BLOQUE 02B nunca las estrenó ahí, de modo que la conversión de la enumeración tuvo cero filas que convertir — que era el único control capaz de fallar por datos.

---

# What's new in María Ingeniería API Documents 2.10.0

2026-08-18

## Alcance por proyecto de clase y tipo (BLOQUE 02C) — promovido a la SFS

### Fase 6 — Promoción

**Dos Objetos del Dominio nuevos** —`DocumentClass` y `DocumentType`—, que hasta ahora **no existían en la SFS**: los catálogos venían del origen del módulo y ningún bloque los había documentado. Se documentan cuando dejan de ser una lista y pasan a tener reglas propias — alcance, cruce, unicidad por ámbito y elegibilidad.

**Tres documentos existentes se corrigieron por lo que este bloque volvió falso**, que es la parte que no conviene omitir:

- **`DocCatalogScope` decía "una fila por proyecto y catálogo"**, y ahora son dos ejes y dos catálogos. Se reescribieron su descripción, el rechazo de catálogo propio —que ahora alcanza también a los tipos colgados de una clase del despliegue— y la siembra, cuya identidad difiere entre los dos catálogos: la ruta completa en el árbol, el código dentro de la clase en la clasificación;
- **el principio 4 afirmaba lo contrario de lo que este bloque estableció**: *"lo que no se generaliza son las invariantes de cruce… clase y tipo son planos y no las necesitan"*. La invariante **sí** se generaliza, porque compara dos alcances y no dos nodos: vale para el nodo y su padre, para el tipo y su clase, y para la plantilla y las entradas que referencia. El ámbito ganó además un principio nuevo, sobre lo dado de baja y lo ya clasificado;
- **`Document` y `DocWorkflowTemplate`** declaraban su clasificación sin decir que está acotada por alcance.

Que un bloque corrija principios ya promovidos es lo previsto: la SFS describe lo implementado y validado, y cuando lo implementado cambia, lo que estaba escrito **deja de ser cierto** y no simplemente incompleto.

Con esto el bloque queda cerrado: seis fases, desplegado y verificado en los cinco despliegues.

---

# What's new in María Ingeniería API Documents 2.11.0

2026-08-20

## La raíz de alcance propia del módulo (BLOQUE 02D)

### Fase 2 — `DocProject`, y `DocProjectSettings` disuelto adentro

El módulo deja de referenciar el `Project` de `mi-project` y pasa a ser dueño de su propia entidad. Es lo que D-15 ya había nombrado sin darle objeto: **cada proyecto documental es un contrato**.

`DocProjectSettings` **desaparece**: era la entidad de contrato sin identidad propia. Sus siete campos —rol documental, contraparte, esquema de revisión, armador por defecto y la configuración de ubicación con su etiqueta— pasan a `DocProject` sin un solo cambio de forma. Lo que se agrega es lo que le faltaba: **código, nombre, descripción, estado y cierre**.

**Cambia el contrato GraphQL.** `DocProjectSettings` pasa a `DocProject`, la consulta `docProjectSettings` a `docProject`, la mutación `declareDocProjectSettings` a `declareDocProject` —con `code` y `name` obligatorios— y el valor `DOC_PROJECT_SETTINGS` de `DocObjectType` a `DOC_PROJECT`, en el tipo y en su variante `Input`. **Ninguna pantalla se rompe**: el nombre viejo solo aparecía en el archivo generado de la webapp, y no hay componente que lo consuma.

**El alta pasa a identificarse por código y no por proyecto.** Un contrato sin gestión PMI asociada no tiene `projectId` con el que buscarse, de modo que el `upsert` va por `code`, que es la identidad y siempre está.

**El uno a uno con `mi-project` se conserva en esta fase.** La unicidad de `projectId` cae en la fase 4, que es la que habilita varios contratos por obra. Hasta entonces los catorce lugares que leen la configuración por proyecto siguen funcionando sin cambiar de clave de búsqueda — y esa es la razón por la que **el renombre a `docProjectId` se adelantó delante del N:1**: quitar la unicidad antes los dejaría sin clave.

**La migración se niega a correr si encuentra configuraciones cargadas.** Cada fila sería un contrato a crear, y le falta justamente lo que este bloque agrega: código y nombre no se pueden inventar por el cliente. El control de precondición ya había verificado cero en los cinco despliegues.

**`ALTER TYPE ... RENAME VALUE` para el tipo de objeto de la traza**, que conserva las filas existentes sin tocarlas. Es un cambio de etiqueta y no una conversión: ningún evento ya emitido queda apuntando a un valor que el contrato no declara, que es la rotura latente que BLOQUE 02C encontró.

**Verificado:** `tsc` limpio, **525 pruebas y 0 fallos** —el mismo total que antes del cambio—, `prisma migrate diff` sin diferencias entre migraciones y modelo, y la ruta completa reconstruida sobre una base limpia con `pg_dump` **idéntico** al de la base migrada de forma incremental.

---

# What's new in María Ingeniería API Documents 2.12.0

2026-08-20

## La raíz de alcance propia del módulo (BLOQUE 02D)

### Fase 3 — el alcance cuelga del contrato

`projectId` pasa a `docProjectId` en los **once modelos** del subsistema documental, y gana **clave foránea real** contra `doc_projects` en nueve de ellos. Hasta hoy nada impedía que un documento apuntara a un proyecto inexistente: no había clave foránea porque no había tabla.

**`ScannedFile` y `Area` quedan intactos**, con su `projectId` hacia `mi-project`: su destino es salir hacia `212-mi-digitalization`, y renombrarlos exigiría inventarles contratos a un subsistema que se va.

**Las dos tablas de eventos llevan la columna sin clave foránea**, con el criterio de ADR-022 de digitalización y por una razón propia: un registro inmutable de auditoría no debe depender del ciclo de vida de lo que audita. Eso cambia qué hace la migración con un valor huérfano — en las nueve con FK **se detiene**, porque hay una decisión que no puede tomar; en las dos de eventos **anula el valor**, porque no hay ninguna decisión y el evento conserva su objeto, su acción, su actor y su fecha.

**El contrato GraphQL se renombró en esta fase**, 48 líneas. Renombrar la columna sin renombrar el campo del SDL deja el contrato mintiendo: un campo que el modelo ya no tiene **se resuelve como `null` en lugar de romperse**, y el consumidor no se entera. Conservan `projectId` exactamente diez lugares: `ScannedFile`, `Area`, sus filtros y altas, el vínculo PMI del contrato, y las dos operaciones que reciben un proyecto de `mi-project`.

**Control nuevo en `contract.test.ts`**, que declara esa frontera y **se verificó fallando con el defecto inyectado**. El test de contrato verificaba operaciones y enumeraciones, no campos, y por eso el `projectId` viejo pasó desapercibido.

**Dos defectos propios, encontrados por las pruebas:** el alta por código no podía fijar el vínculo PMI —`projectId` había quedado fuera de la rama de actualización del `upsert`—, y cinco índices únicos con `NULLS NOT DISTINCT` quedaron con el nombre viejo, delatados por `prisma migrate diff`.

**Al desplegar:** la migración `20260820140000_doc_project_scope` se detiene si encuentra filas con proyecto declarado en las nueve tablas con clave foránea. El control de precondición del bloque incorporó además dos filas nuevas —eventos y trazas con proyecto— que conviene volver a correr antes de desplegar.

**Verificado:** `tsc` limpio, **526 pruebas y 0 fallos**, `prisma migrate diff` sin diferencias, y la ruta completa reconstruida sobre base limpia con `pg_dump` idéntico al de la base migrada de forma incremental.

---

# What's new in María Ingeniería API Documents 2.13.0

2026-08-20

## La raíz de alcance propia del módulo (BLOQUE 02D)

### Fase 4 — varios contratos por obra

Cae la unicidad de `doc_projects.projectId`. Es el desbloqueo funcional del bloque: una planta que contrata la ingeniería civil, la mecánica y la construcción a tres proveedores tiene **una obra y tres contratos**, y hasta acá tenía que abrir tres proyectos hermanos sin nada que los una.

**No roza la binariedad de D-15**: cada contrato conserva una sola contraparte, de modo que la visibilidad entre anfitrión y contraparte sigue siendo binaria y no aparece ninguna regla multi-parte.

**Cambia el contrato GraphQL.** `docProject(projectId:)` no puede seguir existiendo —sin unicidad no hay un contrato por obra que devolver— y quedan dos operaciones donde había una: `docProject(id:)`, por identidad, y `docProjectsByProject(projectId:)`, que devuelve **la lista** de contratos de una obra y vacía si no tiene ninguno.

Al agregar la segunda, el control de contrato de la fase 3 **falló de inmediato**: su lista de operaciones autorizadas a recibir un `projectId` de `mi-project` tenía dos. Es lo que ese control existe para hacer.

**Verificado:** `tsc` limpio, **527 pruebas y 0 fallos** —una más, la de tres contratos sobre la misma obra—, `prisma migrate diff` sin diferencias, y ruta completa sobre base limpia con `pg_dump` idéntico al de la base incremental.

---

# What's new in María Ingeniería API Documents 2.14.0

2026-08-20

## La raíz de alcance propia del módulo (BLOQUE 02D)

### Fase 5 — la contraparte es una referencia, no un nombre

`counterpartyName` se retira y aparece `counterpartyId`, referencia externa sin clave foránea a `Company` de `205-mi-admin`. Es lo que la mudanza de `Company` del 2026-08-19 vino a habilitar, y el motivo por el que tuvo que ir primero.

Se contrata con la **empresa** y no con la razón social: a cuál se le factura es un dato de facturación que este módulo no necesita. La referencia apunta a un registro transversal, sin que documentos dependa nunca de `mi-comercial` ni de `mi-management`.

**El contrato expone la empresa, no su id**: `DocProject.counterparty: Company`, resuelto por federación con el mismo patrón que `UserName`. El stub de `Company` que el subgrafo declaraba sin uso pasa por fin a tener consumidor.

**Una referencia hizo más barata la invariante.** Con el nombre libre había un tercer estado —texto en blanco— que había que descartar con un `trim()`. Una referencia es un id o es nulo, y la regla de D-19 quedó enunciada sobre dos estados en lugar de tres.

**Al desplegar:** la migración `20260820200000_doc_project_counterparty` se detiene si encuentra contratos con contraparte por nombre. Convertir un nombre libre en una referencia exige decidir a cuál `Company` corresponde, y esa decisión no la puede tomar una migración.

**Verificado:** `tsc` limpio, **527 pruebas y 0 fallos**, `prisma migrate diff` sin diferencias, ruta completa sobre base limpia con `pg_dump` idéntico, y **el supergrafo compuesto sin error con `rover`** — la primera vez que el bloque federa contra otro subgrafo.

Y una advertencia que esta fase dejó a la vista: **`tsc` no delata un campo viejo en una escritura de Prisma**. El `upsert` que seguía pasando `counterpartyName` compiló sin un solo error, porque el `XOR<...>` con que Prisma tipa `data` desactiva el control de propiedades excedentes. En ejecución falla, de modo que lo único que lo encuentra son las pruebas.

---

# What's new in María Ingeniería API Documents 2.15.0

2026-08-20

## La raíz de alcance propia del módulo (BLOQUE 02D)

### Fase 6 — la unicidad del código se discrimina por módulo

Los dos índices únicos parciales de `documents` dejan de condicionarse por el nulo del alcance y pasan a condicionarse por el módulo:

- **circulación** — `UNIQUE (code, docProjectId) WHERE module = 'PROJECTS'`;
- **publicación** — `UNIQUE (code, module) WHERE module <> 'PROJECTS'`.

**Consecuencia deliberada: dos contratos de la misma obra pueden repetir el código de documento.** La unicidad es por contrato y no por obra — son contrapartes distintas, y cada contratista numera con su propia convención. Es la contracara del N:1 de la fase 4, y no contradice a D-24: el código sigue siendo el identificador **dentro de su ámbito**.

**Un `CHECK` nuevo, y no es un agregado suelto.** Con la condición vieja un documento de `PROJECTS` sin contrato quedaba cubierto por el índice de publicación; con la nueva cae en el de circulación con alcance nulo y —como Postgres trata los nulos como distintos— **no queda cubierto por ninguna unicidad**. El invariante de D-06 existía desde BLOQUE 02 pero vivía solo en la aplicación, de modo que la base admitía justamente esa combinación. `documents_module_scope_check` lo vuelve estructura, bicondicional, y es lo que garantiza que los dos índices cubran juntos todas las filas.

**Al desplegar:** la migración se detiene si encuentra documentos donde el módulo y el alcance no coinciden.

**Verificado:** `tsc` limpio, **531 pruebas y 0 fallos** —cuatro nuevas de persistencia, que es lo único que verifica índices parciales y `CHECK`, invisibles para `migrate diff`—, y ruta completa sobre base limpia con `pg_dump` idéntico al de la base incremental.

---

# What's new in María Ingeniería API Documents 2.16.0

2026-08-20

## La raíz de alcance propia del módulo (BLOQUE 02D)

### Fase 7 — el contrato en curso admite operaciones; cerrado, no

Dos estados y **un solo efecto**: `ACTIVE` admite todo, `CLOSED` solo lectura.

**Es una puerta sobre la escritura y no una máquina de estados.** No exige que los circuitos estén terminados y **no se propaga hacia abajo**: una revisión en circuito al momento del cierre queda donde está y deja de poder avanzar. Abandonarla o cancelar su circuito sería inventar desenlaces que nadie decidió. Y no promueve nada.

**Se implementó una vez.** La mayoría de las mutaciones autoriza con `userAuthorization`, pero los dos caminos que llegan al contrato —`projectAuthorization`, que lo recibe, y `assertObjectAccess`, que lo deriva del objeto— terminan en el mismo lugar. Los dos cierran, y la prueba verifica los dos: cerrar solo el del alta dejaría abierta toda escritura sobre objetos existentes.

**La intención se declara en cada llamada**: 80 puntos de paso —25 lecturas y 55 escrituras— con `intent` explícito. Se descartó derivarla del sufijo del permiso, que habría ahorrado las declaraciones a cambio de una regla implícita.

**Dos operaciones nuevas**: `closeDocProject` y `reopenDocProject`, con actor y fecha. Sin reapertura, un cierre por error dejaría la documentación congelada sin salida. El catálogo de auditoría pasa de 59 a 61 acciones.

**Verificado:** `tsc` limpio, **534 pruebas y 0 fallos**.

---

# What's new in María Ingeniería API Documents 2.17.0

2026-08-20

## La raíz de alcance propia del módulo (BLOQUE 02D)

### Fase 8 — el juego completo de operaciones del contrato

**Recurso de permisos propio**: `documentsDocProject` con sus seis permisos, en `@CLGonzalezGroh/mi-common@3.1.0`.

**El alta se separó de la edición.** `declareDocProject` —que hacía upsert por código— desaparece. Era el intermedio confuso: quien creía estar editando la configuración de un contrato podía estar creando uno nuevo por errar el código.

| Operación | Qué hace |
| --------- | -------- |
| `docProjects` | Listado del despliegue, paginado y con filtros |
| `docProjectsSelectList` | Selector para desplegables |
| `docProjectById` / `docProjectsByProject` | Por identidad / los de una obra |
| `createDocProject` | Alta, con el código obligatorio |
| `updateDocProject` | Edición. **El código no se declara**: es identidad |
| `deleteDocProject` | Borrado, solo si no tiene nada colgando |

**El borrado no necesitó lógica propia**: la clave foránea `RESTRICT` ya lo rechaza, y el resolver solo traduce el rechazo a un mensaje que dice qué hacer — un contrato con documentación no se borra, **se cierra**.

**La puerta del estado alcanza al propio contrato**: uno cerrado tampoco se edita.

**Al desplegar:** exige `mi-common@3.1.0` y `205-mi-admin` 2.6.0 con `seed --permissions-only` **y** `seed --sync-roles`. Sin el segundo los permisos existen y ningún rol los tiene, y nada lo delata hasta la primera llamada real.

**Verificado:** `tsc` limpio, **538 pruebas y 0 fallos** contra el paquete publicado, y supergrafo compuesto con `rover`.

---

# What's new in María Ingeniería API Documents 2.17.1

2026-08-20

## La raíz de alcance propia del módulo (BLOQUE 02D)

### Fase 9 — los controles de despliegue, y el orden del despliegue

**Los dos controles aprendieron el bloque, y a los dos se los vio fallar.**

`check-document-contract.sh` verifica las cinco mutaciones, las cuatro consultas, los seis tipos y los valores de `DocObjectType` en sus dos variantes. Su marcador más confiable son **las operaciones retiradas**: `declareDocProject` y `DeclareDocProjectInput` solo desaparecen con el bloque entero puesto. Se lo vio fallar sin buscarlo, contra un servicio anterior que ocupaba el puerto.

`check-document-permissions.sh` incorpora `documentsDocProject`, y **su veredicto lo verifica primero**: sin permisos de contrato no hay contrato, y sin contrato no hay documento de proyecto posible — lo impide la clave foránea. Es el único recurso cuya ausencia bloquea el módulo entero.

**Una prueba más** sobre la federación de la contraparte, que es lo único del bloque que no se ejercita ni desde la base ni desde el contrato.

**El orden del despliegue quedó escrito en el bloque**, en siete pasos. Dos que conviene no perder: la línea base del legado se toma **inmediatamente antes** de migrar —el subsistema carga por lotes—, y el seed de `mi-admin` son **dos** comandos, no uno.

**Verificado:** **539 pruebas y 0 fallos**, los dos controles en verde y los dos vistos fallar contra su propio defecto.

---

# What's new in María Ingeniería API Documents 2.17.2

2026-08-20

## La raíz de alcance propia del módulo (BLOQUE 02D)

### Fase 9 — el contrato federado, publicado y consumido

**`rover subgraph check`: Operation Check y Linter Check aprobados.** *"Compared 184 schema changes against 44 operations"*, sin una sola operación registrada afectada — y esta vez con operaciones reales contra las que comparar. Las dos advertencias del linter, valores de enumeración sin descripción, se corrigieron antes de publicar.

**Publicado a `Maria-Ingenieria@current`** y supergrafo recompuesto. El despliegue local usa federación administrada, de modo que el router lo tomó por polling.

**`npm run codegen` en la webapp sin errores** y `type-check` limpio: ningún documento `.graphql` pide un campo que dejó de existir.

**Búsqueda del nombre viejo**: cero apariciones de `docProjectSettings`, `declareDocProject`, `counterpartyName` y `DOC_PROJECT_SETTINGS` fuera de lo generado. Los `projectId` que quedan son todos de `Area` y `ScannedFile` — los dos tipos que el bloque excluyó a propósito.

---

# What's new in María Ingeniería API Documents 2.17.3

2026-08-20

## La raíz de alcance propia del módulo (BLOQUE 02D)

### Fase 9 — la precondición corrida sobre los cinco, con los quince controles

**Ninguno bloquea en ningún despliegue.** El bloque queda habilitado para desplegarse.

**Y los dos controles que la fase 3 agregó dan cero en los cinco.** Ningún despliegue tiene eventos de workflow ni trazas de auditoría con proyecto declarado, de modo que **la rama de la migración que anula el contexto huérfano no se va a ejecutar en ninguna parte**. Lo que en la base de desarrollo local eran 420 y 104 filas resultó ser residuo de las pruebas.

Importa por lo que evita: esa rama era la única del bloque que pierde información sin detenerse, y ahora se sabe que no tiene sobre qué actuar.

**Esta corrida no es la línea base del despliegue.** El legado de `optimal` sumó 136 archivos entre el 18 y el 20 de agosto: la del criterio 5 se toma inmediatamente antes de migrar.

Con esto la fase 9 queda cerrada y solo resta la promoción a la SFS.

