# Bloque 02 — Contexto de proyecto y rol documental

**Estado:** `LISTO_PARA_PROMOVER`
**Versión:** 1.0
**Depende de:** `BLOCK_01`, cuyos eventos de dominio este bloque extiende.
**Decisiones que ejecuta:** D-06, D-09, D-15, D-19. Resuelve H-17, H-24, H-28 y H-32; cierra H-19 para `Document` y B6 de `BLOCK_01`.

## Objetivo

Dotar al subsistema de Gestión Documental del contexto que el ciclo de revisión y la circulación necesitan como base: a qué proyecto pertenece un documento, qué rol documental cumple ese proyecto y quién alcanza qué.

Este bloque **no modifica el ciclo de revisión ni la circulación**. Establece la estructura sobre la que `BLOCK_03` y `BLOCK_04` van a operar.

## Línea base confirmada

Verificado sobre el código a la fecha de este documento.

### Modelo

- **`Document` no tiene `projectId`.** Su contexto se expresa con `module ModuleType` más `entityType String?` / `entityId Int?`.
- La unicidad del código es `@@unique([code, module, entityType, entityId])`, con dos columnas anulables dentro de la tupla: cuando alguna es nula la restricción no impide duplicados (H-19).
- **`Transmittal` ya tiene `projectId Int` obligatorio**, con índice propio, y además `issuedTo String` con el nombre del destinatario.
- `ScannedFile` y `Area` también tienen `projectId` obligatorio, y son el único subsistema con datos en producción.
- `TaskDocumentReference` referencia `projectTaskId` sin proyecto propio.
- 7 migraciones aplicadas, la última `20260808120000_add_domain_events` de `BLOCK_01`.

### Autorización

- La autorización es **puramente global por permiso**. Las 25 operaciones del subsistema documental invocan `userAuthorization` y ninguna consulta pertenencia ni alcance: `documents` 9, `revisions` 2, `versions` 1, `workflows` 6, `transmittals` 7.
- Se suman las 2 consultas de eventos incorporadas por `BLOCK_01`.
- **`202-mi-common` no tiene ningún permiso de membresía documental.** Sí tiene el precedente de digitalización: `DIGITALIZATION_PROJECT_MEMBER_{READ,LIST,CREATE,DELETE}`, sobre el recurso `digitalizationProjectMember`.
- `212-mi-digitalization/src/utils/projectAuthorization.ts` implementa la doble capa de ADR-020 —permiso global validado contra `mi-admin`, más membresía vigente— en 40 líneas, y es portable sin adaptación conceptual.

### Consumidores

- **El único consumidor productivo entre servicios es `checkDocumentDependencies`**, invocado por `mi-quality` desde `src/resolvers/actions.ts:320` y `src/resolvers/findings.ts:352`. Sus argumentos `entityType`/`entityId` identifican **la entidad que `mi-quality` va a borrar**, no las columnas de `Document`.
- Su implementación en `src/resolvers/dependencies.ts` sí usa las columnas de `Document`: la rama `PROJECT` cuenta con `{ module: "PROJECTS", entityId }`, y las ramas `FINDING` y `ACTION` con `{ module: "QUALITY", entityType: "finding" | "action", entityId }`.
- **La webapp no consume `Document.entityType` ni `Document.entityId`.** Sus usos de esos nombres corresponden al input de verificación de dependencias y al planificador de proyectos, que son otros tipos.
- H-28 confirmado: no existe ningún consumidor de documentos fuera de proyectos.

### Eventos de `BLOCK_01`

- Ni `DocWorkflowEvent` ni `DocAuditEvent` llevan `projectId`, conforme a B6 de aquel bloque, que difirió la definición a éste.
- **Ninguno de los dos lleva `module`.** La inconsistencia de H-24 vivía en `DocumentSysLog.module` y desapareció con la sustitución de las 25 escrituras, pero ningún eje de contexto la reemplazó.
- El catálogo declara **8 tipos de objeto**: `DOCUMENT`, `DOCUMENT_REVISION`, `DOCUMENT_VERSION`, `REVIEW_WORKFLOW`, `REVIEW_STEP`, `TRANSMITTAL`, `DOCUMENT_CLASS` y `DOCUMENT_TYPE`. **Ninguno de los intermedios conoce su módulo**: solo `Document` y los dos catálogos lo declaran.
- Las dos consultas expuestas son `docWorkflowEvents(objectType, objectId)` y `docAuditEvents(objectType, objectId)`. **No existe forma de listar la traza por proyecto ni por módulo.**

### Uso productivo

- 0 documentos en la base local de desarrollo, consistente con la línea base del plan. **La verificación sobre las bases de cada cliente sigue pendiente** y es condición para aplicar la migración.

## Decisiones ya aprobadas que aplican

- **D-06**: el documento pertenece a un proyecto.
- **D-09** y **D-19**: el proyecto declara el rol documental del sistema — Emisor, Receptor o Interno, este último sin contraparte.
- **D-15**: el acceso se acota por membresía de proyecto, siguiendo `ProjectMember` (DOM-020) de OperMask Digitalization.
- **B1 de `BLOCK_01`**: los nombres genéricos llevan prefijo `Doc` en un ecosistema federado.
- **B5 de `BLOCK_01`**: acciones de auditoría en imperativo, transiciones de workflow en participio.

## Alcance incluido

1. `Document.projectId`, retiro de `entityType`/`entityId` y nueva unicidad del código.
2. `DocProjectSettings`: rol documental y contraparte del proyecto.
3. `DocProjectMember`: membresía documental con lado.
4. Autorización en dos capas aplicada a las operaciones del subsistema documental, y filtrado por membresía en los listados.
5. `projectId` y `module` en los dos objetos de evento de `BLOCK_01`, derivados del objeto afectado, y su filtrado en las dos consultas.
6. Permisos nuevos en `202-mi-common` y su republicación.
7. Exposición GraphQL de configuración y membresía.
8. Pruebas automatizadas del bloque.

## Fuera de alcance

- **D-14 — ubicación física jerárquica.** Se traslada a un bloque propio. Es un catálogo auto-referencial completo, con recálculo de rutas, snapshot en el documento y propagación auditada, y no bloquea a `BLOCK_03`.
- **D-13 — esquema de revisión configurable.** Pertenece a `BLOCK_03`. `DocProjectSettings` queda como su lugar de residencia, pero este bloque no incorpora el atributo.
- **`ScannedFile` y `Area`.** No se les aplica la doble capa (B8).
- `Attachment`, diferido por D-08. `TaskDocumentReference` y `Document.projectTaskId`, diferidos por D-07.
- Los catálogos `DocumentClass` y `DocumentType`: son globales del despliegue y no pertenecen a un proyecto.
- Cualquier cambio del ciclo de revisión (`BLOCK_03`) o de la circulación (`BLOCK_04`). En particular, las dos consecuencias de D-19 que no son estructurales: que `APPROVED` sea terminal en el rol `INTERNAL` y que los pasos `ACKNOWLEDGE` cierren (H-04) pertenecen a `BLOCK_03`; la ausencia de transmittals en ese rol, a `BLOCK_04`.
- El paquete de información de entrada (D-20), que `BLOCK_04` incorpora como objeto propio, separado del transmittal.
- Interfaz de usuario (`BLOCK_05`).

## Decisiones del bloque

### B1 — `Document.projectId` admite nulo, y el invariante lo exige

`Document` incorpora `projectId Int?`, referencia externa sin clave foránea, con la misma convención que `Transmittal`, `Area` y `ScannedFile`. `Project` vive en `mi-project`.

**El invariante lo exige cuando `module = PROJECTS`.** Un documento de proyecto sin proyecto es inválido y la operación lo rechaza.

**Un `projectId` nulo no es una ausencia: es el régimen de publicación.** El plan ya distingue documentos en circulación —viven en un proyecto, tienen partes, se acotan por membresía— de documentos publicados —el manual de calidad, el conforme a obra de la biblioteca—, que no circulan y se gobiernan por permiso global y clasificación. El nulo nombra ese segundo régimen.

Alternativa descartada: **un proyecto reservado del sistema** que permitiera declarar `projectId` como obligatorio. Se descarta por cuatro motivos:

1. **El módulo no es dueño de `Project`.** Habría que sembrarlo y protegerlo en la base de `mi-project` de cada despliegue de cada cliente, sin que `mi-document` pueda garantizar que exista. Es un invariante entre servicios sostenido por convención, que es exactamente lo que D-06 descartó al rechazar `entityType = "project"`.
2. **Contamina un módulo ajeno.** El proyecto reservado aparecería en cada selector, listado y reporte de `mi-project`, y cada consumidor debería filtrarlo.
3. **Rompe la membresía.** El alcance se acota por membresía de proyecto (D-15): el proyecto reservado necesitaría membresías de todos, o una excepción en la regla de alcance que aterrizaría en la capa de autorización.
4. **Borra una distinción que el plan quiere conservar.** Disfraza de circulación lo que es publicación.

Alternativa descartada: `projectId` obligatorio sin proyecto reservado. Cerraría de hecho la vocación transversal del módulo, que la cuestión de fondo del plan mantiene deliberadamente abierta.

Con 0 documentos en producción, pasar de nulable a `NOT NULL` más adelante es una migración trivial. El nulo es la opción reversible.

### B2 — La unicidad del código se resuelve con índices parciales

La unicidad vigente `[code, module, entityType, entityId]` se retira. La reemplazan **dos índices únicos parciales**, uno por régimen:

```sql
CREATE UNIQUE INDEX documents_code_project_key
  ON documents (code, project_id) WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX documents_code_module_key
  ON documents (code, module)     WHERE project_id IS NULL;
```

El código es único por proyecto para los documentos en circulación, y único por módulo para los publicados.

Prisma no expresa índices parciales, de modo que van como SQL en la migración y se documentan como comentario en el modelo.

Esto **cierra H-19 para `Document`**: la restricción deja de contener columnas anulables y los duplicados dejan de pasar. H-19 sigue abierto para `DocumentClass` y `DocumentType`, que este bloque no toca.

Alternativa descartada: `NULLS NOT DISTINCT` de PostgreSQL 15. Resolvería el nulo pero mantendría una única tupla para dos reglas distintas —por proyecto y por módulo— que no son la misma restricción.

### B3 — `entityType` y `entityId` se retiran

Ambas columnas se eliminan de `Document`, junto con su índice. `module` se conserva como discriminador, conforme a D-06.

**El contrato GraphQL de `checkDocumentDependencies` no se rompe**: sus argumentos identifican la entidad que el otro servicio va a borrar y no tienen relación con estas columnas. `mi-quality` sigue compilando sin cambios.

Cambia su implementación, y el cambio se declara por operación:

| Rama | Hoy | Después |
| ---- | --- | ------- |
| `PROJECT` | `{ module: "PROJECTS", entityId }` | `{ projectId }` — expresa directamente lo que siempre quiso decir |
| `FINDING` | `{ module: "QUALITY", entityType: "finding", entityId }` | **Deja de contar documentos** |
| `ACTION` | `{ module: "QUALITY", entityType: "action", entityId }` | **Deja de contar documentos** |

Las ramas de calidad pierden su conteo porque sin `entityType`/`entityId` solo quedaría filtrar por `module: QUALITY`, que no distingue el hallazgo concreto y sobre-reportaría. Es un cambio de comportamiento y se declara como tal: hoy no existe ni un documento de calidad, y D-07 y D-08 difieren esa integración. Cuando el módulo atienda a calidad, el vínculo se modelará con integridad referencial y no con una convención implícita, que es el criterio de D-06.

**Consecuencia sobre el contrato federado**: se retiran los campos `entityType` y `entityId` del tipo `Document`, los argumentos homónimos de las consultas de listado y los campos del input de creación, donde hoy son obligatorios. Es una reducción del API compuesto y `rover subgraph check` la señalará. Se acepta porque no existe consumidor: la webapp no los usa y `mi-quality` solo invoca `checkDocumentDependencies`.

### B4 — La configuración documental del proyecto es una entidad propia

`DocProjectSettings` guarda un registro por proyecto:

- `projectId`, único, referencia externa sin clave foránea;
- `documentRole DocumentRole` — enumeración `ISSUER` / `RECEIVER` / `INTERNAL`, conforme a D-09 y D-19;
- `counterpartyName String?` — el nombre de la contraparte: el cliente en modo Emisor, el contratista en modo Receptor. **Nulo, y exigido por invariante, según el rol**: obligatorio en `ISSUER` y `RECEIVER`, prohibido en `INTERNAL`, que por definición no tiene contraparte (D-19).

**Es donde residirán las configuraciones por proyecto de los bloques siguientes**: el esquema de revisión de D-13 en `BLOCK_03`, y la habilitación y obligatoriedad de la ubicación física de D-14 en su bloque. Se crea acá porque el rol documental la necesita primero.

La nomenclatura `ISSUER` / `RECEIVER` traduce directamente Emisor y Receptor y se mantiene en inglés como el resto de las enumeraciones del módulo. Alternativas descartadas: `ENGINEERING` / `PLANT` ata el modelo a dos industrias; `OUTBOUND` / `INBOUND` engañaría, porque D-18 muestra que ambos modos tienen transmittals en las dos direcciones.

`INTERNAL` **no es un modo de planta: es la ausencia de contraparte**, y una empresa de ingeniería lo usa igual para su desarrollo propio (D-19).

**La contraparte se declara por nombre.** D-15 fijó que el proyecto admite una sola contraparte, de modo que un atributo alcanza. Alternativa descartada: referenciar una entidad de cliente de otro subgraph, que repetiría el problema de la referencia externa sin integridad y ata el bloque a un relevamiento que no se hizo. Alternativa descartada: derivarla del conjunto de miembros del lado contraparte, que dejaría a un proyecto recién creado sin poder declarar con quién trabaja.

### B5 — El rol documental es inmutable desde el primer documento

El rol se declara al configurar el proyecto y **se congela en cuanto existe el primer documento o el primer transmittal**.

El rol invierte el orden entre el circuito de revisión y el transmittal (D-09): en modo Emisor el circuito precede a la emisión, en modo Receptor la emisión precede a la calificación, y en modo Interno no hay emisión, de modo que el ciclo termina en la aprobación (D-19). Cambiarlo con documentos en circulación dejaría objetos cuyo ciclo ya no corresponde al modo declarado.

Mientras el proyecto no tenga ni documentos ni transmittals, el rol se modifica libremente. La operación existe y es la misma; lo que cambia es la precondición.

### B6 — La membresía documental es `DocProjectMember`

Se porta `ProjectMember` (DOM-020) de OperMask Digitalization, con el prefijo que exige B1 de `BLOCK_01`:

- vincula un usuario con un proyecto y **habilita su acceso a ese proyecto**;
- declara **de qué lado está**: anfitrión o contraparte, con el rótulo que aporta el rol del proyecto según la tabla de D-15. En un proyecto `INTERNAL` todos los miembros son del lado anfitrión, **incluidas las personas ajenas a la organización** que participen del desarrollo: un proyectista externo o un consultor trabaja como uno más y no recibe emisiones ni califica (D-19);
- registra alta, baja y actor;
- es única por par usuario–proyecto.

**No declara rol funcional ni participación de solo lectura**, conforme a D-15: la membresía determina qué alcanza el usuario, no qué puede hacer. Eso lo resuelven el permiso global de `mi-admin` y la asignación del workflow. Incorporar un indicador de solo lectura crearía una segunda fuente de verdad sobre lo permitido y obligaría a resolver cuál prevalece ante una contradicción.

**Es una lista distinta de la membresía de `mi-project`**, que registra personal propio asignado y no contempla externos. No se deriva ni se sincroniza con ella.

### B7 — La autorización es de dos capas, y en los listados es filtrado

Se porta `projectAuthorization` de digitalización: permiso global validado contra `mi-admin`, más membresía vigente en el proyecto.

Su aplicación tiene **dos formas**, según la operación tenga o no un proyecto determinable:

- **Operaciones sobre un objeto**: se resuelve el proyecto del objeto y se exige membresía vigente. Es la doble capa estricta.
- **Listados sin proyecto en los argumentos** —`documents`, `documentsByModule`, `documentsSelectList`, `workflowsByStatus`, `pendingReviewSteps`, `transmittals`—: no puede exigirse membresía en un proyecto que la consulta no nombra. Se **filtra** el resultado a los proyectos donde el usuario tiene membresía vigente. Es la misma regla expresada como restricción del conjunto en lugar de rechazo.

**Los documentos sin proyecto quedan gobernados solo por el permiso global**, conforme a B1: son el régimen de publicación y no tienen partes que acotar.

La distinción se declara acá para que no se resuelva de forma implícita al implementar: un listado que rechazara por falta de membresía sería inutilizable, y un objeto que solo filtrara dejaría el acceso abierto.

Esto resuelve H-32 y fija además el criterio de H-07: `pendingReviewSteps` queda acotado por membresía, y su alineación con D-04 respecto de los pasos ajenos se decide en `BLOCK_03`.

### B8 — `ScannedFile` y `Area` quedan fuera de la doble capa

Sus 22 operaciones conservan la autorización global vigente.

Es el único punto donde este bloque podría romper algo en uso. Son el único subsistema con datos e interfaz en producción, y **ningún usuario tiene membresía documental todavía**: aplicarles la doble capa dejaría al cliente que los usa sin acceso a su propia operación.

Su salida hacia `212-mi-digitalization` está diferida con su propio bloque, y el alcance de acceso se resolverá allí.

### B9 — Los eventos llevan el contexto del objeto: `projectId` y `module`

`DocWorkflowEvent` y `DocAuditEvent` suman **dos** columnas de contexto, ambas nulables:

- `projectId Int?` — resuelve B6 de `BLOCK_01`, que difirió explícitamente la definición a este bloque;
- `module ModuleType?` — el módulo al que pertenece el objeto afectado.

**Son dos ejes distintos y ninguno reemplaza al otro.** `projectId` aísla la traza de un proyecto y es el insumo del alcance por membresía (B7). `module` aísla la traza de un módulo, y es el único eje disponible cuando no hay proyecto: los documentos del régimen de publicación (B1) tienen `projectId` nulo, de modo que sin `module` toda su traza queda en una masa indistinguible. Para un documento de proyecto `module` es siempre `PROJECTS` y no agrega información; **su valor está justamente en los casos donde `projectId` es nulo.**

**Ambas se derivan del objeto afectado y no las informa quien emite.** Es la regla que `BLOCK_01` ya aplica al tipo de objeto —derivado del catálogo, no declarado en el resolver— extendida al contexto, y es la que impide que H-24 reaparezca: el módulo de un transmittal se deriva como el de cualquier otro objeto, no se fija a mano.

Alternativa descartada: derivar el contexto navegando hasta el documento en cada consulta. **Es el motivo por el que este bloque denormaliza.** Ninguno de los objetos intermedios conoce su módulo: un evento sobre `REVIEW_STEP` exigiría recorrer paso → workflow → revisión → documento, sobre un `objectId` polimórfico que no admite unión en SQL. El costo se paga en cada consulta y en cada verificación de alcance, y los eventos de `DocumentClass` y `DocumentType` no tendrían de dónde derivarlo.

Alternativa descartada: un único par polimórfico de contexto, del tipo `scopeType` / `scopeId`. Es exactamente `entityType`/`entityId`, que B3 retira por carecer de integridad referencial.

Ambas columnas son nulables porque los catálogos `DocumentClass` y `DocumentType` declaran su propio `module` como opcional —nulo significa disponible para todos los módulos— y no pertenecen a ningún proyecto.

Ambas tablas están vacías, de modo que la migración es aditiva y no requiere relleno.

**Las dos consultas de eventos admiten filtrar por contexto.** `docWorkflowEvents` y `docAuditEvents` incorporan `module` y `projectId` como argumentos opcionales, además del par `objectType`/`objectId` que ya tienen. Sin ellos las columnas no entregarían nada, y la interfaz de `BLOCK_05` requeriría una migración propia para poder consultarlas.

**H-24 se cierra igual, pero por otro motivo.** No se cierra porque el módulo desaparezca: se cierra porque la inconsistencia vivía en `DocumentSysLog.module` —fijado a `PROJECTS` en transmittals y derivado en el resto— y las 25 escrituras que la producían fueron sustituidas por `BLOCK_01`. El módulo que este bloque incorpora al evento nace derivado, que es lo que aquel hallazgo reclamaba.

### B10 — Dos recursos de permisos nuevos en `202-mi-common`

| Recurso | Permisos |
| ------- | -------- |
| `documentsProjectMember` | `READ`, `LIST`, `CREATE`, `DELETE` |
| `documentsProjectSettings` | `READ`, `UPDATE` |

Sigue el precedente exacto de `digitalizationProjectMember`. Administrar quién entra a un proyecto y declarar su rol documental son actos distintos de operar documentos, y confundirlos permitiría que quien edita un documento cambie el rol del proyecto.

**Este bloque modifica el catálogo compartido y exige republicarlo.** `BLOCK_01` evitó deliberadamente tocarlo; acá es inevitable, porque la membresía es un objeto nuevo sin permiso que la gobierne.

Declarar la constante no alcanza. Un permiso llega a un despliegue por tres pasos, y los tres pertenecen a la Fase A:

1. la constante en `202-mi-common`, publicada;
2. el alta en `prisma/seeds/seedPermissions.ts` de `205-mi-admin`, con nombre y descripción, que es lo que lo crea en la base;
3. la asignación a los roles en `prisma/seeds/shared/rolePermissions.ts`, siguiendo el reparto de digitalización: el rol básico lee, el rol completo administra.

La aplicación efectiva en cada despliegue se hace con `npm run seed:permissions`, que actualiza únicamente permisos y es la vía segura en producción.

### B11 — `Transmittal.issuedTo` no se toca en este bloque

`Transmittal` guarda hoy el nombre del destinatario por registro. Con la contraparte declarada en el proyecto (B4), el dato queda duplicado.

No se unifica acá: el transmittal pertenece a la circulación y su tratamiento —naturaleza, sentido y respuesta— es `BLOCK_04`. Se declara para que la duplicación no pase inadvertida ni se resuelva de forma implícita al implementar.

La dirección en que conviene resolverla es hacia `DocProjectSettings`, no hacia el transmittal: el plan anota como orientación que la relación con la contraparte puede llegar a incluir el vínculo con el despliegue de la propia contraparte, y ese dato debe residir en un solo lugar.

## Mapa de autorización

| Operación | Capa | Criterio |
| --------- | ---- | -------- |
| `documentById`, `updateDocument`, `terminateDocument`, `activateDocument`, `switchRevisionScheme` | Doble | Proyecto del documento; global si el documento no tiene proyecto |
| `createDocument` | Doble | Proyecto del input; global si no se informa proyecto y `module ≠ PROJECTS` |
| `documents`, `documentsByModule`, `documentsSelectList` | Filtrado | Proyectos con membresía vigente, más los documentos sin proyecto |
| `revisionById`, `createRevision`, `registerVersion` | Doble | Proyecto del documento de la revisión |
| `initiateReview`, `approveStep`, `rejectStep`, `cancelWorkflow` | Doble | Proyecto del documento del workflow |
| `pendingReviewSteps`, `workflowsByStatus` | Filtrado | Proyectos con membresía vigente, más los objetos sin proyecto. D-03 fija que toda revisión atraviesa un circuito, de modo que un documento publicado también tiene workflows |
| `transmittalById`, `createTransmittal`, `issueTransmittal`, `respondTransmittal`, `closeTransmittal` | Doble | `Transmittal.projectId`, que ya existe |
| `transmittals` | Filtrado | Proyectos con membresía vigente |
| `transmittalsByProject` | Doble | El proyecto es argumento explícito |
| `docWorkflowEvents`, `docAuditEvents` — por objeto o por proyecto | Doble | `projectId` del evento (B9) |
| `docWorkflowEvents`, `docAuditEvents` — por módulo, sin proyecto | Filtrado | Proyectos con membresía vigente, más los eventos con `projectId` nulo |
| `DocumentClass`, `DocumentType` — todas | Global | Catálogos del despliegue, sin proyecto |
| `ScannedFile`, `Area` — todas | Global | Exclusión declarada en B8 |
| `checkDocumentDependencies` | Global | Verificación entre servicios, sin usuario de proyecto |

## Fases de implementación

| Fase | Contenido |
| ---- | --------- |
| A | Permisos nuevos en `202-mi-common` y republicación del paquete; alta de los seis permisos en el seed de `205-mi-admin` y su asignación a los roles documentales; actualización de la dependencia en los consumidores. |
| B | Modelo Prisma: `Document.projectId`, retiro de `entityType`/`entityId`, `DocProjectSettings`, `DocProjectMember`, `projectId` y `module` en ambos eventos. Migración con los índices parciales en SQL. |
| C | `projectAuthorization` portado, con sus dos formas de aplicación. |
| D | Aplicación a las 27 operaciones, resolver por resolver, sin alterar reglas funcionales. |
| E | Ajuste de `checkDocumentDependencies` según B3. |
| F | GraphQL de configuración y membresía, con sus permisos, y filtros de contexto en las dos consultas de eventos. |
| G | Pruebas automatizadas. |
| H | Cierre documental: recién entonces se evalúa la promoción a la SFS. |

La fase A precede a todas porque sin los permisos publicados no hay con qué autorizar las operaciones nuevas.

## Estrategia de pruebas

Mismo enfoque que `BLOCK_01`: `node:test` ejecutado con `node --import tsx --test`, sin dependencias nuevas.

**Funciones puras**, sin base de datos:

- el invariante de B1: qué combinaciones de `module` y `projectId` son válidas;
- la derivación del contexto del evento (B9): que para cada uno de los 8 tipos de objeto quede declarado de dónde salen `module` y `projectId`, y que ningún tipo quede sin regla. Es el equivalente de la prueba con que `BLOCK_01` fija la derivación del tipo de objeto, y es la que impide que H-24 reaparezca;
- la resolución del rótulo del lado a partir del rol del proyecto (D-15): anfitrión y contraparte se leen Ingeniería/Cliente o Planta/Contratista según `ISSUER` o `RECEIVER`, y en `INTERNAL` solo existe el lado anfitrión;
- el invariante de la contraparte según el rol (B4): exigida en `ISSUER` y `RECEIVER`, prohibida en `INTERNAL`;
- la precondición de inmutabilidad del rol (B5);
- la construcción del criterio de filtrado por membresía (B7), dado un conjunto de membresías vigentes.

**Contra la base**, siguiendo la suite de persistencia que `BLOCK_01` incorporó:

- los dos índices parciales de B2: que se rechace el duplicado de `[code, projectId]` con proyecto, y el de `[code, module]` sin proyecto, y que ambos regímenes no se interfieran;
- la doble capa: que una operación sobre un proyecto sin membresía sea rechazada y con membresía vigente prospere;
- que la baja de la membresía retire el acceso;
- que cada emisión persista el `module` y el `projectId` del objeto afectado, y que un transmittal los derive por la misma vía que el resto (B9).

Scripts incorporados a `package.json`, siguiendo la separación de `BLOCK_01` entre lo que requiere base y lo que no:

```
"test:project-scope":    "node --import tsx --test src/utils/projectAuthorization.test.ts"
"test:project-scope-db": "node --import tsx --test src/utils/projectAuthorizationPersistence.test.ts"
"test:block02":          "npm run test:block01 && npm run test:project-scope"
"test:block02-db":       "npm run test:block02 && npm run test:events-db && npm run test:project-scope-db"
```

## Criterios de aceptación

1. `202-mi-common` publicado con los seis permisos nuevos; `205-mi-admin` con su alta en el seed y su asignación a `doc-basic` y `doc-full`; y `209-mi-document` consumiéndolos desde la versión publicada. Los tres compilan sin error contra la versión nueva.
2. `prisma validate` y `prisma migrate` se ejecutan sin error. La migración se aplica sobre una base con datos de `ScannedFile` y `Area` sin afectarlos.
3. **Antes de aplicar la migración se verifica sobre la base de cada cliente que las tablas del subsistema documental están vacías.** Es la condición que el plan fija para cambiar el modelo de forma directa.
4. `npm run build` y `tsc --noEmit` compilan sin error.
5. `npm run test:block02` pasa en su totalidad, y las suites de `BLOCK_01` siguen pasando.
6. Los dos índices parciales existen en la base y rechazan el duplicado en ambos regímenes.
7. Las 27 operaciones del mapa de autorización aplican la capa que el mapa les asigna, y ninguna quedó sin revisar.
8. La traza puede listarse por proyecto y por módulo, y ninguna emisión persiste un contexto informado a mano: los 8 tipos de objeto lo derivan.
9. Las 22 operaciones de `ScannedFile` y `Area` conservan su autorización global, y el cliente que las usa mantiene su operación intacta.
10. Ninguna regla del ciclo de revisión ni de la circulación cambió: mismos estados, mismas validaciones, mismos mensajes de error.
11. `mi-quality` compila sin cambios y `checkDocumentDependencies` responde con el comportamiento declarado en B3.
12. `rover subgraph check` ejecutado. Los retiros de B3 se documentan como cambios aceptados, con la evidencia de que no existe consumidor.
13. La SFS se actualiza únicamente después de reunir estas evidencias.

## Evidencia de validación

Se completa por fase, como en `BLOCK_01`.

### Fase A — permisos

**`202-mi-common` 2.5.0 publicado** en GitHub Packages, con dos recursos y seis permisos:

| Recurso | Permisos |
| ------- | -------- |
| `documentsProjectSettings` | `documents:documentsProjectSettings:read`, `:update` |
| `documentsProjectMember` | `documents:documentsProjectMember:read`, `:list`, `:create`, `:delete` |

- Commit `4a3f0fa` más el de versión `9a30cde`, con tag `v2.5.0`. Local y remoto coinciden; árbol limpio.
- `prettier --check`, `tsc --noEmit` y `eslint` sin errores. El total del catálogo pasó de 398 a 404 permisos.

**`205-mi-admin` 2.2.4**, commit `728f711`:

- Las seis altas en `prisma/seeds/seedPermissions.ts`, con nombre y descripción, y el reparto en `prisma/seeds/shared/rolePermissions.ts`.
- `tsc --noEmit` y `npm run build` sin errores contra la versión publicada.
- Se revirtió el ruido de regeneración del cliente Prisma, que era solo espacios en blanco, para no ensuciar el commit.
- `WhatIsNew.md` actualizado.

**`209-mi-document`**: dependencia en `^2.5.0`, `tsc --noEmit` y `npm run build` sin errores, y las **22 pruebas de `BLOCK_01` siguen aprobadas** (15 de eventos, 7 del circuito de revisión).

**Aplicación en base, únicamente local** (`mi-admin-pg`, `mi_admin_db`, puerto 5405). `npm run seed:permissions`, que opera por upsert:

- permisos: 398 → **404**;
- `role_permissions`: 781 → **790**, es decir las nueve asignaciones nuevas;
- reparto verificado en base: `doc-basic` recibe `documentsProjectSettings:read` y `documentsProjectMember:read` y `:list`; `doc-full` recibe los seis.

**Pendiente de esta fase**: la aplicación sobre las bases de los demás clientes (`proion`, `maria`, `austin`, `optimal`). Los permisos existen como constante publicada y como seed, pero todavía no están en esas bases.

Nota de operación, para no repetir el tropiezo: el `.npmrc` de `202-mi-common` declara `_authToken=${NODE_AUTH_TOKEN}` y tiene precedencia sobre `~/.npmrc`, de modo que publicar exige esa variable resuelta. El remoto de los repositorios es SSH y la clave no está cargada en el agente.

### Fase B — modelo y migración

Ejecutado sobre la base local de desarrollo (`mi-document-pg`, `mi_document_db`, puerto 5409), con respaldo previo.

- `prisma validate`: schema válido. Migración `20260809120000_add_project_context` generada con `prisma migrate diff` y aplicada con `prisma migrate deploy`. Son **8 migraciones** en total.
- Enumeraciones nuevas: `DocumentRole` con `ISSUER`, `RECEIVER` e `INTERNAL` (D-09, D-19), y `DocProjectSide` con `HOST` y `COUNTERPARTY` (D-15).
- Modelos nuevos: `doc_project_settings`, con `projectId` único, y `doc_project_members`, con `@@unique([projectId, userId])`. Ambos con `projectId` como referencia externa sin clave foránea, según la convención del módulo.
- `Document`: incorpora `projectId Int?` y **pierde `entityType` y `entityId`**, verificado en base. La unicidad `[code, module, entityType, entityId]` y su índice fueron reemplazados por los dos índices parciales de B2.
- `DocWorkflowEvent` y `DocAuditEvent`: incorporan `projectId Int?` y `module ModuleType?`, con índice por cada eje (B9).

**Los índices parciales fueron probados en las dos direcciones**, dentro de una transacción revertida:

| Caso | Resultado |
| ---- | --------- |
| Alta con proyecto | Aceptada |
| Mismo código y mismo proyecto | **Rechazada** por `documents_code_projectId_key` |
| Mismo código, otro proyecto | Aceptada |
| Alta sin proyecto | Aceptada |
| Mismo código y mismo módulo, sin proyecto | **Rechazada** por `documents_code_module_key` |
| Mismo código, otro módulo, sin proyecto | Aceptada |
| Mismo código con proyecto y sin proyecto | Aceptada — los dos regímenes son independientes |

- Datos preexistentes intactos: `scanned_files` 6, `areas` 2, `document_sys_logs` 7. `documents` 0, consistente con la línea base.
- `prisma generate`, `tsc --noEmit` y `npm run build` sin errores. **Las 28 pruebas de `BLOCK_01` siguen aprobadas** (15 + 7 + 6, incluida la de persistencia contra la base).

**Advertencia sobre el valor de la compilación.** Que `tsc` no arroje errores **no significa que el módulo funcione**. Se verificó contra la base que dos formas de consulta que sobreviven en el código fallan en tiempo de ejecución tras el retiro de las columnas:

- `dependencies.ts`, ramas `FINDING` y `ACTION`: filtran por `entityType` y `entityId` en un literal que el tipado de Prisma no rechaza en esa posición;
- `documents.ts`: arma el filtro sobre `const where: any`, de modo que el `any` anula la verificación.

Ninguna de las dos está cubierta por el tipo, y ambas se corrigen en las fases D y E. Se deja asentado para que el criterio de aceptación 4 no se lea como evidencia de comportamiento.

### Fase C — autorización acotada por proyecto

`src/utils/projectAuthorization.ts`, portado de OperMask Digitalization (ADR-020) con las adaptaciones que exige B7. Expone las **dos formas** y la parte pura que las une:

| Función | Forma | Uso |
| ------- | ----- | --- |
| `projectAuthorization` | Doble capa estricta | Operaciones sobre un objeto: permiso global más membresía vigente, con rechazo `FORBIDDEN` |
| `projectScopeAuthorization` | Filtrado | Listados sin proyecto en los argumentos: devuelve el usuario y el criterio de alcance |
| `buildProjectScope` | Pura | Traduce las membresías vigentes en un fragmento de `where` |
| `listMemberProjectIds` | Consulta | Proyectos con membresía vigente del usuario |

Tres decisiones de implementación que conviene dejar explícitas:

- **`projectId` es `number | null`, no opcional.** El nulo significa régimen de publicación (B1) y devuelve el control al permiso global. Declararlo obligatorio impide que alguien omita el argumento por descuido y saltee la segunda capa sin haberlo decidido.
- **El alcance es un fragmento componible, no un `where` completo.** Se aplica directo donde el modelo expone `projectId` —documentos y transmittals— y anidado donde el proyecto vive en el objeto relacionado, como un workflow que lo alcanza a través de su revisión y su documento.
- **`includeWithoutProject` es explícito por llamada.** Solo los listados de documentos incorporan los objetos sin proyecto; los de transmittals y workflows no, porque siempre pertenecen a uno.

Vigencia de la membresía: `isActive: true` y `revokedAt: null`.

**Pruebas: 14 nuevas, todas aprobadas.**

| Suite | Script | Pruebas | Alcance |
| ----- | ------ | ------- | ------- |
| Criterio de alcance | `test:project-scope` | 7 | Construcción del filtro: proyectos con membresía, conjunto vacío, régimen de publicación incluido y excluido, deduplicación y orden estable, ausencia de mutación |
| Membresía en base | `test:project-scope-db` | 7 | Alcance vacío sin membresías, alcance por membresía vigente, aislamiento entre usuarios, **retiro del acceso al dar de baja**, membresía inactiva sin fecha de baja, unicidad del par usuario–proyecto, y validez del filtro construido contra una consulta real |

**Total del módulo: 42 pruebas, 42 aprobadas** — 22 de `BLOCK_01` sin base, 6 de persistencia de eventos y 14 de este bloque. `tsc --noEmit` y `npm run build` sin errores. Las pruebas operan sobre identificadores fuera de rango y limpian al terminar: verificado tras la corrida, `doc_project_members` 0 y el legado intacto.

**Lo que esta fase no cubre.** La primera capa no se ejercita en estas suites: `userAuthorization` exige JWT y una consulta a `mi-admin`. La fase D levanta esa restricción con un arnés de integración.

### Fases D y E — aplicación a las operaciones

**Las 27 operaciones aplican la capa que el mapa les asigna**: `documents` 9, `transmittals` 7, `workflows` 6, `revisions` 2, `events` 2, `versions` 1.

Cuatro decisiones de implementación que conviene dejar asentadas:

- **La autorización va fuera del `try`.** `handleError` re-lanza el `GraphQLError` intacto, de modo que el `FORBIDDEN` sobrevive —pero antes **escribe una fila `ERROR` en `DocumentSysLog`**. Un rechazo de autorización no es un error del servicio, y registrarlo como tal ensuciaría el log técnico con operación normal.
- **El orden es permiso → lectura del objeto → membresía.** Nunca se lee la base antes de verificar el permiso global. Para eso se expone `assertProjectMembership` por separado de `projectAuthorization`.
- **El alcance se anida donde el proyecto no está en la raíz.** Un paso lo alcanza por workflow → revisión → documento, y un workflow por revisión → documento. Se incorpora bajo `AND` para no pisar el `OR` de la búsqueda por texto, que de otro modo podría **ampliar** el resultado en lugar de restringirlo.
- **"No existe" se distingue de "no tiene proyecto".** `assertObjectAccess` corta con `NOT_FOUND` cuando el objeto no está, en lugar de tratarlo como régimen de publicación. Confundirlos autorizaría operaciones sobre objetos inexistentes.

**Contexto de los eventos (B9), implementado literal.** `src/utils/objectContext.ts` declara, por tipo de objeto, de dónde salen `projectId` y `module`. `emitAuditEvent` y `emitWorkflowEvent` lo resuelven solos: **ningún resolver informa el contexto.** El costo es una lectura por emisión, aceptado deliberadamente porque la alternativa —que cada resolver lo pase— es el mecanismo exacto que produjo H-24. La misma tabla resuelve el proyecto para la segunda capa, de modo que no quedó duplicada.

Para `TRANSMITTAL` el módulo se declara `PROJECTS`: el modelo no tiene columna de módulo porque es capacidad exclusiva de proyectos (D-06). La diferencia con el defecto de H-24 es que ahora está en **un solo lugar** y no repetido en cada resolver.

**Contrato GraphQL.** Se retiraron `entityType` y `entityId` del tipo `Document`, de `CreateDocumentInput` —donde eran obligatorios— y de los argumentos de `documentsByModule`, reemplazados por `projectId`. **No se tocó nada de `Attachment`** (diferido por D-08) ni los argumentos de `checkDocumentDependencies`, que identifican la entidad a borrar y no columnas de `Document`. El esquema compone contra los resolvers, verificado con `buildSubgraphSchema`.

**Fase E — `checkDocumentDependencies`.** La rama `PROJECT` pasa a contar por `projectId`, que es lo que siempre quiso decir. Las ramas `FINDING` y `ACTION` **dejan de contar documentos**, declarado en el código con su motivo. `mi-quality` compila sin cambios.

Se verificó **ejecutando** que las dos consultas que la fase B dejó rotas en tiempo de ejecución vuelven a funcionar. No se dio por buena la compilación limpia.

#### Arnés de integración

Levanta la restricción que `BLOCK_01` había declarado insalvable: *"no hay pruebas de integración de los resolvers… requeriría autenticación y datos de prueba"*.

Los resolvers se ejercitan con contexto real —token firmado con `AUTH_JWT_SECRET`, primera capa validada **contra `mi-admin` corriendo**, segunda contra la base—. El token se firma localmente, no se persiste y no sale de localhost.

**10 pruebas, 10 aprobadas** (`test:block02-integration`):

| Verifica | Resultado |
| -------- | --------- |
| Operación sobre objeto con membresía vigente | Prospera |
| Operación sobre objeto de un proyecto ajeno | `FORBIDDEN` |
| Documento sin proyecto | Prospera con permiso global (B1) |
| Objeto inexistente | `NOT_FOUND`, no `FORBIDDEN` |
| Listado de documentos | Filtra: incluye el propio y el publicado, excluye el ajeno |
| Listado de transmittals | Excluye los proyectos sin membresía |
| Proyecto como argumento explícito | `FORBIDDEN` sin membresía |
| Alta de documento de proyecto sin proyecto | `BAD_USER_INPUT`, antes de autorizar |
| Alta en un proyecto ajeno | `FORBIDDEN` |
| Baja de la membresía | Retira el acceso, de punta a punta |

**Total del módulo: 56 pruebas, 56 aprobadas.** `tsc --noEmit` y `npm run build` sin errores. Base sin residuos tras la corrida.

Scripts: `test:block02-integration` y `test:block02-all`, que encadena todo. Se mantienen separados porque la integración **exige `mi-admin` corriendo**, a diferencia del resto.

### Fase F — exposición GraphQL

**Configuración del proyecto**: consulta `docProjectSettings(projectId)` y mutación `declareDocProjectSettings`, que hace *upsert* porque un proyecto declara su rol una vez y puede corregirlo mientras esté vacío.

**Membresía**: consulta `docProjectMembers(projectId, includeRevoked)` y mutaciones `assignDocProjectMember` y `revokeDocProjectMember`. El alta hace *upsert*: un alta repetida **reincorpora** en lugar de duplicar, sostenida por la unicidad del par usuario–proyecto. La baja es lógica y conserva alta, baja y actor (D-15).

**Ambas familias se gobiernan solo por el permiso global, sin la segunda capa.** Es una decisión de arranque, no una omisión: el primer miembro de un proyecto no puede exigir una membresía que todavía no existe, y un proyecto sin configuración tampoco tiene miembros. Es el criterio con que OperMask Digitalization trata el mismo objeto, verificado en su resolver.

**Consecuencia declarada**: quien tenga `documentsProjectMember:list` ve la membresía de **todos** los proyectos. Ese permiso no debe otorgarse a un rol de contraparte cuando `BLOCK_04` incorpore usuarios externos.

**Los objetos nuevos son trazables.** `DocObjectType` incorpora `DOC_PROJECT_SETTINGS` y `DOC_PROJECT_MEMBER` —migración `20260809140000_add_project_context_object_types`, puramente aditiva— junto con tres acciones de auditoría: `DeclareProjectSettings`, `AssignProjectMember` y `RevokeProjectMember`. El catálogo pasa de 25 a **28 acciones**; la prueba que fijaba el número en 25 se actualizó explicando por qué. Su contexto se deriva por la misma tabla: llevan proyecto y no llevan módulo, porque son contexto del proyecto y no documentación.

**Filtros de contexto en la traza.** `docWorkflowEvents` y `docAuditEvents` incorporan `module` y `projectId` como argumentos opcionales, que era lo que B9 prometía y sin lo cual las columnas nuevas no entregaban nada.

**Reglas nuevas, con prueba pura**: el invariante de la contraparte (B4) y el rótulo del lado según el rol (D-15), incluido el caso `INTERNAL`, donde no hay contraparte que nombrar. La inmutabilidad del rol (B5) se verifica en integración, contra un proyecto que ya tiene documentos.

**Pruebas: 6 puras nuevas y 6 de integración nuevas.** El arnés pasó de 10 a **16**, sumando: la configuración se declara, se lee y emite su traza con el proyecto derivado; el proyecto interno rechaza contraparte; el rol no cambia con documentos existentes; administrar membresía no exige membresía previa —y habilita el acceso acto seguido—; el alta repetida reincorpora sin duplicar; y el listado excluye las bajas salvo que se pidan.

**Total del módulo: 72 pruebas, 72 aprobadas.** `tsc --noEmit`, `npm run build` y la composición del subgraph con `buildSubgraphSchema` sin errores. Base sin residuos tras la corrida.

### Verificación del contrato federado

`rover subgraph check Maria-Ingenieria@staging --name mi-document`, ejecutado sobre el SDL resultante.

| Verificación | Resultado |
| ------------ | --------- |
| Composición | Sin cambios en el API compuesto; el core schema sí se modificó |
| Operaciones | **FAILED** — 99 cambios comparados contra **0 operaciones** |
| Linter | **PASSED**, con una advertencia |

**El fallo es exactamente el anticipado y no afecta a ningún consumidor.** Los seis cambios marcados son los retiros de B3:

- `Document.entityType` y `Document.entityId` — campos retirados;
- `CreateDocumentInput.entityType` y `.entityId` — campos retirados del input, donde además eran obligatorios;
- `Query.documentsByModule` — los dos argumentos homónimos.

Se marcan por **clasificación del tipo de cambio, no por uso**: el propio informe indica que la comparación se hizo contra **0 operaciones registradas**. No existe cliente que los consuma. Concuerda con lo verificado en el código durante la fase B: la webapp no los usa, y `mi-quality` solo invoca `checkDocumentDependencies`, cuyos argumentos homónimos identifican la entidad a borrar y **no** se tocaron.

Los otros 93 cambios pasaron, incluidas todas las incorporaciones de este bloque: `projectId` en `Document` y en `CreateDocumentInput` como opcional, los tipos y enumeraciones del contexto de proyecto, las cinco operaciones nuevas y el contexto de los dos eventos.

La advertencia del linter es sobre el nombre `DocObjectType`, por el sufijo `Type`. Es un nombre que introdujo `BLOCK_01` y se conserva: renombrarlo sería un cambio incompatible del contrato a cambio de nada.

**Los retiros se aceptan de forma explícita**, conforme al criterio 12, con esta evidencia como respaldo. El subgraph fue publicado a `staging` tras la aceptación.

### Fase H — cierre documental

**Criterios de aceptación: 12 de 13 verificados.**

| # | Criterio | Estado |
| - | -------- | ------ |
| 1 | Permisos publicados, sembrados, asignados y consumidos; los tres repositorios compilan | Verificado |
| 2 | `prisma validate` y `migrate` sin error, sin afectar datos existentes | Verificado |
| 3 | **Tablas documentales vacías en la base de cada cliente, antes de migrar** | **NO verificado** |
| 4 | `npm run build` y `tsc --noEmit` sin error | Verificado |
| 5 | Suites del bloque y de `BLOCK_01` aprobadas | Verificado — 72 pruebas |
| 6 | Índices parciales presentes y rechazando duplicados en ambos regímenes | Verificado |
| 7 | Las 27 operaciones aplican la capa asignada | Verificado, incluido el arnés de integración |
| 8 | Traza listable por proyecto y por módulo; contexto derivado en los 10 tipos de objeto | Verificado |
| 9 | Las 22 operaciones de `ScannedFile` y `Area` conservan su autorización global | Verificado — 0 llamadas a la capa de proyecto |
| 10 | Ninguna regla del ciclo de revisión ni de la circulación cambió | Verificado |
| 11 | `mi-quality` compila sin cambios | Verificado — `tsc` sin errores |
| 12 | `rover subgraph check` ejecutado y retiros documentados | Verificado |
| 13 | SFS actualizada solo después de reunir la evidencia | Verificado |

**El criterio 3 no se cumplió y no debe darse por cumplido.** La verificación se hizo únicamente sobre la base local. La comprobación sobre las bases de `rbb`, `proion`, `maria`, `austin` y `optimal` sigue pendiente, y es la condición que el plan fija para aplicar cambios directos de modelo. **La migración no debe aplicarse fuera de local hasta cumplirla.** Por el mismo motivo queda pendiente el seed de permisos en esos cuatro despliegues.

#### Promovido a la SFS

Se incorporó un ámbito nuevo, `docs/SFS/domain/05_project/`:

- `10_DOM-003_DocProjectSettings.md`
- `20_DOM-004_DocProjectMember.md`
- `80_Principios_del_Modelo.md`

Y se actualizaron a versión 1.1 los dos objetos de `BLOCK_01`, que incorporaron el contexto derivado: `DOM-001` y `DOM-002`.

**Qué se promovió y qué no.** Se documentaron los dos objetos con sus responsabilidades e invariantes, y siete principios del contexto de proyecto: la unidad de alcance, los dos regímenes de circulación y publicación, la autorización en dos capas y sus dos formas, la administración por encima del alcance, la expresión de la pertenencia por referencia y no por convención, y la derivación del contexto de la traza.

**No se promovió el comportamiento del rol documental sobre el ciclo.** Que en modo Interno el estado aprobado sea terminal, que el rol invierta el orden entre circuito y emisión, y que un proyecto interno no admita transmittals son consecuencias **aprobadas pero no implementadas**: corresponden a `BLOCK_03` y `BLOCK_04`. La SFS afirma únicamente que el proyecto declara un rol de tres valores, con su invariante de contraparte y su inmutabilidad, que es lo que este bloque implementó y validó.

Es el mismo criterio con que `BLOCK_01` se abstuvo de promover su catálogo de acciones: no se documenta como vigente lo que un bloque posterior va a definir.

**Tampoco se promovió `Document`.** El objeto gana `projectId` en este bloque, pero su especificación completa —código, esquema de revisión, ciclo— la modifican `BLOCK_03` y `BLOCK_04`. Promoverlo ahora obligaría a corregirlo dos veces. El contexto de proyecto que este bloque le agrega queda expresado en los principios del ámbito.

**Estado del bloque: `LISTO_PARA_PROMOVER`.** No pasa a `PROMOVIDO_A_SFS` mientras el criterio 3 siga sin verificarse: la definición está documentada, pero el bloque no está aplicado fuera del entorno local.

## Referencias

- `README.md`
- `DOCUMENT_EVOLUTION_PLAN.md` — D-06, D-09, D-15; H-17, H-19, H-28, H-32
- `BLOCK_01_TRAZABILIDAD_FUNCIONAL.md` — B1, B5 y B6
- `../SFS/00_Convenciones.md`
- `212-mi-digitalization/docs/SFS/domain/05_project/20_DOM-020_ProjectMember.md`
- `212-mi-digitalization/src/utils/projectAuthorization.ts` — doble capa de ADR-020
- `../../prisma/schema.prisma`
- `../../schema.graphql`
