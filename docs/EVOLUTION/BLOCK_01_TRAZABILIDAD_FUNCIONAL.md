# Bloque 01 — Trazabilidad funcional

**Estado:** `PROMOVIDO_A_SFS`
**Versión:** 1.0
**Depende de:** nada. Es el primer bloque funcional.
**Decisiones que ejecuta:** D-01. Afecta a H-23 y H-24; incorpora la cobertura de pruebas exigida por H-26.

## Objetivo

Dotar al subsistema de Gestión Documental de trazabilidad funcional propia, mediante eventos de dominio, y dejar establecida la base de pruebas automatizadas sobre la que se validarán los bloques siguientes.

`DocumentSysLog` conserva íntegramente su función de registro técnico y de trazabilidad del subsistema legado.

## Línea base confirmada

Verificado sobre el código a la fecha de este documento.

- El módulo escribe en `DocumentSysLog` desde **46 puntos**: 45 en resolvers y 1 en `src/utils/handleError.ts`.
- Distribución por subsistema:

| Subsistema | Archivos | Escrituras |
| ---------- | -------- | ---------- |
| Gestión Documental | `documents` 5, `documentClasses` 5, `documentTypes` 5, `transmittals` 4, `workflows` 4, `revisions` 1, `versions` 1 | **25** |
| Adjuntos (diferido, D-08) | `attachments` | 2 |
| Legado en producción | `scannedFiles` 11, `areas` 5 | 16 |
| Operación del servicio | `handleError` 1, `documentSysLogs` 2 | 3 |

- Las 25 escrituras del subsistema documental corresponden a estas acciones, hoy nombradas en mayúsculas con guion bajo: `CREATE_DOCUMENT`, `UPDATE_DOCUMENT`, `TERMINATE_DOCUMENT`, `ACTIVATE_DOCUMENT`, `SWITCH_REVISION_SCHEME`, `CREATE_REVISION`, `REGISTER_VERSION`, `INITIATE_REVIEW`, `APPROVE_STEP`, `REJECT_STEP`, `CANCEL_WORKFLOW`, `CREATE_TRANSMITTAL`, `ISSUE_TRANSMITTAL`, `RESPOND_TRANSMITTAL`, `CLOSE_TRANSMITTAL`, y los cinco pares de alta, modificación, baja, reactivación y eliminación de `DocumentClass` y `DocumentType`.
- El registro es de texto plano: `name`, `message`, `meta` como cadena JSON, `level` y `module`. **No identifica el tipo de objeto afectado ni los estados involucrados.**
- Las escrituras ocurren **fuera** de la transacción que aplica el cambio de estado. En `cancelWorkflow` es la única excepción: el registro se emite dentro de la transacción.
- `handleError` escribe los errores con `level: ERROR` en la misma tabla, mezclados con la traza funcional.
- Los transmittals registran siempre `module: PROJECTS`; el resto deriva el módulo del documento afectado (H-24).
- **El módulo no tiene pruebas automatizadas**: no hay archivos de prueba, ni marco de pruebas declarado, ni script `test` en `package.json`.
- El subsistema de Gestión Documental **no tiene uso productivo**. `ScannedFile` y `Area` sí, en un cliente.

## Decisiones ya aprobadas que aplican

- **D-01**: la trazabilidad funcional se modela con eventos de dominio —uno de workflow y uno de auditoría—, inmutables. `DocumentSysLog` queda para la operación del servicio y el subsistema legado.
- Convenciones vigentes: entidades en PascalCase, acciones como verbo en inglés imperativo (`00_Convenciones.md` §3).

## Alcance incluido

1. Modelo y migración de los dos objetos de evento.
2. Mecanismo de emisión y catálogo de acciones.
3. Sustitución de las **25** escrituras funcionales del subsistema documental por emisión de eventos.
4. Exposición de lectura de eventos en GraphQL.
5. Base de pruebas automatizadas del módulo.

## Fuera de alcance

- Cualquier cambio de comportamiento funcional. Este bloque **no modifica** reglas, estados ni validaciones: solo sustituye el registro. Las correcciones del ciclo pertenecen a bloques posteriores.
- `ScannedFile`, `Area` y sus 16 escrituras.
- `Attachment` y sus 2 escrituras, diferido por D-08.
- `handleError` y las operaciones de archivado de registros.
- La corrección del módulo inconsistente en transmittals (H-24), que depende del contexto de proyecto de `BLOCK_02`.
- Interfaz de usuario.

## Decisiones del bloque

### B1 — Dos objetos de evento, con prefijo de módulo

`DocWorkflowEvent` registra transiciones de estado: qué objeto cambió, desde qué estado, hacia cuál y cuándo.
`DocAuditEvent` registra acciones ejecutadas: quién hizo qué, sobre qué objeto, cuándo y con qué contexto.

Responden preguntas distintas y por eso son dos objetos, siguiendo `DigiWorkflowEvent` y `DigiAuditEvent`.

El prefijo `Doc` es obligatorio por la misma razón que en digitalización: `WorkflowEvent` y `AuditEvent` son nombres demasiado genéricos para un ecosistema federado donde otro subgraph puede reclamarlos.

Alternativa descartada: un único objeto con un discriminador. Se descarta porque los atributos difieren —la transición necesita estado previo y resultante; la acción necesita contexto— y se obtendrían columnas nulas en la mitad de los registros.

### B2 — Los eventos son inmutables

No se exponen operaciones de modificación ni de eliminación. La única escritura es la emisión.

### B3 — La emisión ocurre dentro de la transacción del cambio

Un evento de workflow se emite en la misma transacción que aplica la transición. Hoy 24 de las 25 escrituras quedan fuera de la transacción, de modo que un fallo posterior deja el cambio aplicado sin registro, o el registro sin cambio.

Es un cambio de calidad del registro, no de comportamiento funcional.

### B4 — Una acción puede emitir un evento de auditoría y varios de workflow

`approveStep` es el caso testigo: una sola acción del usuario aprueba el paso, puede completar el workflow, aprobar la revisión y dejar en `SUPERSEDED` a las revisiones anteriores. Son cuatro transiciones y una acción.

El modelo debe registrar la acción una vez y cada transición por separado, sin forzar correspondencia uno a uno.

### B5 — Cada objeto de evento tiene su propia convención de nombres

Ambos usan PascalCase en inglés, pero con forma verbal distinta, porque nombran cosas distintas:

- **`DocAuditEvent.action`: verbo en imperativo.** `CreateDocument`, `RegisterVersion`, `InitiateReview`, `ApproveStep`, `IssueTransmittal`. Nombra la acción que alguien ejecutó, conforme a `00_Convenciones.md` §3.
- **`DocWorkflowEvent.name`: participio.** `RevisionApproved`, `TransmittalIssued`, `WorkflowCompleted`, `RevisionSuperseded`. Nombra un hecho consumado, no una orden.

Es la convención de digitalización, donde las transiciones se llaman `LotReceived` o `CatalogEntryPublished` y las acciones `CreateLot` o `PublishCatalogEntry`.

Ambas reemplazan la convención actual de mayúsculas con guion bajo de `DocumentSysLog`.

Los dos catálogos se definen como constantes tipadas, no como texto libre en cada resolver.

### B6 — El evento no lleva proyecto en este bloque

`Document` todavía no tiene `projectId`: lo incorpora `BLOCK_02` por D-06. El evento identifica el tipo de objeto y su referencia; la consulta por proyecto y el alcance por membresía se resuelven en `BLOCK_02`, junto con D-15.

Se declara explícitamente para que no se resuelva de forma implícita durante la implementación.

### B7 — `DocumentSysLog` se preserva intacto

No se modifica su modelo, ni sus operaciones, ni sus pantallas. Sigue recibiendo:

- los errores técnicos de **todos** los subsistemas, vía `handleError`;
- la traza de `ScannedFile` y `Area`, en producción en un cliente;
- sus propias operaciones de archivado.

Es el único punto de este bloque donde puede romperse algo en uso. Las 25 escrituras que se retiran pertenecen a operaciones sin uso productivo, de modo que su ausencia en las pantallas de registros no afecta a ningún cliente.

## Mapa de emisión

| Operación | `DocAuditEvent.action` | `DocWorkflowEvent.name` — transición |
| --------- | --------------------- | ------------------------------------ |
| `createDocument` | `CreateDocument` | `RevisionCreated` — revisión inicial → `DRAFT` |
| `updateDocument` | `UpdateDocument` | — |
| `terminateDocument` | `TerminateDocument` | `DocumentTerminated` — documento dado de baja |
| `activateDocument` | `ActivateDocument` | `DocumentActivated` — documento reactivado |
| `switchRevisionScheme` | `SwitchRevisionScheme` | — |
| `createRevision` | `CreateRevision` | `RevisionCreated` — → `DRAFT` |
| `registerVersion` | `RegisterVersion` | — |
| `initiateReview` | `InitiateReview` | `RevisionSubmitted` — `DRAFT` → `IN_REVIEW`<br>`WorkflowStarted` — → `IN_PROGRESS` |
| `approveStep` | `ApproveStep` | `StepApproved` — `PENDING` → `APPROVED`<br>y si completa el circuito: `WorkflowCompleted` — → `COMPLETED`<br>`RevisionApproved` — `IN_REVIEW` → `APPROVED`<br>`RevisionSuperseded` — una por cada revisión anterior en `APPROVED` |
| `rejectStep` | `RejectStep` | `StepRejected` — `PENDING` → `REJECTED`<br>`StepSkipped` — una por cada paso posterior pendiente<br>`WorkflowRejected` — → `REJECTED`<br>`RevisionReturned` — `IN_REVIEW` → `DRAFT` |
| `cancelWorkflow` | `CancelWorkflow` | `StepSkipped` — una por cada paso pendiente<br>`WorkflowRejected` — → `REJECTED`<br>`RevisionReturned` — `IN_REVIEW` → `DRAFT` |
| `createTransmittal` | `CreateTransmittal` | `TransmittalCreated` — → `DRAFT` |
| `issueTransmittal` | `IssueTransmittal` | `TransmittalIssued` — `DRAFT` → `ISSUED` |
| `respondTransmittal` | `RespondTransmittal` | `TransmittalResponded` — → `RESPONDED` |
| `closeTransmittal` | `CloseTransmittal` | `TransmittalClosed` — → `CLOSED` |
| `DocumentClass`: alta, modificación y eliminación | `CreateDocumentClass`, `UpdateDocumentClass`, `DeleteDocumentClass` | — |
| `DocumentClass`: baja y reactivación | `TerminateDocumentClass`, `ActivateDocumentClass` | `DocumentClassTerminated`, `DocumentClassActivated` |
| `DocumentType`: alta, modificación y eliminación | `CreateDocumentType`, `UpdateDocumentType`, `DeleteDocumentType` | — |
| `DocumentType`: baja y reactivación | `TerminateDocumentType`, `ActivateDocumentType` | `DocumentTypeTerminated`, `DocumentTypeActivated` |

Nótese que `WorkflowRejected` cubre hoy tanto el rechazo como la cancelación, porque el modelo actual no los distingue (H-05). Cuando D-17 les dé identidad propia, la cancelación pasará a tener su propio nombre de evento.

El mapa refleja el comportamiento **actual**. Las transiciones que los bloques siguientes corrijan —el rechazo que deja de volver a `DRAFT`, la cancelación con identidad propia— actualizarán este mapa en su propio bloque.

## Fases de implementación

| Fase | Contenido |
| ---- | --------- |
| A | Modelo Prisma de ambos eventos y migración. |
| B | Catálogo tipado de acciones y de tipos de objeto; función de emisión con soporte transaccional. |
| C | Sustitución de las 25 escrituras, resolver por resolver, sin alterar comportamiento. |
| D | Consultas GraphQL de lectura de eventos, con su permiso. |
| E | Pruebas automatizadas y scripts. |
| F | Cierre documental: recién entonces se evalúa la promoción a la SFS. |

## Estrategia de pruebas

Se replica el enfoque de `204-mi-project`, que no requiere incorporar dependencias: `node:test` ejecutado con `node --import tsx --test`.

Se prueban **funciones puras**, sin base de datos:

- construcción del evento de auditoría y del de workflow a partir de sus insumos;
- el catálogo de acciones y de tipos de objeto: que cada acción declarada tenga su correspondencia y que no existan duplicados;
- la derivación de transiciones de `approveStep`, que es la lógica no trivial: dado el conjunto de pasos y el que se aprueba, qué transiciones corresponde emitir. Es la misma lógica que hoy vive embebida en el resolver y que conviene extraer.

Scripts a incorporar en `package.json`:

```
"test:events": "node --import tsx --test src/events/*.test.ts",
"test:block01": "npm run test:events"
```

La extracción de la lógica de `approveStep` a una función pura es condición para poder probarla, y es la única reorganización de código que este bloque introduce.

## Criterios de aceptación

1. `prisma validate` y `prisma migrate` se ejecutan sin error, y la migración se aplica sobre una base con datos de `ScannedFile` sin afectarlos.
2. `npm run build` y `tsc --noEmit` compilan sin error.
3. `npm run test:block01` pasa en su totalidad.
4. Las 25 escrituras funcionales fueron sustituidas: una búsqueda de `documentSysLog.create` en los siete archivos del subsistema documental no arroja resultados.
5. Las 19 escrituras fuera de alcance permanecen intactas: `scannedFiles` 11, `areas` 5, `handleError` 1, `documentSysLogs` 2.
6. Ninguna operación cambió su comportamiento funcional: mismos estados, mismas validaciones, mismos mensajes de error.
7. Cada transición del mapa de emisión se produce dentro de la transacción que aplica el cambio.
8. Las pantallas de registros del sistema siguen operando sobre `DocumentSysLog` sin modificación.
9. `rover subgraph check` ejecutado; si marca cambios de contrato, se documenta cuáles y por qué son aceptables.
10. La SFS se actualiza únicamente después de reunir estas evidencias.

## Evidencia de validación

### Fase A — modelo y migración

Ejecutado sobre la base local de desarrollo (`mi-document-pg`, `mi_document_db`, puerto 5409).

- `prisma validate`: schema válido.
- `prisma migrate status` previo: 6 migraciones aplicadas, base al día.
- Migración `20260808120000_add_domain_events` generada con `prisma migrate diff` y aplicada con `prisma migrate deploy`. **Es puramente aditiva**: un tipo enumerado, dos tablas y tres índices. No contiene `ALTER` ni `DROP`.
- `prisma generate` y `tsc --noEmit`: sin errores.
- Tablas creadas y verificadas: `doc_workflow_events`, `doc_audit_events`.
- Datos preexistentes intactos tras la migración: `scanned_files` 6, `areas` 2, `document_sys_logs` 7.
- `documents` 0, consistente con la línea base de uso productivo. **Verificado únicamente en la base local**; la comprobación sobre las bases de cada cliente sigue pendiente.

### Fase B — catálogo y emisión

- `src/events/catalog.ts`: catálogos tipados de **25 acciones** de auditoría y **21 transiciones**, cada uno con su tipo de objeto declarado. El tipo de objeto se deriva del catálogo y no lo informa quien emite, de modo que no puede haber discrepancia entre acción y objeto.
- `src/events/emit.ts`: constructores puros `buildAuditEvent` y `buildWorkflowEvent`, y emisores `emitAuditEvent`, `emitWorkflowEvent` y `emitWorkflowEvents`. El cliente se recibe por parámetro, tipado como `Prisma.TransactionClient`, que admite tanto el cliente transaccional como el completo (B3). La emisión no captura errores: un cambio de estado sin registro debe fallar.
- Pruebas: `src/events/catalog.test.ts` y `src/events/emit.test.ts`. Scripts `test:events` y `test:block01` incorporados a `package.json`, con `node --import tsx --test` y sin dependencias nuevas.
- **13 pruebas, 13 aprobadas.** `tsc --noEmit` sin errores.
- Dos nombres se acortaron respecto del mapa original al detectarlo la prueba de convención: `RevisionSubmittedForReview` → `RevisionSubmitted` y `RevisionReturnedToDraft` → `RevisionReturned`. El estado resultante ya viaja en `toState`, de modo que el sufijo era redundante y rompía la forma de participio.

### Fase C — sustitución de las escrituras

- **Las 25 escrituras funcionales fueron sustituidas.** Quedan 0 llamadas a `documentSysLog.create` en los siete archivos del subsistema documental.
- Las 21 escrituras fuera de alcance permanecen intactas: `scannedFiles` 11, `areas` 5, `attachments` 2, `documentSysLogs` 2, `handleError` 1.
- Las llamadas a `handleError` conservan su parámetro `module`, de modo que los errores siguen registrándose en `DocumentSysLog` con su módulo.
- **25 emisiones de auditoría, una por operación**: `documents` 5, `documentClasses` 5, `documentTypes` 5, `transmittals` 4, `workflows` 4, `revisions` 1, `versions` 1.
- Las 25 acciones y las 21 transiciones del catálogo están todas en uso: no hay entradas muertas ni operaciones sin cubrir.
- Toda operación que antes ejecutaba una sola sentencia quedó envuelta en `$transaction`, de modo que el cambio y su registro se aplican juntos (B3).
- `approveStep` identifica las revisiones que quedarán `SUPERSEDED` **antes** de actualizarlas, para emitir una transición por cada una (B4). Es una lectura adicional, sin efecto sobre el comportamiento.
- La lógica de completitud del circuito se extrajo a `src/utils/reviewWorkflow.ts` (`completesWorkflow`, `stepsSkippedByRejection`, `stepsSkippedByCancellation`), reproduciendo el comportamiento vigente sin modificarlo. Es la única reorganización de código del bloque.
- **20 pruebas, 20 aprobadas** (13 de eventos, 7 del circuito de revisión). `tsc --noEmit` y `npm run build` sin errores.

Comportamiento conservado deliberadamente, pese a estar identificado como defecto:

- los pasos `ACKNOWLEDGE` siguen sin impedir que el circuito se complete (H-04), y hay una prueba que lo fija como comportamiento vigente;
- la cancelación sigue registrándose como `WorkflowRejected`, sin estado propio (H-05). El motivo pasa a viajar en la acción de auditoría, que es una mejora del registro, no del modelo.

### Fase D — exposición GraphQL

- Tipos `DocWorkflowEvent` y `DocAuditEvent`, y enumeración `DocObjectType` con su variante `DocObjectTypeInput`, incorporados al SDL en una sección propia de trazabilidad funcional.
- Dos consultas de solo lectura, ambas por objeto y en orden cronológico: `docWorkflowEvents(objectType, objectId)` y `docAuditEvents(objectType, objectId)`. No se expone ninguna operación de escritura (B2).
- Resolver en `src/resolvers/events.ts`, registrado en el índice de resolvers.
- `createdBy` se resuelve como referencia federada a `UserName`, devolviendo nulo cuando el evento lo emitió el sistema.
- Se incorporó el escalar `JSON` al módulo, portado de OperMask Digitalization junto con su `parseLiteral`, y `meta` se expone con ese tipo. El cliente recibe un objeto y no una cadena que deba interpretar. `DocumentSysLog` conserva su `meta` como texto: su modelo no cambia (B7).

**Permiso: no se introdujo uno nuevo.** La traza forma parte del objeto, de modo que la consulta exige el permiso de lectura del objeto consultado, según `DOC_OBJECT_READ_PERMISSION`: documento, revisión y versión exigen `DOCUMENTS_DOCUMENT_READ`; workflow y paso, `DOCUMENTS_WORKFLOW_LIST`; transmittal, `DOCUMENTS_TRANSMITTAL_READ`; y cada catálogo el suyo.

Alternativa descartada: un permiso propio de eventos. Habría requerido modificar el catálogo compartido `@CLGonzalezGroh/mi-common`, republicarlo y otorgarlo por separado en cada despliegue, para gobernar algo que ya está gobernado por el permiso del objeto. La alternativa de reutilizar `DOCUMENTS_SYS_LOG_LIST` también se descarta: volvería a confundir la traza funcional con el registro técnico, que es justamente lo que D-01 separa.

- **21 pruebas, 21 aprobadas.** Se agregó la verificación de que cada tipo de objeto declara el permiso que exige leer su traza.
- Composición del subgraph verificada con `buildSubgraphSchema`: el SDL parsea y todos los resolvers corresponden a campos existentes.
- `rover subgraph check` contra `staging`: **PASSED**. Sin cambios en el API compuesto —las adiciones no rompen el contrato— y verificación de operaciones aprobada. El linter señaló valores de enumeración sin descripción y se corrigieron, alineándose con el resto del SDL.
- `tsc --noEmit` y `npm run build` sin errores.

### Fase E — cobertura de pruebas

**28 pruebas, 28 aprobadas**, en tres suites:

| Suite | Script | Pruebas | Alcance |
| ----- | ------ | ------- | ------- |
| Catálogo y construcción | `test:events` | 15 | Catálogos sin duplicados ni entradas huérfanas, tipos de objeto derivados, convención de nombres de B5, permisos de lectura completos, construcción de ambos eventos |
| Circuito de revisión | `test:review-workflow` | 7 | Completitud del circuito incluida la excepción de `ACKNOWLEDGE` (H-04), y pasos salteados por rechazo y por cancelación |
| Persistencia | `test:events-db` | 6 | Escritura real y garantía transaccional |

`test:block01` ejecuta las dos primeras, que no requieren base. `test:block01-db` agrega la tercera.

La suite de persistencia cubre el hueco más importante que tenía el bloque: hasta la fase D todas las pruebas eran de funciones puras, de modo que **nada demostraba que se hubiera escrito un evento**. Ahora se verifica la escritura efectiva de ambos tipos, el tipo de objeto derivado y persistido, el actor nulo del sistema, la escritura múltiple en una sola operación, y sobre todo **B3 en sus dos direcciones**: si la transacción falla no queda ningún registro, y si confirma quedan ambos.

Las pruebas operan sobre un identificador de objeto fuera de rango y limpian sus registros al terminar. Verificado tras la corrida: `doc_audit_events` 0, `doc_workflow_events` 0, y el legado intacto con `scanned_files` 6 y `document_sys_logs` 7.

**Lo que no está cubierto.** Se declara explícitamente para no atribuir al bloque una garantía que no tiene. La verificación de extremo a extremo se difiere de forma deliberada al momento en que exista interfaz de usuario (`BLOCK_05`), donde se ejercitará el circuito completo contra la webapp:

- **no hay pruebas de integración de los 25 resolvers.** Ninguna prueba ejecuta `approveStep` o `issueTransmittal` de extremo a extremo para comprobar que emiten exactamente los eventos del mapa. Requeriría autenticación y datos de prueba para cada operación. La cobertura actual es estructural: 25 emisiones —una por operación—, y las 25 acciones y 21 transiciones del catálogo en uso, sin entradas muertas;
- **las dos consultas GraphQL no tienen prueba de comportamiento.** Se verificó que el esquema compone y que el mapa de permisos cubre todos los tipos de objeto, pero no el filtrado ni el orden, que exigirían sortear `userAuthorization`;
- no existe una guarda automática que impida reintroducir una escritura a `DocumentSysLog` en el subsistema documental. Hoy se verifica por inspección.

### Fase F — cierre documental

Criterios de aceptación verificados: **los diez**. Migración aditiva aplicada sin afectar datos existentes, compilación y build sin errores, 28 pruebas aprobadas, las 25 escrituras sustituidas y las 21 fuera de alcance intactas, sin cambios de comportamiento funcional, emisión dentro de la transacción demostrada en ambas direcciones, pantallas de registros operando sobre `DocumentSysLog` sin modificación, y `rover subgraph check` aprobado.

**Promovido a la SFS.** Se incorporaron dos Objetos del Dominio en `docs/SFS/domain/00_transversal/`:

- `10_DOM-001_DocWorkflowEvent.md`
- `20_DOM-002_DocAuditEvent.md`

Ambos con estado `Approved`, y el índice de `docs/SFS/README.md` actualizado.

**Qué se promovió y qué no.** Se documentaron los dos objetos, sus responsabilidades, su inmutabilidad, la separación respecto de `DocumentSysLog`, la relación de una acción con varias transiciones y la garantía transaccional. **No se promovió el catálogo de 25 acciones y 21 transiciones**: reproduce el comportamiento vigente, que los bloques siguientes van a modificar —el rechazo dejará de devolver la revisión a borrador (D-10), la cancelación tendrá identidad propia (D-17)—. Enumerarlo en la SFS obligaría a corregirla en cada bloque. El catálogo vive en el código, que es su fuente natural.

Es el mismo criterio de OperMask Digitalization, cuyos DOM-010 y DOM-011 describen los objetos sin enumerar cada nombre de evento, y por eso sobrevivieron a toda la evolución de aquel dominio.

**Estado del bloque: `PROMOVIDO_A_SFS`.**

Pendiente, diferido con acuerdo explícito: la verificación de extremo a extremo del circuito contra la webapp, que se realizará en `BLOCK_05`.

## Referencias

- `README.md`
- `DOCUMENT_EVOLUTION_PLAN.md` — D-01, H-23, H-24, H-26
- `../SFS/00_Convenciones.md`
- `212-mi-digitalization/docs/SFS/domain/00_transversal/` — DOM-010 y DOM-011
- `204-mi-project/docs/EVOLUTION/BLOCK_01_COLLABORATORS_DISCIPLINES_CAPACITY_SUPERVISION.md` — estructura de bloque y enfoque de pruebas
