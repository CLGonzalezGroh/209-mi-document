# Bloque 04 — Emisión y respuesta

**Estado:** `PROMOVIDO_A_SFS`
**Versión:** 1.1
**Depende de:** `BLOCK_02` y `BLOCK_03B`.
**Decisiones que ejecuta:** D-12, D-18, D-22, y las consecuencias de D-09, D-11 y D-19 sobre la circulación.
**Consume lo que dejaron habilitado:** `B16` de `BLOCK_03` —circuito sin elaboración y conclusión terminal— y `B9` de `BLOCK_03B` —qué roles de archivo exige la emisión—.

## Objetivo

Construir lo que le pasa a un documento **después** de aprobarse, cuando hay contraparte: cómo sale, cómo vuelve calificado, y qué habilita esa calificación.

`BLOCK_03` y `BLOCK_03B` dejaron el ciclo interno completo y idéntico en los tres roles. Lo que este bloque agrega es lo único que los distingue: **tener contraparte**. El rol Interno no participa — su ciclo ya terminó al aprobar.

## Qué hereda y qué no toca

El ciclo interno está cerrado y **no se reabre**. Este bloque no cambia cómo se elabora, se revisa, se firma ni se versiona. Toca el circuito en un solo punto, y por una sola causa: en el rol Receptor el circuito **es** el mecanismo con que la planta produce su respuesta, de modo que ahí nace sin elaboración y termina cerrando la revisión. `BLOCK_03` lo dejó habilitado justamente para esto.

## Línea base confirmada

Verificada sobre el código después de `BLOCK_03B`.

- **La circulación no cambió desde `BLOCK_01`.** `src/resolvers/transmittals.ts` conserva sus tres consultas y sus cuatro mutaciones —`createTransmittal`, `issueTransmittal`, `respondTransmittal`, `closeTransmittal`—. El criterio 18 de `BLOCK_03` lo verificó por diferencia y no por declaración.
- **La autorización en dos capas ya está puesta.** `createTransmittal` usa `projectAuthorization` con el `projectId` del input; las otras tres usan `userAuthorization` más `assertObjectAccess` sobre `DocObjectType.TRANSMITTAL`. Es lo que `B7` de `BLOCK_02` estableció, y este bloque lo continúa sin excepciones.
- **`Transmittal` guarda el destinatario por registro**: `issuedTo` como texto, duplicando la contraparte que `DocProjectSettings.counterpartyName` declara desde `BLOCK_02`. `B11` de aquel bloque lo dejó declarado sin resolver, para que no se resolviera de forma implícita.
- **El código es global y no transaccional.** `generateTransmittalCode` lee el último registro por `id` descendente, extrae el número con una expresión regular y suma uno. Se ejecuta **antes** de abrir la transacción, y la unicidad de `code` es global al despliegue, no por proyecto.
- **No hay puerta de emisión.** `createTransmittal` no consulta el estado de las revisiones incluidas: hoy se puede emitir una revisión en `DRAFT`.
- **La respuesta actualiza los ítems por su identificador**, sin comprobar que pertenezcan al transmittal indicado, y registra solo `clientStatus` y `clientComments`. No hay archivos, ni autor distinto del registrante, ni fecha real de la respuesta.
- **`TransmittalStatus.ACKNOWLEDGED` se acepta como estado de origen para responder y ninguna operación lo asigna.**
- **`closeTransmittal` no exige respuestas completas**, y `TransmittalItem` es inmutable desde la creación: no hay operación para agregar ni quitar ítems, ni siquiera en borrador.
- **`PurposeCode` tiene cinco valores y ninguna validación lo consulta.** `ClientStatus` tiene cuatro y vive como enumeración en `TransmittalItem`.
- **Los eventos del transmittal ya existen**: cuatro acciones de auditoría y cuatro transiciones en `src/events/catalog.ts`, todas sobre `DocObjectType.TRANSMITTAL`.
- **El subsistema documental no tiene uso productivo.** Ningún cliente emitió nunca un transmittal, de modo que los cambios incompatibles de modelo y de contrato no rompen consumidores.

## Decisiones ya aprobadas que aplican

- **D-09 / D-19** — el proyecto declara su rol: `ISSUER`, `RECEIVER` o `INTERNAL`. La circulación es asimétrica entre los dos primeros e inexistente en el tercero.
- **D-10** — la revisión es la unidad externa; toda respuesta cierra la revisión emitida y la emisión siguiente lleva revisión nueva.
- **D-11 / `B16`** — el rol Receptor admite **un solo circuito** por revisión, y su calificación la cierra.
- **D-15** — el acceso se acota por membresía de proyecto, con el lado del usuario declarado.
- **D-26** — una palabra por nivel para los estados terminales, y `RevisionStatus.OBSOLETE` eliminado: la respuesta de la contraparte **no es un estado de la revisión**. Su parte confirmatoria —que este bloque no necesitaría ningún estado terminal— **se corrige en `B12`**; lo que sostiene sigue en pie.
- **`B14` de `BLOCK_03`** — `currentRevision` es la última aprobada; `lastRevision`, la última no abandonada.

## Alcance incluido

1. Naturaleza del transmittal y sentido derivado del rol del proyecto.
2. Código propio por proyecto, transaccional, con la referencia del transmittal ajeno.
3. Puerta dura de emisión, y prohibición de transmittals en el rol Interno.
4. El propósito de la emisión con sus dos reglas de comportamiento.
5. La respuesta como objeto propio del ítem, con archivos y autoría diferenciada.
6. El catálogo de calificaciones con su efecto, por despliegue y por proyecto.
7. El acuse de recibo del transmittal.
8. Ítems editables mientras el transmittal está en borrador.
9. El cierre como acto documental explícito.
10. El circuito del rol Receptor: sin elaboración, terminal para la revisión.
11. El documento pendiente de emisión, derivado y no declarado.
12. Migración de modelo y de contrato, y pruebas de las tres capas.

## Fuera de alcance

- **El paquete de información de entrada y su promoción** (D-16, D-20). Se separó como `BLOCK_04B`, por el mismo argumento con que D-20 lo separó del transmittal: reglas disjuntas, archivos sin catalogar en lugar de revisiones, y existencia en los tres roles.
- **La matriz de responsabilidad** (H-36). Queda entre los diferidos: `B16` la dejó como otra fuente de propuesta para el paso de armado, que ya existe y ya admite plantilla. Sin ella, quien recibe asigna los revisores a mano, que es lo que hace hoy.
- **El traslado de la emisión al sistema del cliente**, y la federación entre despliegues. El bloque no debe impedirla y no la construye.
- **El escalón de módulo en la configuración.** Este bloque es enteramente sobre documentos con contraparte, y por lo tanto de proyecto.
- La interfaz de usuario, que corresponde a `BLOCK_05`.

---

## Decisiones del bloque

### B1 — El transmittal declara su naturaleza; el sentido se deriva

Cierra H-29.

D-18 fija que la clasificación relevante **no es la dirección sino el propósito**, y que quedan dos naturalezas, ambas operando sobre revisiones con una sola clase de ítem:

| Naturaleza | Qué es |
| ---------- | ------ |
| `EMISSION` | Entrega de documentación producida |
| `RESPONSE` | Calificación consolidada de una emisión. Referencia necesariamente a la emisión que contesta |

**El sentido no se almacena: se deriva del rol del proyecto y de la naturaleza.** Es el mismo criterio con que D-13 retiró el esquema de revisión del documento — un dato almacenado que puede contradecir a los hechos obliga a inventar una precondición que tape la incoherencia.

| Rol del proyecto | `EMISSION` | `RESPONSE` |
| ---------------- | ---------- | ---------- |
| `ISSUER` | Saliente | Entrante — la práctica histórica |
| `RECEIVER` | Entrante, del contratista | **No existe** |
| `INTERNAL` | **No existe** | **No existe** |

Tres invariantes salen de esa tabla, y ninguna necesita configuración: **un proyecto interno no admite transmittals de ninguna naturaleza** (D-19); **un proyecto en modo Receptor no admite transmittals de respuesta**, porque la planta no consolida su calificación en un remito (D-18); y **un transmittal de respuesta referencia siempre una emisión** del mismo proyecto.

**Consecuencia sobre `issuedTo`.** Cae, y resuelve `B11` de `BLOCK_02` en la dirección que aquel bloque anticipó: hacia `DocProjectSettings`. El destinatario de una emisión es la contraparte del proyecto, que es única (D-15), y guardarla por registro permite que dos transmittals del mismo proyecto declaren destinatarios distintos — que es exactamente la situación que la unidad contractual considera inválida.

### B2 — El código es propio y por proyecto; el ajeno se conserva como referencia

Cierra H-16 y resuelve el hueco que quedaba sobre los transmittals entrantes.

**Dos defectos en el mismo lugar.** La numeración es global al despliegue, cuando el transmittal pertenece a un proyecto; y se calcula fuera de la transacción leyendo el último registro por `id`, de modo que dos emisiones simultáneas obtienen el mismo número.

- **La unicidad pasa a ser `[projectId, code]`**, y la numeración corre por proyecto. Es lo mismo que `BLOCK_02` resolvió para el código del documento con sus dos índices parciales: la unidad de unicidad es el proyecto, porque el proyecto es el contrato;
- **el código se calcula dentro de la transacción**, y **el índice único es el árbitro**: ante colisión se reintenta de forma acotada. No se introduce una tabla de secuencias — la del proyecto es la única secuencia y el índice ya la sostiene.

**Un transmittal entrante tiene dos números, y los dos importan.** El nuestro, que lo identifica en nuestro sistema; y el de la contraparte, que es como ella lo nombra y por el que va a preguntar. **Se conserva como referencia externa**, texto libre y opcional, con el precedente exacto de D-20: *el número de transmittal de la contraparte es un dato del remito ajeno, no un remito propio*.

Vale para los dos casos entrantes: la emisión del contratista en modo Receptor y el transmittal de respuesta del cliente en modo Emisor.

### B3 — La puerta de emisión es dura, y solo existe donde hay emisión saliente

Cierra H-11.

**Todo documento incluido en una emisión saliente debe tener su revisión aprobada.** Sin excepción, cualquiera sea el propósito. Es la función del módulo: garantizar la calidad de lo que sale.

**La puerta se aplica al incorporar el ítem, y no solo al emitir.** Una revisión en circuito no es candidata a salir, de modo que tampoco es candidata a entrar en la carpeta: admitirla en borrador para rechazarla después obliga a armar el transmittal con documentos que van a trabar la emisión, y descubrirlo recién al final. Lo que la puerta gobierna es **qué se puede elegir**, y por eso vive donde se elige.

Se verifica igual al emitir, porque entre una cosa y la otra la revisión puede haber sido abandonada.

**Y el candidato es la revisión aprobada que todavía no salió.** Una revisión se emite **una sola vez**: lo sostiene la unicidad de `documentRevisionId` en el ítem, no una validación. Es un índice sin condiciones porque **solo los transmittals de emisión llevan ítems** (`B5`). Si hay que rehacer la carpeta, se quita el ítem —posible solo en borrador, según `B9`— y la revisión vuelve a estar disponible; emitido el transmittal, ya salió y no puede volver a salir.

Esa unicidad hace además dos cosas que estaban pedidas por separado: **absorbe la puerta de `B7`** —una revisión respondida tampoco vuelve a emitirse, porque ya fue emitida— y **evita que un reintento del emisor duplique la emisión**, que es lo que la orientación sobre federación pide no impedir de antemano.

**Y solo se aplica donde la emisión es saliente**, es decir en modo Emisor:

| Rol | Puerta |
| --- | ------ |
| `ISSUER` | Todas las revisiones del transmittal en `APPROVED` |
| `RECEIVER` | **Ninguna.** El contratista sube documentación ya aprobada por sus propios medios, y la planta no modela su ciclo interno (D-18). No hay estado interno que exigir porque no hubo circuito interno |
| `INTERNAL` | No hay transmittal (`B1`) |

Que en modo Receptor no haya puerta **no es una excepción a la regla sino su consecuencia**: la puerta exige aprobación interna, y ahí adentro no ocurre ninguna.

Con la puerta puesta se cierra además, por construcción, algo que `BLOCK_03` había anticipado: **una revisión abandonada nunca fue emitida**, porque nunca estuvo aprobada.

### B4 — El propósito de la emisión declara qué se espera y qué se exige

`PurposeCode` existe desde el origen del módulo y **ninguna validación lo consulta**. Este bloque le da sus dos primeras reglas, y con eso deja de ser una etiqueta.

**Primera regla — declara si se espera calificación.**

| Propósito | ¿Espera calificación? |
| --------- | --------------------- |
| `FOR_APPROVAL` | Sí |
| `FOR_REVIEW` | Sí |
| `FOR_INFORMATION` | No |
| `FOR_CONSTRUCTION` | No |
| `AS_BUILT` | No |

Es **expectativa y no permiso**: si la contraparte igual responde sobre una emisión informativa, la respuesta se registra. Lo que la regla gobierna es qué está **pendiente**.

Sin ella la bandeja de lo que falta contestar acumula para siempre emisiones que nadie va a responder, y deja de servir para lo único que sirve. Es el mismo mecanismo por el que los pasos de toma de conocimiento quedaban `PENDING` de forma permanente, y por el que `B10` de `BLOCK_03` tuvo que corregir la consulta de pendientes: **una lista de pendientes que incluye lo que nunca va a resolverse no es una lista de pendientes.**

**Segunda regla — declara qué archivos se esperan, y lo advierte.** Es el encargo explícito de `B9` de `BLOCK_03B`: *que el editable se exija recién en la emisión final —apto para construcción, conforme a obra— es una regla real que no se implementa acá; depende del propósito de la emisión*.

| Propósito | Roles esperados en la versión emitida |
| --------- | ------------------------------------- |
| `FOR_CONSTRUCTION`, `AS_BUILT` | Entregable **y** Fuente |
| Los demás | Entregable |

**Es advertencia y no puerta**, a diferencia de `B3`. Por dos motivos, y el segundo es el que decide.

**El caso legítimo existe.** El editable pesa cientos de megabytes o llega en un formato que no viaja por el mismo canal, y se comparte por otro medio. Bloquear la emisión por eso detendría un envío correcto por una condición que la práctica resuelve afuera.

**Y una puerta dura acá sería insatisfacible.** En el momento de emitir, la revisión ya está aprobada: no tiene paso vigente, no admite versiones nuevas (`B5` de `BLOCK_03`) y su versión es inmutable con su conjunto completo (`B6` de `BLOCK_03B`). **No hay forma legal de agregar la fuente que falta.** El sistema exigiría algo que él mismo hace imposible, y las salidas serían todas peores que el problema: abrir una revisión nueva para alojar un archivo que no cambió, o romper la inmutabilidad que la firma acredita.

De ahí el principio, que vale más allá de esta regla:

> **Una puerta solo puede ser dura si existe una manera legal de satisfacerla.** Donde no la hay, corresponde advertir.

La aprobación de `B3` la tiene —se completa el circuito y se emite después—; la fuente faltante, no.

**Por eso la advertencia se adelanta al momento en que todavía sirve.** La ausencia de un archivo de rol Fuente se señala **mientras la revisión está abierta**, que es cuando incorporarlo no cuesta nada: la copia de trabajo está abierta y el conjunto todavía no se confirmó. En la emisión la advertencia se repite, ya sin remedio, y **el hecho queda en la auditoría**: se emitió para construcción sin la fuente. Eso convierte el caso legítimo en un dato registrado en lugar de un silencio.

**Se conserva como enumeración**, por el criterio de D-22 que `B7` de `BLOCK_03B` ya aplicó a los roles de archivo: es catálogo cuando el usuario elige el rótulo, y enumeración cuando el sistema interpreta el efecto. Acá lo interpreta dos veces.

**Declarado como pendiente y no resuelto acá**: si aparece un cliente con su propio juego de propósitos, el tratamiento es el de D-22 —catálogo con código y rótulo del cliente, más un efecto que el sistema interpreta—. No se anticipa, porque hoy no hay evidencia de esa necesidad y los cinco valores actuales cubren la práctica relevada.

### B5 — La respuesta es un objeto propio del ítem

Cierra H-30, H-33 y H-14, y ejecuta D-12.

La respuesta de la contraparte deja de ser dos columnas del ítem y pasa a ser un objeto, con un solo dato obligatorio —la calificación— y todo lo demás opcional:

| Dato | Qué resuelve |
| ---- | ------------ |
| Calificación (`B11`) | El sello. Es el único dato obligatorio |
| Comentarios | Lo que el cliente escribió |
| Archivos devueltos | H-30 — los marcados. **Opcionales**: un rechazo los trae, un sello de aprobado no |
| Quién respondió, **como texto** | D-12: el cliente no es usuario del sistema y no puede serlo |
| Quién la registró, como referencia a `User` | H-33 — el control documental que la transcribe |
| Fecha real de la respuesta | H-33 — la transcripción es siempre posterior |
| Transmittal de respuesta, opcional | D-18 — las dos vías con un solo objeto |

**El último campo es el que unifica las dos prácticas de D-18.** Si la respuesta llegó consolidada en un transmittal de respuesta, lo referencia; si llegó documento a documento —la práctica actual— va nulo. No hacen falta dos mecanismos: la respuesta es siempre del documento, y el transmittal de respuesta es apenas el sobre en que viajó.

**En consecuencia, el transmittal de respuesta no lleva ítems propios: sus ítems son las respuestas.** Es lo que D-18 pide al reducir la circulación a una sola clase de ítem, leído en el sentido correcto — duplicar el ítem sobre la misma revisión crearía dos registros de lo mismo, y chocaría contra la unicidad de `B3` o la debilitaría hasta volverla inútil. El ítem existe una vez, del lado de la emisión, y la respuesta cuelga de él.

**Una respuesta por ítem.** La contraparte califica una emisión una vez.

**H-14 desaparece por construcción.** La respuesta se crea contra el ítem, de modo que no existe la operación que actualizaba ítems por identificador sin verificar a qué transmittal pertenecían.

**Y la bandeja que el usuario pidió sale sola**: el ítem que espera calificación (`B4`) y no tiene respuesta es lo que falta contestar. No hace falta ningún estado que lo declare.

#### La respuesta es corregible

Nadie la firma. El cliente no participa de nuestro circuito, de modo que la inmutabilidad que D-05 impone a la versión y a la firma **no le aplica**: no hay firma que quede acreditando un objeto distinto del que su autor tuvo delante.

Y siendo transcripta a mano en el caso habitual, el error de transcripción es esperable. Exigir que se corrija abriendo otra respuesta produciría dos calificaciones sobre la misma emisión, que es peor.

**Lo que la corrección no puede hacer es borrar que existió**: la auditoría de `BLOCK_01` conserva quién la registró y quién la corrigió, con sus valores.

### B6 — Un archivo que llega de afuera del circuito no es una versión

Es la regla que decide dónde vive el archivo marcado que devuelve la contraparte, y **vale para los dos modos con un solo enunciado**:

> Un archivo producido **dentro** del circuito, por quien tiene el paso vigente, es una **versión**. Un archivo que llega de **afuera** del circuito es **evidencia de una respuesta**.

| Modo | Quién marca | Dónde vive el archivo |
| ---- | ----------- | --------------------- |
| Emisor | El cliente, que no tiene paso ni firma nuestra | En la respuesta del ítem |
| Receptor | El revisor de la planta, que tiene el paso vigente | **Es una versión**, como fija D-10 |

Es la forma de `B16` de `BLOCK_03` aplicada a los archivos: *lo que cambia es dónde vive esa persona*. Una regla, dos resultados.

**Las dos alternativas se descartan por motivos estructurales, no de gusto:**

- **versión posterior a la revisión aprobada** — `B5` de `BLOCK_03` y D-10 lo prohíben. No hay paso vigente, y la firma quedaría acreditando una versión que dejó de ser la última, que es precisamente lo que esa regla existe para impedir;
- **primera versión de una revisión nueva** — obliga a que la revisión nueva exista, y **no siempre existe**: una emisión aprobada para construcción cierra el ciclo sin revisión siguiente. Crearla igual sería consumir un código de revisión para alojar un archivo, contra lo que el módulo decidió dos veces — `B12` de `BLOCK_03` con la revisión abandonada y `B12` de `BLOCK_03B` con la copia de trabajo, que no crea la versión hasta confirmarse.

Hay además un motivo de contenido: **el archivo devuelto no es ninguno de los tres roles de D-25.** No es entregable, no es fuente y no es respaldo. No integra la entrega: es lo que la contraparte dijo sobre la entrega.

**No se copia a la revisión siguiente.** Queda enganchado al ítem y visible desde el documento; quien elabore la revisión siguiente trabaja con él a la vista. Si quiere incorporarlo dentro de la versión nueva como respaldo, lo agrega explícitamente — es una decisión suya y no un automatismo, con el mismo criterio con que la copia de trabajo precarga pero no obliga.

### B7 — La respuesta no cambia el estado de la revisión

Contesta la frontera que `B14` de `BLOCK_03` había dejado abierta y confirma lo que D-26 resolvió al eliminar `RevisionStatus.OBSOLETE`.

**No hay estados nuevos de la revisión.** La revisión emitida permanece en `APPROVED`, y que esté cerrada **se lee de que tiene respuesta**. Un estado que lo declarara sería la segunda máquina de estados sobre el mismo hecho contra la que advierte el §1 de los principios.

En consecuencia, **`currentRevision` sigue siendo la que está en `APPROVED`**, y la lectura que `B14` unificó no cambia de significado. Lo que cierra la vigencia de una revisión sigue siendo lo mismo que antes de este bloque: que se apruebe la siguiente, que la supersede.

**El efecto de la calificación no dispara nada por sí solo.** Que obligue a emitir revisión nueva es información para quien conduce el documento, no una transición automática: abrir la revisión siguiente es un acto posterior y deliberado, como cualquier otro.

Que una revisión respondida no vuelva a emitirse **no necesita regla propia**: la unicidad de `B3` ya lo impide un paso antes, desde que salió la primera vez.

### B8 — El acuse de recibo vive en el transmittal, y no es una calificación

Cierra H-12, que hoy es un estado que ninguna operación asigna.

**Un acuse no dice nada sobre el documento: dice que el envío llegó.** Por eso no entra en el catálogo de calificaciones, y hay una prueba limpia de ello en el propio D-22: sus efectos declaran que **la cuarta combinación no existe** —*si el documento no sirve, hay que volver a emitirlo*— y un acuse cae exactamente ahí, sin habilitar nada y sin obligar a nada. Forzarlo adentro rompería la regla que les da sentido a los dos efectos, y dejaría una entrada que la ingeniería no puede interpretar aguas abajo.

Va, entonces, **en el transmittal**, con la misma autoría diferenciada de `B5` y por el mismo motivo de D-12: quién acusó como texto, quién lo registró como referencia a `User`, y la fecha real frente a la de registro.

**Solo tiene sentido en modo Emisor**, donde la emisión viaja afuera y no se sabe si llegó. En modo Receptor el contratista carga el transmittal dentro de nuestro sistema: no hay nada que acusar, y el acto equivalente es la confirmación de la recepción de `B12`. Declararlo evita que se implemente un estado que en ese modo no significa nada.

El acuse **no es precondición de la respuesta**: hoy `respondTransmittal` ya admite `ISSUED` o `ACKNOWLEDGED`, y eso se conserva. Un cliente puede responder sin haber acusado nunca.

### B9 — Los ítems se editan mientras el transmittal está en borrador

Cierra H-13.

**En borrador se agregan y se quitan ítems; emitido, el contenido queda fijo.** Es el mismo corte que `B3` aplica a la puerta, por la misma razón: lo que salió no se puede cambiar, porque la carátula que la contraparte recibió declara un contenido.

**Se ejecuta en la fase 3 y no en la 5**, donde estaba agendado. El motivo es que `B3` formula la puerta *al incorporar el ítem*, y sin esta operación el único momento en que un ítem se incorpora es la creación: la regla quedaba escrita para un caso que no podía probarse. Acá tiene su caso propio, y con él la contracara de la unicidad —**quitar el ítem libera la revisión**— que tampoco era demostrable de otro modo.

Corregir una emisión ya salida no es editarla: es emitir otra. El módulo ya tiene esa forma en dos niveles —la versión no se modifica, la revisión aprobada tampoco— y este es el tercero.

### B10 — El cierre es un acto documental explícito

Cierra H-15, resolviendo la pregunta que D-18 había dejado abierta entre cierre derivado y cierre explícito.

**Explícito, con motivo opcional, y sin exigir respuestas completas.** D-18 ya fija por qué: las respuestas parciales son la práctica normal y el cierre no condiciona el avance de ningún documento. Un cierre derivado de que todos los ítems tengan respuesta nunca ocurriría en la práctica, y volvería inútil el estado.

**Lo que sí cambia es qué se puede mostrar.** Con `B4`, el transmittal sabe cuántos de sus ítems esperaban calificación y cuántos la tienen: *faltan 3 de las 5 que esperaban respuesta* en lugar de *faltan 3 de 8*. Esa lectura se deriva y no se almacena.

**Cerrar no impide registrar una respuesta posterior.** Cerrar declara que se dejó de esperar, no que se dejó de escuchar: una calificación tardía se registra igual, sobre un transmittal cerrado. Prohibirlo obligaría a reabrir para asentar un hecho que ya ocurrió.

### B11 — La calificación es un catálogo con efecto interpretado

Ejecuta D-22.

`ClientStatus` es hoy una enumeración fija de cuatro valores. **Se reemplaza por un catálogo**, porque cada cliente tiene su propio juego de calificaciones, con sus códigos y su cantidad, y el rótulo que el usuario ve es el del cliente y no una traducción nuestra.

Cada entrada declara **código**, **rótulo** y **efecto**. Los dos primeros son lo que el usuario ve; el efecto es lo único que el sistema interpreta.

**El efecto se modela como enumeración de tres valores y no como dos indicadores**, resolviendo el pendiente de D-22:

| Efecto | ¿Habilita usar el documento? | ¿Obliga a emitir revisión nueva? | Calificación habitual |
| ------ | ---------------------------- | -------------------------------- | --------------------- |
| `ACCEPTED` | Sí | No | Aprobado, revisado sin objeción |
| `ACCEPTED_WITH_COMMENTS` | Sí | **Sí** | Aprobado con comentarios |
| `REJECTED` | **No** | Sí | Rechazado |

Las dos preguntas se conservan como **lectura derivada** —son lo que explica por qué *aprobado con comentarios* no es ni una cosa ni la otra— pero no como almacenamiento. Con dos indicadores, la cuarta combinación que D-22 declara inexistente **puede escribirse en la base** y hay que impedirla por validación. Con la enumeración no puede expresarse. Es el criterio de D-13 aplicado a otro atributo: *sin atributo, la incoherencia no puede existir*.

**Alcance: despliegue y proyecto, sin herencia.** El proyecto que no declara calificaciones usa las del despliegue; el que declara alguna, usa **las suyas y solo las suyas**.

Es una diferencia deliberada con D-21, y conviene enunciarla porque las dos son catálogos con alcance por proyecto. Allá el proyecto puede heredar el catálogo del módulo y ampliarlo, porque una clase documental de más no molesta a nadie. Acá no: **la lista de calificaciones es la del contrato**, y una lista mezclada —cuatro del despliegue más tres del cliente— no es la de nadie y admite calificar con un valor que la contraparte no usa.

**Confirma el pendiente que el plan había anotado**: el catálogo de calificaciones **no necesita escalón de módulo**. La calificación es de la contraparte; sin contraparte no hay calificación, y sin proyecto no hay contraparte.

**Sirve a los dos modos con el mismo catálogo**, que es la razón para modelarlo una sola vez: en Receptor la planta emite la calificación al cerrar el circuito, en Emisor el control documental transcribe la que el cliente devolvió.

**Reemplaza a `ClientStatus`, sin etapa de convivencia**, resolviendo el otro pendiente de D-22. No hay datos productivos, de modo que convivir solo obligaría a sostener dos vocabularios y a decidir cuál gana. El despliegue se siembra con las cuatro entradas actuales como valores por defecto, que es lo que preserva la práctica relevada.

**Orden explícito y baja lógica.** El orden lo declara la entrada, porque es el de la lista del cliente y no el alfabético. La baja es lógica: una calificación usada no se elimina, y lo ya calificado no se revalida — es la orientación de D-13, la validación ocurre solo en escritura.

### B12 — El circuito del rol Receptor

Ejecuta lo que `B16` de `BLOCK_03` dejó habilitado y no implementó.

En modo Receptor **el transmittal precede a la revisión**, porque lo que se califica es la emisión ya recibida (D-09). El circuito no es el ciclo interno: es el mecanismo con que la planta produce su respuesta.

La secuencia completa:

1. **el contratista da de alta el documento, o toma uno que la planta ya declaró** (`B13`), y crea el transmittal entrante con sus archivos. La revisión nace con su versión, por el recorrido del documento preexistente que D-10 admite;
2. **quien recibe confirma la recepción y designa los revisores.** Es el acto que en modo Emisor cumple el acuse, y el punto donde D-18 prevé que la matriz de responsabilidad **proponga** los revisores cuando exista;
3. **el circuito se instancia sin paso de elaboración**, habilitado por `B3` de `BLOCK_03`: el documento llega elaborado desde afuera y no hay a quién asignarle esa tarea;
4. **la conclusión es terminal para la revisión.** Se apruebe o se rechace, la calificación cierra la revisión y **no se abre un circuito nuevo**: no hay a quién devolverle el trabajo, porque quien elabora está afuera (D-11);
5. **la calificación se registra en la respuesta del ítem** (`B5`), producida por el circuito en lugar de transcripta. Es lo que el contratista lee, y lo que la orientación sobre federación pide que sea legible por quien emitió;
6. **la emisión siguiente lleva revisión nueva**, en un transmittal nuevo.

**No hay acto de armado del lado de la planta.** Quién revisa y quién califica está **predefinido**, de modo que emitir el transmittal entrante arma el circuito de cada documento y somete su revisión, en el mismo acto y sin intervención.

El mecanismo ya estaba construido y sin usar: **`DocWorkflowTemplate` resuelve su alcance por proyecto, clase y tipo, con actores preasignados**, y al crear el documento el sistema ya deja adherida al circuito la plantilla aplicable. En proyectos, **clase significa disciplina** —el nombre es genérico para que otros módulos clasifiquen con otro criterio—, de modo que la plantilla **es** la matriz de responsabilidad para los ejes que hoy existen. Lo que la matriz diferida agregaría es el **área**, que depende de D-14.

El argumento de por qué el sistema puede resolver ese armado es de D-03: el armado siempre tiene contenido **porque el elaborador nunca se preasigna**. Acá no hay elaborador, así que con la plantilla completa queda literalmente vacío. Se resuelve **por sistema**, con `resolvedById` nulo, en lugar de atribuirle el acto al contratista que emitió.

**Y queda una red.** Si el proyecto no tiene plantilla, o alguno de sus pasos no declara actor, ese documento conserva su armado pendiente y la planta lo resuelve a mano; el resto del transmittal avanza igual. Se descartó rechazar la emisión: dejaría al contratista trabado por una configuración que él no puede corregir, con el documento ya listo para entrar.

**El desenlace del paso se deriva del efecto de la calificación** y no al revés: `REJECTED` rechaza el paso, los otros dos lo aprueban. Es lo que D-22 pide al conservar el desenlace binario del circuito — la lógica del circuito no se ramifica, y la calificación es lo que el usuario elige y la interfaz muestra. La operación elegida no puede contradecir al efecto: sin esa verificación el circuito quedaría diciendo lo contrario que la respuesta que la contraparte lee.

#### La revisión rechazada necesita estado propio, y D-26 se corrige

Al implementarlo apareció lo que la confirmación de D-26 no podía prever. **En modo Receptor el rechazo concluye la revisión**, y ninguno de los estados existentes sirve: `DRAFT` la deja bloqueando la emisión siguiente —`createRevision` no admite abrir otra mientras haya una en curso, que es H-01 otra vez—, `APPROVED` sería falso, `ABANDONED` **libera el código** y esta revisión salió con el suyo, y `SUPERSEDED` es el efecto de aprobar la siguiente.

`RevisionStatus` incorpora **`REJECTED`**. No es el `OBSOLETE` que `BLOCK_03B` retiró —obsoleto es lo que dejó de aplicar— y **consume código**, de modo que el índice único parcial, que excluye solo a las abandonadas, sigue contándola sin cambios.

**La secuencia sigue de largo en los tres desenlaces.** Aprobada, aprobada con comentarios o rechazada: si hay revisión posterior, lleva código nuevo, y rechazada la `A` la siguiente es la `B`. Que el rechazo no implique avance contractual —no se certifica— es un asunto del progreso del proyecto y no del código de revisión, que solo describe cuántas veces salió el documento.

Lo que D-26 sostiene no se toca: la respuesta de la contraparte no es un estado de la revisión. `REJECTED` expresa la conclusión del **circuito**, que en este rol es interno a la planta; en modo Emisor la revisión emitida sigue sin moverse (`B7`).

**Las marcas de la planta son versiones** (`B6`), producidas por quien tiene el paso vigente, como en cualquier circuito.

### B13 — No hay documento esperado: hay documento, y pendiente es el que no salió

Cierra H-31 **sin incorporar ningún concepto nuevo**, que es lo contrario de lo que D-09 anticipaba al anotarlo como *un concepto nuevo, sin correlato en el modelo actual*.

**Todo documento dado de alta en el proyecto es un documento esperado.** El que aparece después del alcance inicial, por una necesidad que el proyecto descubrió sobre la marcha, también lo es: nació más tarde, no es de otra clase. La distinción entre esperado y adicional describe **cuándo apareció**, no **qué es**, y el momento ya lo registra la auditoría de `BLOCK_01`.

De ahí que no haya dos tipos de documento ni un objeto de expectativa. Hay documento, y **pendiente es el que todavía no salió**:

| Rol | Qué significa pendiente |
| --- | ----------------------- |
| `ISSUER` | La revisión está aprobada y todavía no se emitió |
| `RECEIVER` | El contratista todavía no lo entregó en ningún transmittal |
| `INTERNAL` | No aplica: no hay emisión, y el ciclo termina al aprobar |

**No hace falta ningún atributo, porque la condición ya está en el modelo**: es la ausencia de un ítem de transmittal para la revisión. La misma relación que `B3` acaba de volver única sirve, leída al revés, para saber qué falta salir. Es el criterio con que este bloque ya resolvió el sentido de la circulación (`B1`) y con que D-24 derivó la causa de la obsolescencia: **lo derivable no se almacena**.

**Y en modo Emisor la lista de pendientes es la misma consulta de candidatos de `B3`.** Lo que el control documental necesita ver para armar el próximo transmittal y lo que necesita ver para saber qué debe todavía es, literalmente, lo mismo.

#### Lo que esto exige, y que ya está resuelto

**Que la planta pueda dar de alta el documento antes de que exista su archivo.** Ya se puede: `BLOCK_03` retiró la exigencia de archivo en el alta al cerrar H-20, porque el archivo pasó a ser el producto de la elaboración. Un documento con su revisión en borrador y sin versión es un estado legítimo desde entonces, y es exactamente lo que en modo Receptor significa *lo declaré y todavía no llegó*.

**Que dé lo mismo quién lo dio de alta.** La planta lo declara por contrato, o el contratista lo crea al entregarlo. En los dos casos es el mismo objeto con el mismo ciclo; el armador sale del valor por defecto que `DocProjectSettings` declara, que es del lado de la planta, de modo que un documento creado por el contratista no designa personal ajeno.

**Y que el circuito no se instancie dos veces.** El paso de armado de la revisión ya existe desde el alta, y **la confirmación de la recepción de `B12` es lo que lo completa**, designando los revisores. No es un acto nuevo que se agrega al circuito: es el paso que el circuito ya tenía, resuelto en el momento en que hay algo que repartir.

**Se descartó el objeto de expectativa** que este bloque había planteado primero. Habría creado dos identidades para la misma cosa —una expectativa con código previsto y un documento con código— y un acto de promoción entre ambas, para representar una diferencia que no existe en el trabajo real.

---

## Cambios de modelo

| Objeto | Cambio |
| ------ | ------ |
| `Transmittal` | `+ nature`; `+ respondsToTransmittalId`; `+ counterpartyReference`; `+ closedAt`, `closedById`, `closeReason`; `+ acknowledgedBy` (texto), `acknowledgedById`, `acknowledgedAt`, `acknowledgeRegisteredAt`; `− issuedTo`; `− responseAt`, `responseComments`; unicidad `[projectId, code]` en lugar de `code` global |
| `TransmittalItem` | `− clientStatus`, `− clientComments` (pasan a la respuesta); `documentRevisionId` pasa a ser **único a secas**, en reemplazo de `[transmittalId, documentRevisionId]` — una revisión se emite una sola vez (`B3`), y solo los transmittals de emisión llevan ítems (`B5`) |
| `DocTransmittalResponse` | **Nuevo.** Uno por ítem: calificación, comentarios, quién respondió como texto, quién registró, fecha real y de registro, transmittal de respuesta opcional |
| `DocResponseFile` | **Nuevo.** Archivos devueltos por la contraparte, colgando de la respuesta |
| `DocQualification` | **Nuevo.** Catálogo: código, rótulo, efecto, orden, alcance por proyecto o de despliegue, baja lógica |
| `TransmittalNature` | **Nueva enumeración**: `EMISSION`, `RESPONSE` |
| `QualificationEffect` | **Nueva enumeración**: `ACCEPTED`, `ACCEPTED_WITH_COMMENTS`, `REJECTED` |
| `ClientStatus` | **Se elimina.** Reemplazada por el catálogo |
| `TransmittalStatus` | Se conserva. `ACKNOWLEDGED` gana su operación |
| `PurposeCode` | Se conserva como enumeración, con comportamiento asociado (`B4`) |
| `DocObjectType` | `+ TRANSMITTAL_ITEM`, `+ DOC_TRANSMITTAL_RESPONSE`, `+ DOC_QUALIFICATION` |

## Cambios de contrato

- **`respondTransmittal` deja de existir** como operación que actualiza ítems en lote. Se reparte en **registrar la respuesta de un ítem** —la vía documento a documento, que es la práctica actual— y **registrar un transmittal de respuesta** que agrupa varias, la vía histórica. Ambas producen los mismos objetos.
- **Nuevas**: `acknowledgeTransmittal`, `addTransmittalItem` / `removeTransmittalItem`, `correctTransmittalResponse`, y el ABM del catálogo de calificaciones.
- **`createTransmittal`** pierde `issuedTo` y gana la naturaleza y la referencia externa.
- **Consultas nuevas**: revisiones candidatas a emitir —aprobadas y no emitidas—, ítems pendientes de calificación por proyecto, y documentos pendientes de emisión o de entrega según el rol (`B13`).
- **La advertencia de archivos faltantes se expone en el contrato**, sobre la revisión y sobre el ítem, y no se deriva en cada consumidor. Es el criterio del §13 que `B14` de `BLOCK_03` ya aplicó a las dos lecturas de la revisión: una condición que la interfaz tiene que mostrar en dos momentos distintos se resuelve en un solo lugar.
- **Advertencia de `BLOCK_03`**, registrada como aprendizaje: al renombrar o retirar un campo del contrato no alcanza con `rover subgraph check` y `tsc`. Hay que **buscar el nombre viejo en la webapp**, incluidos los artefactos de `codegen`.

## Migración

El subsistema no tiene uso productivo y las tablas de circulación están vacías, de modo que los cambios se aplican de forma directa, sin etapas de compatibilidad ni backfill. **Se verifica el supuesto contra las bases de cada cliente antes de migrar**, con una consulta de solo lectura, como en los bloques anteriores.

El catálogo de calificaciones se siembra con las cuatro entradas que `ClientStatus` tenía, en el alcance del despliegue.

## Criterios de aceptación

1. Un proyecto interno rechaza la creación de cualquier transmittal.
2. Un proyecto en modo Receptor rechaza la creación de un transmittal de respuesta.
3. Un transmittal de respuesta sin emisión referenciada se rechaza; con una emisión de otro proyecto, también.
4. **Incorporar** al transmittal una revisión no aprobada se rechaza en modo Emisor, cualquiera sea el propósito; emitir vuelve a verificarlo, para el caso de que la revisión se haya abandonado mientras tanto.
5. Una revisión ya incluida en un ítem no vuelve a ser candidata; quitar el ítem, posible solo en borrador, la libera. Un segundo intento de emitirla falla por unicidad y no por validación.
6. Emitir con propósito `FOR_CONSTRUCTION` sin archivo de rol Fuente **se admite**, produce advertencia y queda registrado en la auditoría.
7. La misma advertencia aparece mientras la revisión está abierta, con la copia de trabajo todavía sin confirmar.
8. En modo Receptor, crear el transmittal entrante con revisiones en borrador se admite.
9. Dos transmittals creados de forma concurrente en el mismo proyecto obtienen códigos distintos y consecutivos; dos proyectos distintos pueden tener el mismo código.
10. Un transmittal de respuesta no crea ítems propios: sus respuestas apuntan a los ítems de la emisión que contesta.
11. Registrar una respuesta sobre un ítem de otro transmittal es imposible por construcción.
12. Una respuesta sin calificación se rechaza; sin archivos, se admite.
13. Corregir una respuesta conserva en la auditoría el valor anterior y el actor de la corrección.
14. La respuesta no altera el estado de la revisión, y `currentRevision` devuelve la misma revisión antes y después.
15. Un ítem con propósito `FOR_INFORMATION` no figura entre los pendientes de calificación.
16. Cerrar un transmittal con respuestas parciales se admite; registrar una respuesta sobre uno cerrado, también.
17. Un proyecto sin calificaciones propias resuelve las del despliegue; con una propia, resuelve solo las suyas.
18. Una calificación de efecto `REJECTED` deja el paso del circuito en rechazado, en modo Receptor.
19. En modo Receptor el circuito se instancia sin paso de elaboración, y su conclusión no abre un circuito nuevo.
20. En modo Emisor, el documento con revisión aprobada y sin emitir figura como pendiente, y es el mismo conjunto que la consulta de candidatos de `B3`. En modo Receptor, el documento dado de alta y nunca incluido en un transmittal figura como pendiente, sin importar quién lo creó.
21. Cada operación del bloque emite sus eventos de auditoría y de transición **dentro de la misma transacción** del cambio, según `B3` de `BLOCK_01`.
22. Ninguna regla del ciclo interno cambió, **verificado por diferencia** entre el commit que abre el bloque y el que lo cierra. `revisions.ts`, `versions.ts`, `workingCopies.ts`, `replacements.ts` y `stepSignature.ts` no registran **una sola línea** de cambio. Dos excepciones, ambas declaradas: `workflows.ts`, por `B12`, y `documents.ts`, que suma la consulta de pendientes de `B13` y **solo agrega** — ninguna línea retirada ni modificada.

## Fases

| Fase | Contenido |
| ---- | --------- |
| 1 | Catálogo de calificaciones, con su alcance y su siembra (`B11`) |
| 2 | Naturaleza, sentido derivado, código por proyecto y referencia externa (`B1`, `B2`) |
| 3 | Puerta de emisión, reglas de propósito e ítems en borrador (`B3`, `B4`, `B9`) |
| 4 | La respuesta como objeto, con archivos, autoría y corrección (`B5`, `B6`, `B7`) |
| 5 | Acuse y cierre (`B8`, `B10`) |
| 6 | Circuito del rol Receptor (`B12`) |
| 7 | Documento pendiente, derivado, y su consulta por rol (`B13`) |
| 8 | Migración, contrato y pruebas de las tres capas |

El catálogo va primero porque la respuesta lo referencia, y el circuito del Receptor va después de la respuesta porque la produce.

## Lo que este bloque no resuelve

- **Si la respuesta directa del cliente exige que sea usuario con alcance restringido al proyecto** (D-12). El objeto de respuesta no lo prejuzga: el autor es texto y no referencia a `User`, de modo que ambas vías siguen abiertas.
- **El propósito como catálogo del cliente** (`B4`), si aparece la necesidad.
- **La matriz de responsabilidad**, que propondría los revisores del paso 2 de `B12`.
- **El paquete de información de entrada**, que es `BLOCK_04B`.
- **El escalón de módulo en la configuración.** Este bloque carga `DocProjectSettings` y el catálogo de calificaciones con configuración específica de contraparte, que es exactamente la evidencia que el plan quería tener a la vista antes de abrir ese bloque.

---

## Cierre

**Promovido a la SFS.** El comportamiento del bloque se incorporó en un ámbito propio, `domain/15_circulation/`, con cuatro Objetos del Dominio nuevos —`Transmittal`, `TransmittalItem`, `DocTransmittalResponse` y `DocQualification`— y sus principios en doce puntos.

El ámbito es propio y no un agregado al ciclo interno porque el bloque introdujo objetos que no le pertenecen: mezclarlos habría vuelto a borrar la frontera que D-18 estableció. El ciclo interno no sabe de transmittals, y la circulación no reabre el circuito salvo en el único punto donde el circuito **es** el mecanismo de respuesta.

Cuatro documentos del ciclo interno se actualizaron por lo que este bloque les cambió: `DocumentRevision` incorpora su estado terminal por rechazo de la contraparte y la regla de que consume código; `ReviewWorkflow` y `ReviewStep`, la conclusión terminal y la calificación exigida al cerrar en el rol Receptor; y `Document`, la lectura de documento pendiente.

**Desplegado y verificado.** Testing —`rbb`, `optimal`, `proion`— y producción —`optimal`, `proion`— sirven el contrato del bloque, con las ocho migraciones aplicadas y los permisos sembrados. La línea base del subsistema legado de `optimal` quedó intacta, comparada entre dos corridas del mismo control antes y después de migrar: 3.289 archivos escaneados, 52 áreas y 5.124 registros de log.

**Lo que no se verificó todavía**, y no depende del bloque: las pruebas funcionales de extremo a extremo, que esperan la interfaz de usuario (H-25, `BLOCK_05`).

