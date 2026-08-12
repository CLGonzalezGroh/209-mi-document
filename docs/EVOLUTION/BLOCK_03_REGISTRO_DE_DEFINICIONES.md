# Bloque 03 — Registro de definiciones

**Estado:** Cerrado. Las definiciones vigentes están en `BLOCK_03_CICLO_INTERNO.md`, decisiones `B1` a `B16`.
**Versión:** 1.0
**Acompaña a:** `BLOCK_03_CICLO_INTERNO.md`

## Objetivo

Conservar **cómo se llegó a cada definición** del bloque: el planteo, las alternativas consideradas y la resolución, punto por punto.

El documento del bloque enuncia las decisiones ordenadas por tema, que es lo que hace falta para implementar. Este registro conserva el razonamiento, que es lo que hace falta para **releer una decisión** cuando aparezca una consecuencia imprevista o alguien proponga cambiarla. Las alternativas descartadas también se conservan, para no volver a plantearlas.

Son 50 cuestiones. Cada una indica la decisión `B` del bloque en la que quedó expresada.

## Línea base confirmada

Verificado sobre el código a la fecha de este documento, después de `BLOCK_02`.

### Modelo

- **`DocumentRevision`** — `@@unique([documentId, revisionCode])`, `status RevisionStatus @default(DRAFT)`, `approvedById`, `approvedAt`. Relación `workflow ReviewWorkflow?` en **singular**, porque `ReviewWorkflow.revisionId` es `@unique`. No hay ningún atributo que distinga un circuito vigente de uno cerrado, porque hoy no puede haber más de uno.
- **`DocumentVersion`** — `@@unique([revisionId, versionNumber])`, `checksum String?` **anulable**, `comment String?`, `createdById`. No registra origen ni naturaleza, y no debe hacerlo: H-35 quedó `DESCARTADO`.
- **`ReviewWorkflow`** — `revisionId Int @unique`, `status WorkflowStatus @default(PENDING)`, `initiatedById`, `initiatedAt`, `completedAt`. **No tiene motivo, actor ni fecha de cancelación.**
- **`ReviewStep`** — `@@unique([workflowId, stepOrder])`, `assignedToId`, `status`, `comments`, `completedAt`, `signatureHash String?`. **No registra quién resolvió efectivamente el paso** ni conserva los insumos del hash.
- **`RevisionScheme`** tiene **dos valores**: `ALPHABETICAL` y `NUMERIC`. **No existe `FREE_TEXT`**, y el nombre `ALPHABETICAL` no coincide con el `ALPHA` que D-13 toma del precedente de digitalización.
- **El esquema vive en el documento**: `Document.revisionScheme @default(ALPHABETICAL)`. `DocProjectSettings`, creado por `BLOCK_02`, **no tiene todavía atributo de esquema**; su comentario en el modelo ya anticipa que es su lugar.
- **`DocumentType.requiresWorkflow`** se persiste en el ABM de tipos y **no se consulta en ninguna validación del ciclo** (H-02, verificado).
- Estados sin asignación: **`RevisionStatus.OBSOLETE` no lo asigna ninguna operación**, y **`WorkflowStatus.PENDING` solo aparece como filtro de lectura** en `pendingReviewSteps`, nunca como valor escrito (H-08, verificado).

### Operaciones del ciclo

Once operaciones, ya con la autorización de `BLOCK_02` aplicada.

| Operación | Permiso exigido hoy | Regla vigente relevante |
| --------- | ------------------- | ----------------------- |
| `createDocument` | `DOCUMENTS_DOCUMENT_CREATE` | Crea documento, primera revisión y primera versión en una transacción. Esquema del input o `ALPHABETICAL`; código inicial del input o `A`/`0`, **sin validar formato** |
| `revisionById` | `DOCUMENTS_DOCUMENT_READ` | Doble capa por el proyecto del documento |
| `createRevision` | `DOCUMENTS_DOCUMENT_CREATE` | Rechaza si existe una revisión en `DRAFT` o `IN_REVIEW`. Acepta `revisionCode` explícito **sin validar** formato ni progresión (H-09); si no viene, lo deriva del último por `createdAt desc` |
| `registerVersion` | `DOCUMENTS_DOCUMENT_CREATE` | **Exige `DRAFT`** y rechaza toda versión con la revisión en `IN_REVIEW` (H-34). Numera `última + 1`. `checksum` opcional |
| `initiateReview` | `DOCUMENTS_WORKFLOW_CREATE` | Exige `DRAFT`, **rechaza si la revisión ya tuvo un workflow**, exige al menos un paso. Crea el workflow en `IN_PROGRESS` y pasa la revisión a `IN_REVIEW` |
| `approveStep` | `DOCUMENTS_WORKFLOW_UPDATE` | Exige paso `PENDING` y todos los anteriores en `APPROVED` o `SKIPPED`. **No verifica que el actor sea el asignado** (H-03). Al completarse: workflow `COMPLETED`, revisión `APPROVED`, y las revisiones `APPROVED` anteriores del documento pasan a `SUPERSEDED` |
| `rejectStep` | `DOCUMENTS_WORKFLOW_UPDATE` | Comentario obligatorio. Posteriores pendientes a `SKIPPED`, workflow `REJECTED`, revisión de vuelta a `DRAFT` |
| `cancelWorkflow` | `DOCUMENTS_WORKFLOW_CREATE` | Admitida mientras el workflow no esté `COMPLETED` ni `REJECTED`, **aun con pasos ya firmados**. Deja el workflow en `REJECTED`; el motivo solo vive en el `meta` del evento de auditoría (H-05) |
| `pendingReviewSteps` | `DOCUMENTS_WORKFLOW_LIST` | Recibe `userId` como argumento y **no lo contrasta con el usuario autenticado** (H-07). Filtrado por membresía desde `BLOCK_02` |
| `workflowsByStatus` | `DOCUMENTS_WORKFLOW_LIST` | Filtrado por membresía |
| `switchRevisionScheme` | `DOCUMENTS_DOCUMENT_UPDATE` | Cambia el esquema del documento; solo rechaza que sea el mismo. Sin precondición sobre revisiones en curso |

**El bloqueo de H-01 está confirmado en el código**: `rejectStep` devuelve la revisión a `DRAFT`; `initiateReview` rechaza abrir un segundo circuito porque `revisionId` es único; y `createRevision` rechaza abrir una revisión nueva mientras exista una en `DRAFT`. Las tres reglas juntas dejan al documento sin salida.

**La firma**, en `generateSignatureHash`, es `SHA-256(stepId + userId + timestamp + action)`. No incorpora la versión ni su `checksum`, y **ninguno de los insumos se persiste**, de modo que el hash no es verificable a posteriori (H-06).

**Los pasos `ACKNOWLEDGE` no solo quedan `PENDING`: quedan además invisibles.** `completesWorkflow` los excluye del cálculo, de modo que el workflow se completa con ellos pendientes; y `pendingReviewSteps` filtra por `workflow.status in [PENDING, IN_PROGRESS]`, de modo que **una vez completado el workflow esos pasos dejan de aparecer en la única consulta que los mostraría**. Nadie recibe el aviso y nadie puede cerrarlos. Es lo que agrava H-04 bajo D-19.

**`Document.currentRevision` se resuelve de dos maneras distintas** en `src/resolvers/resolversTypes/index.ts`. Cuando las revisiones vienen incluidas, prefiere la `APPROVED`, después la que esté en `DRAFT` o `IN_REVIEW`, y si no la primera del arreglo; cuando no vienen, consulta la **última por `createdAt`, sin mirar el estado**. Las dos ramas pueden devolver revisiones distintas para el mismo documento. Es una inconsistencia previa a este bloque, y se vuelve visible con las revisiones abortadas: la segunda rama devolvería como vigente una revisión abandonada.

### Permisos disponibles

`202-mi-common` expone, para este ciclo, únicamente `DOCUMENTS_DOCUMENT_{READ,LIST,SELECT,CREATE,UPDATE,DELETE}` y `DOCUMENTS_WORKFLOW_{CREATE,UPDATE,LIST}`. **No existe recurso de revisión ni de versión**, lo que explica que `createRevision` y `registerVersion` exijan permiso de documento (H-22). El precedente de una acción administrativa diferenciada existe y es `DOCUMENTS_SCANNED_FILE_ADMIN_UPDATE`.

### Trazabilidad

- El catálogo de `BLOCK_01`, extendido por `BLOCK_02`, tiene **28 acciones de auditoría y 21 transiciones**, sobre **10 tipos de objeto**.
- `src/utils/objectContext.ts` deriva `projectId` y `module` por tipo de objeto. **Todo objeto nuevo que este bloque incorpore debe sumar su tipo y su derivador**, o queda sin contexto y sin alcance.
- Las transiciones del ciclo ya existentes son `RevisionCreated`, `RevisionSubmitted`, `RevisionApproved`, `RevisionSuperseded`, `RevisionReturned`, `WorkflowStarted`, `WorkflowCompleted`, `WorkflowRejected`, `StepApproved`, `StepRejected` y `StepSkipped`.

### Pruebas

- **43 pruebas puras verificadas hoy**, sin base: catálogo de eventos 8, emisión 7, circuito de revisión 7, alcance por proyecto 11, configuración de proyecto 6, contexto del documento 4.
- Con las suites contra base y el arnés de integración, el total del módulo es de **72 pruebas** según la evidencia de `BLOCK_02`.
- `src/utils/reviewWorkflow.ts` aísla la lógica del circuito —`completesWorkflow`, `stepsSkippedByRejection`, `stepsSkippedByCancellation`— y su comentario declara explícitamente que reproduce el comportamiento vigente sin corregirlo, **y que la corrección corresponde a este bloque**. Es el punto natural de intervención.
- El arnés de `BLOCK_02` (`authorization.integration.test.ts`) ya ejercita resolvers con token firmado y `mi-admin` corriendo. Este bloque puede apoyarse en él en lugar de construir uno nuevo.

### Consumidores

- **Ninguna pantalla consume el ciclo.** Verificado: `projects/documents/[projectId]/documents/` y `.../transmittals/` siguen siendo directorios vacíos, y ningún archivo de la webapp menciona `createRevision`, `registerVersion`, `initiateReview`, `approveStep`, `rejectStep` ni `cancelWorkflow`.
- Ningún otro subgraph invoca estas operaciones.
- **Consecuencia**: los cambios incompatibles de contrato de este bloque no rompen a nadie, igual que en `BLOCK_02`. `rover subgraph check` los marcará por clasificación y no por uso.

### Producción del `checksum`

Dato relevante para D-05: **hoy nadie calcula el `checksum`.** `FILESERVER_API_DOCUMENTATION.md` no lo menciona y `208-mi-fileserver` no lo produce.

El precedente existe del lado del cliente: en digitalización, `EvidenceUpload.tsx` calcula `SHA-256` en el navegador con `crypto.subtle.digest` **antes** de pedir la URL presignada, y lo envía junto con la metadata. El mismo patrón es portable a la carga documental, y aterriza en `BLOCK_05`.

### Precedentes portables

- `212-mi-digitalization/src/utils/revisionScheme.ts` — esquemas `FREE_TEXT | ALPHA | NUMERIC`, con `buildRevisionValues` e `isValidRevision`. **Genera una lista de valores admitidos** de tamaño configurable (`revisionListSize`, tope 200) y valida contra ella.
- `CatalogSettings` (ADR-026) — configuración global del despliegue como **registro único**, `id Int @id @default(1)`, con `revisionScheme`, `revisionListSize`, `revisionRequired` y `revisionLabel`.

**La diferencia con este módulo es la que D-13 ya anticipa y conviene tener presente al portar**: allá la revisión es una etiqueta que se valida contra una lista; acá es una entidad cuyo código el sistema debe **calcular**. Se porta el criterio de los tres esquemas y la generación por código, no necesariamente la lista ni su tamaño.

## Cuestiones a resolver

Cada punto registra la situación, las opciones consideradas y su resolución.

**Estado: cerrado.** Las 50 cuestiones están resueltas, salvo Q49 —la validación del `checksum` por el almacenamiento—, **diferida de forma deliberada** a un trabajo propio sobre `mi-fileserver` que no condiciona a este bloque.

Correspondencia con las decisiones del bloque:

| Cuestiones | Decisión |
| ---------- | -------- |
| Q8, Q9, Q10, Q41 | `B1` — el circuito abarca el ciclo completo |
| Q1, Q2, Q3 | `B2` — un solo circuito abierto por revisión |
| Q42, Q43, Q44 | `B3` — plantilla del circuito y designación del armador |
| Q47, Q6, Q13 | `B4` — la versión es un archivo, e inmutable |
| Q5, Q7 | `B5` — quién registra versiones, y cuándo |
| Q48 | `B6` — la metadata se congela con la revisión aprobada |
| Q11, Q12, Q14, Q40, Q50 | `B7` — la firma es un objeto propio con su payload |
| Q45 | `B8` — pasos que deciden y pasos que se cumplen |
| Q15, Q16, Q17, Q18, Q37, Q38 | `B9` — delegación, reasignación y un permiso único |
| Q19, Q20 | `B10` — la toma de conocimiento cierra después de aprobar |
| Q28, Q29, Q30, Q31, Q34, Q39 | `B11` — cancelar el circuito y abortar la revisión |
| Q4, Q32, Q33 | `B12` — la revisión abortada no consume código |
| Q21 a Q27 | `B13` — el esquema de revisión se propone y no se persiste |
| Q36 | `B14` — revisión vigente y revisión en curso |
| Q46 | `B15` — unicidad de los catálogos |
| Q35 | `B16` — el ciclo no se ramifica por rol |
| Q49 | Diferida, fuera del bloque |

### Estructura del circuito (D-10, D-11)

**Q1 — Cómo se distingue el circuito vigente de los cerrados.**
Al caer la unicidad de `ReviewWorkflow.revisionId`, una revisión pasa a tener varios workflows y hace falta saber cuál rige. Opciones: derivarlo del estado y la cronología; un `DocumentRevision.currentWorkflowId`; o un número de intento en el workflow.
**Resuelto:** el circuito vigente se **deriva**, y la regla se sostiene con un **índice único parcial** que admite a lo sumo un workflow sin resolver por revisión. Es exactamente lo que D-11 pide, reemplaza una unicidad por otra más precisa en lugar de eliminarla, y reutiliza el mecanismo de índices parciales en SQL que B2 de `BLOCK_02` ya incorporó. Se descarta `DocumentRevision.currentWorkflowId`, que sería un dato derivado con riesgo de desincronizarse.

El estado alcanzado por el índice depende de Q3: al retirarse `WorkflowStatus.PENDING`, el circuito abierto es el que está `IN_PROGRESS`, de modo que el índice queda `UNIQUE (revision_id) WHERE status = 'IN_PROGRESS'`. Prisma no expresa índices parciales: va como SQL en la migración y se documenta como comentario en el modelo, igual que en B2.

Bajo Q8 el índice describe además el estado normal y no solo un tope: toda revisión viva tiene **exactamente un** circuito abierto, desde que nace hasta que se aprueba o se abandona.

**Q2 — Qué expone el contrato en lugar de `DocumentRevision.workflow`.**
Hoy es un campo singular opcional. Opciones: reemplazarlo por `workflows: [ReviewWorkflow!]!` más `currentWorkflow`; o conservar `workflow` como alias del vigente.
**Resuelto:** se reemplaza por `workflows: [ReviewWorkflow!]!` más `currentWorkflow: ReviewWorkflow`, y **el campo singular se retira**. Conservarlo como alias del vigente perpetuaría la lectura de que hay uno solo, que es justamente lo que D-11 cambia. Sin consumidores, el retiro no rompe nada, y `rover subgraph check` lo marcará por clasificación del cambio como ocurrió con B3 de `BLOCK_02`.

**Q3 — Estados inalcanzables (H-08).**
`WorkflowStatus.PENDING` nunca se asigna y `RevisionStatus.OBSOLETE` tampoco.
**Resuelto:** se **retira `WorkflowStatus.PENDING`** —el circuito nace iniciado y no hay caso que lo justifique— y se **conserva `RevisionStatus.OBSOLETE` sin uso**, declarado como tal, hasta que `BLOCK_04` defina los estados terminales por respuesta de la contraparte. Retirarlo ahora para reponerlo después costaría dos migraciones de enumeración.

Consecuencias a ejecutar: el filtro de `pendingReviewSteps` deja de nombrar `PENDING`; el `@default(PENDING)` de `ReviewWorkflow.status` se reemplaza por `IN_PROGRESS`; y el valor sale de la enumeración en el modelo y en el contrato, donde `WorkflowStatusInput` lo admite hoy como argumento de `workflowsByStatus`.

**Q4 — Orden de las revisiones (H-10).**
Con `switchRevisionScheme` la secuencia de códigos puede quedar `A, B, C, 0, 1`.
**Resuelto:** **las revisiones se ordenan por secuencia de creación y nunca por código.** Es regla del bloque, no observación: cada `orderBy` del módulo debe respetarla, y la derivación del código sucesor debe tomar la última revisión por creación y no por orden alfabético o numérico —que es lo que `createRevision` ya hace, y ahora queda como invariante en lugar de coincidencia—.

Alcanza también a la lectura: un listado de revisiones ordenado por `revisionCode` sería incorrecto bajo una secuencia `A, B, C, 0, 1`, de modo que `BLOCK_05` hereda la misma restricción.

**Q36 — Qué expone el documento como revisión vigente y como revisión en curso.** *(Incorporada después de Q35, al revisarse la divergencia de `currentRevision` que registra la línea base.)*
**Resuelto: son dos lecturas distintas y el contrato expone las dos.**

| Campo | Qué devuelve |
| ----- | ------------ |
| `currentRevision` | **La última aprobada, y solo la aprobada.** Nulo mientras el documento no haya aprobado ninguna |
| `lastRevision` | **La última no abortada por secuencia de creación**, cualquiera sea su estado. Coincide con `currentRevision` cuando no hay ninguna en curso |

Con la revisión `A` aprobada y la `B` en circuito, `currentRevision` es `A` y `lastRevision` es `B`. **Ninguna de las dos considera las revisiones abortadas.**

**La mayoría de los consumidores quiere la vigente**; solo quien está dentro del proceso de revisión necesita ver el par completo. Separarlas evita que la lectura corriente devuelva un borrador como si fuera el documento del proyecto, que es lo que hoy hace la rama de revisiones incluidas al caer en `DRAFT` o `IN_REVIEW` cuando no hay aprobada.

**Se exponen y no se derivan en cada consumidor.** Ambas son derivables, y precisamente por eso las dos ramas divergentes de `currentRevision` llegaron a devolver revisiones distintas para el mismo documento. Resolverlas en un solo lugar es la corrección.

Dos apoyos que la sostienen:

- **A lo sumo hay una revisión en `APPROVED` por documento**, porque aprobar una supersede a las anteriores. "La última aprobada" y "la única aprobada" son la misma revisión, de modo que la definición no depende del orden.
- **`lastRevision` es la misma revisión de la que Q32 deriva el código sucesor.** Una sola regla —la última no abortada por creación (Q4)— con dos usos, en lugar de dos criterios que puedan separarse.

Es además la simetría de Q2 un nivel más abajo: vigente e historia, con `currentWorkflow` junto a `workflows`.

**Frontera con `BLOCK_04`**: cuando la respuesta de la contraparte cierre la revisión emitida, habrá que revisar si la vigente sigue siendo la que está en `APPROVED` o la que quede en el estado terminal que aquel bloque defina. Se declara acá para que no se resuelva de forma implícita al implementarlo.

### Qué es una versión, y qué no (D-10)

**Q47 — Una versión es un archivo.** *(Incorporada al abrir el bloque, antes de resolver Q5.)*
**Resuelto: la versión existe únicamente con archivo nuevo.** Un cambio de metadata no la produce: es una actualización del documento, registrada como acción de auditoría.

| Nivel | Qué incluye | Qué produce al cambiar |
| ----- | ----------- | ---------------------- |
| **Documento** | Código, título, descripción, clase, tipo, ubicación | Actualización auditada. Vale para todas sus revisiones |
| **Revisión** | Código de revisión, estado | Transición de la revisión |
| **Versión** | `fileKey`, `fileName`, `fileSize`, `mimeType`, `checksum` | **Solo existe con archivo nuevo** |

Lo que la versión guarda **no es metadata del documento sino descripción del archivo**: nombre, tamaño, tipo y hash no pueden cambiar sin que cambie el archivo. La única excepción es `comment`, que es anotación sobre el cambio.

Es lo que le da sentido a D-05: la firma acredita una versión **porque una versión es un archivo**. Si pudiera existir una versión sin cambio de contenido, la firma dejaría de acreditar contenido.

**La versión es inmutable.** No se modifica ni se elimina, y eso incluye su comentario: si quedó mal, la corrección va en la traza y no editando la evidencia. Es el comportamiento vigente —`registerVersion` es la única operación sobre versiones— y pasa de ser una omisión a ser una regla, con el mismo criterio de los eventos de `BLOCK_01` y del "la historia avanza, no retrocede" de D-17.

**Q48 — La metadata del documento se congela con la revisión aprobada.**
**Resuelto: toda la metadata, y se corrige abriendo una revisión nueva.**

El motivo no es formal sino material: **parte de la metadata está impresa dentro del archivo.** El rótulo de un plano lleva el código, el título y la revisión, y a menudo también la clase y el tipo —de hecho el código del documento habitualmente **se compone** de clase y tipo—. Cambiarla en el sistema después de aprobada una revisión no invalida la firma, que acredita bytes que no cambiaron: produce algo peor, una divergencia silenciosa entre lo que el sistema afirma y lo que el entregable dice.

De ahí que la clasificación no sea descripción sino **identidad**, y que el corte no pase entre "metadata del sistema" y "metadata del archivo": pasa entre **documento en revisión** y **documento aprobado**.

- **Mientras la revisión vigente no esté aprobada**, la metadata se edita libremente.
- **Aprobada la revisión, se congela.** Corregirla exige abrir una revisión nueva, que es lo que el control documental hace igual, porque un rótulo distinto es un documento distinto.
- **Abrir la revisión siguiente la vuelve a habilitar**, y el archivo que se elabore llevará el rótulo nuevo.

**Consecuencia sobre D-05, que conviene aprovechar**: la metadata vigente al momento de firmar se incorpora al payload firmado (Q12). Con eso la firma pasa a acreditar **la identificación además del contenido**, que es lo que D-05 buscaba al preguntar "qué se aprobó", y el snapshot por revisión queda resuelto sin estructura nueva.

**Tres bordes declarados:**

- **El esquema de revisión queda fuera del congelamiento.** Es configuración de cómo se numeran las revisiones siguientes, no identificación de esta: `switchRevisionScheme` no altera ningún código ya asignado (Q24).
- **Colisión a resolver en `BLOCK_02B`**: D-14 admite corregir un nodo de ubicación y **propagarlo de forma explícita y auditada a documentos ya emitidos**. Es una excepción controlada a este congelamiento, y las dos reglas deben conciliarse cuando ese bloque se ejecute, no antes.
- **Abandonar una revisión no revierte la metadata** que se cambió mientras estaba abierta. El documento queda declarando algo que ninguna revisión aprobada reproduce, hasta que se emita la siguiente. Retroceder sería peor: la historia no vuelve atrás.

### Versiones durante el circuito (D-10, H-34)

**Q5 — Quién puede registrar una versión.**
**Resuelto: quien tiene asignado el paso vigente**, más quien cuente con el permiso superior de Q16. Es la respuesta natural, porque cada versión es el producto del paso que se está ejecutando: la elabora el elaborador, la marca el revisor, la marca el aprobador.

- **La versión se registra siempre contra un paso vigente.** No es una restricción de identidad sino de momento: quien trabaja es quien produce el archivo.
- **El permiso superior habilita hacerlo por otro**, con el mismo criterio de D-04 y sin crear un tercer permiso: es el mismo que gobierna la firma delegada y la reasignación.
- **Una revisión aprobada no admite versiones nuevas**, porque no tiene paso vigente. Es la consecuencia que protege a D-05: agregar un archivo después de aprobada dejaría la firma acreditando una versión que ya no es la última.
- **Al crear el documento o la revisión, quien crea puede adjuntar el archivo inicial.** Q41 lo vuelve opcional, no prohibido: el caso de un proyecto que parte de un documento preexistente empieza justamente así.

**Comentar no genera versión; marcar el archivo sí.** El comentario del revisor vive en el paso, que ya lo tiene. La versión aparece cuando el revisor **interviene sobre el archivo**, que es la distinción de Q47: una versión es un archivo.

**Los dos recorridos que el bloque debe sostener**, y que son sus dos escenarios de prueba de punta a punta:

| | Documento nuevo | Documento preexistente |
| - | --------------- | ---------------------- |
| **v1** | La registra el **elaborador** en su paso | La adjunta **quien da de alta el documento**, con el archivo que ya existe |
| **v2** | El **revisor** marca el archivo | El **elaborador** incorpora el cambio que el proyecto introduce |
| **v3…** | El **aprobador** aprueba como está, o marca y rechaza | El **revisor** marca, si tiene observaciones |
| **Cierre** | Aprobación sobre la última versión | Aprobación sobre la última versión |

**La vigente es la última, y coincide con la aprobada.** No son dos reglas: como el circuito cierra aprobando y después no se admiten versiones, la última versión de una revisión aprobada **es** la que se aprobó. D-10 no necesita corregirse.

Lo único que rompería esa coincidencia es que un paso se apruebe **después** de marcar el archivo, en cuyo caso el entregable quedaría con marcas. **El sistema no lo impide**, conforme a D-10: las versiones no se clasifican por origen ni naturaleza, y la disciplina del ciclo es la que resuelve que lo que se aprueba sea una versión limpia.

**Q6 — Si la versión registrada durante el circuito exige comentario.**
**Resuelto: opcional.** La observación casi siempre viaja **dentro del archivo**, como marcas sobre el documento, y no en un campo de texto. El comentario es un complemento, no el registro de la objeción.

Es coherente con D-10, que descarta clasificar el origen y la naturaleza de la versión, y con H-35, que quedó `DESCARTADO`: exigir un comentario sería reintroducir esa clasificación por la puerta de atrás.

**Q7 — Qué pasa con el estado de la revisión al registrar una versión durante el circuito.**
**Resuelto: permanece `IN_REVIEW`.** Solo el rechazo la devuelve a `DRAFT`. Registrar una versión no es una transición de la revisión.

### El circuito empieza antes de la revisión (D-03)

**Q8 — Cuándo nace el circuito y qué pasos lo abren.**
**Resuelto: el circuito se instancia con la revisión y abarca el ciclo completo, no solo la aprobación.** Deja de crearse con `initiateReview` y deja de empezar cuando el documento ya está hecho.

| Paso | `StepType` | Quién | Qué significa completarlo |
| ---- | ---------- | ----- | ------------------------- |
| **Armado** | `ASSIGN` | Quien se designa al crear el documento | Quedan designados el elaborador y los revisores, y con ellos los pasos siguientes |
| **Elaboración** | `PREPARE` | El elaborador designado | El documento está hecho y **se somete a revisión** |
| **Revisión / aprobación / toma de conocimiento** | `REVIEW`, `APPROVE`, `ACKNOWLEDGE` | Los revisores designados | Lo que ya hacen hoy |

**Los nombres los aporta el dominio.** El rótulo de un plano de ingeniería declara *Prepared by / Reviewed by / Approved by*: `PREPARE` es el término establecido para **elaborar el documento**, y encaja con `REVIEW` y `APPROVE`, que ya existen y son las otras dos casillas del mismo rótulo. Esa es la razón por la que no puede nombrar al armado, que es un acto sobre el circuito y no sobre el documento; ahí `ASSIGN` dice exactamente lo que se hace: designar quién elabora y quiénes revisan.

La secuencia resultante se lee sola: `ASSIGN` ▸ `PREPARE` ▸ `REVIEW` ▸ `APPROVE` ▸ `ACKNOWLEDGE`.

**El circuito, y no la operación, es lo que expresa el ciclo.** Someter deja de ser "crear el workflow" y pasa a ser "completar el paso de elaboración", que es lo que efectivamente ocurre. La consecuencia es que `initiateReview` desaparece como operación y se reparte en dos: **definir el circuito** —completa el armado y crea los pasos siguientes— y **someter** —completa la elaboración—.

**Cómo se reinstancia.** Es donde la estructura se vuelve económica:

- **Rechazo** → circuito nuevo **desde `PREPARE`, con el mismo elenco**. El trabajo vuelve al elaborador sin rearmar nada, que es el caso frecuente.
- **Revisión nueva** → circuito nuevo **desde `ASSIGN`**. Entre una revisión y la siguiente el elenco puede cambiar, y ahí sí corresponde volver a designarlo.

**El elenco se copia, no se referencia.** El circuito nuevo por rechazo duplica los actores del anterior en sus propios pasos. Referenciarlos ataría dos circuitos que deben poder leerse por separado —y reasignar un paso del nuevo alteraría la historia del viejo—. Es el mismo criterio con que la plantilla se copia al materializarse (Q42).

Ambos son circuitos sucesivos sobre la revisión en el primer caso y sobre la revisión nueva en el segundo, de modo que D-11 no cambia: lo que se acumula es la historia.

**Alcance de D-03 bajo esta forma.** "Toda revisión se aprueba por workflow" se refuerza: **toda revisión tiene circuito desde que nace**, y no solo desde que se somete. El workflow mínimo de D-03 deja de ser un objeto aparte y pasa a ser un **resultado del armado**: un circuito cuya designación se limita a un único paso de aprobación. No hace falta una regla propia para él.

**Q9 — Qué estado tiene la revisión mientras el circuito está en armado o en elaboración.**
**Resuelto: `DRAFT`**, y `IN_REVIEW` recién cuando se completa la elaboración. `DRAFT` pasa a significar "en elaboración por X" en lugar de "sin circuito", que es lo que hoy significa por omisión. El estado de la revisión sigue siendo el que gobierna las precondiciones —registrar versiones, abortar— y no hace falta ningún estado nuevo: el detalle de dónde está el trabajo lo da el paso vigente del circuito.

Es lo que evita duplicar información: si la revisión tuviera un estado por cada paso, habría dos máquinas de estados describiendo lo mismo.

**Q10 — Qué significa `DocumentType.requiresWorkflow`.**
Bajo D-03 deja de indicar si hay circuito —siempre lo hay— y pasa a distinguir el formal del mínimo.
**Resuelto: se renombra a `requiresFormalReview`** y es **sugerencia y no invariante**: propone el armado y no lo impone. Es el mismo criterio con que D-18 trata la matriz de responsabilidad, que propone revisores sin quitar el control sobre el resultado.

**Q41 — El documento debe poder crearse sin archivo (H-20).** *(Arrastrada por Q8.)*
**Resuelto por consecuencia: es forzoso.** El paso de elaboración existe justamente para producir el archivo, de modo que exigirlo al crear el documento haría que el elaborador reciba una tarea ya cumplida.

Hoy `createDocument` exige `fileKey`, `fileName`, `fileSize` y `mimeType`, y crea documento, revisión y **primera versión** en una sola operación; `createRevision` hace lo mismo con la revisión. Bajo Q8 eso deja de ser posible: la revisión nace sin versiones, y la primera aparece cuando el elaborador trabaja.

- La versión deja de ser obligatoria al crear el documento o la revisión. **Deja de ser obligatoria, no admisible**: el proyecto que parte de un documento preexistente adjunta el archivo en el alta, y ese es el primer recorrido de Q5.
- **Someter exige al menos una versión**, con su `checksum` (Q13). Es la precondición que reemplaza a la del alta.
- `DocumentVersion` no cambia; lo que cambia es cuándo se crea.

**H-20 entra al alcance de este bloque**, aunque el plan no se lo hubiera asignado: no es una mejora independiente sino una condición del ciclo que Q8 define.

**Q45 — Cómo se cierra un paso que no juzga nada.** *(Abierta por Q8.)*
`StepStatus` tiene hoy `PENDING`, `APPROVED`, `REJECTED` y `SKIPPED`, un vocabulario de **decisión**. Los pasos `ASSIGN` y `PREPARE` no aprueban ni rechazan: se cumplen. Dejarlos en `APPROVED` diría que alguien aprobó el armado, que no es lo que ocurrió.
**Resuelto: se incorpora `COMPLETED`** a `StepStatus`, como estado terminal de **cumplimiento** para los pasos que no emiten juicio: `ASSIGN`, `PREPARE` y `ACKNOWLEDGE`.

Unifica con Q19, que necesitaba exactamente lo mismo para cerrar la toma de conocimiento: **es un solo estado nuevo y no tres soluciones distintas.** De paso deja explícita la partición del circuito entre pasos que deciden —`REVIEW` y `APPROVE`, los únicos que pueden rechazar y los únicos que cuentan para completar el circuito— y pasos que se cumplen.

### Plantilla del circuito y designación del armador (D-03)

**Q42 — La plantilla del circuito se modela en este bloque.** *(Incorporada al abrir el bloque.)*
**Resuelto: se modela ahora, mínima y con el alcance ya previsto.**

Sin plantilla, el armador tendría que declarar el circuito paso por paso en cada documento, que es exactamente el trabajo que el control documental no puede asumir. Con ella, el alta propone un circuito y el armado lo confirma.

Forma adoptada:

- **una plantilla con sus pasos**: orden, tipo y **actor preasignado opcional**;
- **alcance por proyecto, con refinamiento por clase y por tipo de documento**: las columnas de clase y tipo existen desde ahora y admiten nulo. **La más específica gana** —tipo, después clase, después proyecto—, de modo que la plantilla del proyecto con ambas nulas **es** su default y no hace falta una marca aparte;
- **la plantilla no incluye el armado ni la elaboración.** Esos dos pasos los pone el sistema, porque son estructurales: una plantilla que pudiera omitirlos permitiría circuitos sin elaborador. **Los pone según el rol del proyecto**: en el rol Receptor no hay paso de elaboración, porque el documento llega ya elaborado desde afuera (Q35). Es lo único que este bloque deja preparado para `BLOCK_04`.

**El elaborador nunca se preasigna.** Designarlo *es* distribuir la carga de trabajo, y se decide documento por documento. Por eso el paso de armado tiene contenido incluso con la plantilla más completa, y por eso siempre existe.

**La plantilla se copia, no se referencia.** Al materializarse los pasos se copian sus valores; cambiar la plantilla después no altera ningún circuito en curso. Es el mismo criterio del snapshot de ubicación de D-14 y del payload firmado de Q12.

**Unicidad del alcance — cuidado con H-19.** La tupla `[projectId, documentClassId, documentTypeId]` tiene dos columnas anulables, que es la forma exacta del defecto que B2 de `BLOCK_02` corrigió: con nulos, la restricción no impide duplicados.
**Resuelto: `NULLS NOT DISTINCT`**, disponible desde PostgreSQL 15. Acá **sí** corresponde, a diferencia de B2: allá la alternativa se descartó porque una sola tupla expresaba dos reglas distintas —por proyecto y por módulo—; acá es una única regla con refinamientos opcionales, que es el caso para el que existe.

**La versión está verificada en los tres ambientes**: producción y el servidor de testing corren PostgreSQL 16, y el entorno local 17. No hace falta la alternativa con índices parciales por combinación de nulos.

**Q43 — El armador se designa al crear el documento, y es obligatorio.**
**Resuelto.** Es el único actor que debe conocerse al alta: todo lo demás lo trae la plantilla o lo decide el armado.

- **Obligatorio**, con **default configurable en `DocProjectSettings`** —habitualmente el PM—, de modo que en la práctica el campo llega lleno. La alternativa, admitir documentos sin armador, obligaría a una bandeja de huérfanos y a un estado más.
- **Puede serlo cualquiera con permiso y membresía vigente.** No se crea una lista de armadores habilitados: sería un tercer padrón, y D-15 ya descartó multiplicarlos.
- **El paso de armado se reasigna como cualquier otro** (Q37). Es lo que cubre el caso corriente: el alta se lo asigna al PM, y el PM lo deriva al jefe de especialidad que corresponda. No hace falta ningún concepto adicional para eso.

**Q44 — Qué existe entre el alta y el armado.**
**Resuelto: existe el circuito, con su paso de armado pendiente y la plantilla propuesta referenciada.** Los pasos siguientes **se materializan recién al completarse el armado**.

- **No hay documento sin circuito: hay circuito en armado.** Lo que en la práctica se describe como "se da de alta ahora y se le asigna el workflow después" es este estado, y no una excepción a D-03.
- **Los pasos no se crean antes** porque quedarían sin asignado, y `ReviewStep.assignedToId` no admite nulo. Materializarlos en un solo momento evita además un circuito a medio definir.
- **La plantilla propuesta se resuelve por alcance al dar de alta** y puede cambiarse: por quien crea el documento y por el armador. Es el criterio de D-18 sobre la matriz de responsabilidad —propone, no impone— aplicado al armado.

**Con esto el workflow mínimo termina de disolverse**: es una plantilla con un único paso de aprobación, no un objeto ni una regla.

### Reasignación de pasos (D-04)

**Q37 — Reasignar un paso a otra persona.** *(Incorporada al abrir el bloque.)*
**Resuelto: se incorpora la reasignación**, tanto de los pasos pendientes como del paso vigente.

Cubre dos casos que hoy no tienen salida: el revisor que no está, y la redistribución de carga de trabajo —pasarle a otra persona la elaboración de un documento ya asignado—. Es un acto de conducción, no de revisión.

- **Alcance**: pasos **pendientes**, incluido el vigente. **Un paso ya resuelto no se reasigna**: su firma acredita quién lo resolvió, y reasignarlo dejaría la firma sin correspondencia.
- **No altera el circuito**: no cambia el tipo del paso, ni su orden, ni cuántos son. Cambia el actor.
- **Traza**: es acción de auditoría y **no** transición de estado, porque el paso sigue `PENDING`. Se registra de quién a quién y con qué motivo, y el historial de asignados queda en la traza sin necesidad de una columna nueva.
- **Permiso**: el administrativo de Q16, si se confirma. Reasignar el trabajo de otro no es lo mismo que hacer el propio.

**Q38 — La estructura del circuito es inmutable una vez definida.**
**Resuelto: no se agregan, quitan ni reordenan pasos.** El circuito se conserva como fue armado y lo único editable son sus actores (Q37).

La excepción aparente no lo es: el paso de armado **crea** los pasos siguientes, y ese es su acto propio. La inmutabilidad rige desde que el armado se completa.

**Esto es lo que le deja a la cancelación un uso claro**, y se trata en Q39.

**Q39 — Qué queda para cancelar el circuito, con reasignación disponible.**
**Resuelto: la cancelación sobrevive, con un alcance más preciso.** La reasignación cubre **quién**; la cancelación cubre **cómo está armado** y **qué se sometió**. Son dimensiones distintas y ninguna suple a la otra.

Casos que subsisten, y que la reasignación no alcanza:

1. **El circuito quedó mal armado.** Falta el jefe de especialidad, sobra un paso, el orden es incorrecto, o se designó un circuito mínimo donde correspondía el formal. Como Q38 fija que los pasos no se editan, **la única salida es cancelar y rearmar**. Sin cancelación, un paso olvidado obligaría a abandonar la revisión entera.
2. **Se sometió lo que no correspondía.** El elaborador completó su paso con el archivo equivocado o incompleto. Retirar la revisión del circuito la devuelve a elaboración sin que nadie haya emitido un juicio negativo.

La distinción con el rechazo queda además nítida bajo Q8, porque los tres caminos reinstancian el circuito en lugares distintos:

| Salida | Circuito nuevo | Elenco |
| ------ | -------------- | ------ |
| **Rechazo** | Desde la elaboración | El mismo |
| **Cancelación del circuito** | Desde el armado | Redefinible |
| **Abandono de la revisión** | Ninguno | — |

Cancelar es, entonces, **volver al armado**: la operación que corrige lo que la reasignación no puede tocar.

**Q40 — Qué pasa con las firmas ya reunidas cuando aparece una versión nueva.**
Q5 admite registrar versiones durante el circuito, y D-05 hace que cada firma acredite la versión vigente al firmar. Queda por definir qué ocurre con las aprobaciones ya dadas cuando el archivo cambia después.
**Resuelto: se conservan, y cada firma acredita la versión sobre la que actuó su autor.** El elaborador firma lo que entrega; el revisor firma sobre la versión comentada que él mismo produjo; y así sucesivamente. No hay contradicción entre firmas: **ninguna afirma nada sobre las versiones posteriores**, solo sobre la suya.

Es lo que D-10 describe como ciclo normal —el revisor marca el plano y genera una versión— y el modelo ya lo registra, porque la versión forma parte del payload firmado (Q12). Invalidar automáticamente las aprobaciones previas borraría trabajo real y sorprendería al usuario.

Lo que corresponde cuando el cambio es sustantivo no es invalidar: es **retirar la revisión del circuito** y volver a someterla, que es el segundo caso de Q39. La regla queda del lado del operador, que es quien sabe si lo que cambió invalida lo revisado.

Q5 acota además el alcance de este problema: como la versión la produce quien tiene el paso vigente, el caso frecuente no es un archivo que aparece por sorpresa sino **la marca del propio revisor**, que acompaña su rechazo y devuelve el trabajo. Las aprobaciones anteriores a ese rechazo pertenecen a un circuito que se cierra, y el circuito siguiente vuelve a recorrerse completo.

**Q50 — Qué pasos producen firma.** *(Abierta al resolver Q40.)*
**Resuelto: firman los pasos que actúan sobre una versión** —elaboración, revisión, aprobación y toma de conocimiento—. El armado **no firma**.

El criterio sale de la propia definición de D-05: la firma acredita **qué** se aprobó, y ese "qué" es una versión. Al completarse el armado puede no existir todavía ninguna versión —el documento nace sin archivo (Q41)—, de modo que una firma ahí no tendría objeto que acreditar. Su evidencia es el evento de auditoría, que registra quién designó a quién.

Los cuatro que sí firman son exactamente los del rótulo del plano más el acuse: **quien elabora firma lo que entrega, quien revisa firma lo que revisó, quien aprueba firma lo que aprobó, y quien toma conocimiento firma lo que vio.** Firmar deja de ser privativo de los pasos que deciden: es la contracara de Q45, donde cumplir un paso y juzgarlo son cosas distintas pero **ambas se acreditan**.

### Firma (D-05, H-06, H-27)

**Q11 — Dónde viven los datos firmados.**
**Resuelto: objeto propio, `DocStepSignature`**, uno por firma, referenciado por el paso. La firma es evidencia inmutable y el paso es un objeto que se sigue actualizando; separarlos permite declararla inmutable sin excepciones, la hace trazable con su propio tipo en `DocObjectType`, y evita ensanchar `ReviewStep` con una decena de columnas de las que la mitad son copia de otra entidad.

Obliga a sumar el tipo de objeto y su derivador de contexto en `objectContext.ts`, y a extender el catálogo de `BLOCK_01`, cuya prueba fija el número de acciones.

**Q12 — Qué se persiste, además del hash.**
**Resuelto: el payload canónico serializado** que se usó para calcular el hash, más el algoritmo. Un hash sin sus insumos no es verificable, que es exactamente el defecto de H-06; guardar el payload permite recalcular y comparar sin reconstruirlo desde entidades que pudieron cambiar.

Contenido del payload:

- el **paso**, su **workflow** y su **revisión**;
- la **versión vigente al firmar**, con su número, `fileKey` y `checksum`;
- la **metadata del documento** vigente al firmar —código, título, clase y tipo—, conforme a Q48: la firma acredita la identificación además del contenido;
- el usuario **asignado** y el usuario que **resolvió** (Q15), y el motivo cuando difieren (Q17);
- la **acción** —aprobación o rechazo (Q14)— y el momento.

**Q13 — Cuándo se exige el `checksum` (H-27).**
**Resuelto: obligatorio en toda versión.** No hay datos productivos, de modo que la migración es directa, y cualquier regla condicional obligaría a decidir qué pasa con la versión que entró sin checksum y después resulta ser la firmada.

**Depende de un productor que hoy no existe.** `mi-fileserver` no lo calcula ni lo devuelve. El precedente portable es el de digitalización, donde el navegador computa `SHA-256` con `crypto.subtle` antes de pedir la URL presignada. Mientras `BLOCK_05` no exista, quien invoque la API debe enviarlo; **es la única regla del bloque cuyo cumplimiento depende de un componente que este bloque no construye**, y conviene no perderlo de vista. Quién debe calcularlo y quién validarlo se trata en Q49.

**Q49 — Quién calcula el `checksum` y quién lo valida.** *(Abierta al confirmar Q13.)*

**`mi-fileserver` no puede calcularlo sin dejar de ser lo que es.** Su arquitectura, declarada en su propio `CLAUDE.md`, consiste en **no ver los bytes**: firma URLs y el cliente sube directo al almacenamiento. `generatePresignedUploadUrl` solo arma un `PutObjectCommand` con clave y tipo de contenido. Para calcular el hash tendría que recibir el archivo —convirtiéndose en proxy de todo el tráfico— o volver a descargarlo del almacenamiento después de la carga, lo que cuesta una lectura completa por archivo y deja el registro sin `checksum` durante un lapso, en contra de la obligatoriedad de Q13.

**El único lugar que tiene los bytes sin volver a leerlos es el cliente**, antes de subirlos. No es un atajo: es el único punto del recorrido donde el contenido ya está en memoria.

**Pero un checksum que solo calcula quien sube es una afirmación, no un hecho.** Nadie contrasta que el archivo almacenado sea el que corresponde a ese hash, y D-05 pide justamente lo contrario: que la firma acredite el contenido.

**Recomendación: que el cliente lo calcule y que el almacenamiento lo valide**, incorporándolo a los encabezados que la URL presignada firma. El objeto se rechaza en el momento de la escritura si los bytes no coinciden, sin lecturas adicionales y sin que `mi-fileserver` toque el contenido: **no lo calcula, lo obliga.** Con eso el hash deja de ser una declaración del cliente y pasa a estar verificado por quien guarda el archivo.

**Condición a verificar antes de adoptarlo**: que DigitalOcean Spaces admita el encabezado de checksum de S3 en una carga presignada. Es una capacidad relativamente nueva del protocolo y la compatibilidad de Spaces no está comprobada. Si no lo admitiera, la alternativa es dejar la carga como está y aceptar el hash como declaración, que es lo que hoy hace digitalización.

**Alcance del cambio**: vive en `mi-fileserver` y en cómo cada consumidor pide la URL, de modo que **digitalización obtendría la misma garantía sin cambiar su código de catalogación**.

**Diferida.** Queda como trabajo propio, corto y verificable, **fuera de este bloque**: la regla de Q13 se sostiene igual, y lo que la validación agrega es fortaleza de la evidencia, no su existencia.

**Q14 — Si el rechazo también firma.**
**Resuelto: sí**, con la misma estructura y la acción como parte del payload. El rechazo es una resolución del paso y su evidencia importa tanto como la de la aprobación —de hecho más, porque es la que documenta qué se objetó—.

### Delegación (D-04, H-03, H-07)

**Q15 — Cómo se registra quién resolvió efectivamente el paso.**
**Resuelto:** `resolvedById` en `ReviewStep`, **siempre informado**, y la divergencia con `assignedToId` **derivada** en lugar de almacenada. Un indicador booleano de delegación sería un dato calculable que puede contradecir a los dos campos que lo originan.

**Q16 — Si la delegación exige un permiso distinto.**
**Resuelto: sí, un permiso especial**, siguiendo el precedente de `DOCUMENTS_SCANNED_FILE_ADMIN_UPDATE`. Firmar por otro es un acto distinto de firmar lo propio, y conviene poder auditarlo y otorgarlo por separado.

**Es el permiso que gobierna todos los actos sobre el trabajo ajeno**, y no solo la firma: la reasignación de pasos (Q37), el registro de una versión sobre un paso de otro (Q5) y la consulta de pendientes ajenos (Q18). Uno solo, no cuatro.

**Costo declarado:** obliga a tocar `202-mi-common` y republicarlo, con la fase de permisos que `BLOCK_02` ya recorrió —constante publicada, alta en el seed de `205-mi-admin`, asignación a los roles y `npm run seed:permissions` por despliegue—. Esa fase vuelve a preceder a todas las demás.

**Q17 — Si la delegación exige justificación.**
**Resuelto: sí, motivo obligatorio** cuando el actor no es el asignado. Se conserva en el paso y dentro del payload firmado (Q12). Es lo que convierte a la delegación en trazable y no solo en permitida.

**Q18 — Alcance de `pendingReviewSteps` (H-07).**
**Resuelto: devuelve los del usuario autenticado**, y con el permiso especial de Q16 admite consultar los de otro.

- El argumento `userId` deja de ser obligatorio y pasa a ser **opcional**: omitido, es el usuario autenticado; informado y distinto, exige el permiso especial.
- Sigue acotado por membresía, conforme a B7 de `BLOCK_02`. Las dos capas se acumulan: el permiso especial habilita ver pendientes ajenos, no ver proyectos ajenos.
- Es cambio incompatible de contrato —el argumento era obligatorio— y no tiene consumidores.

Conserva una sola consulta en lugar de dos, y con eso la bandeja de trabajo del usuario y la vista de supervisión son la misma operación con distinto alcance.

### Toma de conocimiento (H-04, D-19)

**Q19 — Cuándo y cómo se cierra un paso `ACKNOWLEDGE`.**
Opciones: (a) que deje de excluirse del cálculo y bloquee el cierre del circuito; (b) que el circuito cierre con los pasos decisorios y los acuses se resuelvan después, con operación propia; (c) que se cierren automáticamente al completarse el workflow.
**Resuelto: (b).** Es lo que D-19 describe: el acuse **comunica** un documento ya aprobado, de modo que bloquear la aprobación invertiría su función, y cerrarlo solo lo convertiría en un registro vacío.

Exige tres cosas, y ninguna es opcional:

1. **Una operación de acuse**, que es lo que hoy no existe.
2. **Un estado terminal propio del paso**, que Q45 resuelve junto con `ASSIGN` y `PREPARE`.
3. **Corregir `pendingReviewSteps`**, que hoy deja de mostrarlos apenas el workflow pasa a `COMPLETED`. Sin esa corrección la operación nueva no tendría dónde ejercerse: los acuses quedan pendientes en un circuito ya cerrado, que es exactamente el conjunto que la consulta excluye.

**Q20 — Si el acuse necesita permiso propio.**
**Resuelto: no.** `DOCUMENTS_WORKFLOW_UPDATE`, el mismo de aprobar y rechazar. Un acuse es la resolución de un paso asignado.

### Esquema de revisión (D-13)

**Q21 — Nombres de los valores.**
**Resuelto: `ALPHA`, `NUMERIC` y `FREE_TEXT`**, renombrando `ALPHABETICAL` e incorporando el tercero, alineado con el precedente de digitalización. Sin datos, el renombre de la enumeración es directo.

**Q22 — Dónde se resuelve el esquema que rige.**
**Resuelto: precedencia de tres niveles** — rige el del documento, que se inicializa desde el del proyecto, que se inicializa desde un valor por defecto del despliegue. Ninguno revalida lo ya creado.

**Q24 lo reformula sin contradecirlo**: el nivel del documento deja de ser un atributo almacenado y pasa a derivarse de su última revisión. La precedencia se conserva; lo que cambia es que el escalón del documento se lee en lugar de guardarse.

**Q23 — Si existe un valor por defecto del despliegue, y dónde.**
**Resuelto: sí, como registro único**, con el patrón de `CatalogSettings` (`id @default(1)`). Permite fijar la convención del cliente sin desplegar y sin configurar proyecto por proyecto, que es lo que D-13 busca al hablar de un default global. Es el escalón que Q22 da por existente.

**Q24 — Si el esquema se persiste en el documento, o solo se sugiere.**
Planteo original: si `switchRevisionScheme` debía exigir que no hubiera una revisión en curso. Al revisarlo apareció una pregunta anterior: **si tiene sentido persistir el esquema en el documento.**

El problema del atributo almacenado es que **puede contradecir a los hechos**. Cambiar el esquema con la revisión `A` aprobada deja el documento declarando `NUMERIC` mientras su revisión vigente es `A`. No rompe nada —el esquema solo interviene al crear la siguiente— pero afirma algo que no se corresponde con lo que el documento muestra, y obliga a inventar una precondición para tapar la incoherencia.

**Resuelto: no se persiste. El esquema se elige al crear la revisión, y el sistema propone el código.**

- **Primera revisión** — el código se propone según el esquema del proyecto, o del default del despliegue (Q22, Q23).
- **Revisiones siguientes** — el código se calcula a partir de la **última revisión no abortada**, infiriendo el esquema de la forma de su código: dígitos continúan en `NUMERIC`, letras en `ALPHA`. La inferencia solo necesita interpretar valores que el propio sistema generó, porque bajo `FREE_TEXT` el código lo escribe el usuario.
- **Cambiar de esquema** es elegir otro en ese mismo momento, y la secuencia se reinicia: de `C` a `NUMERIC` da `0`, que es el comportamiento que H-10 ya describía como el buscado.

Lo que esto elimina:

- `Document.revisionScheme` como columna;
- la operación `switchRevisionScheme` y su acción de auditoría `SwitchRevisionScheme`, que sale del catálogo de `BLOCK_01`;
- **la pregunta original de Q24**, que deja de existir: no hay un momento en el que el cambio esté permitido o prohibido, porque el cambio es la elección del código de la revisión que se está creando.

Es además el modelo de digitalización, donde el esquema no se guarda por elemento sino que gobierna qué se ofrece. La diferencia se mantiene y es la de D-13: allá se valida contra una lista, acá se calcula el sucesor.

**Lo que cuesta**, declarado: un documento no puede fijar de antemano el esquema que va a seguir. Deja de existir "este documento se numera con letras" como declaración previa; existe la secuencia de sus revisiones, que es el hecho. Para el usuario la diferencia es que elige en el momento en que importa, con el código propuesto a la vista.

**Q25 — Validación de los códigos según el esquema (H-09).**
**Resuelto:** bajo `ALPHA` y `NUMERIC` el sistema **calcula** el código y **rechaza** el informado; bajo `FREE_TEXT` lo ingresa el usuario y solo se valida que no se repita entre las revisiones no abortadas del documento, que es lo que sostiene el índice parcial de Q32. Alcanza a `createRevision.revisionCode` y a `createDocument.initialRevisionCode`, hoy ambos aceptados sin validación.

**Q26 — Qué se porta del util de digitalización.**
**Resuelto:** se extrae `src/utils/revisionScheme.ts` con la generación del **sucesor**, no de la lista. `revisionListSize` responde a validar contra un conjunto cerrado, que es el problema de digitalización y no el de acá. Sin lista tampoco hay tope que administrar. El util incorpora además la **inferencia del esquema a partir del último código** que Q24 exige.

**Q27 — Si la configuración incorpora etiqueta.**
**Resuelto: no**, conforme a lo que D-13 ya anticipa: "revisión" es terminología establecida del dominio documental.

### Cancelación (D-17)

**Q28 — Confirmación y alcance de D-17.**
**Resuelto: D-17 queda aprobada, y ampliada.** Se conserva que la cancelación **no elimina las versiones generadas** y que adopta identidad propia con su motivo en el modelo. **Cae la restricción de cancelar solo antes de la primera firma**: la cancelación se admite **en cualquier punto del circuito**, aun con pasos ya resueltos.

El caso que lo exige: se abre una revisión, se avanza, y a mitad del circuito se concluye que no corresponde continuarla. Exigir que ninguna firma exista obligaría a completar un circuito que ya se sabe inútil, o a rechazarlo simulando un rechazo que nadie emitió.

**El riesgo que motivaba la restricción no se reabre, porque nada se elimina.** La revisión abortada permanece en la historia con su circuito, sus versiones y las firmas que alcanzó a reunir, junto con el motivo del abandono. La evidencia queda intacta por construcción, que era el fin que la restricción perseguía; los cuatro fundamentos de D-17 —consistencia con D-11, integridad de la firma, las versiones intermedias como trabajo, y la pertenencia de la versión a la revisión— se sostienen sin ella.

**Q29 — Cancelar el circuito y abortar la revisión son dos actos distintos.**
**Resuelto: son dos operaciones, con precondiciones y efectos propios.**

| Acto | Cuándo | Efecto |
| ---- | ------ | ------ |
| **Cancelar el circuito** | El circuito quedó mal armado, o se sometió lo que no correspondía (Q39) | El circuito queda cancelado; **la revisión sobrevive**, vuelve a `DRAFT` con sus versiones y se rearma un circuito nuevo **desde el armado** (D-11, Q8) |
| **Abortar la revisión** | La revisión dejó de tener sentido y no va a emitirse | La revisión queda abortada en la historia; si tiene un circuito abierto, se cancela con ella |

Ambas exigen motivo. Sin la primera, corregir un circuito mal armado obligaría a rechazar un paso —ensuciando la historia con un rechazo que nadie emitió— o a abandonar una revisión que no tenía nada malo.

Se suman a las salidas que ya existen y no las reemplazan: el **rechazo** sigue siendo el circuito que se ejecutó y concluyó negativamente (D-10), y el **circuito trabado por un revisor ausente** lo resuelve la delegación registrada de D-04, no la cancelación.

**Pendiente dentro de esta cuestión:** si cancelar **solo el circuito** admite también pasos ya firmados, o si ahí sí se conserva la precondición original. El caso confirmado —abandonar la revisión en cualquier punto— no lo decide.
**Recomendación:** admitirlo igual. El argumento que sostenía la restricción es el mismo y cae por el mismo motivo: el circuito cancelado permanece con sus firmas y su motivo, de modo que la historia queda legible y nada se destruye. Mantener la precondición solo para este acto obligaría además a explicar por qué el camino más destructivo —abandonar la revisión entera— es el menos restringido.

**Q30 — Forma de la identidad del circuito cancelado (H-05).**
**Resuelto:** valor `CANCELLED` en `WorkflowStatus`, más `cancelledAt`, `cancelledById` y `cancelReason` en el workflow. La transición se suma al catálogo como `WorkflowCancelled`, hoy inexistente: la cancelación emite `WorkflowRejected`, que es la misma confusión de H-05 trasladada a la traza. Los pasos pendientes quedan `SKIPPED`, como hoy, y **los ya resueltos conservan su estado y su firma**.

**Q31 — Estado y datos de la revisión abortada.**
**Resuelto:** valor `CANCELLED` en `RevisionStatus`, con `cancelledAt`, `cancelledById` y `cancelReason`, y transición `RevisionCancelled`. Mismo vocabulario que el circuito, para que las dos cancelaciones se lean igual. No se reutiliza `OBSOLETE`, que Q3 conserva sin uso para otra semántica: obsoleto es lo que dejó de aplicar, no lo que se abandonó antes de salir.

**No hace falta restituir la revisión anterior.** La supersesión ocurre al aprobarse la sucesora, y una revisión abortada nunca se aprueba (Q33): la anterior nunca dejó de estar vigente. "Volver a la revisión anterior" es, en el modelo, no haber salido de ella.

Eso vale para el estado, no para la lectura: si `Document.currentRevision` no excluyera las abortadas, abortar una revisión cambiaría cuál es el documento vigente. Lo resuelve Q36, que unifica las dos ramas divergentes de la línea base y define qué devuelve cada campo.

**Q32 — La revisión abortada no consume código de revisión.**
**Resuelto: el código se reutiliza.** Sobre un documento en revisión `A` puede abrirse `B`, abortarse, y abrirse más adelante otra vez `B`, que se completa. La `B` abortada queda en la historia sin ocupar el código. Es el mismo principio con que D-10 impide que el rechazo interno agote la secuencia: lo que la contraparte ve son las revisiones que salieron.

Exige dos cambios que conviene declarar por separado, porque uno solo no alcanza:

1. **La unicidad `@@unique([documentId, revisionCode])` se reemplaza por un índice único parcial** que excluye a las abortadas: `UNIQUE (document_id, revision_code) WHERE status <> 'CANCELLED'`. Es el tercer índice parcial del módulo, con el mismo tratamiento en SQL y el mismo comentario en el modelo que B2 de `BLOCK_02`.
2. **El cálculo del código sucesor ignora las revisiones abortadas.** Sin esto el sistema propondría `C` donde el usuario espera `B`. Se combina con Q4: la revisión de la que se deriva el sucesor es la última **no abortada** por secuencia de creación.

Consecuencia aceptada: un documento puede tener varias revisiones abortadas con el mismo código —tres intentos de `B` abandonados—. Es correcto y el índice parcial lo admite; cada una se distingue por su fecha de creación y su motivo.

**Q33 — Solo se aborta una revisión no aprobada.**
**Resuelto: se aborta en `DRAFT` o en `IN_REVIEW`.** Aprobada, la revisión es el documento vigente y lo que corresponde es abrir la siguiente.

Tiene una consecuencia que conviene registrar para `BLOCK_04`: como la emisión exige aprobación interna (D-18, puerta dura), **una revisión abortada nunca fue emitida**. Este bloque no le deja al siguiente ningún caso de transmittal sobre una revisión abandonada.

**Q34 — Permisos de las dos operaciones.**
`cancelWorkflow` exige hoy `DOCUMENTS_WORKFLOW_CREATE`, que es la parte de H-22 que este bloque toca inevitablemente.
**Resuelto:** `DOCUMENTS_WORKFLOW_UPDATE` para cancelar el circuito y `DOCUMENTS_DOCUMENT_UPDATE` para abortar la revisión. Ambos existen, de modo que ninguno de los dos suma trabajo al catálogo compartido, que este bloque toca una sola vez por el permiso de Q16. Un recurso propio de revisión resolvería mejor la segunda, pero es H-22 y está fuera de alcance.

### Unicidad de los catálogos (H-19)

**Q46 — Cerrar H-19 en `DocumentClass` y `DocumentType`.** *(Incorporada al abrir el bloque.)*
**Resuelto: se cierra en este bloque, con `NULLS NOT DISTINCT`.**

Son cuatro restricciones, todas con columnas anulables dentro de la tupla:

| Modelo | Restricción | Cuándo no impide el duplicado |
| ------ | ----------- | ----------------------------- |
| `DocumentClass` | `[name, module]` y `[code, module]` | `module` nulo — disponible para todos los módulos |
| `DocumentType` | `[name, classId, module]` y `[code, classId, module]` | `module` o `classId` nulos — disponible para todos los módulos o todas las clases |

**El caso que no protege es el más frecuente.** Un catálogo recién sembrado tiene casi todas sus entradas sin módulo y sin clase, que es exactamente donde la restricción no rige.

No cambia ninguna regla funcional: la restricción pasa a impedir lo que siempre quiso impedir.

**Condición operativa, distinta de todo lo demás del bloque: estos catálogos tienen datos en producción.** La migración falla si ya existen duplicados. Antes de aplicarla hay que verificarlo por cliente con una consulta de solo lectura, y resolver los que aparezcan. Es el mismo procedimiento de precondición que `BLOCK_02` usó para las tablas vacías, con otra consulta y con un desenlace distinto: acá un resultado no vacío no cancela la migración, exige limpiar antes.

Deja además el terreno preparado para **D-21**: el alcance por proyecto agrega otra columna anulable a estas mismas tuplas, y con el mecanismo ya adoptado no habrá que volver a decidirlo.

### Rol documental

**Q35 — Si el ciclo se ramifica por rol.**
**Resuelto: en este bloque no se ramifica.** Al recorrer los tres casos aparecieron dos diferencias reales, y ambas pertenecen a `BLOCK_04` porque ambas se desprenden de un solo hecho.

| Rol | Circuitos por revisión | Cómo termina |
| --- | ---------------------- | ------------ |
| **Emisor** | Varios: cada rechazo devuelve el trabajo al elaborador y abre uno nuevo | La aprobación interna habilita la emisión al cliente |
| **Interno** | Varios, igual que Emisor | La aprobación es terminal: el documento queda vigente |
| **Receptor** | **Uno solo**: la calificación cierra la revisión, se apruebe o se rechace | La calificación se comunica a quien emitió; un rechazo obliga a emitir una revisión nueva |

**El hecho del que se desprenden las dos diferencias: en el rol Receptor la elaboración no ocurre dentro del sistema.** El contratista sube documentación ya aprobada por sus propios medios y la planta no modela su ciclo interno (D-18). El circuito de la planta no tiene a quién devolverle el trabajo.

De ahí:

1. **El circuito del rol Receptor no tiene paso de elaboración.** La versión llega con la emisión; no la produce un paso. El circuito empieza en el armado —propuesto ahí por la matriz de responsabilidad (H-36)— y sigue con revisión y aprobación.
2. **El rechazo cierra la revisión en lugar de reabrir el circuito.** No es una regla nueva: es D-10 aplicada donde corresponde. En modo Receptor el circuito **no es el ciclo interno**, es el mecanismo con que la contraparte produce su respuesta — y toda respuesta cierra la revisión emitida. La siguiente emisión lleva revisión nueva, con o sin objeciones.

Dicho de una sola manera: **el rechazo devuelve el trabajo a quien elabora.** En Emisor e Interno esa persona está dentro del sistema y el circuito se reabre; en Receptor está afuera, y lo único que el sistema puede hacer es cerrar la revisión y esperar la siguiente. La regla es la misma; cambia dónde vive el elaborador.

**Por qué eso no ramifica este bloque.** El circuito del rol Receptor **solo existe después de una recepción**, y la recepción es `BLOCK_04`. Este bloque construye el ciclo tal como lo viven Emisor e Interno, que son idénticos entre sí salvo por lo que ocurre **después** de aprobar — y eso también es `BLOCK_04`.

**Lo que este bloque debe dejar habilitado**, declarado acá para que `BLOCK_04` no lo redescubra:

- que un circuito pueda armarse **sin paso de elaboración**. Q42 lo contempla: los pasos estructurales los agrega el sistema **según el rol**, no siempre los dos;
- que la conclusión de un circuito pueda ser **terminal para la revisión**, y no solo devolverla a borrador;
- que el armado admita ser **propuesto por una matriz de responsabilidad** y no solo por una plantilla. En la forma de este bloque, la matriz de D-18 es otra fuente de propuesta para el mismo paso de armado, y no un mecanismo aparte.

**Una observación sobre los tres finales.** El circuito termina comunicando algo en los tres roles: la emisión al cliente, la calificación al contratista, o el aviso de que hay un documento vigente. **Las tres son comunicaciones y ninguna forma parte del circuito.** Dos son de `BLOCK_04`; la tercera ya está resuelta acá, porque en el rol Interno la comunicación **es** el paso de toma de conocimiento (D-19, Q19).

## Referencias

- `README.md`
- `DOCUMENT_EVOLUTION_PLAN.md` — D-03, D-04, D-05, D-10, D-11, D-13, D-17, D-19; H-01 a H-10, H-27, H-34
- `BLOCK_01_TRAZABILIDAD_FUNCIONAL.md` — catálogo de eventos y base de pruebas
- `BLOCK_02_CONTEXTO_DE_PROYECTO.md` — B2, B4, B7 y B9
- `../SFS/00_Convenciones.md`
- `../../prisma/schema.prisma`
- `../../schema.graphql`
- `../../src/utils/reviewWorkflow.ts`, `../../src/utils/objectContext.ts`
- `212-mi-digitalization/src/utils/revisionScheme.ts` — esquemas de revisión
- `200-mi/docs/specs/DIGITALIZATION_CATALOG_ATTRIBUTES_SPEC.md` — `CatalogSettings`
- `212-mi-digitalization/docs/SFS/90_Architecture_Decisions.md` — ADR-026
- `212-mi-digitalization/docs/SFS/50_casos_de_uso/UC-CF-001_configurar-atributos-catalogacion.md`
