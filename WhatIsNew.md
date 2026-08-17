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

