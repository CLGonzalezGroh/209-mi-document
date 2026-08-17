# Bloque 02B — Ubicación física del documento

**Estado:** `PROMOVIDO_A_SFS`
**Versión:** 1.7
**Depende de:** `BLOCK_02`, que dejó creada `DocProjectSettings`.
**Decisiones que ejecuta:** D-14.
**Decisiones que construye para otro bloque:** el mecanismo de alcance por proyecto de D-21, que `BLOCK_02C` reutiliza sobre clase y tipo.
**Decisión que descarta:** el eje de área de la matriz de responsabilidad (D-18; H-36).

## Objetivo

Incorporar la ubicación física del documento —sitio, planta, área, unidad de proceso— como catálogo jerárquico propio, y con ella el **mecanismo de alcance por proyecto** que los tres catálogos documentales necesitan.

El bloque es chico por una razón que conviene enunciar de entrada: **la ubicación no tiene ningún consumidor de comportamiento.** Ninguna regla del módulo la lee. Es un atributo de clasificación y de filtrado, y nada más. Lo que lo vuelve valioso ahora es que es la última dependencia de `BLOCK_05` y el terreno más barato donde probar el mecanismo de alcance antes de aplicarlo a catálogos con datos productivos.

## Línea base confirmada

Verificada sobre el código después de `BLOCK_04`.

- **No existe ninguna jerarquía de ubicación en el módulo.** `Document` y `DocumentRevision` no tienen atributo de ubicación, y no hay catálogo auto-referencial.
- **`Area` existe pero no sirve**: es plana, obligatoriamente atada a un proyecto, y pertenece al subsistema de `ScannedFile` que sale del módulo. `optimal` en producción tiene 52 registros, todos del subsistema legado.
- **`DocProjectSettings` existe con cuatro atributos de configuración** —`documentRole`, `counterpartyName`, `revisionScheme`, `defaultOrganizerId`— y `projectId` **obligatorio y único**.
- **`DocSettings` es el registro único del despliegue**, hoy con un solo atributo, y es el último escalón de la precedencia documento ▸ proyecto ▸ despliegue.
- **Los catálogos existentes no tienen alcance por proyecto.** `DocumentClass` y `DocumentType` resuelven su alcance por `module` anulable, con `NULLS NOT DISTINCT` en la unicidad desde `BLOCK_03`, B15. `optimal` en producción tiene 7 clases y 57 tipos.
- **El precedente está especificado y construido en digitalización**: `CatalogReference` (DOM-024), catálogo jerárquico global al despliegue, con ruta completa, snapshot en la entrada catalogada, recálculo de rutas al mover o renombrar, y eliminación definitiva solo sin uso ni descendientes.
- **El módulo de activos no existe.** No hay subgraph de activos ni especificación, y las páginas `/tags/documents` de la webapp son stubs con datos fijos.
- **El subsistema documental no tiene uso productivo**, de modo que el atributo se incorpora sin compatibilidad hacia atrás.

## Decisiones ya aprobadas que aplican

- **D-14** — el documento se ubica en una jerarquía física, con el patrón de `CatalogReference`; el sitio es el nivel superior del mismo árbol y no una entidad aparte; `Area` no se reutiliza.
- **D-21** — un catálogo es un conjunto y no un valor, de modo que el proyecto debe poder heredar el catálogo del módulo y ampliarlo, o tener el suyo propio, y declarar cuál de las dos cosas hace.
- **D-23** — la metadata de identificación pertenece a la revisión; descripción, ámbito y vínculos quedan en el documento y se editan siempre.
- **D-13** — la validación ocurre solo en escritura: cambiar la configuración nunca revalida ni invalida lo existente.
- **D-15** — la membresía determina qué puede alcanzar el usuario, no qué puede hacer.
- **D-01 / `BLOCK_01`** — la trazabilidad funcional se escribe en `DocWorkflowEvent` y `DocAuditEvent`.

## Definiciones del bloque

### B1 — El árbol se hereda del despliegue y el proyecto lo amplía

**Planteo.** D-14 configura la obligatoriedad por proyecto pero no dice de quién es el árbol. El precedente de digitalización lo hace global al despliegue (DBR-026), y eso no sirve a los dos casos del negocio a la vez: una planta interviene siempre sobre la misma instalación, mientras que una empresa de ingeniería trabaja para plantas distintas y no tiene un árbol único que declarar.

**Resolución.** Dos modos, declarados por el proyecto:

- **hereda** — vínculo vivo: las entradas del despliegue aparecen siempre, más las que el proyecto agregue. Es el valor por defecto;
- **propio** — sin vínculo: el proyecto no ve nada del despliegue y arma su lista desde cero.

En una planta rige el primero: el árbol del despliegue describe la instalación y cada proyecto le agrega lo que su intervención incorpore. En una empresa de ingeniería el global queda vacío o mínimo y cada proyecto carga la estructura de su cliente, salvo la ingeniería de un solo cliente, que puede usar el global.

**Es el mecanismo de alcance de D-21, y se construye acá.** No es un mecanismo de la ubicación: sirve igual a clase y a tipo. `BLOCK_02C` lo reutiliza sobre los dos catálogos que tienen datos e interfaz en producción, y este bloque lo prueba donde no hay ninguno de los dos.

**La declaración es por catálogo, no una sola por proyecto.** Los casos difieren: un cliente puede dictar los tipos de documento y no tener nomenclatura formal de áreas.

**Cambiar de modo con documentos ya clasificados se admite**, con la orientación de D-13: la validación ocurre solo en escritura y nunca revalida lo existente. Un documento clasificado conserva su valor aunque su entrada deje de estar disponible. No se le impone la inmutabilidad que D-09 exige al rol documental, porque acá no hay semántica que cambie de significado.

**Alternativa descartada:** árbol global al despliegue, como en digitalización. Se descarta porque obligaría a una empresa de ingeniería a mezclar en un solo árbol las instalaciones de todos sus clientes.

**Alternativa descartada:** árbol enteramente por proyecto. Se descarta porque obligaría a una planta a recargar en cada proyecto la misma instalación.

### B2 — La siembra por copia es puntual, y su fuente puede ser otro proyecto

**Planteo.** D-21 dejó abierto si un catálogo propio puede sembrarse copiando el del módulo, y si esa copia es puntual o permanente. Un proyecto que declara *propio* y arranca vacío no puede dar de alta un documento hasta que alguien cargue clase y tipo, que son obligatorios.

**Resolución.** La siembra es **puntual**, y esa es justamente la distinción entre los dos modos de B1: una copia permanente **es** herencia, y llamarla de otro modo daría dos formas de lo mismo.

**La fuente admite el global del despliegue o un proyecto existente.** El global suele ser el estándar de la propia organización, mientras que el catálogo de un proyecto es el estándar de un cliente: el segundo proyecto para el mismo cliente copia del primero y no recarga a mano lo ya cargado.

Forma:

- **los proyectos que se ofrecen como fuente son los que el usuario alcanza por membresía** (D-15). La nomenclatura de un cliente es información de ese cliente, y la membresía es lo que determina qué alcanza el usuario. No hace falta concepto nuevo;
- **sembrar solo agrega**: toma las entradas de la fuente que el destino no tenga, y nunca quita ni modifica. Se admite más de una vez, no exige que el destino esté vacío, y sembrar dos veces no duplica. **Precisado al implementar la fase 3: la identidad de un nodo es su ruta completa y no su código**, porque el mismo código puede repetirse en dos plantas; y lo que se compara es lo que el destino **ve**, no lo que tiene propio;
- **de dónde salió el catálogo queda en la traza y no en el modelo**: sembrar emite un evento de auditoría con la fuente en su contexto. Un atributo de linaje sería estructura para una pregunta que `DocAuditEvent` ya contesta;
- **copiar el árbol no es copiar una lista**: hay que trasladar los nodos, rearmar los vínculos de padre y recalcular las rutas en el destino. Es el caso difícil de la siembra, y es la razón por la que este bloque construye el mecanismo: si funciona sobre la jerarquía, aplicarlo a clase y tipo es el caso fácil.

**Y con esto, excluir una entrada heredada deja de hacer falta**, que era el tercer pendiente de D-21. Si hay que podar, se declara *propio* y se siembra. Un mecanismo de exclusión por proyecto sería una tercera forma de decir lo mismo, con la ambigüedad de qué ocurre cuando el global agrega una entrada nueva.

### B3 — La ubicación es del documento, y se edita siempre

**Planteo.** D-14 afirma que el documento lleva su propia ubicación, pero se escribió antes de D-23, que movió título, clase y tipo a la revisión con el criterio de que lo impreso en el rótulo pertenece a la emisión que lo produjo. El área y la unidad también aparecen en el rótulo.

**Resolución.** La ubicación **pertenece al documento y no a la revisión**, y se edita siempre, como la descripción. No entra en el congelamiento de D-05, no se copia a la revisión, y **no integra el payload de la firma**.

El motivo es que la ubicación no es identidad: es una referencia para filtrar y ordenar. Que un dato aparezca impreso en el rótulo no lo vuelve identificación — lo que D-23 sostiene es que la identificación pertenece a la emisión, no que todo lo impreso lo haga. El código identifica (D-24), el título describe la emisión (D-23), y la ubicación clasifica.

Se suma entonces al grupo que D-23 dejó explícitamente en el documento: descripción, ámbito y vínculos.

### B4 — El atributo es opcional en los tres roles

**Planteo.** D-14 anticipaba que *"un proyecto de ingeniería puede deshabilitar el atributo; una planta lo exigirá"*.

**Resolución.** **La primera mitad se conserva y la segunda se corrige.** La planta usa la ubicación para filtrar, no para exigir: es opcional también ahí. La configuración de habilitación, obligatoriedad y etiqueta sigue existiendo en `DocProjectSettings`, junto con el esquema de revisión, pero el valor por defecto es **habilitado y no obligatorio**.

No es un dato necesario para la gestión documental del proyecto. Un proyecto puede atravesar el ciclo completo sin declarar ninguna ubicación.

### B5 — Un nodo por documento, con profundidad libre

**Resolución.** El documento referencia **un** nodo, habitualmente la hoja, como en el precedente.

El documento que alcanza dos áreas apunta al **ancestro común**, que un árbol de profundidad libre ya permite. No se modela N:M: agregaría una tabla de unión y la ambigüedad de qué ruta se muestra en un listado, para un atributo cuyo único uso es filtrar.

**Alternativa descartada:** varios nodos por documento. Se descarta por lo anterior. Si aparece el caso donde el ancestro común es la raíz y el filtro pierde utilidad, es una migración contenida sobre un atributo sin consumidores de comportamiento.

### B6 — El snapshot de la ruta es denormalización, no evidencia

**Planteo.** D-14 anticipaba que *"corregir un nodo admite propagación explícita y auditada a los documentos ya emitidos"*, siguiendo el precedente de digitalización, donde la propagación alcanza a entradas publicadas.

**Resolución.** Con la ubicación editable siempre (B3), no hay inmutabilidad que respetar, y la propagación **deja de ser el problema que D-14 anticipaba**. El snapshot de la ruta es una denormalización de conveniencia —evita el recorrido recursivo en cada listado— y no acredita nada, de modo que renombrar o mover un nodo **recalcula las rutas de sus descendientes y de los documentos que los referencian, de forma automática**.

Es una regla menos y no una más. Lo que se conserva del precedente es el recálculo; lo que se descarta es la propagación como acto explícito y auditado, que existía allá porque el snapshot formaba parte de una publicación.

### B7 — El nodo admite una referencia externa opcional

**Planteo.** El árbol de la ubicación es el mismo que administraría el módulo de activos, y D-14 lo registra como advertencia de frontera.

**Resolución.** El nodo lleva desde el principio una **referencia externa opcional**, con origen e identificador. En un despliegue de planta, un nodo podrá declarar que corresponde a un activo concreto, y a partir de ahí sembrar el árbol desde el registro de activos o mantenerlo sincronizado se vuelve una operación y no una migración.

Es la forma que la orientación sobre el repositorio documental externo pide —una referencia que admita origen interno o externo desde su definición— y el plan ya declara insuficiente el precedente de `ScannedFile.externalReference`, que resuelve el caso con una cadena y una URL armada por variable de entorno. Acá se modela bien de entrada porque cuesta una columna.

### B8 — El catálogo de clasificación no es el registro de activos

**Planteo.** El dueño natural del árbol es el módulo de activos, que solo tiene sentido en una planta. Pero una empresa de ingeniería no tiene activos y puede necesitar el atributo, y un contratista de digitalización debe entregarlo cuando su cliente lo exige. La titularidad quedaba dependiendo de qué módulos tenga cada despliegue, que es lo que trababa la decisión.

**Resolución.** Son **dos cosas distintas que se parecen**, y por eso no compiten por un dueño:

| | Registro de activos | Catálogo de clasificación |
| --- | --- | --- |
| Qué afirma | Este equipo existe y es nuestro | Así nombra el cliente sus sectores |
| Ciclo de vida | Alta, modificación, decomisionamiento | Baja lógica del rótulo |
| Dueño | El módulo de activos, cuando exista | El módulo que clasifica |
| Alcance | El despliegue, autoritativo | Despliegue con ampliación por proyecto (B1) |

En una planta el árbol es el registro de activos: describe equipos reales que la planta posee y opera, con ciclo de vida propio —el decomisionamiento de una unidad deja obsoleta su documentación sin que nada la reemplace, que es la causa de obsolescencia que el plan ya declara ajena a este módulo—. En una empresa de ingeniería o en un contratista, el árbol es la nomenclatura del cliente copiada para clasificar: no posee esos equipos, no tiene ciclo de vida sobre ellos, y solo necesita los rótulos.

**Cada módulo que clasifica administra su catálogo de clasificación.** Documentos el suyo, digitalización el suyo —que ya tiene, y correctamente, porque el contratista debe entregar el atributo aunque no tenga activos—. Nadie tiene una titularidad que dependa del perfil del despliegue.

**Esto contesta la advertencia de frontera de D-14 en lugar de diferirla:** la divergencia entre un catálogo de clasificación y un registro de activos no es un defecto, porque no dicen lo mismo. La divergencia entre dos registros de activos sí lo sería, y no va a ocurrir — registro de activos hay uno.

**Costo aceptado, declarado.** Un despliegue de planta con activos y documentos mantendrá el árbol dos veces hasta que el puente de B7 exista. Lo vuelve tolerable que el atributo documental es opcional y solo sirve para filtrar (B3, B4): una planta con activos probablemente filtre por el registro de activos en su propia pantalla.

**Alternativa descartada:** un hogar transversal para el árbol —`mi-admin`, único subgraph presente en todo despliegue, o un subgraph propio—. Resolvería la duplicación de raíz y se descarta ahora por dos razones concretas: obligaría a diseñar dato maestro compartido para un módulo que todavía no está especificado, y arrastraría la migración del `CatalogReference` que digitalización ya tiene modelado. B7 mantiene el camino abierto.

### B9 — El eje de área sale de la matriz de responsabilidad

**Planteo.** El bloque diferido de la matriz de responsabilidad (D-18; H-36) tenía **el área como único eje pendiente**: la plantilla de `BLOCK_03` ya resuelve por proyecto, clase y tipo con actores preasignados, y en proyectos la clase es la disciplina. Ese eje dependía de este bloque.

**Resolución.** **Se descarta.** Modelar un responsable por sector es desproporcionado: lo habitual es que los revisores de un proyecto sean los mismos sin importar de qué sector de la planta se trate, y si cambiaran, serían proyectos distintos — porque cada proyecto es un contrato (D-15). El sector no es un eje de asignación: es una propiedad de lo que el proyecto interviene. Lo que quede fuera de la propuesta lo resuelve la reasignación de D-04, que ya existe.

Al retirarse el eje de área, **la matriz de responsabilidad queda sin contenido** y el bloque diferido se cierra. H-36 pasa a `DESCARTADO`, y el punto correspondiente del fuera-de-alcance de `BLOCK_04` queda cerrado en lugar de pendiente.

## Alcance incluido

1. El catálogo jerárquico de ubicación, auto-referencial, con código, nombre, ruta completa, orden, registro reservado y baja lógica.
2. El mecanismo de alcance por proyecto en dos modos, aplicado a este catálogo (B1).
3. La operación de siembra por copia, con fuente global o de otro proyecto (B2).
4. El atributo de ubicación en `Document`, con su nodo y su snapshot de ruta (B3, B5).
5. La configuración de habilitación, obligatoriedad y etiqueta en `DocProjectSettings` (B4).
6. El recálculo automático de rutas al renombrar o mover un nodo (B6).
7. La referencia externa opcional del nodo (B7).
8. Eventos de auditoría del catálogo y de la siembra, y del cambio de ubicación del documento.
9. Consultas de listado y filtrado por ubicación, con el árbol y por rama.
10. Migración de modelo y de contrato, permisos propios del catálogo, y pruebas de las tres capas.

## Fuera de alcance

- **Clase y tipo con alcance por proyecto**, que es `BLOCK_02C`. Este bloque construye el mecanismo; aquel lo aplica donde hay datos e interfaz en producción.
- **El sitio como espacio de trabajo** y no solo como atributo de filtrado (D-14). El alcance de acceso se resuelve por membresía de proyecto y no por sitio.
- **La bandeja de emisiones entre proyectos** (D-14): mientras el documento lleve proyecto y ubicación, es una consulta y no una estructura nueva.
- **La sincronización con el registro de activos.** B7 deja la referencia; el puente se construye cuando el módulo de activos exista.
- **La salida de `ScannedFile` y `Area`**, que conserva su propio bloque diferido. `Area` no se reutiliza ni se migra acá.
- **La interfaz de usuario**, que corresponde a `BLOCK_05`.

## Pendiente de definición

**El escalón de módulo en la configuración.** Con el árbol en el despliegue y heredado por defecto, un documento sin proyecto —calidad, comercial, activos— usa el árbol global sin declarar nada, y siendo el atributo opcional por defecto (B4) tampoco necesita configuración. **Pero la obligatoriedad no se le puede declarar**: `DocProjectSettings.projectId` es obligatorio y único, y la biblioteca de planta es justamente el caso donde la ubicación es el eje principal de orden y querría exigirla.

De modo que el escalón de módulo **no se disuelve, se acota**: este bloque no lo necesita para funcionar, y lo que queda sin cubrir es exigir la ubicación en documentos sin proyecto. Se registra como deuda declarada del bloque diferido correspondiente, en lugar de resolverse acá con `projectId` anulable — que es exactamente la forma que el plan advierte no elegir con la tabla todavía chica.

## Criterios de aceptación

1. Un proyecto que hereda ve las entradas del despliegue más las propias; uno que declara *propio* no ve ninguna del despliegue.
2. Sembrar desde el global y desde otro proyecto produce el mismo árbol en el destino, con la jerarquía y las rutas correctas.
3. Sembrar dos veces no duplica entradas ni altera las existentes.
4. Un proyecto del que el usuario no es miembro no aparece como fuente de siembra.
5. Renombrar y mover un nodo recalcula la ruta del nodo, de sus descendientes y de los documentos que los referencian.
6. Un documento con revisión aprobada admite cambiar su ubicación, y el payload de la firma no la contiene.
7. Un proyecto sin ubicación declarada atraviesa el ciclo completo, en los tres roles.
8. Un proyecto con la ubicación obligatoria rechaza el alta sin nodo.
9. Eliminar definitivamente un nodo se rechaza si tiene descendientes o documentos que lo referencian; la baja lógica se admite.
10. La línea base del subsistema legado de `optimal` queda intacta, comparada antes y después de migrar.
11. `Area` y `ScannedFile` no se modifican.

## Fases

| Fase | Contenido |
| ---- | --------- |
| 1 | El catálogo jerárquico con rutas y baja lógica, sin alcance (`B5`, `B6`, `B7`) |
| 2 | El mecanismo de alcance en dos modos (`B1`) |
| 3 | La siembra por copia, con las dos fuentes (`B2`) |
| 4 | El atributo en el documento y su configuración por proyecto (`B3`, `B4`) |
| 5 | Consultas de listado y filtrado, y eventos |
| 6 | Migración, contrato, permisos y pruebas de las tres capas |
| 7 | Actualización del plan y de la SFS, con el descarte de la matriz (`B8`, `B9`) |

El catálogo va primero porque el alcance opera sobre él, y la siembra después del alcance porque la fuente es un catálogo con alcance declarado.

## Ejecución

### Fase 1 — completada

`DocLocation` con su jerarquía, su ruta recalculada por rama, su ciclo de vida y la referencia externa de `B7`. Dos migraciones —el catálogo y el valor de enumeración de la traza, separado por el motivo que ya obligó a separarlo en `BLOCK_03B` y en `BLOCK_04`—, seis acciones de auditoría, dos transiciones y el derivador de contexto del tipo nuevo.

Tres cosas que la fase resolvió y no estaban escritas en el bloque:

- **mover es operación propia y verifica el ciclo.** El precedente de digitalización no lo necesita porque no admite mover un nodo; `B6` sí lo pide. Sin la verificación, colgar un nodo de su propia descendencia desconecta la rama de toda raíz y ningún recálculo la alcanza;
- **la clave del árbol es `RESTRICT` y no `CASCADE`.** Eliminar un nodo con descendencia se rechaza en la operación para dar mensaje, y la base lo garantiza en lugar de resolverlo borrando en silencio una rama entera;
- **la baja lógica no alcanza a la descendencia.** Un nodo dado de baja con hijos vigentes es un estado legítimo, y cerrar la rama de oficio decidiría algo que nadie pidió.

**386 pruebas, 0 fallos**, con las tres suites de integración. Trece puras sobre rutas, recálculo y ciclos; cuatro contra la base sobre la unicidad por nivel con `NULLS NOT DISTINCT`, el rechazo del borrado con descendencia y el par de la referencia externa.

Pendiente de despliegue: `@CLGonzalezGroh/mi-common` con los seis permisos nuevos, y su siembra en cada cliente. Sin el seed el catálogo es inoperable aunque todo compile, que es lo que la fase 1 de `BLOCK_04` aprendió a los golpes. **Publicado como `2.9.0` y sembrado en local**; el alta en `mi-admin` incluyó el reparto por rol, que es el tercer paso y el que no compila si falta.

### Fase 2 — completada

`DocCatalogScope` con los dos modos, el alcance en `DocLocation`, la unicidad recreada con el alcance en la tupla, y la autorización en dos capas sobre las siete operaciones del catálogo.

**Dos decisiones que la fase tomó, y que `B1` no fijaba:**

- **la declaración vive en una tabla propia con una fila por proyecto y catálogo**, y no en columnas de `DocProjectSettings`. Es la única forma en que "un mecanismo para tres catálogos" es cierto en el modelo: `BLOCK_02C` agrega un valor a `DocCatalogKind` y no migra estructura. Es además la distinción que D-21 ya había hecho —las demás configuraciones por proyecto son **valores** donde lo específico reemplaza a lo general; un catálogo es un **conjunto**— y evita empujar a `DocProjectSettings` en la dirección que el plan advierte para cuando llegue el escalón de módulo;
- **declarar catálogo propio se rechaza mientras algún nodo del proyecto cuelgue del árbol del despliegue**, nombrando las rutas que lo impiden. Convertirlos en raíces reescribiría rutas de nodos que nadie tocó por un cambio de configuración, y mover ya es la vía para acomodarlos.

**Y una invariante que la fase descubrió al modelar el cruce:** el cruce de alcances se admite **en un solo sentido**. Un nodo de proyecto cuelga de uno del despliegue —eso *es* ampliar—; al revés volvería el árbol global dependiente de un proyecto. No es expresable en un `CHECK` porque exige mirar el padre, de modo que vive en la operación con su prueba. Es específica del árbol: `BLOCK_02C` no la va a necesitar, porque clase y tipo son planos.

Dos consecuencias del cruce que había que resolver y no estaban anotadas: el recálculo de rutas **lee sin acotar por alcance**, porque renombrar un nodo global cambia la ruta de las ampliaciones que le colgaron los proyectos; y la cuenta de descendencia que protege el borrado también, porque un nodo global con ampliaciones tiene descendencia aunque quien lo mira no la vea.

**No consumió permisos nuevos.** Declarar el alcance usa el de la configuración del proyecto, que es lo que el acto es. No hubo que publicar `mi-common`.

**406 pruebas, 0 fallos.** Quince puras nuevas y tres contra la base.

### Fase 3 — completada

La siembra por copia, con el árbol del despliegue o el de otro proyecto como fuente.

**Lo que la fase decidió, y `B2` no fijaba: la identidad de un nodo es su ruta completa.** De ahí sale todo lo demás, y es lo que distingue copiar un árbol de copiar una lista:

- **sembrar es incremental e idempotente.** Dos veces no duplica, y una fuente parcialmente solapada agrega solo las ramas que faltan, colgándolas de los nodos que el destino ya tiene en lugar de recrearlos;
- **el destino se compara por lo que ve y no por lo que tiene propio**, de modo que nunca se crea una copia propia que tape a una heredada;
- **la fuente es también "lo que la fuente ve"**, con su alcance resuelto, y por eso el despliegue y otro proyecto son una sola regla y no dos.

Y una consecuencia que apareció al probarlo: **el orden importa, y es el natural.** Primero se declara catálogo propio, después se siembra. Un proyecto que todavía hereda ya ve el árbol del despliegue, de modo que sembrárselo no agrega nada — correcto, no defectuoso. Lo descubrió una prueba de integración cuya expectativa era la equivocada.

Dos decisiones menores que quedaron asentadas: **solo se copia lo vigente con ascendencia vigente**, porque la descendencia de un nodo dado de baja no tendría de qué colgar; y **la referencia externa viaja con el nodo**, porque identifica el mismo objeto real y copiarlo sin ella perdería el vínculo que `B7` sostiene.

**La traza son las creaciones más el acto.** Cada nodo copiado emite su creación, con su contexto derivado; la siembra emite además `SeedLocations`, **sin objeto** y deliberadamente: no recae sobre un nodo sino sobre el catálogo, y elegir uno de los creados sería la atribución arbitraria que `DOC_REPLACEMENT` evitó con un tipo propio. Existe por lo que las creaciones no cubren — una siembra que no agrega nada no dejaría rastro.

**435 pruebas, 0 fallos.** Once puras sobre el plan de copia, y una suite de integración nueva con dieciocho casos que verifica contra la base lo que el plan puro no alcanza: que la jerarquía se reconstruya de verdad, que el cruce de alcances se rechace donde corresponde, y que declarar propio nombre las rutas que lo impiden.

### Fase 4 — completada

El atributo en `Document` con su snapshot de ruta, y la configuración de habilitación, obligatoriedad y etiqueta en `DocProjectSettings`. Migración aditiva: nace habilitado y no obligatorio, de modo que todo proyecto sigue operando igual.

**Cuatro precisiones que la fase agregó:**

- **el alcance del documento es una aplicación de `B1`, no una regla nueva.** La validación del nodo elegido y la resolución del catálogo comparten el predicado de visibilidad: una regla, dos usos;
- **deshabilitado no exige**, aunque el proyecto haya quedado con la obligatoriedad marcada. Exigir lo que no se puede declarar sería una contradicción, y es la combinación que una pantalla puede producir sin querer;
- **la baja del nodo se verifica antes que el alcance**, para que el motivo del rechazo sea el que el usuario puede corregir eligiendo otro nodo, y no el que sugiere un problema de configuración;
- **al editar, el alcance se resuelve contra el proyecto del documento** y no contra el del input: cambiar de proyecto no es una edición.

**Y un defecto que encontró una prueba de integración, no el diseño.** El recálculo del snapshot movía el `updatedAt` de cada documento alcanzado, porque Prisma dispara `@updatedAt` también en una actualización masiva. Nadie editó esos documentos, y dejar *"modificado en T por X"* con un X que no hizo nada en T es exactamente el ruido que esta denormalización existe para no producir. Se resuelve con una actualización en SQL de la sola columna, y queda una prueba que lo fija.

`deleteLocation` gana la otra mitad de su condición: ningún documento clasificado, diciendo cuántos. La baja lógica sigue siendo la salida correcta, y no revalida lo existente.

**457 pruebas, 0 fallos.** Once puras nuevas y once casos de integración más.

### Fase 5 — completada

El filtrado, que es para lo que el atributo existe. Tres formas de preguntar sobre el documento —nodo exacto, rama y no clasificados— y la rama también sobre el catálogo, con el mismo `branchOf`.

**Lo que la fase decidió:**

- **la rama se resuelve como conjunto de identificadores y no por prefijo de la ruta**, aunque el snapshot invitara a lo segundo. Dos nodos de alcances distintos pueden tener la misma ruta —el propio de un proyecto y el del despliegue del que salió, después de una siembra— y un filtro por prefijo los mezclaría. El recorrido reutiliza la travesía que ya calcula las rutas: una implementación, una batería de pruebas;
- **la precedencia se declara y no se descubre.** `withoutLocation` gana sobre los otros dos, con la misma forma que `rootsOnly` sobre `parentId` —es el caso especial de *"sin nodo"*—, y la rama gana sobre el nodo exacto porque lo contiene. Enunciada en un solo lugar del código y en el contrato;
- **una rama inexistente devuelve vacío y no devuelve todo**, que es la diferencia entre un filtro que no encuentra y un filtro que se desactiva solo.

El snapshot conserva su razón de ser, que era otra: mostrar y ordenar sin un join, y agrupar cada rama con su descendencia en un listado plano.

**No hubo eventos nuevos.** El alcance de la fase los anticipaba, pero cambiar la ubicación de un documento es una edición ordinaria y `UpdateDocument` ya la registra con su input; el ciclo del catálogo y la siembra los cubrieron las fases 1 a 3.

**467 pruebas, 0 fallos.** Cuatro puras nuevas y seis casos de integración más.

### Fase 6 — completada

La ruta de migración verificada, el control de precondición y la auditoría de los once criterios.

**La migración se verificó en los dos sentidos**: reconstruyendo el estado previo a todo el bloque en una base limpia —veintitrés migraciones— y aplicando encima las cinco del bloque, y también las veintiocho de una sola vez sobre una base vacía. El diff del modelo es **206 líneas agregadas y ninguna eliminada**, que es la evidencia de que el bloque es aditivo y no una promesa.

**`prisma/checks/block02b_precondicion.sql` es el primer control del módulo sin ningún veredicto capaz de cancelar la migración**, y se conserva igual para dejar por escrito por qué: nada se retira ni se renombra, ninguna columna existente cambia de tipo ni de obligatoriedad, y el atributo nace opcional. Lo único que bloquea es una aplicación parcial previa. Probado verde sobre una base pre-bloque y detectando el estado ya aplicado sobre la local.

**Dos discrepancias que encontró `prisma migrate diff` y no la compilación.** Las dos claves nuevas quedaban declaradas con `SetNull` —el default de Prisma en una relación opcional— mientras las migraciones dicen `RESTRICT`. Un `prisma migrate dev` habría "corregido" la base en la dirección equivocada, y borrar un nodo habría **vaciado en silencio la clasificación de cada documento que lo usaba**, que es exactamente lo que el comentario de la migración dice que no debe pasar. Se declara `onDelete: Restrict` en las dos relaciones.

Queda declarada una **deriva anterior** que este bloque no toca: dos claves de `documents` conservan el nombre de las columnas que `BLOCK_03B` renombró a `current*`, y `document_revisions.documentClassId` tiene la misma diferencia de `onDelete`. Son de un bloque ya promovido, y corregirlas es una migración con su propia decisión.

**La auditoría cerró cuatro criterios cubiertos a medias:**

- **el 4 pedía una consulta que no existía.** Se incorpora `locationSeedSources`: los proyectos que el usuario alcanza por membresía vigente **y que tienen catálogo propio**, sin el destino. El segundo filtro evita ofrecer una siembra que no agregaría nada;
- **el 6 tenía una mitad sin probar.** Que el payload de la firma no contenga la ubicación era cierto por construcción; ahora lo fija una prueba. Y la edición con revisión aprobada se prueba de verdad, aprobando la revisión por la base: lo que se verifica es la ausencia de precondición, no el circuito;
- **el 7 se probaba en un solo rol**, y ahora en los tres, que es lo que sostiene que el atributo sea opcional en todos;
- **el 2 comparaba cada siembra por separado** y no que las dos fuentes produjeran el mismo árbol.

Los criterios 10 y 11 quedan del lado del despliegue y del diff: `Area` y `ScannedFile` no registran una sola línea modificada —solo se los menciona en comentarios que explican por qué no se reutilizan— y la línea base de `optimal` se compara con el control de precondición antes y después de migrar.

**473 pruebas, 0 fallos.**

### Fase 7 — completada

**Promovido a la SFS**, en un ámbito propio: `domain/20_classification/`, con dos Objetos del Dominio nuevos —`DocLocation` y `DocCatalogScope`— y sus principios en siete puntos.

El ámbito es propio y no un agregado al ciclo interno por el mismo criterio con que `BLOCK_04` separó la circulación: **clasificar no es identificar**. El código identifica y no cambia, el título describe la emisión y por eso vive en la revisión, y la ubicación clasifica — de modo que se edita siempre, no se congela y no integra el payload de la firma. Meterla en el ciclo habría borrado esa frontera.

Dos documentos existentes se actualizaron por lo que el bloque les cambió: `Document` incorpora la ubicación y su snapshot, con la regla de que se edita siempre; y `DocProjectSettings`, la configuración del atributo, con la distinción de que ahí viven los **valores** y no los **conjuntos**.

**Desplegado y verificado en testing** —`rbb`, `optimal`, `proion`— **y en producción** —`optimal`, `proion`—, con las cinco migraciones aplicadas y los permisos sembrados. El contrato servido por la imagen desplegada da verde en los dos bloques en los cinco despliegues, y los seis permisos de ubicación están repartidos por rol: `doc-basic` con tres, `doc-full` con seis.

**La línea base del subsistema legado quedó intacta, y esta vez medida.** En `optimal` de producción —el único cliente con uso real de `ScannedFile`— se comparó la misma consulta antes y después de migrar y **la diferencia es vacía**: 3.289 archivos escaneados, 52 áreas y 5.124 registros de log, idénticos. `proion` no usa el subsistema legado y da cero en las tres.

Es el criterio 10 **medido** y no argumentado, que es lo que en testing había quedado pendiente. Lo respalda además que las cinco migraciones no mencionan `scanned_files` ni `areas` **ni una sola vez**, verificado sobre su texto.

**Dos controles nuevos quedaron en `210-mi-deploy`**, y los dos por defectos reales de esta sesión:

- `check-document-contract.sh` verifica **por bloque**. Al incorporar este bloque fundí sus operaciones con las de `BLOCK_04` en una lista sola, y el resultado informaba *"la imagen NO tiene BLOQUE 04"* cuando `BLOCK_04` estaba entero y faltaba solo `02B`. Es la clase de salida que manda a diagnosticar el problema equivocado;
- **`check-document-permissions.sh` es nuevo**, y cubre el hueco que ninguna verificación tenía: el contrato en verde no significa operable. El servicio expone la operación aunque ningún rol tenga su permiso, y el primer llamado real devuelve *no estás autorizado*. Mira los dos últimos de los tres pasos del alta de un permiso —el alta y el reparto por rol—, que es exactamente lo que yo mismo olvidé al abrir la fase 1.

**Lo que no se verificó todavía**, y no depende del bloque: las pruebas funcionales de extremo a extremo, que esperan la interfaz de usuario (H-25, `BLOCK_05`).

## Referencias

- `DOCUMENT_EVOLUTION_PLAN.md` — D-14, D-21, D-23, H-36
- `BLOCK_02_CONTEXTO_DE_PROYECTO.md` — `DocProjectSettings`, membresía y autorización en dos capas
- `BLOCK_03_CICLO_INTERNO.md` — B13 y B15, precedencia de configuración y unicidad con nulos
- `212-mi-digitalization/docs/SFS/domain/20_catalog/04_DOM-024_CatalogReference.md`
- `212-mi-digitalization/docs/SFS/domain/20_catalog/01_DOM-021_CatalogSettings.md`
