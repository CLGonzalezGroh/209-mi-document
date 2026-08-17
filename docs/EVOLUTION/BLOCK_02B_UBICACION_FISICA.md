# Bloque 02B — Ubicación física del documento

**Estado:** `APROBADO_PENDIENTE`
**Versión:** 1.0
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
- **sembrar solo agrega**: toma las entradas de la fuente cuyo código no exista en el destino, y nunca quita ni modifica. Se admite más de una vez, no exige que el destino esté vacío, y sembrar dos veces no duplica;
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

## Referencias

- `DOCUMENT_EVOLUTION_PLAN.md` — D-14, D-21, D-23, H-36
- `BLOCK_02_CONTEXTO_DE_PROYECTO.md` — `DocProjectSettings`, membresía y autorización en dos capas
- `BLOCK_03_CICLO_INTERNO.md` — B13 y B15, precedencia de configuración y unicidad con nulos
- `212-mi-digitalization/docs/SFS/domain/20_catalog/04_DOM-024_CatalogReference.md`
- `212-mi-digitalization/docs/SFS/domain/20_catalog/01_DOM-021_CatalogSettings.md`
