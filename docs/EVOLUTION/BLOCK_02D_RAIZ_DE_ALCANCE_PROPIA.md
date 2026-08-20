# Bloque 02D — Raíz de alcance propia: el contrato

**Estado:** `APROBADO_PENDIENTE`
**Versión:** 1.0
**Depende de:** `BLOCK_02`, cuya configuración y membresía de proyecto este bloque reubica; `BLOCK_02C`, por la unicidad con nulos de los catálogos.
**Decisiones que ejecuta:** D-29, que se incorpora al plan con este bloque.
**Decisiones que revisa:** D-06, D-15, D-28.
**Decisiones que aplica sin modificar:** D-09, D-19, D-21, D-24.

## Objetivo

Que el módulo documental sea **dueño de su raíz de alcance**. Hoy el proyecto vive en `mi-project` y llega acá como referencia externa sin clave foránea; con este bloque el módulo tiene su propia entidad —`DocProject`—, que es lo que D-15 ya había nombrado sin darle objeto: **cada proyecto documental es un contrato**.

El bloque es de modelo y no de comportamiento. **Ninguna regla del ciclo interno, de la circulación ni de los catálogos cambia**: lo que cambia es de qué cuelga el alcance, y con eso, tres cosas que hasta ahora no eran posibles.

1. **Vender el módulo solo.** La regla de oro de `PROJECTS_DOCUMENTS_INTEGRATION_SPEC` dice que un cliente puede comprar solo Projects, solo Documents o ambos, y formaliza una sola dirección: que Projects no dependa de Documents. La otra mitad no se cumple. El listado por el que se entra a la gestión documental **es** el listado de proyectos de `mi-project`, y `DocProjectSettings.projectId` es uno a uno con un proyecto que este módulo no puede crear.
2. **Representar el multi-contratista.** Una planta con tres contratistas en la misma obra hoy abre tres proyectos hermanos sin nada que los una.
3. **Desbloquear `BLOCK_05`.** D-28 declara una dependencia externa —la reorganización del módulo de proyectos por workspace, que tiene su propio plan y no pertenece a este módulo— para que la interfaz nazca en su ruta definitiva. Con raíz propia, esa ruta es del módulo documental.

Es el mismo argumento con que `Company` se movió a `mi-admin` el 2026-08-19, aplicado un nivel más arriba: un módulo no puede venderse solo mientras su objeto central viva en otro que el cliente no compró.

## Línea base confirmada

Verificada sobre el código y sobre los despliegues después de `BLOCK_04` y `BLOCK_02C`.

- **`Document.projectId` es referencia externa sin clave foránea**, con la convención que `BLOCK_02` fijó: *"el módulo no es dueño de `Project`"*. Lo mismo en `Transmittal`, `Area` y `ScannedFile`.
- **`DocProjectSettings` es un satélite uno a uno** (`projectId Int @unique`) que ya contiene rol documental, contraparte, esquema de revisión, armador por defecto y la configuración del atributo de ubicación. Es la entidad de contrato sin identidad propia.
- **`DocProjectMember` es membresía propia**, explícitamente distinta y no derivada de la de `mi-project` (D-15). Es única por par `[projectId, userId]`.
- **Catorce modelos llevan `projectId`**: `Document`, `Transmittal`, `DocumentClass`, `DocumentType`, `DocWorkflowTemplate`, `DocQualification`, `DocCatalogScope`, `DocLocation`, `DocWorkflowEvent`, `DocAuditEvent`, `DocProjectSettings`, `DocProjectMember`, y los dos del subsistema legado, `ScannedFile` y `Area`.
- **Diez índices únicos lo incluyen**, más los **dos índices únicos parciales de `Document`**, creados en SQL crudo porque Prisma no los expresa (`BLOCK_02`, B2): `UNIQUE (code, projectId) WHERE projectId IS NOT NULL` y `UNIQUE (code, module) WHERE projectId IS NULL`.
- **La contraparte es texto libre**: `DocProjectSettings.counterpartyName`, exigida por invariante en `ISSUER` y `RECEIVER`, prohibida en `INTERNAL`.
- **El subgrafo ya declara `Company` como entidad federada** —`type Company @key(fields: "id")`, en `schema.graphql`— sin ningún uso. Es un stub heredado, y desde el 2026-08-19 resuelve contra `mi-admin`.
- **El hub documental lista proyectos de `mi-project`**: `projects/documents/page.tsx` consume `ProjectSortFieldInput` y filtra por `companyId` contra el otro subgrafo.
- **El subsistema documental está vacío en los cinco despliegues**, verificado el 14, el 17 y el 18 de agosto. Los catálogos no: `optimal` productivo tiene 7 clases y 57 tipos, **todos con `projectId` nulo** —declaran módulo, cero compartidos— y `BLOCK_02C` verificó además que **no existe ninguna declaración de alcance en producción**.
- **El subsistema legado sí tiene datos**: 3.289 `scanned_files`, 52 `areas` y 5.124 `document_sys_logs` en `optimal` productivo, quietos y no crecientes.

**Lo que falta medir antes de migrar**, y es la primera fase:

- cuántas filas hay en `doc_project_settings`, `doc_project_members`, `documents` y `transmittals` en cada uno de los cinco despliegues. Se espera cero, y hay que probarlo;
- **cuántas entradas de `document_classes` y `document_types` tienen `projectId` no nulo en cada despliegue**, y si alguna clasifica a algún `scanned_file`. Es el control que decide si el renombre de B7 es gratis o arrastra datos;
- lo mismo para `doc_catalog_scopes` y `doc_locations`, que son las otras dos tablas donde una declaración por proyecto pudo haberse creado a mano;
- cuántos `scanned_files` y `areas` tienen `projectId` no nulo, que dimensiona lo que B7 deja afuera.

**El segundo control es el que puede invalidar el bloque, y no está medido.** `BLOCK_02C` verificó en **producción** que las 7 clases y los 57 tipos de `optimal` declaran módulo y ninguna declaración de alcance existía. Eso no dice nada de los **tres despliegues de testing**, donde una entrada de catálogo con proyecto pudo crearse desde que `BLOCK_02C` se desplegó. Y `ScannedFile` referencia clase y tipo en el 96% de sus 3.289 filas productivas: una entrada de catálogo con `projectId` es una fila que el renombre obliga a colgar de un `DocProject` que no existe, o a perder su alcance en silencio.

**Si el control da distinto de cero, la fase 2 no arranca**: primero se decide qué contrato representa a ese proyecto, o se retira la declaración.

**Cómo leer un resultado distinto de cero.** El control se probó contra la base de desarrollo local antes de mandarlo a ningún despliegue, y **bloqueó**: 12 clases y 6 tipos con proyecto declarado. Son residuo de las pruebas de integración —`projectId` negativo, la convención de fixtures de `modelConstraintsPersistence.test.ts`— y no una declaración real. La lección no es que el dato sea inocuo, sino que **un resultado distinto de cero exige identificar la causa antes de concluir**: fixture sin limpiar, carga de prueba manual, o alcance real de un cliente. Solo el tercero cambia el alcance del bloque; los otros dos se limpian.

Vale además como noticia buena para la fase 5: la migración se ejercita en local **contra el caso que la haría fallar**, y no contra una base ideal donde todo es nulo.

## Decisiones ya aprobadas que aplican

- **D-15** — cada proyecto **es un contrato**, con una sola contraparte; la membresía habilita el acceso y no define permisos; la estructura es binaria entre anfitrión y contraparte.
- **D-09** — el proyecto declara el rol documental, inmutable desde el primer documento.
- **D-19** — el rol `INTERNAL` no tiene contraparte, y todos sus miembros están del lado anfitrión.
- **D-06** — la unicidad se resuelve con índices parciales o con `NULLS NOT DISTINCT`, y no con tuplas anulables sueltas. `module` se conserva como discriminador.
- **D-21** — el alcance por proyecto de un catálogo solo tiene sentido con `module = PROJECTS`.
- **D-24** — el código es el identificador y no cambia. La unicidad es **dentro de su ámbito**.
- **Regla de no-contaminación** de `PROJECTS_DOCUMENTS_INTEGRATION_SPEC` — la dependencia es estrictamente unilateral `Documents → Projects`. Está prohibido cualquier campo inverso en Projects.
- **`COMPANY_RELOCATION_SPEC`, §1.1 y §14.4** — la contraparte de un contrato es la `Company`, no la razón social; y con `Company` en `mi-admin`, la referencia documental no arrastra ni `mi-comercial` ni `mi-management`.

## Definiciones del bloque

### B1 — El módulo es dueño de su raíz de alcance

**Planteo.** `BLOCK_02` resolvió que el documento pertenece a un proyecto, y lo expresó con una referencia externa sin clave foránea porque *"el módulo no es dueño de `Project`"*. Esa frase es correcta y es el problema: un invariante central del módulo queda sostenido por convención entre servicios, y el módulo no puede ofrecer el objeto que su propio circuito necesita.

La consecuencia práctica no es teórica. Un cliente que compre únicamente gestión documental **no tiene dónde dar de alta un proyecto**, porque el alta vive en un módulo que no compró. Y la interfaz lo hace literal: el listado por el que se entra a la gestión documental es el listado de `mi-project`.

**Resolución. `DocProject` es una entidad de este módulo**, con identidad propia, al modo de `DigitalizationProject` en `212-mi-digitalization` —*"DOM-019 — Raíz de alcance (scope) de todo el dominio"*—, que es el precedente exacto: código propio, nombre, estado, membresía propia y ninguna federación del proyecto de `mi-project`.

**Forma en el modelo.** `DocProject` incorpora la identidad que hoy no existe en ninguna parte —código único, nombre, descripción, estado, apertura y cierre con actor— y absorbe la configuración de `DocProjectSettings` (B2). Sus dependientes pasan a colgar de él con **clave foránea real**: el invariante deja de ser convención y pasa a ser estructura.

**Sobre el nombre.** El prefijo `Doc` no es una marca de pertenencia al módulo: se aplica **solo a los nombres genéricos que pueden repetirse en otro subgrafo del supergrafo**, para que no colisionen. `Project` es exactamente ese caso —`mi-project` tiene el suyo y digitalización llamó al suyo `DigitalizationProject` por el mismo motivo—, de modo que `DocProject` lleva prefijo por la regla y no por costumbre. Los nombres propios del módulo no lo necesitan: `Document`, `DocumentRevision`, `Transmittal` y `ReviewWorkflow` se quedan como están.

**Lo que esto le devuelve a D-06.** Aquella decisión descartó crear un proyecto reservado del sistema *"porque el módulo no es dueño de `Project` y el invariante quedaría sostenido por convención entre servicios"*. La premisa deja de valer. No se rehabilita el proyecto reservado —B6 explica por qué el nulo sigue siendo la forma correcta del régimen de publicación—, pero el motivo por el que se descartó ya no es el que gobierna.

**Alternativa descartada:** conservar la referencia externa y sembrar un proyecto reservado en `mi-project`. Se descarta por lo que D-06 ya había dicho, y además porque contamina un módulo ajeno: el proyecto reservado aparecería en cada selector, listado y reporte de proyectos.

**Alternativa descartada:** federar `Project` de `mi-project` como entidad con `@key`. Se descarta porque no cambia nada de fondo —el alta sigue estando del otro lado— y vuelve obligatoria la presencia de un subgrafo que el cliente puede no haber comprado, que es exactamente lo que la regla de oro prohíbe.

### B2 — La configuración es del contrato, y `DocProjectSettings` se disuelve

**Planteo.** `DocProjectSettings` nació en `BLOCK_02`, B4 como *"entidad propia"* para la configuración documental del proyecto, y era la forma correcta mientras el proyecto viviera afuera: no había dónde poner esos campos. Con `DocProject` sí lo hay, y sostener las dos tablas dejaría un objeto de identidad y un objeto de configuración unidos por un uno a uno obligatorio, que es una sola cosa contada dos veces.

**Resolución. `DocProjectSettings` se disuelve dentro de `DocProject`.** Sus cinco grupos de campos —`documentRole`, la contraparte, `revisionScheme`, `defaultOrganizerId` y la configuración de ubicación con su etiqueta— pasan a ser campos del contrato.

No es una simplificación cosmética: es lo que vuelve legible el objeto. `documentRole` no es una preferencia de configuración, es **lo que el contrato es** (D-09), y estaba guardado en una tabla llamada *settings*.

**Lo que no cambia.** La precedencia de configuración sigue siendo la de `BLOCK_03`: lo que el contrato no declara lo resuelve `DocSettings`, la fila única del despliegue. Ese escalón se conserva intacto, y el escalón de módulo que el plan tiene diferido sigue sin existir — con una precisión que este bloque agrega en *Fuera de alcance*.

**Alternativa descartada:** conservar `DocProjectSettings` como satélite de `DocProject`. Se descarta porque el uno a uno obligatorio no expresa ninguna opcionalidad real —no hay contrato sin rol documental— y agrega un salto de lectura a cada resolución de configuración.

### B3 — El vínculo con `mi-project` es opcional, N:1, y nombra la gestión PMI

**Planteo.** Separar el contrato del proyecto de `mi-project` no significa desconectarlos: el cliente que compró los dos módulos quiere que la documentación de una obra se reconozca como suya.

**Resolución. `DocProject.projectId` es anulable y N:1**, referencia externa sin clave foránea, con la misma convención que el módulo ya usa.

**Qué significa el nulo, dicho de frente: que el contrato no tiene asociada una gestión PMI en `mi-project`.** No es un contrato incompleto ni un dato faltante: es un contrato cuya obra no se administra con el módulo de proyectos, sea porque el cliente no lo compró o porque esa obra no se sigue por cronograma.

**Lo que el N:1 habilita, y es el desbloqueo funcional del bloque: varios contratos por proyecto.** Una planta que contrata la ingeniería civil, la mecánica y la construcción a tres proveedores tiene **una obra y tres contratos**. Hoy tiene que abrir tres proyectos hermanos sin nada que los una, y D-15 lo registró como la unidad contractual del negocio precisamente porque no había forma de expresar el nivel de arriba.

**Y no roza la binariedad de D-15.** Cada contrato conserva **una sola contraparte**, de modo que la lógica de visibilidad entre anfitrión y contraparte queda igual de barata: sigue siendo binaria, y no aparece ninguna regla multi-parte. Lo que D-15 advertía —que admitir varias contrapartes por proyecto permitiría representar situaciones que la operación considera inválidas— se sostiene entero: las tres contrapartes no conviven dentro de un contrato, son tres contratos.

**La dirección de la dependencia no se toca.** El vínculo vive del lado de documentos y apunta a proyectos, como `Document.projectTaskId` y `TaskDocumentReference`. **Ningún campo inverso en `mi-project`**, que es la regla de no-contaminación.

**El vínculo se puede agregar después del alta, y quitar.** No es identidad: el contrato existe y opera sin él, y que la obra pase a administrarse con el módulo de proyectos —o deje de hacerlo— es un hecho administrativo posterior. La operación de edición lo admite como cualquier otro campo, con su evento de auditoría. Es la diferencia exacta con el código del contrato, que sí es identidad y no cambia por el mismo criterio con que D-24 lo fija para el documento.

**Lo que queda nombrado y sin resolver: inferir el avance PMI desde documentos.** Es D-07, diferida, y su intención original era registrar el avance de una tarea a partir de la revisión aprobada de su documento entregable. Este vínculo es el portador natural de esa lectura, y el bloque lo deja disponible sin construir nada: **cómo se infiere el avance se decide en el bloque de D-07, no acá.**

### B4 — La contraparte es una referencia a `Company`, no un nombre

**Planteo.** `counterpartyName` es texto libre porque cuando `BLOCK_02` lo definió, la única `Company` del ecosistema vivía en `207-mi-comercial`, y hacerla referencia habría atado la gestión documental a un módulo comercial que el cliente puede no tener. Esa atadura desapareció el 2026-08-19.

**Resolución. La contraparte del contrato es una referencia a `Company`**, el registro transversal de `205-mi-admin`.

Es lo que §1.1 de la reubicación resolvió de antemano: **se contrata con la empresa, no con la razón social**. A qué razón social se le factura es un dato de facturación que el módulo documental no necesita, de modo que la referencia apunta a un único registro transversal sin que documentos tenga que saber nada de `Client` ni de `Entity` — es decir, **sin depender jamás de `mi-management`**.

**Forma en el modelo.** `counterpartyName String?` se retira; `DocProject.counterpartyId Int?` lo reemplaza, resuelto por federación contra la entidad `Company` que el subgrafo **ya declara** con `@key(fields: "id")` y hoy no usa.

**El invariante de D-09 y D-19 se conserva palabra por palabra**, con el campo nuevo: exigido en `ISSUER` y en `RECEIVER`, **prohibido** en `INTERNAL`, que por definición no tiene contraparte.

**Alternativa descartada:** conservar el texto libre y agregar la referencia al lado. Se descarta porque crea dos fuentes de verdad sobre quién es la contraparte, con la pregunta inevitable de cuál gana cuando difieren.

**Alternativa descartada:** denormalizar el nombre junto a la referencia. Se descarta porque no es evidencia de nada: a diferencia de la copia de rótulo de `BLOCK_03B`, acá no hay ningún acto pasado cuyo valor haya que congelar. El nombre de la empresa contratante hoy es el que la empresa tiene hoy.

### B5 — La unicidad del código se discrimina por módulo

**Planteo.** `Document` resuelve hoy la unicidad de su código con dos índices únicos parciales cuya condición es **el nulo de `projectId`**: único por proyecto donde hay proyecto, único por módulo donde no lo hay. Funciona porque el invariante de D-06 exige `projectId` cuando `module = PROJECTS`, de modo que las dos condiciones coinciden. Pero el régimen queda expresado por una columna anulable en lugar de por el discriminador que lo nombra.

**Resolución. La condición pasa a ser el módulo, y los dos regímenes se enuncian de frente:**

| Régimen | Unicidad | Condición |
| ------- | -------- | --------- |
| Circulación | `[docProjectId, code]` | `module = PROJECTS` |
| Publicación | `[module, code]` | `module <> PROJECTS` |

Siguen siendo dos índices únicos parciales en SQL crudo, por el mismo motivo por el que ya lo eran: Prisma no los expresa.

**Consecuencia declarada, y es deliberada: dos contratos de la misma obra pueden repetir el código de documento.** La unicidad es por contrato, no por obra. Es lo correcto —son contrapartes distintas, y cada contratista numera su documentación con su propia convención—, y es la contracara exacta del N:1 de B3. Obligar a que los códigos no se repitieran entre contratos hermanos sería imponerle a tres empresas una numeración común que ninguna acordó.

**D-24 se conserva.** El código sigue siendo el identificador y sigue sin cambiar; lo que este bloque precisa es cuál es el ámbito dentro del que se exige único, que es lo que aquella decisión ya dice: *la unicidad es dentro de su ámbito*.

**El discriminador nuevo necesita un `CHECK`, y sin él abriría un hueco.** Con la condición vieja —el nulo del alcance— un documento de `module = PROJECTS` **sin** contrato caía en el índice de publicación y quedaba cubierto por `UNIQUE (code, module)`. Con la condición nueva cae en el de circulación, `UNIQUE (code, docProjectId)`, y como Postgres trata los nulos como distintos **no queda cubierto por ninguna unicidad**: dos filas iguales entrarían las dos.

El invariante de D-06 —alcance obligatorio cuando `module = PROJECTS`— existía desde `BLOCK_02` pero **vivía solo en la aplicación**, de modo que la base admitía justamente la combinación que abre el hueco. Se vuelve estructura, que es lo mismo que `B1` hizo con la pertenencia al convertirla en clave foránea:

```
documents_module_scope_check
  CHECK ((module =  'PROJECTS' AND docProjectId IS NOT NULL)
      OR (module <> 'PROJECTS' AND docProjectId IS NULL))
```

Es **bicondicional**, y por eso más fuerte que el de los catálogos: allá `CHECK (docProjectId IS NULL OR module = 'PROJECTS')` solo impide el alcance fuera de proyectos; acá hace falta además la dirección inversa, que es la que garantiza que **los dos índices parciales cubran juntos todas las filas**.

**El resto de las unicidades acompaña el renombre sin cambiar de forma**: `[docProjectId, code]` en `Transmittal`, `[docProjectId, userId]` en la membresía, y las de los catálogos con `NULLS NOT DISTINCT` tal como `BLOCK_02C` las dejó.

### B6 — Los dos nulos viven en niveles distintos y no se confunden

**Planteo.** Después de B1 y B3 hay dos columnas anulables que un lector apurado puede leer como la misma ausencia, y no lo son.

**Resolución. Cada nulo pertenece a un nivel y nombra una cosa distinta:**

| Columna | Nivel | Qué significa el nulo |
| ------- | ----- | --------------------- |
| `Document.docProjectId` | Documento | **Régimen de publicación**: el documento no circula por un contrato. `module` dice de quién es |
| `DocProject.projectId` | Contrato | **No hay gestión PMI**: la obra de este contrato no se administra en `mi-project` |

**No se confunden porque no se tocan.** Un documento de `module = PROJECTS` **siempre** tiene contrato —es el invariante que B1 vuelve clave foránea—, y que ese contrato tenga o no gestión PMI no le llega al documento: no cambia su unicidad, ni su circuito, ni su alcance, ni su catálogo.

Lo que `BLOCK_02`, B1 estableció sobre el primero se conserva intacto: *un `projectId` nulo no es una ausencia, identifica el régimen de publicación*. Lo único que cambia es el nombre de la columna.

### B7 — El renombre alcanza al subsistema documental y excluye al legado

**Planteo.** `projectId` aparece en catorce modelos, y dos de ellos —`ScannedFile` y `Area`— son el subsistema legado de digitalización, el **único con uso productivo real**: 3.289 archivos escaneados y 52 áreas en `optimal`, con destino declarado de salir hacia `212-mi-digitalization`.

**Resolución. El renombre a `docProjectId`, con clave foránea real a `DocProject`, alcanza a los once modelos del subsistema documental** —`Document`, `Transmittal`, `DocumentClass`, `DocumentType`, `DocWorkflowTemplate`, `DocQualification`, `DocCatalogScope`, `DocLocation`, `DocWorkflowEvent`, `DocAuditEvent` y `DocProjectMember`— **y excluye a `ScannedFile` y `Area`**, que conservan su `projectId` apuntando a `mi-project` exactamente como está hoy.

**Nueve llevan clave foránea, y dos no.** `DocWorkflowEvent` y `DocAuditEvent` reciben la columna **sin FK**, con el criterio de ADR-022 de digitalización —clave foránea en las raíces, columna de alcance en lo que solo denormaliza el contexto— y por una razón propia: en esas dos tablas el valor es un **snapshot derivado del objeto afectado**, nunca informado por quien emite (`BLOCK_02`, B9), y **un registro inmutable de auditoría no debe depender del ciclo de vida de lo que audita**.

Eso cambia además qué hace la migración con un valor huérfano, y la diferencia es de fondo:

| | Las nueve con FK | Las dos de eventos |
| --- | --- | --- |
| Qué se hace | **Se detiene la migración** | **Se anula el valor** |
| Por qué | Hay una decisión que tomar —qué contrato representa a ese proyecto— y no la puede tomar una migración | No hay ninguna decisión: el valor no puede seguir significando lo que significaba, y el evento conserva su objeto, su acción, su actor y su fecha |

**Por qué se excluyen.** Renombrarlos exigiría crearles un `DocProject` a cada proyecto que hoy referencian, es decir **inventar contratos para un subsistema que se va del módulo**. Es el mismo criterio con que `BLOCK_02C`, B3 los dejó fuera del alcance por proyecto, y aquella exclusión no quedó como argumento: quedó **medida**, y sobre el 96% del subsistema apoyado en los catálogos que ese bloque alteró.

**Lo que vuelve barato el renombre, y está medido.** En los once modelos que sí participan, las únicas filas productivas son las de los catálogos: 7 clases y 57 tipos en `optimal`, **todas con `projectId` nulo**, porque declaran módulo y no proyecto. `BLOCK_02C` verificó además que no existe ninguna declaración de alcance en producción. El resto del subsistema está vacío en los cinco despliegues. **La migración renombra columnas sin filas que convertir**, salvo por lo que la fase 1 mida y contradiga.

**El invariante deja de ser convención.** Hasta hoy nada impedía que un documento apuntara a un proyecto inexistente: no había clave foránea porque no había tabla. Con `DocProject` en la misma base, la base lo garantiza.

**Y arrastra a los scripts de despliegue.** `check-document-db.sh` y los controles de contrato y de permisos leen columnas por nombre y no los compila ni los prueba nada. Es el precedente ya vivido al mover columnas: se actualizan como parte de la fase, no después.

### B8 — La ruta definitiva deja de depender de `mi-project`

**Planteo.** D-28 fijó que `BLOCK_05` nace en su ubicación definitiva, y declaró una dependencia externa para lograrlo: *"la reorganización del módulo de proyectos por workspace, que tiene su propio plan en curso y no pertenece a este módulo"*. El motivo era que el ámbito de proyecto se expresaba como `projects/[projectId]/documents/`, una ruta cuyo primer escalón es de otro módulo.

**Resolución. Con raíz de alcance propia, el workspace es del módulo documental**, y la tabla de ámbitos de D-28 se corrige:

| Ámbito | Ruta | Qué vive ahí |
| ------ | ---- | ------------ |
| Despliegue | `documents/settings/` | Catálogo global, configuración por defecto, auditoría |
| Módulo | `<modulo>/documents/` | Catálogo y documentos de calidad, comercial y activos |
| Contrato | `documents/[docProjectId]/` | El contrato, su catálogo propio y sus documentos |

Es el precedente que D-28 ya citaba, aplicado ahora sin obstáculo: en OperMask Digitalization el workspace es `digitalization/[projectId]/` y los catálogos del despliegue viven en `digitalization/settings/`.

**Lo que se conserva de D-28, íntegro:** que el ámbito se expresa en la ruta con una regla y no caso por caso; que no es preferencia de navegación sino lo que gobierna la resolución de catálogos, el alcance de acceso y la precedencia de configuración; y que la bandeja de trabajo es transversal, con el filtro por contrato como vista.

**Lo que este bloque no hace: la interfaz.** `BLOCK_05` la construye. Lo que acá se decide es dónde nace, y que ya no depende del calendario de otro módulo.

### B9 — El contrato en curso admite operaciones; cerrado, no

**Planteo.** B1 le da identidad al contrato, y con ella un estado. Un estado sin efecto es decoración, y hay que decir cuál es antes de que la interfaz lo muestre.

**Resolución. Dos estados y un solo efecto**, con el precedente literal de `ProjectStatus` en digitalización —`ACTIVE`: *admite todas las operaciones del pipeline*; `CLOSED`: *solo lectura / consulta histórica*—:

| Estado | Qué admite |
| ------ | ---------- |
| `ACTIVE` | Todo: dar de alta documentos, abrir revisiones, correr circuitos, emitir transmittals y registrar respuestas |
| `CLOSED` | Lectura. **Ninguna escritura** sobre ningún objeto del contrato |

**El cierre es una puerta sobre la escritura, y no una máquina de estados nueva.** No exige que los circuitos estén terminados, y **no se propaga hacia abajo**: una revisión en circuito al momento del cierre queda donde está y deja de poder avanzar. Abandonar revisiones, cancelar circuitos o cerrar transmittals como efecto del cierre sería inventar desenlaces que nadie decidió, y D-26 ya le dio a cada nivel su palabra propia para terminar mal. El contrato tiene la suya, y no es la de los otros.

**El cierre admite reapertura, con acto propio y trazado.** Sin ella, un cierre por error deja congelada la documentación de un contrato sin ninguna salida. Reabrir es un acto explícito con actor y fecha, y emite su evento como cualquier otro (`BLOCK_01`).

**Lo que el cierre no hace: promover.** La nota prospectiva del plan sobre la promoción al régimen de publicación ya lo dice —es selectiva por naturaleza, y por eso no puede ser un efecto automático del cierre—. El módulo de activos se resuelve en su momento y no es esto.

**Alcance del efecto:** los objetos que cuelgan del contrato por `docProjectId`. `ScannedFile` y `Area` no participan (B7).

## Alcance incluido

- `DocProject` como entidad del módulo, con identidad propia y clave foránea desde sus dependientes.
- Absorción completa de `DocProjectSettings`, y baja de la tabla.
- `DocProject.projectId` anulable y N:1 hacia `mi-project`, sin campo inverso.
- Contraparte como referencia a `Company` de `mi-admin`, con el invariante por rol conservado.
- Renombre de `projectId` a `docProjectId` en los once modelos del subsistema documental.
- Los dos índices únicos parciales de `Document`, con el módulo como condición.
- Operaciones de alta, edición, cierre, reapertura y consulta del contrato, con sus permisos y su siembra.
- La puerta de escritura por estado del contrato, aplicada a los objetos que cuelgan de él.
- Actualización de los controles de despliegue que leen columnas por nombre.
- Pruebas de las tres capas y línea base del subsistema legado medida antes y después.

## Fuera de alcance

| Fuera de alcance | Motivo |
| ---------------- | ------ |
| La interfaz del módulo | Es `BLOCK_05`, que este bloque desbloquea |
| El avance PMI inferido desde documentos | Es D-07, diferida. B3 deja el vínculo, no la lectura |
| La salida de `ScannedFile` y `Area` | Tiene su propio bloque. B7 los excluye para no condicionarlo |
| El paquete de información de entrada | Es `BLOCK_04B`, que no depende de esto |
| El escalón de módulo en la configuración | Sigue diferido. Este bloque le agrega evidencia: `DocProject` **tampoco** puede ser esa tabla, por el mismo motivo por el que `BLOCK_04` mostró que `DocProjectSettings` no podía serlo con proyecto anulable — un contrato sin contraparte y sin obra no es la configuración de un módulo, es un contrato mal declarado |
| La reorganización de `mi-project` por workspace | Deja de ser dependencia de `BLOCK_05`. No se toca |

## Pendiente de definición

- **Qué otros efectos tiene el cierre, además de la puerta de escritura.** B9 implementa el único que hoy está decidido. Lo demás se mira cuando exista un caso, y la promoción al módulo de activos no es esto.
- **Qué pasa con un contrato cerrado que la contraparte vuelve a contestar.** No es una escritura del anfitrión sino un hecho externo, y B9 la rechaza como cualquier otra. Si la operación demuestra que ocurre, la salida es reabrir, no perforar la puerta.

## Criterios de aceptación

1. `DocProject` existe con identidad propia y **código único**, y es la única raíz de alcance del subsistema documental.
2. `DocProjectSettings` **no existe**, y ninguno de sus campos se perdió: rol documental, contraparte, esquema de revisión, armador por defecto y configuración de ubicación con etiqueta viven en `DocProject`.
3. Los once modelos del subsistema documental referencian `docProjectId` **con clave foránea real**.
4. `ScannedFile` y `Area` **no registran una sola línea de cambio**, verificado por diferencia entre el commit que abre el bloque y el que lo cierra.
5. La línea base del subsistema legado de `optimal` es **idéntica antes y después**, medida con el mismo control corrido dos veces: 3.289 archivos escaneados, 52 áreas y sus clasificaciones por clase y tipo.
6. Las 7 clases y los 57 tipos de `optimal` productivo sobreviven al renombre con su alcance intacto.
7. **Ninguna entrada de catálogo quedó sin ámbito por el renombre**: las que declaraban proyecto —si la fase 1 encontró alguna— cuelgan del contrato que las representa, y ningún `scanned_file` perdió su clasificación.
8. Un documento de `module = PROJECTS` **no puede crearse sin contrato**, y lo impide la base.
9. Dos documentos con el mismo código en **dos contratos distintos** se aceptan; dos con el mismo código en el mismo contrato se rechazan.
10. Dos documentos publicados con el mismo código en el mismo módulo se rechazan; en módulos distintos se aceptan.
11. Un contrato con `projectId` nulo atraviesa el ciclo completo —alta de documento, circuito, emisión y respuesta— **sin ninguna diferencia** respecto de uno vinculado.
12. Un proyecto de `mi-project` con **tres contratos** funciona, y cada uno resuelve su catálogo, su membresía y su numeración por separado.
13. La contraparte es exigida en `ISSUER` y `RECEIVER`, y **rechazada** en `INTERNAL`.
14. La contraparte se resuelve por federación contra `Company` de `mi-admin`, y el módulo **no referencia** ningún tipo de `mi-comercial` ni de `mi-management`.
15. **No existe ningún campo de `mi-project` que apunte a este módulo**, verificado sobre su schema.
16. Ninguna regla del ciclo interno ni de la circulación cambió, **verificado por diferencia**: `revisions.ts`, `versions.ts`, `workingCopies.ts`, `replacements.ts`, `stepSignature.ts` y `transmittals.ts` solo registran el renombre de la columna.
17. Los permisos del contrato están sembrados y repartidos por rol, y **verificados contra una llamada real**, no contra el contrato.
18. `check-document-db.sh` y los controles de contrato y de permisos corren en verde contra el modelo nuevo.
19. Un contrato `CLOSED` **rechaza toda escritura** sobre sus documentos, revisiones, circuitos y transmittals, y sigue admitiendo la lectura completa.
20. Una revisión en circuito al momento del cierre **conserva su estado**: el cierre no la abandona ni cancela su circuito.
21. La reapertura restituye la operación y deja evento con actor y fecha.
22. El `projectId` del contrato **se puede agregar y quitar después del alta**, y el código del contrato **no**.
23. Cada operación del bloque emite sus eventos de auditoría y de transición **dentro de la misma transacción** del cambio, según `B3` de `BLOCK_01`.

## Fases

| Fase | Contenido |
| ---- | --------- |
| 1 ✔ | **Línea base medida** en los cinco despliegues: filas de cada tabla que se toca, entradas de catálogo con `projectId` no nulo y su cruce con `scanned_files`, y `projectId` no nulo en `scanned_files` y `areas` |
| 2 | `DocProject` con identidad, absorbiendo `DocProjectSettings` (`B1`, `B2`). Conserva el uno a uno con `mi-project` |
| 3 | Renombre a `docProjectId` en los once modelos, con claves foráneas (`B7`) |
| 4 | Vínculo opcional N:1 con `mi-project` (`B3`) |
| 5 | Contraparte como referencia a `Company`, con federación (`B4`) |
| 6 | Índices únicos, los dos parciales por módulo (`B5`, `B6`) |
| 7 | Estados del contrato y puerta de escritura por estado (`B9`) |
| 8 | Contrato GraphQL, operaciones del contrato, permisos y siembra |
| 9 | Pruebas de las tres capas, controles de despliegue y línea base contrastada |
| 10 | Corrección de D-06, D-15 y D-28 en el plan, y promoción a la SFS |

**El renombre se adelantó delante del N:1, y el motivo lo puso el código.** El orden original ponía el vínculo opcional antes del renombre, y no funciona: **catorce lugares leen la configuración con `findUnique({ where: { projectId } })`**, que exige que esa columna sea única. Quitarle la unicidad para admitir varios contratos por obra los deja sin clave de búsqueda, y la que los reemplaza —`docProjectId`, que apunta al contrato directamente— no existe hasta el renombre.

Con el orden nuevo cada paso es coherente por sí solo: la fase 2 deja el contrato uno a uno con el proyecto y nada cambia de lugar; la fase 3 hace que todo cuelgue del contrato por su id; y recién entonces la fase 4 puede quitar la unicidad, porque **ya nadie busca por ahí**. Es además una simplificación: después del renombre los catorce lugares tienen el contrato a mano y dejan de buscarlo.

La línea base va primero porque es lo único que puede invalidar el supuesto sobre el que se apoya todo el bloque —que no hay datos que migrar—, y porque medir después de tocar no sirve de nada. **Su control sobre los catálogos es condición de arranque y no un dato de contexto**: de dar distinto de cero, cambia el alcance de la fase 5.

El renombre va después de la contraparte y no antes: son dos cambios de columna sobre las mismas tablas, y hacerlos en el orden inverso obligaría a migrar dos veces la misma fila.

## Ejecución

### Fase 1 — completada

**Los cinco despliegues medidos el 2026-08-20. Ningún control bloquea en ninguno.**

Los seis controles que bloquean —entradas de clase o tipo con proyecto, escaneados clasificados por alguna de ellas, alcances / ubicaciones / plantillas / calificaciones con proyecto, configuración y membresía cargadas, subsistema documental con datos, y aplicación parcial previa— dan **cero en los cinco**.

**El supuesto sobre el que se apoya el bloque queda probado y no argumentado: no hay una sola fila que colgar de un contrato inexistente.** El renombre de `projectId` a `docProjectId` en los once modelos no tiene nada que convertir.

Línea base informativa:

| Línea base | `rbb` t | `optimal` t | `proion` t | `optimal` p | `proion` p |
| ---------- | ------- | ----------- | ---------- | ----------- | ---------- |
| Clases / tipos | 0 / 0 | 3 / 4 | 0 / 0 | **8 / 57** | 0 / 0 |
| Declaraciones de alcance / ubicaciones | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Escaneados | 0 | 9 | 1 | **3.425** | 0 |
| Con clase / con tipo | 0 / 0 | 4 / 4 | 0 / 0 | **3.318 / 3.300** | 0 / 0 |
| Áreas | 0 | 3 | 0 | **52** | 0 |
| Registros de log | 0 | 32 | 1 | **5.277** | 0 |
| Proyectos distintos referenciados por el legado | 0 | 2 | 1 | **2** | 0 |

**Los números de `optimal` productivo son la línea base del criterio 5** y deben repetirse idénticos después de migrar.

#### El subsistema legado no está quieto, y la nota anterior era falsa

`BLOCK_02C` midió `optimal` productivo el 2026-08-18: **3.289** archivos escaneados, 3.182 con clase, 3.164 con tipo, 5.124 registros de log y 7 clases. Dos días después son **3.425**, 3.318, 3.300, 5.277 y **8 clases**.

**136 archivos escaneados nuevos en dos días**, y una clase de documento más. La caracterización anterior —*"está quieto, no creciendo"*, apoyada en que los mismos números se repitieron entre el 14 y el 17 de agosto— **no describe lo que pasa**: la carga es esporádica y por lotes, no ausente. Las 52 áreas sí siguen iguales.

Tres consecuencias, y ninguna bloquea:

- **refuerza B7.** El subsistema del que se excluye el renombre no es un archivo histórico congelado: es un sistema en uso, cargando esta semana;
- **la línea base del criterio 5 hay que tomarla inmediatamente antes de migrar**, y no reutilizar la de esta fase. Entre la medición y la migración pueden entrar lotes nuevos, y una diferencia por carga legítima leída como daño de la migración es exactamente el veredicto en falso que este bloque quiere evitar;
- **la clase nueva llegó con `projectId` nulo**, como todas. El control central sigue en cero, y la deriva de los catálogos que ya se había visto en `optimal` de testing —2/3 a 3/4— aparece también en producción: 7 a 8.

#### Lo demás que la medición confirma

**`proion` productivo da cero absoluto**, catálogos incluidos: nunca usó ni el subsistema documental ni el legado. **`rbb` da cero en todo** en testing, coherente con que ese despliegue corra únicamente `quality`. De los cinco, **`optimal` productivo es el único con algo real en juego**, y es el que gobierna el cuidado del bloque.

### Fase 3 — completada

**El alcance cuelga del contrato.** `projectId` pasó a `docProjectId` en los once modelos, con clave foránea real en nueve y columna de alcance sin FK en las dos de eventos. `ScannedFile` y `Area` no registran una sola línea de cambio.

**El contrato GraphQL entró en esta fase y no en la octava.** Renombrar la columna sin renombrar el campo del SDL deja el contrato mintiendo: `tsc` no lee el SDL, y un campo que el modelo ya no tiene **se resuelve como `null` en lugar de romperse**, de modo que un consumidor pediría `projectId` y recibiría nulo sin enterarse. Son 48 líneas del contrato, y las diez que conservan el nombre viejo son exactamente las que deben: el legado y el vínculo PMI.

**Un control nuevo, y probado contra su propio defecto.** El test de contrato verificaba operaciones y enumeraciones, y **no campos**: por eso el `projectId` viejo pasó desapercibido hasta que se lo buscó a mano. Se agregó un control que declara la frontera de `B7` —quién puede seguir nombrando `projectId`— y se verificó que **falla cuando el defecto se inyecta**, con el criterio que `BLOCK_02C` ya había establecido: un control que nunca se vio fallar no prueba nada.

**Dos defectos propios que encontraron las pruebas:**

- **el alta no podía fijar el vínculo PMI.** La fase 2 dejó `projectId` fuera de la rama de actualización del `upsert`, herencia de cuando la clave de búsqueda **era** ese campo. Con el alta por código, declarar un contrato existente no podía asociarle su gestión PMI — que es justo lo que `B3` promete;
- **cinco índices únicos quedaron con el nombre viejo.** Son los de `NULLS NOT DISTINCT` creados en SQL crudo por `BLOCK_02C` y `BLOCK_03`: no los nombra Prisma y no seguían la convención automática. Los delató `prisma migrate diff`, que es el control que existe para esto.

**Las pruebas se hicieron fieles al modelo, no se adaptaron.** Con clave foránea, toda fila con alcance exige que su contrato exista. Se agregó `testContracts.ts`, que crea contratos **con id explícito**: la convención de identificadores negativos se conserva y ahora nombran al contrato en lugar del proyecto, de modo que ninguna prueba tuvo que reescribir sus constantes. Su código sigue la forma `T-<id>` a propósito, para que `declareDocProject` —que hace upsert por código— caiga sobre esa misma fila en lugar de crear un segundo contrato.

Una prueba de limpieza tuvo que corregirse por una razón que conviene retener: borraba entradas de catálogo **por prefijo de código**, y varias llevan un código propio del dominio —`CIVIL`— con el prefijo solo en el nombre. Sin FK eso solo dejaba basura; con `RESTRICT` impide borrar el contrato, y el defecto se vuelve visible.

**Verificado:** `tsc` limpio, **526 pruebas y 0 fallos** —una más que antes, la del contrato—, `prisma migrate diff` sin diferencias, y la ruta completa reconstruida sobre base limpia con `pg_dump` **idéntico** al de la base migrada de forma incremental.

**Pendiente de medición antes de desplegar:** el control de precondición incorporó dos filas nuevas —eventos de workflow y trazas de auditoría con proyecto—, que **no estaban cuando se corrieron los cinco**. En la base de desarrollo local son 420 y 104 filas, todas de pruebas; en los despliegues deberían ser cero, y la migración las anula sin detenerse. Conviene volver a correr el control antes de la fase de despliegue.

### Fase 4 — completada

**Cae la unicidad de `doc_projects.projectId`, y con eso una obra admite varios contratos.** Es el desbloqueo funcional del bloque: la planta que contrata la ingeniería civil, la mecánica y la construcción a tres proveedores tiene **una obra y tres contratos**, en lugar de tres proyectos hermanos sin nada que los una.

**La consulta del contrato cambió de clave, y era inevitable.** `docProject(projectId:)` no puede seguir existiendo: sin unicidad no hay un contrato por obra que devolver. Quedaron dos operaciones donde había una, y la distinción es la que el N:1 introduce:

| Operación | Devuelve |
| --------- | -------- |
| `docProject(id:)` | El contrato por su identidad |
| `docProjectsByProject(projectId:)` | **La lista** de contratos de una obra. Vacía si no tiene ninguno, que no es un error |

**El control de contrato de la fase 3 hizo su trabajo enseguida.** Al agregar `docProjectsByProject` falló, porque su lista de operaciones autorizadas a recibir un `projectId` de `mi-project` tenía dos y ahora son tres. Es exactamente lo que ese control existe para hacer: obligar a que cada operación nueva que cruce la frontera se declare a propósito en lugar de colarse.

**Se pudo recién ahora y no antes**, que es lo que el reordenamiento de fases anticipó: hasta la fase 3, catorce lugares leían la configuración con `findUnique` por `projectId`. El renombre les dio el contrato por su id, y con eso **ya nadie busca por ahí**.

**La prueba nueva verifica lo que la fase habilita**, y no solo que la migración corrió: tres contratos sobre la misma obra, cada uno con **una sola contraparte** —la binariedad de D-15 intacta—, más la obra sin contratos que devuelve vacío.

**Verificado:** `tsc` limpio, **527 pruebas y 0 fallos**, `prisma migrate diff` sin diferencias, y ruta completa sobre base limpia con `pg_dump` idéntico al de la base incremental.

### Fase 5 — completada

**La contraparte dejó de ser un nombre.** `counterpartyName` se retira y aparece `counterpartyId`, referencia externa sin clave foránea a `Company` de `205-mi-admin`. Es lo que la mudanza del 2026-08-19 vino a habilitar, y el motivo por el que tuvo que ir primero.

**Una referencia hizo más barata la invariante, y no solo más limpia.** Con el nombre libre había un tercer estado —texto en blanco— que `counterpartyViolation` tenía que descartar a mano con un `trim()`. Una referencia no lo admite: es un id o es nulo. La regla de D-19 quedó enunciada sobre dos estados en lugar de tres.

**El contrato expone la empresa, no su id.** `DocProject.counterparty: Company` se resuelve por federación, con el mismo patrón con que el módulo trata a `UserName`. El stub de `Company` que el subgrafo ya declaraba sin uso —heredado de cuando la empresa vivía en `mi-comercial`— pasa por fin a tener consumidor, y su descripción dice de dónde viene.

**La composición del supergrafo se verificó localmente**, con `rover supergraph compose` sobre los siete subgrafos: compone sin error, y `Company` queda declarada como entidad en cuatro subgrafos con sus campos resueltos por `mi-admin`. Es una verificación que el bloque no había necesitado hasta ahora, porque **es la primera vez que federa contra otro subgrafo**.

Aparece de paso una inconsistencia preexistente y ajena a este bloque: `mi-management` y `mi-project` describen a `Company` como *"empresa para darle seguimiento comercial"*, y esa es la descripción que el supergrafo elige. Es cosmética y no se toca acá.

#### `tsc` no delata un campo viejo en una escritura de Prisma

Al retirar `counterpartyName` del modelo y regenerar el cliente, el `upsert` que seguía pasándolo en `data` **compiló sin un solo error**. El `XOR<...>` con que Prisma tipa `data` desactiva el control de propiedades excedentes de TypeScript. En ejecución falla —*Unknown argument*—, de modo que **lo único que lo encuentra son las pruebas**.

Es la contracara exacta del hallazgo de la fase 3 sobre el contrato: allá un campo retirado del modelo se resolvía como `null` en lugar de romperse; acá una escritura con el nombre viejo compila y falla recién al ejecutarse. **En los dos casos `tsc` limpio no es evidencia de nada**, y lo que vale es `grep` del nombre viejo más una prueba que ejercite el camino.

**Verificado:** `tsc` limpio, **527 pruebas y 0 fallos**, `prisma migrate diff` sin diferencias, ruta completa sobre base limpia con `pg_dump` idéntico, y el supergrafo compuesto sin error.

### Fase 6 — completada

**Los dos índices parciales pasan a discriminar por módulo.** El régimen dejó de expresarse con una columna anulable que coincidía con él y pasa a expresarse con lo que lo nombra.

**Y apareció el motivo por el que el cambio no era solo cosmético.** El discriminador viejo y el nuevo coinciden en toda fila donde módulo y alcance concuerdan — y **la base no exigía que concordaran**. Un documento de `PROJECTS` sin contrato quedaba cubierto por el índice de publicación con la condición vieja, y con la nueva no queda cubierto por ninguna, porque los nulos son distintos entre sí. La fase agregó el `CHECK` bicondicional que cierra el hueco, y con eso el invariante de D-06 dejó de vivir solo en la aplicación.

**Lo verifican las pruebas y no el diff**, y conviene retenerlo: `prisma migrate diff` no expresa índices parciales **ni `CHECK`**, de modo que las cuatro reglas de esta fase son invisibles para él. Se agregaron cuatro pruebas de persistencia:

- dos contratos de la misma obra **pueden** repetir código, y dentro del mismo contrato no;
- lo publicado es único por módulo, y dos módulos distintos pueden publicar el mismo código;
- un documento de contrato y uno publicado **no compiten** por el código (B6, los dos nulos en niveles distintos);
- módulo y alcance tienen que coincidir, y **lo impide la base**.

**Verificado:** `tsc` limpio, **531 pruebas y 0 fallos**, `prisma migrate diff` sin diferencias, y ruta completa sobre base limpia con `pg_dump` idéntico —que acá vale doble, porque es lo único que compara los índices parciales y el `CHECK` entre las dos bases—.

### Fase 7 — completada

**La puerta encontró un solo embudo, y eso la volvió barata.** La mayoría de las mutaciones autoriza con `userAuthorization` y no con `projectAuthorization`, de modo que a primera vista no había dónde ponerla. Pero **los dos caminos terminan en el mismo lugar**: `projectAuthorization`, que recibe el contrato, y `assertObjectAccess`, que lo deriva del objeto. La puerta se implementó una vez y los dos la atraviesan — y la prueba verifica **los dos caminos**, porque cerrar solo el del alta dejaría abierta toda escritura sobre objetos ya existentes.

**La intención se declara en cada llamada y no se infiere.** Ochenta puntos de paso —25 lecturas y 55 escrituras— declaran `intent`, con el mismo criterio con que `docProjectId` no es opcional: *un valor por defecto haría que la puerta se saltee por descuido en lugar de por decisión*. Se descartó derivarla del sufijo del permiso —`:create` escribe, `:list` lee—, que habría ahorrado las ochenta declaraciones a cambio de una regla implícita que nadie ve al leer el resolver.

**La puerta no es una capa de autorización, y el código lo dice.** Va después de la membresía y por separado: la autorización responde *quién puede*; el estado del contrato responde *qué admite*. Confundirlas haría que un contrato cerrado se leyera como un problema de permisos.

**Cerrar y reabrir son actos propios, no un `UpdateDocProject` genérico.** Lo que cambian no es un dato del contrato sino qué admite. Reabrir tiene acción propia por la misma razón, y porque sin ella un cierre por error dejaría la documentación congelada sin salida. El catálogo de auditoría pasa de 59 a 61 acciones.

**Lo que las pruebas verifican, y conviene enumerar porque es donde vive la decisión:**

- un contrato cerrado **rechaza la escritura** —por los dos caminos— y **sigue admitiendo la lectura**;
- **el cierre no se propaga**: el documento que ya existía conserva su estado;
- reabrir **restituye la operación**, y el alta que antes fallaba prospera;
- cerrar dos veces se rechaza, y reabrir lo que está abierto también;
- **el régimen de publicación no tiene puerta que atravesar**: sin contrato no hay cierre que lo alcance.

**Verificado:** `tsc` limpio, **534 pruebas y 0 fallos**.

### Fase 8 — completada

**El contrato tiene recurso de permisos propio**: `documentsDocProject`, con sus seis permisos, publicado en `@CLGonzalezGroh/mi-common@3.1.0`. Es recurso propio y no una variante de `documentsProjectSettings` porque el contrato es un objeto nuevo —con identidad, listado y pantalla— que **absorbe** a la configuración en lugar de ser una versión suya.

**Los tres pasos, y no uno.** La constante en `mi-common`, el alta en `seedPermissions.ts` y **el reparto por rol en `rolePermissions.ts`**: `doc-basic` lee, lista y selecciona; `doc-full` administra los seis. Sin el tercero el permiso existe y ningún rol lo tiene, que es la misma inoperancia que la falta de seed — y nada lo delata: compila, siembra, y falla en la primera llamada real.

**El alta se separó de la edición, y el `upsert` por código desapareció.** `declareDocProject` era el intermedio confuso: quien creía estar editando la configuración de un contrato podía estar creando uno nuevo por errar el código. Quedan actos distintos:

| Operación | Qué hace |
| --------- | -------- |
| `docProjects(filter, pagination)` | Listado del despliegue, paginado |
| `docProjectsSelectList(onlyActive)` | Selector para desplegables |
| `docProjectById(id)` / `docProjectsByProject(projectId)` | Por identidad / los de una obra |
| `createDocProject(input)` | Alta. El código es obligatorio |
| `updateDocProject(id, input)` | Edición. **El código no se declara**: es identidad (D-24) |
| `deleteDocProject(id)` | Borrado, solo si no tiene nada colgando |
| `closeDocProject` / `reopenDocProject` | La puerta de `B9` |

**El borrado no necesitó lógica propia.** La clave foránea `RESTRICT` de `B7` ya rechaza borrar un contrato con documentación; lo único que agrega el resolver es traducir ese rechazo a un mensaje que dice qué hacer en su lugar: **un contrato con documentación no se borra, se cierra**.

**Y la puerta de `B9` alcanza al propio contrato**: uno cerrado tampoco se edita. Reabrirlo es el camino, y eso es lo que lo distingue de un estado terminal.

**Un filtro que no es la ausencia de otro.** `withoutProject` nombra a los contratos **sin gestión PMI**, que es una condición y no un dato faltante (B3, B6). Declararlo como filtro propio evita que la interfaz lo confunda con "no filtrar por obra".

**Verificado:** `tsc` limpio en los tres repos, **538 pruebas y 0 fallos** contra el paquete **publicado** —no contra la copia local—, supergrafo compuesto, y el seed corrido en la base local con los seis permisos repartidos a los dos roles.

## Referencias

- `DOCUMENT_EVOLUTION_PLAN.md` — D-06, D-07, D-09, D-15, D-19, D-21, D-24, D-28, D-29
- `BLOCK_02_CONTEXTO_DE_PROYECTO.md` — B1, B2, B4, B6
- `BLOCK_02C_ALCANCE_POR_PROYECTO.md` — B3, B8
- `BLOCK_04_EMISION_Y_RESPUESTA.md` — B11, B13
- `../../prisma/schema.prisma`
- `../../schema.graphql`
- `200-mi/docs/specs/PROJECTS_DOCUMENTS_INTEGRATION_SPEC.md` — regla de oro y regla de no-contaminación
- `200-mi/docs/specs/COMPANY_RELOCATION_SPEC.md` — §1.1, §14.1, §14.4
- `212-mi-digitalization/prisma/schema.prisma` — `DigitalizationProject`, DOM-019
