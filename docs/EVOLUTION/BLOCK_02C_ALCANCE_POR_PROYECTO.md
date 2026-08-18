# Bloque 02C — Alcance por proyecto de clase y tipo

**Estado:** `APROBADO_PENDIENTE` — fases 1 a 5 completadas, desplegado en testing y producción
**Versión:** 1.11
**Depende de:** `BLOCK_02B`, que construyó el mecanismo de alcance; `BLOCK_03`, por la unicidad con nulos.
**Decisiones que ejecuta:** D-21.
**Decisiones que aplica sin modificar:** D-06, D-13, D-15.

## Objetivo

Llevar el alcance por proyecto a `DocumentClass` y `DocumentType`, aplicando el mecanismo que `BLOCK_02B` construyó y probó sobre la ubicación.

El bloque es chico en definiciones y **caro en cuidado**, y conviene enunciar de entrada por qué: es el primer bloque del plan que altera objetos con **datos e interfaz en producción**. `optimal` tiene 7 clases y 57 tipos, la webapp tiene pantallas vivas de ambos catálogos, y `ScannedFile` —el único subsistema con uso real— los referencia. Nada de eso puede degradarse.

Lo que hace barato el bloque es que el trabajo conceptual ya está hecho: el mecanismo existe, se probó en el caso difícil —una jerarquía, con vínculos de padre y recálculo de rutas— y clase y tipo son el caso fácil.

## Línea base confirmada

Verificada sobre el código después de `BLOCK_02B`.

- **`DocCatalogScope` existe y es genérico.** Una fila por proyecto y catálogo, con `mode` en `INHERIT` u `OWN`, y `projectId Int` **obligatorio**, con clave `[projectId, catalog]`.
- **`DocCatalogKind` ya declara los tres valores** —`LOCATION`, `DOCUMENT_CLASS`, `DOCUMENT_TYPE`— y **los dos últimos no los asigna ninguna operación**: solo existen filas de ubicación.
- **`catalogScope.ts` no sabe de árboles.** `effectiveMode`, `visibleEntries`, `entryVisible` y `scopeWhere` reciben entradas con alcance; lo específico de la jerarquía son las dos invariantes de cruce del final. Se reutiliza sin tocarlo.
- **`catalogSeed.ts` sí es del árbol.** Identifica un nodo por su **ruta completa**, que es lo que un catálogo plano no tiene.
- **Los dos catálogos resuelven hoy por `module` anulable**, con `NULLS NOT DISTINCT` en sus cuatro índices únicos desde `BLOCK_03`, B15: `[name, module]` y `[code, module]` en la clase, `[name, classId, module]` y `[code, classId, module]` en el tipo.
- **Sus consultas no tienen noción de proyecto.** `documentClasses` y `documentTypes` filtran, paginan y ordenan; los selectores son `documentClassesSelectList(module)` y `documentTypesSelectList(module, classId)`.
- **Cada catálogo ya tiene sus seis permisos** —`LIST`, `READ`, `SELECT`, `CREATE`, `UPDATE`, `DELETE`— repartidos por rol.
- **Cinco tablas referencian los dos catálogos**: `documents` (por la copia `current*` de `BLOCK_03B`), `document_revisions` (por el dato, D-23), `doc_workflow_templates`, `scanned_files` y `transmittal_items`.
- **Existe una deriva declarada por `BLOCK_02B` y sin dueño**, detallada en B5.
- **Ningún documento productivo.** El subsistema documental sigue sin uso: lo que hay en producción son las **entradas de catálogo** y su consumo desde `ScannedFile`.

## Decisiones ya aprobadas que aplican

- **D-21** — un catálogo es un conjunto y no un valor: el proyecto hereda y amplía, o tiene el suyo. El alcance por proyecto solo tiene sentido con `module = PROJECTS`.
- **D-13** — la validación ocurre solo en escritura: cambiar la configuración nunca revalida ni invalida lo existente.
- **D-15** — la membresía determina qué alcanza el usuario, no qué puede hacer. La autorización es en dos capas.
- **D-06** — la unicidad se resuelve con índices parciales o con `NULLS NOT DISTINCT`, y no con tuplas anulables sueltas.
- **`BLOCK_02B`, B1 y B2** — los dos modos, la siembra puntual por copia, la ausencia de mecanismo de exclusión, y el cambio de modo admitido con documentos ya clasificados.

## Definiciones del bloque

### B1 — Clase y tipo declaran su alcance juntos

**Planteo.** `BLOCK_02B`, B1 fijó que la declaración es **por catálogo** y no una sola por proyecto, con un caso concreto: un cliente puede dictar los tipos de documento y no tener nomenclatura formal de áreas. Al aplicarlo a clase y tipo aparece la pregunta que la ubicación no tenía, porque su padre vive en el mismo catálogo: **¿clase y tipo son dos catálogos o uno?**

La combinación que lo fuerza es clase `OWN` con tipo `INHERIT`. El proyecto no ve ninguna clase del despliegue, pero hereda tipos que cuelgan de esas clases: tipos huérfanos, que apuntan a una clase que el proyecto no puede nombrar. La combinación inversa —clase `INHERIT`, tipo `OWN`— no rompe nada, pero deja el sistema de clasificación partido en dos convenciones.

**Resolución. Se heredan ambos o ninguno.** Clase y tipo son **un solo sistema de clasificación**, no dos catálogos que coinciden en pantalla: el tipo cuelga de la clase, de modo que declararlos por separado admite estados que no describen ninguna práctica real.

Esto **no contradice a B1 de `BLOCK_02B`, lo precisa**: la declaración sigue siendo por catálogo, y lo que este bloque establece es que los catálogos son **dos y no tres** —clasificación y ubicación—. El caso que B1 defendía se conserva entero: el cliente que dicta la clasificación y no tiene nomenclatura de áreas declara `OWN` en una y `INHERIT` en la otra.

**Forma en el modelo: `DocCatalogKind` pasa a `{ LOCATION, CLASSIFICATION }`.** Los valores `DOCUMENT_CLASS` y `DOCUMENT_TYPE` se retiran. Sostener dos filas obligadas a coincidir sería una segunda fuente de verdad sobre un solo hecho, con la pregunta inevitable de cuál gana ante una divergencia.

Es además la corrección que el módulo ya hizo dos veces: `WorkflowStatus.PENDING` y `RevisionStatus.OBSOLETE` se retiraron por estar declarados sin que ninguna operación los asignara (H-08), que es exactamente el estado de estos dos hoy. Retirarlos ahora **no cuesta migración de datos**: nunca se les escribió una fila.

**Alternativa descartada:** dos filas con invariante de coincidencia. Se descarta por lo anterior — expresa como restricción algo que la estructura puede impedir.

**Alternativa descartada:** admitir las cuatro combinaciones y ocultar los tipos huérfanos al resolver. Se descarta porque la ocultación es silenciosa: el proyecto declara heredar tipos y no ve ninguno, sin que nada explique por qué.

### B2 — La siembra es conjunta, y la identidad es el código dentro de su clase

**Planteo.** `catalogSeed.ts` identifica un nodo por su ruta completa, porque copiar un árbol no es copiar una lista. Un catálogo plano no tiene ruta, y hay que decir con qué se reconoce una entrada ya presente en el destino.

**Resolución.** La siembra copia **clase y tipo en un acto**, coherente con B1, y la identidad es el **código**:

- una **clase** ya está presente si su código está presente en el destino;
- un **tipo** ya está presente si su código está presente **dentro de su clase**. El mismo código de tipo puede repetirse bajo dos clases distintas, y son entradas distintas.

Es la identidad que la base ya declara —`[code, module]` en la clase, `[code, classId, module]` en el tipo— y no una convención nueva.

**Se conservan las cuatro reglas de `BLOCK_02B`, B2**, que no son del árbol sino de la siembra: la fuente es lo que la fuente **ve**, con su alcance resuelto; el destino se compara por lo que **ve**, de modo que sembrar en un proyecto que hereda no agrega nada; solo se copia lo vigente; y sembrar es **incremental e idempotente**.

**Sembrar un tipo arrastra su clase**, cuando esa clase todavía no está en el destino. Es la consecuencia directa de B1: un tipo sin su clase es el huérfano que ese punto descarta. La clase se copia primero, y el tipo cuelga de la copia.

**La fuente admite el despliegue o un proyecto existente**, con la misma regla de `BLOCK_02B`: los proyectos ofrecidos son los que el usuario alcanza por membresía, y solo los que tienen catálogo propio. De dónde salió el catálogo queda en `DocAuditEvent` y no en un atributo de linaje.

### B3 — `ScannedFile` no participa del alcance

**Planteo.** `ScannedFile` referencia clase y tipo, tiene `projectId` propio y es el único subsistema con uso productivo. Podría resolver sus selectores por el alcance de su proyecto.

**Resolución. No se toca.** Sus selectores siguen viendo el catálogo del despliegue, exactamente como hoy.

El motivo es que **sale del módulo**: su migración a `212-mi-digitalization` es un bloque diferido con su propio análisis, y hacerlo participar del alcance es trabajo que se tira. Es además la única parte del sistema con datos y operación real de un cliente, de modo que el cambio más barato es el que no existe.

Con las entradas existentes en alcance de despliegue —`projectId` nulo— el comportamiento observable de `ScannedFile` es **idéntico** antes y después del bloque, y eso se mide, no se argumenta.

### B4 — El bloque es de backend, y no rompe las pantallas del despliegue

**Planteo.** `BLOCK_02B` fue enteramente de backend porque la ubicación no tenía pantallas. Acá las hay: `documents/document-classes` y `documents/document-types` están en producción.

**Resolución.** El bloque construye el backend y **verifica** que las pantallas existentes sigan funcionando sin modificarlas. La administración del catálogo propio de un proyecto se construye en `BLOCK_05`.

Lo que lo hace posible es que la migración sea **aditiva**: toda entrada existente queda con `projectId` nulo, o sea en alcance de despliegue, que es el ámbito que esas pantallas administran. Un argumento nuevo y opcional en las consultas no cambia lo que la webapp pide hoy.

Y lo que lo hace conveniente es la ubicación definitiva: el catálogo del proyecto se administra en `projects/[projectId]/documents/`, ruta que todavía no existe. Construirla acá obligaría a levantarla dos veces o a estrenarla en la ruta vieja.

**Las pantallas globales pasan a administrar explícitamente el ámbito del despliegue**, que es lo que ya hacen sin decirlo. Nombrarlo es de `BLOCK_05`.

### B5 — La deriva de las claves foráneas se corrige acá

**Planteo.** `BLOCK_02B` dejó declarada una deriva entre el modelo y la base que no le correspondía tocar, y quedó sin dueño. Este bloque abre migración sobre esas mismas tablas.

**Situación verificada** sobre las seis referencias a los dos catálogos:

| Tabla | Columna | Base | Modelo | |
| ----- | ------- | ---- | ------ | - |
| `documents` | `currentDocumentTypeId` | `RESTRICT` | `RESTRICT` | nombre de constraint viejo |
| `documents` | `currentDocumentClassId` | `SET NULL` | `SET NULL` | nombre de constraint viejo |
| `document_revisions` | `documentTypeId` | `RESTRICT` | `RESTRICT` | — |
| `document_revisions` | `documentClassId` | `RESTRICT` | **`SET NULL`** | **divergencia real** |
| `doc_workflow_templates` | ambas | `SET NULL` | `SET NULL` | — |
| `scanned_files` | ambas | `SET NULL` | `SET NULL` | — |

**Resolución.**

- **`document_revisions.documentClassId` se declara `onDelete: Restrict`**, que es lo que la base ya hace. La relación es opcional y Prisma pone `SetNull` por defecto cuando nadie lo declara: un `prisma migrate dev` habría "corregido" la base en la dirección equivocada. Y acá la consecuencia es peor que en la ubicación, porque **la clase integra el payload de la firma** (D-05, D-23): borrar una clase habría vaciado en silencio la clasificación de revisiones firmadas, que es lo que la firma existe para impedir.
- **Los dos nombres de constraint de `documents` se renombran** a `currentDocumentTypeId` y `currentDocumentClassId`. PostgreSQL no renombra las constraints al renombrar la columna, y `BLOCK_03B` renombró las columnas. Es cosmético y no cambia comportamiento, pero es deriva que el diff sigue reportando.

Es el mismo hallazgo que `BLOCK_02B` encontró con `prisma migrate diff` y **no** con la compilación, que es la razón por la que la verificación de la ruta de migración es una fase y no un paso.

### B6 — El alcance se declara con los mismos dos ejes que la entrada

**Planteo.** `DocCatalogScope` tiene hoy `projectId Int` obligatorio, con clave `[projectId, catalog]`: solo un proyecto puede declarar su modo. Pero comercial, calidad y activos van a tener catálogo propio, administrado en `<modulo>/documents/`, y ninguno tiene proyecto. Con la tabla así, la ausencia de proyecto equivale al despliegue, que es exactamente lo que el plan advierte que no debe construirse.

**Resolución. El terreno se prepara acá**, aunque el escalón de módulo en configuración y plantilla siga diferido.

La forma es la que el propio catálogo ya usa: **`module` más `projectId`**, los mismos dos ejes con que se alcanza una entrada, ahora sobre la declaración.

| Fila | `module` | `projectId` | Qué declara |
| ---- | -------- | ----------- | ----------- |
| Proyecto | `PROJECTS` | 5 | Cómo resuelve el proyecto 5 |
| Módulo | `QUALITY` | nulo | Cómo resuelve calidad |

Un proyecto siempre pertenece al módulo de proyectos, de modo que **`module` está siempre presente** y `projectId` es la única columna anulable. La clave pasa a `[module, projectId, catalog]`, con `NULLS NOT DISTINCT`.

**No se usan dos columnas anulables con exclusión mutua**, que es la forma que D-20 descarta por ser *"la misma familia de defecto que D-06 retira al eliminar `entityType`/`entityId`"*. Acá no hace falta: los dos ejes conviven en lugar de excluirse, y el eje de módulo del alcance dice lo mismo que el eje de módulo de la entrada.

**Consecuencia sobre el significado del eje de módulo, que conviene enunciar.** Hoy `module = null` en una entrada significa *disponible para todos los módulos*, sin condición. Cuando un módulo declare `OWN`, significará que ese módulo **no ve** las entradas sin módulo. Es la misma generalización que el proyecto recibe en este bloque, aplicada un escalón más arriba, y es lo que vuelve al mecanismo uno solo en lugar de dos.

**Este bloque no construye la administración por módulo**: prepara la estructura y deja la resolución escrita en términos de ámbito. Mientras ningún módulo declare nada, rige `INHERIT`, que es el comportamiento actual.

### B7 — El cruce de alcance va en un solo sentido

**Planteo.** En la ubicación, un nodo del proyecto puede colgar de uno del despliegue —eso **es** ampliar— y nunca al revés, porque volvería el árbol global dependiente de un proyecto. Acá el vínculo equivalente es `DocumentType.classId`, con la diferencia de que el padre vive en el otro catálogo del par.

**Resolución. La misma regla, y no se cruza al revés.**

- un **tipo de un proyecto** puede colgar de una **clase del despliegue**: es ampliar la clasificación heredada;
- un **tipo del despliegue** no puede colgar de una **clase de proyecto**. Se rechaza.

**Alcanza también a `DocWorkflowTemplate`**, cuyo alcance combina proyecto con clase y tipo: una plantilla del despliegue no puede referenciar una clase o un tipo de proyecto. Es el mismo enunciado sobre otro objeto, y sin él la plantilla global de un despliegue quedaría dependiendo de un catálogo privado.

Como en `BLOCK_02B`, la invariante **no es expresable en un `CHECK`** —exige mirar la entrada referenciada— y vive en la operación, con su prueba.

### B8 — La ausencia de ámbito nombra el despliegue

**Planteo.** Los tres ejes —`module`, `projectId`, y `classId` en el tipo— ya funcionan igual entre sí: nulo significa *para todos*, y este bloque no lo cambia. Lo que falta declarar es qué devuelve `documentClasses()` **sin** argumento de ámbito, que es exactamente como la webapp la llama hoy.

**Resolución. Sin ámbito rige el del despliegue**, o sea `projectId` nulo. Para ver el catálogo de un proyecto hay que pedirlo por su proyecto.

**La ausencia de argumento nombra un ámbito; no apaga un filtro.** Es la orientación que `BLOCK_02B` ya fijó con otras palabras —*"una rama inexistente devuelve vacío y no devuelve todo"*—: un filtro que no encuentra no se desactiva solo.

Es además lo único que sostiene el criterio 9. Devolver todo dejaría la pantalla de catálogos de `optimal` mostrando las entradas privadas de cada cliente mezcladas con el estándar de la organización, sin que nadie lo hubiera pedido y sin una línea de código modificada que lo explicara.

**Alternativa descartada:** el proyecto como un filtro más, donde sin filtro no se filtra. Se descarta por lo anterior: es un cambio de comportamiento en producción disfrazado de argumento opcional.

**Alternativa descartada — por ahora:** un modo explícito de ver todos los ámbitos, para una administración transversal. No se descarta el caso sino su momento: no existe la pantalla que lo pediría, y `BLOCK_05` puede agregarlo sin migrar nada. Lo que este bloque fija es el valor por defecto, que es lo que no conviene cambiar dos veces.

**El precio, declarado:** no hay forma de ver de un vistazo todas las entradas de todos los ámbitos. Con esta resolución eso es una consulta por ámbito, y no una pantalla.

### B9 — Una entrada dada de baja no se elige

**Planteo.** Apareció al implementar la fase 4, y no en la definición del bloque: la ubicación rechaza clasificar con un nodo dado de baja —`BLOCK_02B`, B3: *"un nodo dado de baja no se elige, aunque los documentos que ya lo tienen lo conserven"*— y clase y tipo no tenían la regla equivalente, ni antes de este bloque ni después. Un catálogo con la baja lógica declarada y sin efecto sobre lo que se puede elegir deja la baja sin sentido: la entrada sigue siendo elegible por quien conozca su identificador.

**Resolución. La misma regla que la ubicación**, en los mismos puntos donde se valida el alcance.

Su límite es lo que la vuelve compatible con D-13: **se valida solo lo que se escribe**. Lo ya clasificado conserva su entrada aunque se dé de baja después, y editar el título de una revisión cuya clase caducó no se rechaza. Es lo que distingue *no se elige* de *deja de valer*.

**Es una regla funcional que las definiciones del bloque no traían**, y por eso se registró primero como observación en lugar de incorporarse durante la implementación. Se decidió aparte y se documenta acá.

## Alcance incluido

- `projectId Int?` en `DocumentClass` y `DocumentType`, referencia externa sin FK, con el invariante de D-21: con valor, exige `module = PROJECTS`.
- Los cuatro índices únicos recreados con el eje nuevo y `NULLS NOT DISTINCT`.
- `DocCatalogKind` a `{ LOCATION, CLASSIFICATION }` (B1).
- `DocCatalogScope` con los dos ejes: `module` obligatorio, `projectId` anulable, clave `[module, projectId, catalog]` con `NULLS NOT DISTINCT` (B6). Las filas de ubicación existentes se migran a `module = PROJECTS`.
- Las dos invariantes de cruce, en `DocumentType.classId` y en `DocWorkflowTemplate` (B7).
- Resolución de alcance en `documentClasses`, `documentTypes` y los dos selectores, con argumento de proyecto **opcional**: sin él rige el ámbito del despliegue, que es lo que la webapp pide hoy.
- Autorización en dos capas: los seis permisos existentes de cada catálogo, más membresía cuando la operación es de ámbito de proyecto, con el precedente de `locations.ts`.
- Siembra conjunta por copia, y la consulta de fuentes disponibles, con el precedente de `locationSeedSources`.
- Validación al clasificar: la clase y el tipo elegidos deben estar dentro del alcance del proyecto del documento —con `entryVisible`— y vigentes (B9).
- Corrección de la deriva de claves foráneas (B5).
- Control de precondición en `prisma/checks/`, y línea base contada por despliegue.
- Pruebas puras del caso plano y de integración de la resolución, la siembra y la autorización.

## Fuera de alcance

- **Toda pantalla.** Las existentes se verifican y no se modifican; las del catálogo por proyecto son de `BLOCK_05` (B4).
- **`ScannedFile` y `Area`** (B3).
- **El escalón de módulo en configuración y plantilla** —`DocProjectSettings` y `DocWorkflowTemplate`—, que sigue diferido con su propio análisis. Este bloque prepara el eje **solo en la declaración de alcance del catálogo** (B6).
- **La administración del catálogo por módulo**, que vive en `<modulo>/documents/` y es de la interfaz.
- **La traducción de la clasificación al promover a la biblioteca de planta**, que D-21 dejó anotada como nota prospectiva.
- **El alcance de `DocWorkflowTemplate`** por proyecto, clase y tipo, que ya existe y no cambia. Lo único que el bloque le agrega es la invariante de cruce de B7.

## Pendiente de definición

**Ninguna.** Las tres cuestiones que quedaron abiertas al redactar el bloque se resolvieron antes de escribir código, que es la condición que el propio bloque se puso: el terreno del escalón de módulo en B6, el sentido único del cruce de alcance en B7, y el ámbito por defecto de la consulta en B8.

Lo que se difiere está en **Fuera de alcance**, y es distinto de lo que falta definir.

## Criterios de aceptación

1. Una entrada creada sin proyecto la ven todos los proyectos que heredan, y ninguno de los que declara catálogo propio.
2. Un proyecto con clasificación propia ve solo sus clases y sus tipos, y puede crear entradas con códigos que el despliegue ya usa.
3. La declaración de clasificación gobierna clase y tipo a la vez: no existe estado en que una herede y el otro no (B1).
4. La siembra conjunta es idempotente: dos ejecuciones producen el mismo catálogo, y una fuente parcialmente solapada agrega solo lo que falta.
5. Sembrar un tipo cuya clase no está en el destino copia primero la clase.
6. Un documento no puede clasificarse con una entrada fuera del alcance de su proyecto, ni con una dada de baja; lo ya clasificado conserva la suya (B9).
7. Un proyecto que cambia de modo con documentos ya clasificados no invalida ninguno: la validación es solo en escritura (D-13).
8. Administrar el catálogo de un proyecto exige el permiso global **y** membresía vigente; el del despliegue, solo el permiso.
9. **Las pantallas de catálogo de la webapp funcionan sin una sola línea modificada**, y el contrato que consumen no cambia de forma incompatible.
10. **`ScannedFile` no registra ninguna diferencia observable**: misma consulta antes y después de migrar, en `optimal` de producción, con diferencia vacía (B3).
11. Un tipo de proyecto puede colgar de una clase del despliegue; un tipo del despliegue no puede colgar de una clase de proyecto, y una plantilla del despliegue no puede referenciar entradas de proyecto (B7).
12. Las filas de alcance existentes —todas de ubicación— quedan migradas a `module = PROJECTS` sin cambiar el comportamiento de ningún proyecto, y una declaración de módulo es registrable aunque ninguna operación la produzca todavía (B6).
13. El diff del modelo contra la base queda limpio, incluida la deriva de B5, verificado con `prisma migrate diff` en los dos sentidos.
14. El control de precondición detecta la aplicación parcial previa y no cancela por ningún otro motivo.

## Fases

1. **Modelo y migración** — `projectId` en los dos catálogos, los cuatro índices, `DocCatalogKind`, los dos ejes de `DocCatalogScope` (B6), y la corrección de la deriva de B5.
2. **Resolución de alcance** — consultas y selectores, con el argumento opcional de ámbito y la autorización en dos capas.
3. **Siembra conjunta** — util puro del caso plano, operación y consulta de fuentes.
4. **Validación al clasificar** — las dos invariantes de cruce de B7 y el alcance de la entrada elegida.
5. **Ruta de migración verificada** — los dos sentidos, control de precondición, línea base contada por despliegue, y la medición de `ScannedFile` en `optimal`.
6. **Promoción a la SFS** — el ámbito `domain/20_classification/` que `BLOCK_02B` ya creó.

## Ejecución

### Fase 1 — completada

El modelo y la migración, sin nada de resolución todavía.

- **`projectId` en los dos catálogos**, con el `CHECK` que exige `module = PROJECTS` cuando hay proyecto. A diferencia del cruce entre clase y tipo, este invariante **sí** es expresable: mira dos columnas de la propia fila.
- **Los cuatro índices únicos incorporan el alcance**, recreados con `NULLS NOT DISTINCT`, que es lo que los vuelve efectivos con tres o cuatro columnas anulables.
- **`DocCatalogKind` queda en `{ LOCATION, CLASSIFICATION }`.** El `USING` de la conversión es además **la precondición que se verifica sola**: si alguna fila tuviera uno de los dos valores retirados, la migración se detiene en lugar de perder el dato. No la tuvo ninguna, que es lo que `B1` anticipaba —nunca se les escribió una fila—.
- **`DocCatalogScope` pasa a los dos ejes**, con las filas existentes migradas a `module = PROJECTS`: todas eran declaraciones de proyecto, que es lo único que la estructura anterior admitía.
- **La deriva de `B5` corregida donde estaba el defecto.** `document_revisions.documentClassId` **no se toca en la base**: ya estaba en `RESTRICT`, que es lo correcto. Lo que estaba mal era el modelo, que al no declarar `onDelete` en una relación opcional dejaba a Prisma suponiendo `SetNull`. La migración solo renombra las dos constraints de `documents` que quedaron con el nombre previo a `current*`.

**El diff volvió a encontrar lo que la compilación no ve**, y es la segunda vez en dos bloques: los cuatro índices recreados conservaban su nombre anterior, que declaraba dos columnas cuando ya cubrían tres o cuatro. Es la misma deriva que `B5` corrige un párrafo más arriba, y se habría creado en la misma migración que la repara. Se adopta el nombre que la convención genera.

**Verificado en los dos sentidos**: el diff contra la base local queda vacío, y las **28 migraciones replicadas desde cero** producen exactamente el modelo.

**474 pruebas, 0 fallos** — una nueva, que fija que el eje de módulo ya admite una declaración sin proyecto y que la unicidad la alcanza con `NULLS NOT DISTINCT`, aunque todavía no exista operación que la produzca.

**Lo que esta fase no trae, y es deliberado:** las consultas siguen resolviendo como antes —el alcance existe en el modelo y todavía no lo lee nadie—, no hay siembra, y la invariante de cruce de `B7` es de la fase 4. La webapp no registra una sola línea modificada, que es lo que `B4` sostiene.

### Fase 2 — completada

La resolución de alcance en las consultas y los selectores, con la autorización en dos capas.

**Las dos vistas quedan separadas, con el precedente de la ubicación:**

- **la lista es de administración y NO resuelve alcance.** Muestra lo que ese ámbito declaró: el catálogo del despliegue, o el propio de un proyecto;
- **el selector resuelve.** Es lo que se puede elegir para clasificar: las propias más las heredadas, o solo las propias.

Confundirlas habría dejado la pantalla de administración de un proyecto mostrando entradas que no puede editar.

**`B8` es una línea de código y una prueba.** El ámbito omitido resuelve `projectId: null`, y las dos pruebas que lo fijan son las que sostienen que la webapp no se toque: la pantalla global llama sin proyecto y sigue devolviendo exactamente lo mismo.

**La autorización sale del alcance de la entrada y no de una regla por operación.** El derivador de contexto de `DOCUMENT_CLASS` y `DOCUMENT_TYPE` **afirmaba que los catálogos eran globales del despliegue** —`projectId: null` fijo, con su comentario—, cosa que dejó de ser cierta en la fase 1. Ahora lee el alcance real, y con eso `assertObjectAccess` exige membresía para una entrada de proyecto sin que ninguna operación lo sepa. Es el mismo mecanismo que la ubicación, y por eso no hubo que escribir una regla por mutación.

**Un defecto encontrado al componer los filtros.** El selector de tipos armaba módulo y clase sobre el mismo `OR` de nivel superior, moviéndolo de lugar cuando aparecía el segundo. Con el alcance —que también puede aportar un `OR`— el último en escribirse habría borrado a los anteriores **sin ruido**: un proyecto con catálogo propio habría visto el del despliegue. Los tres ejes pasan a componerse como condiciones `AND` independientes.

**El alcance no reemplaza al eje de módulo**, y hay prueba: los dos filtran a la vez, de modo que un proyecto que hereda ve el catálogo del despliegue de su módulo y no el de calidad.

**12 pruebas de integración nuevas, y 486 en total, 0 fallos.** Las tres negativas verifican **por qué** se rechaza y no solo que se rechace: un `catch` que acepta cualquier error habría quedado en verde el día que la operación fallara por un código duplicado.

**Lo que esta fase no trae:** la siembra es la fase 3, y las dos invariantes de cruce de `B7` la fase 4 — hoy un tipo del despliegue todavía puede colgar de una clase de proyecto. La webapp sigue sin una línea modificada, y el contrato solo suma argumentos y campos opcionales.

### Fase 3 — completada

La siembra conjunta, con su util puro, su operación y la consulta de fuentes.

**La identidad es toda la diferencia con el árbol.** Allá un nodo **es** su ruta completa; acá una clase es su código y un tipo su código **dentro de su clase**. De ahí sale lo demás: el paso lleva el `classCode` y no el identificador, por el mismo motivo que el paso del árbol lleva `parentPath` —la clase del destino todavía no existe cuando el plan se arma—, y el mismo código de tipo bajo dos clases distintas son dos entradas.

**El plan no sabe de ejes, y el módulo se filtra donde el alcance.** El util recibe **lo que cada lado ve**, ya resuelto, exactamente como el del árbol. Por eso el filtro de módulo vive en la lectura y no en el plan: un proyecto ve el catálogo de proyectos más el compartido, de modo que una clase de calidad no viaja — el destino no la vería nunca.

**La entrada copiada queda en el módulo de proyectos**, que es lo que el `CHECK` exige y lo que la entrada pasa a ser: la clase compartida del despliegue, al copiarse al alcance de un proyecto, deja de estar disponible para todos los módulos.

**Un tipo cuya clase no viaja tampoco viaja**, sea porque está dada de baja o porque no está en lo que la fuente ve. Es la misma regla que en el árbol descarta la rama sin ascendencia vigente, y es la contracara de que el tipo arrastre su clase.

**La siembra vive en un archivo propio y no en el de clases ni en el de tipos**, porque no es de ninguno de los dos: recae sobre el par. Elegir uno habría dejado la mitad del acto lejos de la otra.

**El resultado es el del mecanismo y el desglose vive en la traza.** `DocSeedResult` sirve a los tres catálogos, de modo que sus tres números no se abren por clase y tipo; el evento del acto sí lleva `addedClasses` y `addedTypes`. Se generalizó de paso el vocabulario del tipo, que hablaba de nodos.

**`SeedClassification` es acción propia y no reúso de `SeedLocations`**: una sola acción para las dos dejaría la traza sin decir qué catálogo se sembró.

**14 pruebas puras y 9 de integración nuevas. 509 en total, 0 fallos.** Una de ellas falló al escribirse y tenía razón el código: el tipo del despliegue se había creado sin clase, de modo que la prueba de la resolución por código no probaba nada. Se le dio una clase.

### Fase 4 — completada

Las invariantes de cruce y el alcance de la entrada elegida. Quedaron **cuatro** puntos de control y no dos, y el que faltaba lo delató el precedente.

**El cruce entre catálogos, en las dos escrituras del tipo.** Al crear y al editar: mover un tipo a otra clase lo cruza igual que crearlo ahí. La regla se reutiliza tal cual de `parentScopeAdmitted`, que **no es del árbol** aunque haya nacido ahí — compara dos alcances, no dos nodos.

**Declarar catálogo propio se rechaza con tipos colgando del despliegue.** Es el punto que las definiciones no habían enunciado, y sale de mirar qué hizo la ubicación: allá, declarar `OWN` se rechaza mientras algún nodo del proyecto cuelgue del árbol global. Acá el vínculo cruza un catálogo más allá —el tipo del proyecto cuelga de una clase del despliegue— y el efecto es el mismo: al dejar de heredar, esos tipos apuntarían a una clase que el proyecto ya no ve. Se rechaza nombrándolos, en lugar de dejarlos sin clase por decisión del sistema.

**La plantilla del despliegue no referencia entradas de proyecto**, que es la segunda invariante que `B7` pedía.

**El documento se clasifica solo con lo que su ámbito ve**, en los dos caminos por los que una clase o un tipo entran a una revisión: el alta del documento y la edición de la identificación. Sin esto el selector sería una sugerencia y no un límite — quien conoce un identificador clasificaría con una entrada que su proyecto no ve.

**Y una asimetría con la ubicación que quedó planteada acá y resuelta en `B9`**: clasificar con una entrada dada de baja se admitía.

**7 pruebas de integración nuevas, 516 en total, 0 fallos.** Dos fallaron al escribirse y tenían razón: el control del alta del tipo **no se había insertado** —la edición sí— y las pruebas lo encontraron enseguida. Es exactamente para lo que la prueba negativa existe.

### Fase 5 — completada

La ruta de migración verificada en los dos sentidos, el control de precondición y la línea base.

**Este control sí puede cancelar la migración, a diferencia del de `BLOCK_02B`.** Aquel era enteramente aditivo sobre tablas que nacían vacías; este retira dos valores de una enumeración y cambia la obligatoriedad de una columna. Tiene tres veredictos que bloquean: filas con los valores retirados, aplicación parcial previa, y las dos constraints a renombrar ausentes.

**El primero se probó disparando, y no solo en verde.** Con una fila en `DOCUMENT_TYPE` sobre una base pre-bloque, el control devuelve `bloquea = true` **y la migración se detiene sola**: el `USING` de la conversión no puede interpretar el valor. Aplicada dentro de una transacción —como la aplica Prisma— revierte entera: la enumeración queda con sus tres valores y ninguna columna nueva aparece. Un control que solo se prueba en verde no prueba que bloquee.

**La verificación en los dos sentidos, y una corrección de método.** El primer intento reconstruyó la base pre-bloque con `prisma migrate diff --from-empty --to-migrations`, y esa base **no era fiel**: el diff de Prisma **no expresa `NULLS NOT DISTINCT`, los índices parciales ni los `CHECK`**, de modo que los perdía todos. Se rehízo aplicando el SQL real de las 27 migraciones anteriores, y sobre esa base sí se aplicó la del bloque. El resultado es **estructuralmente idéntico** a la base migrada de forma incremental: la única diferencia es la tabla de registro de migraciones de Prisma, ausente por haberse aplicado el SQL a mano.

**El hallazgo tiene una consecuencia sobre el criterio 13, y conviene enunciarla.** Un diff limpio es **necesario y no suficiente**: dice que el modelo y la base coinciden en lo que Prisma sabe expresar, y las cláusulas que este módulo escribe a mano quedan fuera de esa comparación. Lo que las sostiene es la base, y lo que lo verifica son las pruebas de persistencia — que existen justamente por eso. Se les incorporaron cuatro casos: la unicidad con nulos en los dos catálogos, que dos proyectos puedan repetir un código, que el mismo código de tipo conviva bajo dos clases, y los dos `CHECK` del alcance.

**Un defecto propio, encontrado por una prueba ajena.** Al generalizar el reconocimiento de violaciones de `CHECK` a un sufijo común, quedó fuera `doc_locations_external_reference_complete`, que no lo tiene, y la prueba de `BLOCK_02B` empezó a fallar. Se nombran los tres `CHECK` del módulo en lugar de buscar un patrón.

**La línea base queda contada por el control**, que informa clases, tipos, cuántos son compartidos, los consumidores que no cambian y los dos números de `ScannedFile` del criterio 10. En la base local: 17 clases y 9 tipos, 6 archivos escaneados y 2 áreas.

**523 pruebas, 0 fallos.**

#### El criterio 9, verificado y no argumentado

Que la webapp no se toque era hasta acá una afirmación del bloque. Se verificó de tres formas, antes de promover:

- **Los 45 documentos GraphQL del subgraph documental validan idénticamente** contra el esquema anterior al bloque y contra el actual. Se compararon los dos resultados y **la diferencia es vacía**, incluidos los 26 que fallan por `UserName` —un tipo que resuelve `mi-admin` y que este esquema declara como referencia—, que fallan igual en ambos. Comparar los dos es lo que vuelve al ruido irrelevante: lo que importa no es que validen, sino que validen **lo mismo**;
- **ninguno de los seis documentos de clase y tipo menciona el ámbito.** Los argumentos y campos que el bloque agrega son todos opcionales, de modo que las consultas que la webapp envía hoy siguen siendo válidas palabra por palabra;
- **la webapp compila sin una sola línea modificada** y su árbol de trabajo está limpio.

Lo que sostiene la equivalencia de comportamiento es la migración: toda entrada preexistente queda con `projectId` nulo, que es exactamente el ámbito que la consulta sin argumento resuelve (B8). El filtro que se agrega no descarta ninguna fila que antes se devolviera.

#### Cuatro divergencias entre el contrato y el modelo, y la que faltaba las encontró

Al incorporar `BLOQUE 02C` al control de contrato de `210-mi-deploy` apareció que **el `schema.graphql` conservaba los tres valores viejos de `DocCatalogKind`**: la fase 1 cambió la enumeración de Prisma y el contrato quedó atrás. La consecuencia era peor que una inconsistencia de documentación — el valor nuevo **no era enviable** y los dos retirados sí, hacia una base que ya no los tenía, de modo que declarar el alcance de la clasificación era **inalcanzable por GraphQL**. Las pruebas de integración no lo veían porque llaman al resolver directamente.

**Ninguna verificación del módulo podía verlo**, y por eso la suite del contrato gana la que faltaba: **las enumeraciones del contrato coinciden con las del modelo**, en las dos direcciones y también en las variantes `...Input`.

Al correrla aparecieron **tres divergencias más, y ninguna de este bloque**:

| Enumeración | Falta en el contrato | De dónde viene |
| ----------- | -------------------- | -------------- |
| `RevisionStatus` | `REJECTED` | `BLOCK_04`, al corregir D-26 |
| `DocObjectType` | `DOC_LOCATION`, `DOC_CATALOG_SCOPE`, `DOC_TRANSMITTAL_RESPONSE` | `BLOCK_02B` y `BLOCK_04` |
| `DocObjectTypeInput` | las tres anteriores más `DOC_QUALIFICATION` | ídem |

**Las dos son roturas latentes y no inconsistencias de forma.** Un valor que la base puede contener y el contrato no declara hace **fallar la serialización** de cualquier consulta que lo devuelva: una revisión rechazada en el rol Receptor, o un evento de auditoría de una ubicación —que `BLOCK_02B` emite y está en producción—. Se corrigen acá porque son aditivas, no rompen a ningún cliente y dejarlas sería desplegar sabiendo que están.

#### Desplegado y verificado en testing

`rbb`, `optimal` y `proion`, con la migración aplicada y las tres verificaciones en verde.

**La línea base es idéntica antes y después en los tres**, medida con el mismo control corrido dos veces. En `optimal` —el único con datos— 2 clases, 3 tipos, 9 archivos escaneados con 4 clasificados por clase y 4 por tipo, y 3 áreas, sin una sola diferencia. Es el criterio 10 **medido** y `B3` dejando de ser una afirmación.

Los dos veredictos que bloquean en la segunda corrida son la confirmación de que la migración entró: tres columnas nuevas y **cero** constraints con el nombre viejo.

**Dos controles de `210-mi-deploy` se ampliaron, y los dos por huecos reales:**

- **el de contrato ahora verifica valores de enumeración.** Sin eso una imagen anterior al bloque lo pasaba: `DocCatalogKind` existe en las dos versiones, con contenido distinto. Es lo que encontró que el `schema.graphql` había quedado atrás;
- **el de permisos no miraba clase ni tipo.** El bloque no crea permisos —usa los que existen desde el origen— y por eso nadie los había verificado nunca, siendo que la siembra exige `CREATE` sobre los dos catálogos. Están completos y repartidos: `doc-basic` con tres, `doc-full` con seis, igual que ubicación y calificación.

**Un defecto propio, y con moraleja.** Al ampliar el control de permisos nombré los recursos `documentsDocumentClass` y `documentsDocumentType`, siguiendo la convención de los posteriores; se llaman `documentClass` y `documentType`, **sin el prefijo del módulo**. El control informó cero permisos en los tres despliegues, que es un **veredicto en falso** — el peor resultado posible, porque manda a arreglar lo que está bien. Lo que lo desarmó fue contrastarlo con un hecho conocido: las pantallas de catálogos funcionan en producción desde siempre. Queda anotado en el propio script.

#### Desplegado y verificado en producción

`optimal` y `proion`, con el mismo procedimiento y las mismas tres verificaciones en verde.

**Acá el criterio 10 se midió de verdad.** En testing `optimal` tenía 4 archivos escaneados con clase y 4 con tipo; en producción son **3.182 y 3.164 sobre 3.289**, el 96% del subsistema legado apoyado en los dos catálogos que este bloque altera. La comparación antes y después no registra **una sola diferencia**:

| `optimal` en producción | antes | después |
| ----------------------- | ----- | ------- |
| clases / tipos | 7 / 57 | 7 / 57 |
| archivos escaneados | 3.289 | 3.289 |
| con clase declarada | 3.182 | 3.182 |
| con tipo declarado | 3.164 | 3.164 |
| áreas | 52 | 52 |

`B3` deja de ser una decisión de alcance y pasa a ser un hecho verificado sobre el único cliente con uso real.

**Dos observaciones de la línea base que conviene retener:**

- **las 7 clases y los 57 tipos declaran módulo** —cero compartidos—, de modo que todos pasan al alcance del despliegue sin ambigüedad;
- **no existía ninguna declaración de alcance en producción**: `BLOCK_02B` nunca las estrenó ahí. La conversión de la enumeración tuvo **cero filas que convertir**, que era el único control capaz de fallar por datos y no por aplicación parcial.

## Referencias

- `DOCUMENT_EVOLUTION_PLAN.md` — D-21, D-13, D-15, D-06; H-19
- `BLOCK_02B_UBICACION_FISICA.md` — B1 y B2, el mecanismo de alcance y la siembra por copia
- `BLOCK_03_CICLO_INTERNO.md` — B15, unicidad con nulos
- `BLOCK_03B_TITULARIDAD_POR_NIVEL.md` — B1 y B2, la identificación en la revisión y su copia en el documento
- `../../src/utils/catalogScope.ts`, `../../src/utils/catalogSeed.ts`
- `../../src/resolvers/locations.ts` — precedente de autorización en dos capas sobre un catálogo
