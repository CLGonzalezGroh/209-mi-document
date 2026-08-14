# Bloque 03B — Qué le pertenece a cada nivel

**Estado:** `APROBADO_PENDIENTE`
**Versión:** 1.0
**Depende de:** `BLOCK_02` y `BLOCK_03`, cuyo modelo revisa. Precede a `BLOCK_04`.
**Decisiones que ejecuta:** D-23, D-24, D-25, D-26, D-27.
**Revisa:** `B4`, `B5`, `B6` y `B11` de `BLOCK_03`, y la unicidad del código de `BLOCK_02`.

## Objetivo

Corregir la titularidad de tres datos que hoy están en el nivel equivocado o con la cardinalidad equivocada:

| Dato | Hoy | Objetivo |
| ---- | --- | -------- |
| Metadata de identificación | Del documento, congelada por regla de comportamiento | De la revisión, congelada por estructura |
| Código | Del documento, editable como cualquier campo | Del documento, **inmutable** salvo ventana de corrección |
| Archivo | La versión **es** un archivo | La versión es un **conjunto** de archivos entregados en un mismo acto |

Los tres son la misma pregunta —a qué nivel pertenece cada dato— y por eso se resuelven juntos.

## Por qué es un bloque propio y no una corrección dentro de otro

`BLOCK_03` está `PROMOVIDO_A_SFS`: su comportamiento ya está implementado, validado y publicado en la especificación vigente. Reabrirlo confundiría lo que se relevó con lo que se decide ahora.

Y estos cambios no pertenecen a `BLOCK_04`. La emisión al cliente da por sentado qué acredita una firma y qué compone un entregable; si esas dos cosas se mueven durante `BLOCK_04`, la puerta de emisión se especifica sobre un piso inestable. Por eso el bloque va **antes**.

Conserva el sufijo por el mismo criterio que `BLOCK_02B` y `BLOCK_02C`: no renumerar bloques ya referenciados.

### Y por qué no se parte en dos

Se evaluó separar la titularidad de la metadata y del código, por un lado, de la composición de la versión, por el otro. **Se descarta**, por dos razones.

**La firma es el punto donde ambas mitades se juntan.** `B8` cambia el payload por las dos causas a la vez: el snapshot de identificación pasa a leerse de la revisión (`B1`) y la versión pasa a ser un conjunto (`B6`). Partido, el formato del payload se rompería **dos veces**, con dos valores sucesivos de `payloadVersion` y dos formas históricas que verificar para siempre. Es exactamente el costo que el módulo se negó a pagar cuando reservó un valor de enumeración *"para no pagar dos migraciones"*.

**Y el tamaño no lo justifica.** `BLOCK_03` cerró con dieciséis decisiones y ocho fases; doce decisiones no es un bloque grande para este plan. Lo que hace falta no es partirlo sino secuenciarlo, que es lo que resuelven las fases.

## Línea base confirmada

Verificada sobre el código después de `BLOCK_03`.

- **La metadata vive en `Document`**: `code`, `title`, `description`, `documentTypeId`, `documentClassId` en `documents`. El congelamiento de `B6` es una precondición de la operación de actualización, no una propiedad del modelo.
- **El código tiene dos índices únicos parciales** creados en SQL: `documents_code_projectId_key` para la documentación en circulación y `documents_code_module_key` para la publicada. No existe ninguna restricción sobre su modificación.
- **La versión es un archivo**: `document_versions` lleva `fileKey`, `fileName`, `fileSize`, `mimeType` y `checksum` en línea, con `@@unique([revisionId, versionNumber])`. `registerVersion` recibe esos cinco datos como un objeto plano.
- **La firma ya prevé el cambio de forma.** `SIGNATURE_PAYLOAD_VERSION` existe en `src/utils/stepSignature.ts` exactamente para esto: *"sin ella, un cambio futuro en la forma del payload dejaría las firmas viejas indistinguibles de las nuevas"*. Hoy vale `1`.
- **El payload firma un solo archivo**: `version: { id, versionNumber, fileKey, checksum }`, más el snapshot de metadata `document: { id, code, title, documentClassId, documentTypeId }`.
- **`canonicalize` ordena claves pero no arreglos** (`value.map(canonicalize)`). Un payload con una lista de archivos exige que la lista se construya en orden determinístico antes de serializar.
- **El subsistema documental no tiene uso productivo**, según la línea base del plan. Los cambios incompatibles de modelo y de contrato no rompen consumidores.

## Decisiones ya aprobadas que aplican

- **D-05** — la firma acredita quién y qué, sobre datos verificables y persistidos.
- **D-10** — la revisión es la unidad externa y la versión la iteración interna.
- **B4 de `BLOCK_03`** — la versión no se modifica ni se elimina. **Se conserva**; cambia su cardinalidad, no su inmutabilidad.
- **B6 de `BLOCK_03`** — la metadata se congela con la revisión aprobada. **Se conserva el efecto** y cambia su fundamento.
- **B12 de `BLOCK_03`** — la revisión abandonada no consume código.
- **B14 de `BLOCK_03`** — revisión vigente y revisión en curso, resueltas en un solo lugar. Este bloque las reutiliza para la metadata.

## Alcance incluido

1. La metadata de identificación como atributo de la revisión.
2. La metadata efectiva del documento como copia de la revisión en curso.
3. El código como identificador inmutable, con ventana de corrección acotada.
4. El reemplazo entre documentos del mismo ámbito, como acto N:M con motivo.
5. La obsolescencia del documento, por reemplazo o por salir del alcance.
6. El vocabulario de los estados terminales, una palabra por nivel.
7. La versión como conjunto de archivos, con rol por archivo.
8. La copia de trabajo, y la versión producida al confirmarla.
9. La firma acreditando el conjunto completo, con `payloadVersion` 2.
10. Migración de datos y de contrato, y pruebas de las tres capas.

## Fuera de alcance

- **Qué roles de archivo son obligatorios y cuándo.** Depende del propósito de la emisión, que el modelo todavía no tiene. Corresponde a `BLOCK_04` (B9).
- **La recodificación masiva** por cambio del esquema de codificación del cliente. Se resolvió no implementarla: la posibilidad queda abierta, ninguna operación la ofrece.
- **El destino de `Attachment`**, diferido por D-08. Los roles de archivo de este bloque viven dentro de la versión y no lo reemplazan, aunque `B7` le retire el caso de uso que más lo apuraba.
- **La promoción de documentos al activo al cierre del proyecto**, que es linaje entre revisiones y no reemplazo (`B10`). Pertenece al módulo de activos.
- **La obsolescencia por decomisionamiento** de una parte de la planta. Es una causa que este módulo no conoce, y vive donde vive el activo.
- La interfaz de usuario, que corresponde a `BLOCK_05`.

---

## Decisiones del bloque

### B1 — La metadata de identificación pertenece a la revisión

El §6 de los principios justifica el congelamiento por un motivo **material**: parte de la metadata está impresa dentro del archivo. El rótulo lleva el código, el título y a menudo la clase y el tipo.

Si el dato está impreso en el archivo, pertenece a la emisión que produjo ese archivo. Ubicarlo en el documento obliga a sostener por regla de comportamiento —"editable mientras no esté aprobada"— algo que la estructura puede sostener sola: **una revisión aprobada no se modifica, y con eso el congelamiento deja de necesitar enunciado.**

Pasan a la revisión: **título, clase y tipo**. Se copian de la revisión anterior al crearse la nueva, y se editan libremente mientras esté abierta.

Quedan en el documento, editables siempre: **descripción, ámbito y vínculos**. Ninguno aparece en el rótulo, y hoy el congelamiento los alcanza sin causa: corregir una descripción no debe exigir abrir una revisión.

El código no pasa a la revisión. Ver `B3`.

**Qué resuelve además.** DOM-005 admite hoy una anomalía en sus Observaciones: *"Abandonar una revisión no revierte la metadata que se cambió mientras estaba abierta. El documento queda declarando algo que ninguna revisión aprobada reproduce"*. Con la metadata en la revisión, la anomalía desaparece sin regla compensatoria: lo que se editó en la revisión abandonada se abandona con ella.

**Y habilita comparar.** Qué cambió entre la revisión B y la C —el título, la clase— pasa a ser información consultable. Hoy no existe.

### B2 — El documento conserva la metadata efectiva como copia de la revisión en curso

Mover el dato no significa vaciarlo del documento. `Document` conserva el título, la clase y el tipo, pero **como copia y no como dato propio**: su único escritor es la transición de la revisión.

| Acto | Efecto sobre la copia |
| ---- | --------------------- |
| Editar la metadata con la revisión abierta | Escribe en la revisión y se replica |
| Aprobar | Ninguno: ya estaba replicada |
| Abandonar la revisión | Se recalcula desde la nueva revisión en curso —que es la aprobada— y **la metadata vuelve sola** |

La alternativa —quitarla del documento y resolverla por join— se descarta: obligaría a todo listado, filtro y búsqueda a consultar la revisión efectiva, sin comprar nada que la copia no dé.

**Aparecen dos lecturas, y son las que `B14` ya definió.** Metadata **vigente** es la de la última aprobada, lo que dice el rótulo que salió; metadata **en curso** es la de la revisión abierta. No es una regla nueva: es la misma regla aplicada a otro atributo.

Con una revisión `A` aprobada y una `B` en borrador donde el título se corrigió, hay dos respuestas correctas a la misma pregunta:

| Lectura | Qué devuelve | Para qué sirve |
| ------- | ------------ | -------------- |
| En curso | El título de `B` | Qué es el documento hoy, y qué se está por emitir |
| Vigente | El título de `A` | **Qué dice el rótulo que efectivamente salió** |

**La copia se nombra por la lectura que sirve.** `Document.title` pasa a `currentTitle`, y con él `currentDocumentClass` y `currentDocumentType`. Conservar el nombre desnudo dejaría un campo que significa *"el de la revisión en curso"* sin decirlo, y el consumidor que buscaba el rótulo aprobado se llevaría otro valor sin enterarse — que es el defecto contra el que advierte el §13 cuando pide que las dos lecturas *"se expongan y no se deriven en cada consumidor"*.

El prefijo marca la copia. **En la revisión los nombres quedan desnudos** —`title`, `documentClassId`, `documentTypeId`—, porque ahí el valor no es copia de nada: es el dato. La asimetría es deliberada y se lee de un vistazo.

La otra lectura no necesita campo propio: después de `B1` la revisión vigente lleva su título, de modo que el rótulo aprobado queda a un salto sin agregar nada al modelo.

El renombre alcanza al modelo y no solo al contrato. Un campo llamado `title` en la tabla y `currentTitle` en la API obligaría a recordar la traducción justamente donde la confusión es cara. Se paga una vez, sin consumidores y sin datos productivos.

**Tensión declarada con el §3 de los principios.** Allí se rechaza almacenar un dato derivado porque puede desincronizarse de su origen. Acá el origen es inmutable una vez aprobado y el único escritor es la transición de revisión. La excepción se declara en el principio y no se resuelve en la implementación.

**Consecuencia sobre la plantilla.** El circuito se resuelve por la tupla clase/tipo al materializarse (§12), y los valores se copian. Cambiar la clase o el tipo dentro de una revisión ya armada **no rearma el circuito**, coherente con el criterio de copia. Se enuncia para que no quede decidido implícitamente.

### B3 — El código es el identificador y no cambia

El código no es metadata: es **la referencia**. Está en los transmittals emitidos, en el payload de cada firma, en las referencias cruzadas de otros documentos, en el sistema de la contraparte y en el rótulo de cada archivo que salió. Cambiarlo no renombra un registro: rompe la correspondencia con todo lo que ya lo nombra y que el sistema no controla.

Es lo que DOM-005 ya afirma sin extraer la consecuencia: *"esa identificación no es descripción sino identidad"*. Si es identidad, no se edita.

La distinción con `B1` es a qué apunta cada dato. El título y la clase **describen**, y pueden corregirse entre revisiones porque nadie referencia un documento por su título. El código **identifica**.

La restricción técnica coincide con la funcional: los dos índices únicos parciales de la línea base solo son expresables con el código en `documents`. Si viviera en la revisión, la unicidad recaería sobre un conjunto derivado —la revisión en curso de cada documento— que ningún índice expresa, y dos borradores podrían reclamar el mismo código y chocar recién al aprobar.

### B4 — El código se corrige mientras el documento no tenga revisión aprobada

Un error de tipeo en el alta debe poder corregirse. La condición habilitante es **que no exista revisión vigente**, y no "antes de cerrar la primera revisión":

1. Es la condición material de que **nada salió**: ningún transmittal lo nombra, ninguna firma lo lleva en su payload, ningún rótulo emitido lo imprime.
2. Es más precisa. Si la primera revisión se abandona y se abre una segunda, sigue sin haberse aprobado nada, y la formulación por "primera revisión" bloquearía el código sin causa.
3. No requiere indicador nuevo: es la lectura de revisión vigente nula que `B14` ya resuelve.

Dos condiciones de la operación:

- **Emite evento propio.** Es la identidad cambiando, y sin evento sería inexplicable en una auditoría posterior. `DocumentCodeChanged`, con el código anterior y el nuevo.
- **Advierte sobre las versiones cargadas.** Si ya existe una versión con el rótulo impreso, cambiar el código obliga a volver a cargarla. El sistema no puede verificar el interior del archivo; la advertencia sí corresponde.

### B5 — El reemplazo supera al documento anterior, dentro del mismo ámbito

Aprobada una revisión, el código no se edita. Lo que corresponde es **dar de alta un documento nuevo que reemplace y supere al anterior**.

**Reemplazar es superar, y el documento reemplazado queda obsoleto.** No son dos actos: es el sentido de la fórmula con que el control documental lo enuncia —*reemplaza y supera a*—, y el documento superado deja de representar nada vigente en el mismo instante en que otro lo hace.

Es exactamente lo que ya ocurre un nivel más abajo: aprobar una revisión supersede a la anterior. Acá el mismo hecho ocurre entre documentos.

**El reemplazo no es la única causa.** Un documento también queda obsoleto **por salir del alcance del proyecto**: dejó de tener sentido y nada lo reemplaza. Son dos caminos al mismo estado, y por eso la obsolescencia **se registra en el documento** —fecha, actor y motivo obligatorio— en lugar de derivarse de la existencia de un reemplazo. Es el precedente de `B11` de `BLOCK_03` para el abandono de la revisión: *el motivo vive en el modelo y no en el meta de un evento*.

Lo que sí **se deriva es la causa**: el documento obsoleto que figura como reemplazado en un acto lo está por reemplazo, y el que no figura en ninguno, por fuera de alcance. Un indicador de causa sería un dato calculable capaz de contradecir a los que lo originan, que es lo que el §7 rechaza.

Qué implica estar obsoleto, por cualquiera de las dos causas:

- **no admite revisiones nuevas**, porque sería contradictorio emitir sobre lo que ya fue superado;
- **conserva todo lo demás**: su código, su historia de revisiones, sus versiones firmadas y sus transmittals siguen enteros y consultables;
- **no libera su código**, que permanece tomado dentro del ámbito. Es lo que impide que el reemplazo se convierta en una vía indirecta de reutilizar un identificador, y refuerza `B3`.

**Obsoleto no es dado de baja.** `terminatedAt` es baja lógica: corrige un alta que no debió existir. La obsolescencia es un hecho del ciclo de vida — el documento existió, sirvió y dejó de servir. Confundirlas borraría de la historia lo que la obsolescencia justamente conserva.

**Se modela N:M desde el principio**, y no 1:1 con generalización posterior. Con la misma relación quedan expresados tres hechos que hoy no tienen forma de registrarse:

| Cardinalidad | Hecho |
| ------------ | ----- |
| 1:1 | Recodificación: el mismo documento con otro código |
| N:1 | Unificación: dos documentos pasan a ser uno |
| 1:N | División: un documento se separa en dos |

**El reemplazo es un acto, y no un par de referencias.** Un acto declara su fecha, su actor y su motivo, y agrupa los documentos que salen y los que entran. Sin esa agrupación, una unificación de dos documentos en dos nuevos es indistinguible de dos reemplazos separados, y la reorganización pierde el sentido que la explica.

**El motivo vive en el acto y no se tipifica.** Qué clase de reemplazo es —recodificación, unificación, división— **se deriva de la cardinalidad** del propio acto. Es el criterio de D-04 sobre la delegación: no se guarda un indicador que puede contradecir a los datos que lo originan.

**Los documentos de un acto comparten ámbito.** Reemplazar es un hecho interno a un proyecto, o interno al régimen de publicación. Cruzar de uno a otro no es reemplazar sino promover, que es otra cosa y no pertenece a este bloque — ver `B10`.

Lo que el reemplazo conserva es justamente lo que la edición del código destruiría: el documento anterior sigue existiendo con su identidad y su historia, y el acto declara qué lo reemplazó y por qué.

### B6 — Una versión es un conjunto de archivos entregados en un mismo acto

Un documento se entrega habitualmente como más de un archivo. El caso corriente de ingeniería es el **PDF junto con su editable**: se revisa y se marca el PDF, y el DWG viaja como respaldo de la fuente. También existe el documento compuesto por varios entregables —memoria y planillas—, de modo que la restricción no es "un principal", sino "al menos un revisable".

**El principio del §4 no se debilita: se corrige su cardinalidad.** Lo que sostiene es que la versión no existe sin contenido nuevo y que nunca cambia. Ambas cosas se conservan enunciadas sobre el conjunto:

> La versión es el conjunto de archivos registrado en un mismo acto. No existe sin contenido nuevo, y ni el conjunto ni sus archivos se modifican ni se eliminan.

**Agregar un archivo a una versión existente se descarta.** Rompería la inmutabilidad y dejaría a una firma acreditando un conjunto distinto del que su autor tuvo delante. Si el editable llega después, se registra una versión nueva con ambos archivos — que es lo correcto, porque las versiones son iteración interna y no consumen numeración externa.

**El costo práctico se acota reutilizando la referencia.** Un archivo que no cambió conserva su `fileKey` y su `checksum` en la versión nueva: lo que se crea es el registro del conjunto, no el objeto almacenado. Cómo se opera eso lo resuelve `B12`.

**Que el editable viaje solo al final es un caso, no una excepción.** En las revisiones tempranas el conjunto tiene un archivo; en la emisión final tiene dos. Nada en el modelo lo impide y nada lo exige — ver `B9`.

### B7 — El rol del archivo lo interpreta el sistema

Cada archivo del conjunto declara su rol. Se modela como enumeración y no como catálogo configurable, por el criterio de D-22: **es un catálogo cuando el usuario elige el rótulo, y una enumeración cuando el sistema interpreta el efecto.** Acá el sistema lo interpreta —qué se abre para revisar, qué se marca, qué se exige al emitir—, de modo que un valor libre no tendría comportamiento asociado.

| Rol | Qué es | Comportamiento |
| --- | ------ | -------------- |
| `DELIVERABLE` | El entregable, típicamente PDF | Es lo que se revisa y se marca. Al menos uno por versión |
| `SOURCE` | La fuente editable, típicamente DWG | Acompaña en custodia. No se revisa. Opcional |
| `SUPPORT` | La evidencia que formó parte de producir el documento: memoria de cálculo, ensayos, planillas, relevamientos | Acompaña como respaldo. No se revisa ni se marca. Opcional, y admite varios |

**`SUPPORT` no invade a `Attachment`, y su frontera es limpia.** Lo que distingue a los tres roles de un adjunto no es la naturaleza del archivo sino a qué se ata: el archivo de una versión **integra la entrega**, es inmutable y queda acreditado por la firma; un adjunto cuelga del documento, es mutable y no acredita nada. Que la evidencia que sustenta un cálculo quede firmada junto con el entregable que la usa es precisamente lo que hoy no se puede afirmar.

La distinción además **descarga a D-08** en lugar de anticiparlo: retira del destino pendiente de `Attachment` el caso de uso que más presión le ponía.

**Invariantes del conjunto:** al menos un archivo; al menos uno con rol `DELIVERABLE`; `checksum` obligatorio en cada archivo, con el mismo fundamento que hoy lo vuelve obligatorio en la versión; y ningún `fileKey` repetido dentro de la versión.

### B8 — La firma acredita el conjunto completo

El payload pasa a llevar la lista de archivos de la versión vigente, cada uno con su rol, su nombre, su `fileKey` y su `checksum`.

**Firma también lo que nadie revisó**, y esa es la razón de la decisión. La custodia del editable importa precisamente porque es la fuente del PDF: si pudiera sustituirse sin producir versión nueva, la correspondencia entre uno y otro sería una afirmación sin evidencia. Que hayan sido firmados juntos es lo que la sostiene.

**No se agrega un hash del conjunto.** Sería un derivado del payload, que ya se persiste íntegro y sobre el cual se recalcula al verificar. El §7 rechaza guardar derivados y acá no hace falta ninguno.

Tres consecuencias de implementación:

- `SIGNATURE_PAYLOAD_VERSION` pasa a `2`. El mecanismo ya está previsto y las firmas anteriores siguen verificándose con su propia forma.
- **La lista se construye en orden determinístico** —por rol y después por `fileKey`— antes de serializar. `canonicalize` ordena las claves de los objetos pero conserva el orden de los arreglos, de modo que el orden no puede quedar librado al de la consulta.
- El snapshot de metadata del payload se toma de la revisión para título, clase y tipo, y del documento para el código.

### B9 — Qué roles se exigen depende del propósito de la emisión, y se difiere

Que el editable se exija recién en la emisión final —apto para construcción, conforme a obra— es una regla real, y **este bloque no la implementa**, porque depende de un concepto que el modelo todavía no tiene: el **propósito de la emisión**.

Expresarla sin ese concepto obligaría a elegir mal:

- exigir el rol por tipo de documento la volvería obligatoria en **toda** revisión, que es justo lo contrario de lo que la práctica pide;
- exigirla por estado de la revisión confundiría el avance interno con el destino externo.

`BLOCK_04` es donde viven la puerta de emisión y la respuesta de la contraparte, y es donde el propósito tiene lugar propio. Este bloque **habilita la capacidad y no la obligación**, y le deja el conjunto de archivos con sus roles ya modelado. Es el mismo tratamiento que `BLOCK_03` le dio a D-22.

### B10 — La promoción al activo es linaje entre revisiones, y no reemplazo

Al cerrarse un proyecto, parte de su documentación pasa al activo de planta. Es tentador leerlo como un reemplazo que cruza de ámbito, y no lo es. Cuatro diferencias lo separan de `B5`, y cualquiera alcanza:

| | Reemplazo (`B5`) | Promoción |
| --- | --- | --- |
| Nivel | Entre documentos | Entre **revisiones** |
| Efecto | El anterior queda obsoleto | El de proyecto **no queda obsoleto**: quedó terminado |
| Qué produce | Un documento nuevo | Una **revisión** en el activo |
| Ámbito | El mismo | Cruza del proyecto al régimen de publicación |

**Lo que se promueve es la revisión aprobada**, y no el documento. Del lado del activo produce una de dos cosas, y la unidad de origen es la misma en ambos casos:

| En el activo | Resultado |
| ------------ | --------- |
| El documento ya existe | Una **revisión nueva** de ese documento |
| El documento no existe | Su **primera revisión**, con el documento creado en el acto |

Dicho de otro modo: **un proyecto aporta al activo una revisión nueva o un documento nuevo**, y qué de las dos ocurra no cambia la forma del vínculo. El linaje siempre une revisión con revisión: informativo, N:M, sin correspondencia individual, con el precedente de `CatalogedFileSource` en Digitalization — que también es linaje a nivel de lo publicado y no de la identidad.

Cuando el documento del activo se crea, **su código es propio del régimen de publicación** y no hereda el del proyecto. Son dos identidades en dos ámbitos, cada una con su índice de unicidad, y por eso pueden coincidir sin conflicto. Nada de esto contradice `B3`: ningún código cambia.

Y no alcanza a todo: **hay documentación que vive solo en el proyecto** y no representa nada de la planta. La promoción es selectiva por naturaleza, otra razón por la que no puede ser un efecto automático del cierre.

**No se modela en este bloque.** Pertenece al módulo de activos, junto con la obsolescencia por decomisionamiento, que es una causa que este módulo no conoce. Lo que corresponde acá es no impedirla — y `B1` y `B6` la favorecen sin proponérselo:

- con la identificación en la revisión, promover es **copiar una revisión** con su título, su clase y su tipo, en lugar de reconstruirla desde el documento;
- con la versión como conjunto de archivos, el entregable viaja con su fuente y su respaldo, que es lo que la biblioteca de planta necesita conservar.

### B11 — Cada nivel tiene su palabra para terminar mal

El vocabulario de los estados terminales hoy se superpone. El estado de la revisión abandonada se llama `CANCELLED`, y *cancelación* es además el nombre del acto que retira el circuito **sin** abandonar la revisión: la misma palabra para dos actos de efecto opuesto. Y `BLOCK_03` alterna tres términos para lo mismo — la SFS dice *abandonar*, sus decisiones dicen *abortar*, y el modelo dice `cancelled`.

Se fija una palabra por nivel, y no se usa en ningún otro:

| Nivel | Palabra | Qué nombra |
| ----- | ------- | ---------- |
| Circuito | **Cancelado** | Se retiró sin que nadie emitiera juicio. La revisión sobrevive y se rearma |
| Revisión | **Abandonada** | Dejó de tener sentido antes de aprobarse. No consume código |
| Documento | **Obsoleto** | Fue superado por otro, o salió del alcance. Ya no representa nada vigente |

Los tres son terminales, y cada uno pertenece a un nivel distinto: retirar un armado, desistir de una emisión y dar por concluida una identidad son hechos que no se confunden en el trabajo real, y no deben confundirse en el nombre.

**`RevisionStatus.OBSOLETE` se elimina.** Está declarado sin uso y reservado a los estados terminales por respuesta de la contraparte que definiría `BLOCK_04`. No hace falta, y tenerlo hace daño:

- una revisión **se aprueba o se rechaza**; si el trabajo deja de tener sentido antes, se abandona, y si deja de tenerlo después, lo que caduca es el documento, no la emisión que efectivamente salió;
- lo que la contraparte responde ya tiene forma propia en D-22 —la calificación, con sus dos efectos— y **no es un estado de la revisión**. Meterlo ahí sería exactamente el defecto contra el que advierte el §1: dos máquinas de estados describiendo lo mismo, una interna y otra externa;
- `SUPERSEDED` ya cubre el único caso de caducidad interna, que es la revisión desplazada por una posterior aprobada.

El valor se reservó *"para no pagar dos migraciones de enumeración"*. **Confirmado al cerrar el bloque que `BLOCK_04` no lo necesita**, la eliminación no deja deuda: la segunda migración que la reserva quería evitar no va a hacer falta.

### B12 — La versión nace al confirmar, y antes hay una copia de trabajo

`B6` deja una pregunta abierta que con un solo archivo no existía: **cómo se modifica**. Mientras la versión era un archivo, subirlo era producirla. Con un conjunto, corregir el PDF obligaría a rearmar el conjunto entero en un solo acto, y subir cada archivo por separado produciría una versión por archivo — una secuencia de iteraciones que no son iteraciones.

**La inmutabilidad de la versión y la comodidad de editar no están en conflicto: ocurren en momentos distintos.** La versión debe ser inmutable *una vez que existe*; lo que hay que decidir es **cuándo existe**. Y la respuesta es: **al confirmar**, no al abrir ni al subir cada archivo.

Antes de eso hay una **copia de trabajo**: el conjunto en preparación, mutable por naturaleza, que todavía no es una versión y por lo tanto no acredita nada.

| Operación | Qué hace |
| --------- | -------- |
| **Abrir** | Crea la copia de trabajo **precargada con los archivos de la versión vigente** |
| **Reemplazar** | Sustituye un archivo del conjunto por el editado |
| **Adjuntar** | Suma un archivo al conjunto, con su rol |
| **Quitar** | Retira un archivo del conjunto |
| **Confirmar** | El conjunto se convierte en la versión siguiente, completa e inmutable |
| **Descartar** | La copia se abandona sin producir versión |

**Precargar es lo que vuelve barata la edición.** El que corrige el PDF abre, reemplaza ese archivo y confirma: el DWG y el respaldo viajan solos, conservando su `fileKey` y su `checksum` sin volver a subirse. Se sube un archivo y se produce una versión que referencia tres.

**A lo sumo hay una copia de trabajo abierta por revisión.** Es el mismo invariante que el módulo ya aplica dos veces —a lo sumo una revisión en curso por documento, a lo sumo un circuito abierto por revisión— apareciendo en un tercer nivel. Vive en la revisión y no en el paso, de modo que sobrevive a una reasignación y a la apertura de un circuito nuevo tras un rechazo: lo que se está corrigiendo es el mismo entregable.

**Confirmar exige al menos un cambio.** Sin archivo agregado, reemplazado o quitado no hay nada que confirmar, porque *la versión solo existe con contenido nuevo*. El principio se hace cumplir solo.

**Resolver un paso exige no tener copia de trabajo abierta.** Declarar que se terminó mientras una iteración sigue abierta es una contradicción, y evita además que una revisión llegue a aprobarse con trabajo colgando.

#### Qué no significa acá el *check-out*

En un gestor documental genérico, el *check-out* baja el archivo y lo bloquea. Ninguna de las dos cosas corresponde:

- **No descarga.** El archivo se lee cuando se quiere, por presigned URL, y leerlo nunca fue un acto del ciclo. Abrir la copia declara que hay una iteración en curso, no que alguien obtuvo el archivo.
- **No bloquea, porque el bloqueo ya existe.** `B5` de `BLOCK_03` establece que la versión la produce quien tiene el paso vigente: la exclusividad la da el circuito, no un candado. Agregar uno duplicaría la regla, y el permiso especial que habilita actuar sobre el trabajo ajeno seguiría atravesándolo igual.

Los nombres *check-out* y *check-in* son los que el usuario de gestión documental espera, y la interfaz puede usarlos. El modelo los nombra por lo que hacen.

#### Alternativas descartadas

**Una versión por cada archivo subido.** Es lo que hay hoy, y solo se sostiene con un archivo por versión. Con un conjunto, convierte la secuencia de versiones en un registro de subidas: se pierde la noción de iteración, que es lo único que la numeración interna quiere expresar.

**Que abrir cree la versión y confirmar la sobrescriba.** Es la alternativa más tentadora y la peor: vuelve mutable a la entidad cuya razón de ser es no serlo, y obliga a la invariante condicional que `DOM-007` evita en el `checksum` —*no se modifica, salvo mientras esté abierta*—. Peor todavía, una apertura abandonada dejaría una versión consumiendo un número en la secuencia, que es exactamente lo que el módulo evitó un nivel más arriba al decidir que la revisión abandonada no consume código.

**Que la copia de trabajo sea el único camino.** Se conserva el atajo: **confirmar admite recibir el conjunto completo de una vez**, creando y cerrando la copia en un solo acto. No son dos modelos sino la misma transición con y sin acumulación previa, y es lo que necesita un cliente automático —el sistema del contratista de la orientación de federación— para no depender de una secuencia de llamadas.

#### Vocabulario

Por el criterio de `B11`, la copia de trabajo termina **descartada**: palabra propia, distinta de cancelado, abandonada y obsoleto.

---

## Cambios de modelo

**`documents`**

- Conserva `code`, ahora inmutable fuera de la ventana de `B4`, con sus dos índices únicos parciales sin cambios.
- `title`, `documentClassId` y `documentTypeId` se renombran a `currentTitle`, `currentDocumentClassId` y `currentDocumentTypeId`, y pasan a ser **copia** de la revisión en curso, con su único escritor en la transición de revisión (`B2`).
- Conserva `description`, `module`, `projectId` y `projectTaskId` como datos propios editables.
- Incorpora `obsoletedAt`, `obsoletedById` y `obsoleteReason`, con el motivo obligatorio. La **causa** —reemplazo o fuera de alcance— no se guarda: se deriva de si algún acto de reemplazo lo nombra (`B5`).
- Conserva `terminatedAt`, que es baja lógica y no obsolescencia.

**`doc_replacements`** — modelo nuevo, el acto de reemplazo

- Fecha, actor y **motivo obligatorio**, con el criterio del §9 para todo acto consecuente.
- No declara de qué clase de reemplazo se trata: se deriva de su cardinalidad.
- Los documentos que agrupa comparten ámbito, verificado al registrarlo.

**`doc_replacement_items`** — modelo nuevo, los documentos del acto

- `replacementId`, `documentId`, `role` con valores `REPLACED` y `REPLACING`.
- Único por (`replacementId`, `documentId`, `role`). Un mismo documento no aparece dos veces con el mismo papel dentro de un acto.
- Una tabla de pares `reemplazante ← reemplazado` se consideró y se descartó: resuelve N:M pero pierde el acto, y sin el acto una reorganización de dos documentos en dos es indistinguible de dos reemplazos separados.
- El vínculo admite corregirse. Lo que **sí bloquea** es emitir sobre un documento reemplazado, por `B5`.

**`document_revisions`**

- Incorpora `title`, `documentClassId` y `documentTypeId`, copiados de la revisión anterior al crearse.
- `RevisionStatus.CANCELLED` pasa a `ABANDONED`, y `cancelledAt`, `cancelledById` y `cancelReason` a `abandonedAt`, `abandonedById` y `abandonReason` (`B11`).
- `RevisionStatus.OBSOLETE` se elimina.
- El índice único parcial `document_revisions_code_key` se recrea sobre `WHERE status <> 'ABANDONED'`.

**`review_workflows`**

- Sin cambios. `WorkflowStatus.CANCELLED` conserva su nombre, que pasa a ser exclusivo del circuito.

**`document_versions`**

- Pierde `fileKey`, `fileName`, `fileSize`, `mimeType` y `checksum`, que pasan al conjunto.
- Conserva `versionNumber`, `comment` y la autoría.

**`doc_version_files`** — modelo nuevo

- `versionId`, `role`, `fileKey`, `fileName`, `fileSize`, `mimeType`, `checksum`.
- Único por (`versionId`, `fileKey`). Nombre según `B1` de `BLOCK_01`, con prefijo `Doc` en los nombres genéricos.

**`doc_working_copies`** — modelo nuevo, la copia de trabajo (`B12`)

- `revisionId`, quién la abrió y cuándo, y el motivo al descartarla.
- **A lo sumo una abierta por revisión**, con índice único parcial, del mismo modo que `BLOCK_03` resolvió el circuito abierto.
- Sus archivos comparten la forma de `doc_version_files` y se copian a la versión al confirmar.

**Enumeración nueva** `DocFileRole`, con los valores de `B7`.

**Contrato GraphQL**

- `DocumentVersion` deja de exponer los campos de archivo en línea y expone `files`.
- `registerVersion` se reemplaza por las operaciones de `B12` —abrir, reemplazar, adjuntar, quitar, confirmar y descartar—, con el atajo de confirmar recibiendo el conjunto completo.
- `Document` expone `currentTitle`, `currentDocumentClass` y `currentDocumentType`; los filtros de los listados se renombran igual. La lectura vigente se obtiene de la revisión.
- La actualización del documento deja de aceptar título, clase y tipo; se editan sobre la revisión, que los expone con el nombre desnudo.
- Operación propia para corregir el código bajo la condición de `B4`.

Son cambios incompatibles, sin consumidores según la línea base.

**Migración**

0. `RevisionStatus.CANCELLED` se renombra a `ABANDONED` y `OBSOLETE` se elimina. Sin datos que convertir: el módulo no tiene uso productivo según la línea base del plan, y `OBSOLETE` además nunca se usó. Los identificadores afectados aparecen en 12 archivos entre modelo, resolvers, contrato y pruebas, **parte de ellos por el `CANCELLED` del circuito, que no se toca**: la separación hay que hacerla caso por caso y no con un reemplazo global.
1. Cada `document_versions` existente produce un `doc_version_files` con rol `DELIVERABLE`.
2. `documents.title`, `documentClassId` y `documentTypeId` se copian a la revisión en curso de cada documento, y a las aprobadas como mejor aproximación disponible — no existe historia de la que reconstruir el valor real de cada revisión pasada. Se registra como limitación conocida de la migración.
3. Las firmas existentes conservan su `payloadVersion` 1 y se verifican con su forma original.

## Impacto sobre la SFS vigente

| Documento | Cambio |
| --------- | ------ |
| `10_DOM-005_Document.md` | Atributos, invariante de congelamiento, inmutabilidad del código, obsolescencia derivada del reemplazo, y la Observación sobre la metadata no revertida, que se elimina por quedar sin objeto |
| `20_DOM-006_DocumentRevision.md` | Atributos de identificación incorporados, estado `ABANDONED`, baja de `OBSOLETE` y su Observación, y el diagrama de estados |
| `40_DOM-008_ReviewWorkflow.md` | Vocabulario: `CANCELLED` queda reservado al circuito |
| `30_DOM-007_DocumentVersion.md` | Propósito, descripción e invariantes reformulados sobre el conjunto, y el momento en que la versión nace |
| `60_DOM-010_DocStepSignature.md` | Contenido del payload |
| `80_Principios_del_Modelo.md` | §4 en su cardinalidad, §5 en lo firmado, §6 en su fundamento, y §13 extendido a la metadata |

Se agregan tres documentos de entidad: el archivo de la versión, el acto de reemplazo y la copia de trabajo. Y dos principios nuevos: la superación entre documentos con su frontera con la promoción, y el momento en que la versión nace.

## Cuestiones resueltas

No queda ninguna abierta. Ninguna se resolvió implícitamente durante la implementación.

- **El tercer rol de archivo** se incorpora como `SUPPORT`, para la evidencia que formó parte de producir el documento (`B7`).
- **El reemplazo se modela N:M desde el principio**, como acto y no como par de referencias (`B5`).
- **El acto exige ámbito compartido** (`B5`). Lo que cruza de ámbito no es reemplazo sino promoción, y es linaje entre revisiones (`B10`).
- **Una palabra por nivel** —cancelado, abandonada, obsoleto— y `RevisionStatus.OBSOLETE` eliminado (`B11`).
- **La obsolescencia se registra y no se deriva**, porque tiene dos causas. Lo que se deriva es cuál de las dos (`B5`).
- **`description` es administrativa** y queda en el documento, editable siempre (`B1`). No se imprime en el rótulo, y su uso es poco frecuente.
- **`BLOCK_04` no necesita un estado terminal de la revisión** por respuesta de la contraparte, de modo que retirar `RevisionStatus.OBSOLETE` no le deja deuda (`B11`).
- **La recodificación masiva no se implementa.** Se evalúa como un caso muy especial que no se espera que ocurra. La decisión conserva la posibilidad —el código anterior queda en la traza y el acto sería de proyecto, explícito y auditado— pero **ninguna operación la ofrece**, y no se construye nada para sostenerla.
- **La copia de metadata se nombra por su lectura**: `currentTitle`, `currentDocumentClass` y `currentDocumentType`, en el modelo y en el contrato. En la revisión los nombres quedan desnudos, porque ahí el valor no es copia (`B2`).

## Criterios de aceptación

1. Editar el título de una revisión abierta no altera la revisión aprobada anterior, y ambos valores son consultables.
2. Abandonar una revisión con la metadata editada devuelve al documento la metadata de la última aprobada.
3. Una revisión aprobada rechaza toda edición de metadata, por estructura y no por precondición.
4. El código se corrige mientras no exista revisión vigente, con su evento, y se rechaza después.
5. Registrar una versión con PDF y DWG produce un conjunto de dos archivos, y la firma del aprobador contiene ambos `checksum`.
6. Registrar una versión sin ningún archivo `DELIVERABLE` se rechaza.
7. Una firma con `payloadVersion` 1 sigue verificando correctamente.
8. La verificación de una firma `payloadVersion` 2 es estable ante el orden en que la consulta devuelve los archivos.
9. Los listados y filtros por clase y tipo siguen resolviéndose sobre `documents`, sin join a la revisión.
10. Con `A` aprobada y `B` en borrador con otro título, `currentTitle` devuelve el de `B` y la revisión vigente el de `A`. Ningún campo desnudo devuelve ninguno de los dos.
11. Un acto de reemplazo con dos documentos reemplazados y uno reemplazante se registra y se consulta desde cualquiera de los tres.
12. Un documento reemplazado se lee entero —revisiones, versiones y transmittals— y rechaza abrir una revisión nueva.
13. El código de un documento reemplazado sigue tomado dentro de su ámbito.
14. Un acto que mezcla documentos de proyectos distintos, o uno de proyecto con uno publicado, se rechaza.
15. Un documento se declara obsoleto por fuera de alcance, con motivo y sin reemplazo, y su causa se lee como tal.
16. Un archivo `SUPPORT` queda en el payload firmado y no cuenta para el mínimo de `DELIVERABLE`.
17. Abandonar una revisión la deja en `ABANDONED`, cancelar su circuito lo deja en `CANCELLED`, y ninguna operación produce el otro valor.
18. El código de una revisión abandonada sigue disponible para una revisión posterior, con el índice recreado.
19. Abrir la copia de trabajo la precarga con los archivos de la versión vigente, y reemplazar uno solo produce, al confirmar, una versión con el conjunto completo.
20. Abrir una segunda copia de trabajo sobre la misma revisión se rechaza.
21. Descartar la copia de trabajo no produce versión, y la numeración interna no salta.
22. Confirmar sin ningún cambio se rechaza.
23. Resolver un paso con una copia de trabajo abierta se rechaza.
24. Confirmar con el conjunto completo en una sola llamada produce la misma versión que la secuencia incremental.

## Fases de implementación

Mismo orden que `BLOCK_02` y `BLOCK_03`, con una fase de vocabulario adelante para que todo lo que se escriba después ya use los nombres definitivos.

| Fase | Contenido |
| ---- | --------- |
| A | **Permisos**: los actos nuevos que no encajan en los existentes, en `202-mi-common`; alta en el seed de `205-mi-admin`, asignación a roles, republicación y actualización de la dependencia. |
| B | **Vocabulario** (`B11`): `RevisionStatus.CANCELLED` a `ABANDONED`, baja de `OBSOLETE`, renombre de los campos de abandono y recreación del índice único parcial. Caso por caso: el `CANCELLED` del circuito no se toca. |
| C | **Modelo y migración**: metadata en la revisión; renombre a `currentTitle` y familia; obsolescencia en el documento; `doc_version_files`, `doc_working_copies`, `doc_replacements` y sus ítems; enumeración `DocFileRole`; índices únicos parciales de la copia de trabajo y del acto. |
| D | **Utilidades puras**: payload firmado `v2` con la lista de archivos en orden determinístico; réplica de metadata a la copia del documento; derivación de la causa de obsolescencia; diferencia de la copia de trabajo, que responde si hay algo que confirmar. |
| E | **Operaciones**, resolver por resolver: edición de metadata sobre la revisión, corrección del código, acto de reemplazo, declaración de obsolescencia, y las seis de la copia de trabajo con la precondición sobre la resolución del paso. |
| F | **Trazabilidad**: tipos, acciones y transiciones de los hechos nuevos — código corregido, documento reemplazado, documento obsoleto, copia abierta, confirmada y descartada. |
| G | **Contrato GraphQL**, con los retiros declarados y el reemplazo de `registerVersion`. |
| H | **Pruebas** de las tres capas, contra los veinticuatro criterios de aceptación. |
| I | **Cierre documental**: SFS, `WhatIsNew.md`, y recién entonces la evaluación de promoción. |

**La fase A precede a todas**, como en los bloques anteriores: sin permisos publicados no hay con qué autorizar lo nuevo. Y arrastra una fricción conocida del entorno — publicar `202-mi-common` exige resolver el token desde `~/.npmrc` y correr el build a mano, porque el `.npmrc` del proyecto ignora los scripts.

**Qué decide la fase A**, y no debe resolverse por omisión: si corregir el código, reemplazar y declarar obsoleto se autorizan con `DOCUMENTS_DOCUMENT_UPDATE` —que ya existe— o exigen acciones propias. El criterio del módulo empuja a lo primero: `B9` de `BLOCK_03` gobierna todo acto sobre el trabajo ajeno con **un solo** permiso especial, y multiplicar permisos por acto contradice esa economía. Pero reemplazar y declarar obsoleto no son una edición más, y la ventana de corrección del código ya está acotada por estado. Se decide al abrir la fase.

**La fase B va antes del modelo** porque es un renombre transversal: hacerla después obligaría a escribir el modelo nuevo con los nombres viejos y corregirlo enseguida.

**Las fases D y E son donde el bloque se puede detener sin romper nada**, si hiciera falta pausarlo: hasta ahí el modelo está migrado y las utilidades probadas, pero ninguna operación cambió de comportamiento.

## Evidencia de validación

### Fase A — permisos

**Completada.** `202-mi-common` 2.7.0 publicada, `205-mi-admin` 2.2.6, `209-mi-document` 2.5.0.

**La decisión que la fase debía tomar** quedó resuelta así: corregir el código se autoriza con `documents:document:update`, que ya existe —es una edición, y su ventana ya está acotada por estado—, y **un solo permiso nuevo** gobierna los dos actos que terminan la vida útil del documento, reemplazarlo y declararlo obsoleto. Es la economía de `B9` de `BLOCK_03`, que gobierna todo acto sobre el trabajo ajeno con uno solo.

**La acción `archive` se descartó**, aunque existía en el catálogo. En este código se usa exclusivamente para archivar registros de sistema —`*_SYS_LOG_ARCHIVE` en los nueve módulos—, y "archivar documento" se leería como darlo de baja, que es justamente lo que `B5` separa de la obsolescencia.

**Se agregó la acción `obsolete` al catálogo**, en lugar de pasar una cadena literal como hizo `BLOCK_03` con `admin:update`. El motivo apareció al revisar el consumidor: la grilla de permisos resuelve la etiqueta de la acción contra `ACTION_LIST`, de modo que **un valor ausente de esa lista se renderiza en blanco y no es filtrable**. Eso explica además algo que parecía un descuido en el seed de `BLOCK_03` —el permiso con código `admin:update` declara `action: ACTIONS.UPDATE`—: no es una inconsistencia, es lo que mantiene la fila visible. Acá el problema se resuelve en el origen y código y seed declaran lo mismo.

| Verificación | Resultado |
| ------------ | --------- |
| `type-check` y `lint` de `202-mi-common` | Sin errores |
| Publicación a GitHub Packages | `@CLGonzalezGroh/mi-common@2.7.0` |
| `tsc --noEmit` de `205-mi-admin` y `209-mi-document` con la dependencia actualizada | Sin errores |
| `npm run seed:permissions` | 408 permisos, 795 `rolePermissions` en 22 roles |
| Consulta directa a la base | `documents:document:obsolete`, acción `obsolete`, 1 rol |

### Fase B — vocabulario

**Completada.** Migración `20260814120000_terminal_state_vocabulary`.

El renombre alcanzó más de lo que el enunciado de la fase preveía, y por el mismo motivo que lo justifica: **la palabra estaba en cuatro capas, y dejarla a medias en cualquiera de ellas conserva la colisión donde más cuesta.**

| Capa | Cambio |
| ---- | ------ |
| Enumeración | `RevisionStatus.CANCELLED` → `ABANDONED`; baja de `OBSOLETE` |
| Columnas | `cancelledAt`, `cancelledById`, `cancelReason` → `abandonedAt`, `abandonedById`, `abandonReason` |
| Traza | `AuditAction.CancelRevision` → `AbandonRevision`; `WorkflowEvent.RevisionCancelled` → `RevisionAbandoned` |
| Contrato | Mutación `cancelRevision` → `abandonRevision`; campos y valores de `RevisionStatus` y `RevisionStatusInput` |

**La traza no estaba en el enunciado y se incorporó.** Un evento `RevisionCancelled` conviviendo con `WorkflowCancelled` deja la ambigüedad viva justo en el registro de auditoría, que es donde se la consulta cuando importa.

**Nada del circuito se tocó.** `WorkflowStatus.CANCELLED` conserva su nombre, y `review_workflows` conserva sus tres columnas `cancel*`: ahí el acto sí es cancelar. La separación se hizo caso por caso y no con un reemplazo global.

**Retirar `OBSOLETE` exigió recrear el tipo**, porque PostgreSQL no admite quitar un valor. La migración verifica primero que ninguna fila lo use y **falla en lugar de perder datos** si algún despliegue lo hubiera empezado a usar. El índice único parcial se retira antes de tocar el tipo y se recrea sobre `<> 'ABANDONED'`.

| Verificación | Resultado |
| ------------ | --------- |
| `prisma migrate deploy` y `generate` | Aplicada, cliente regenerado |
| `tsc --noEmit` | Sin errores |
| `npm run test:block03-all` | **177 pruebas, 0 fallos**, sin cambios de expectativa fuera del renombre |
| `rover subgraph check Maria-Ingenieria@current` | **Operation Check y Linter Check aprobados.** Los ocho cambios incompatibles —tres campos, una mutación y cuatro valores de enumeración— **sin ninguna operación registrada afectada** |
| Enumeraciones en base | `RevisionStatus`: `DRAFT, IN_REVIEW, APPROVED, SUPERSEDED, ABANDONED`. `WorkflowStatus` intacta |
| Índice parcial en base | `WHERE (status <> 'ABANDONED')` |
| Columnas en base | `document_revisions` con las tres `abandon*`; `review_workflows` con las tres `cancel*` |
| Búsqueda del nombre viejo en `201-mi-webapp` | Ningún consumidor escrito a mano. Solo los artefactos de codegen, que se regeneran al cerrar el bloque |

**Pendiente del cierre del bloque, no de esta fase**: `rover-publish-current` y `npm run codegen` en la webapp. Hasta entonces la webapp local sigue viendo el esquema viejo, que es lo esperado.

### Fase C — modelo y migración

**Completada.** Migración `20260814140000_ownership_by_level`.

**Sin cambios de comportamiento**, como el plan de fases preveía: las operaciones existentes hacen lo mismo que antes sobre el modelo nuevo. Lo que cambia de comportamiento —editar la metadata sobre la revisión, replicarla, y las seis operaciones de la copia de trabajo— es la fase E.

| Cambio | Estado |
| ------ | ------ |
| `title`, `documentClassId`, `documentTypeId` en `document_revisions`, con respaldo desde el documento | Aplicado |
| Renombre a `currentTitle`, `currentDocumentTypeId`, `currentDocumentClassId` | Aplicado |
| `obsoletedAt`, `obsoletedById`, `obsoleteReason` en `documents` | Aplicado |
| `doc_version_files`, con las versiones existentes migradas a rol `DELIVERABLE` | Aplicado |
| `doc_working_copies` y `doc_working_copy_files` | Aplicado |
| `doc_replacements` y `doc_replacement_items` | Aplicado |
| Enumeraciones `DocFileRole` y `DocReplacementRole` | Aplicadas |

**El renombre alcanzó lugares que el compilador no señala.** `tsc` no valida los `where` ni los `data` de Prisma cuando están tipados como `any`, de modo que los filtros del listado, el `select` del selector, el mapa de ordenamiento y los payloads de prueba **se revisaron a mano**. Uno de ellos —una prueba que creaba versiones con los campos de archivo en línea— compilaba y fallaba en ejecución.

**Dos adaptaciones dejan una deuda declarada, que la fase E cierra:**

- `updateDocument` escribe la copia del documento y **todavía no la revisión**, de modo que las dos pueden divergir. Es el comportamiento anterior, trasladado al nombre nuevo.
- `registerVersion` conserva su forma de un archivo y lo registra como entregable. La copia de trabajo con sus seis operaciones la reemplaza.

**La firma ya lee la identificación de la revisión** y no del documento. No es un cambio observable —la migración las dejó iguales—, pero es la fuente correcta. El payload sigue en `v1`, con el primer entregable; la fase D lo lleva a `v2` con la lista completa.

| Verificación | Resultado |
| ------------ | --------- |
| `prisma migrate deploy`, `generate` y `migrate status` | Aplicada, cliente regenerado, base al día |
| `tsc --noEmit` | Sin errores |
| `npm run test:block03-all` | **180 pruebas, 0 fallos** — 177 anteriores más tres de las restricciones nuevas |
| `rover subgraph check` | **Operation Check y Linter Check aprobados**, sin operaciones registradas afectadas |
| Índices en base | `doc_working_copies_open_key` parcial sobre `confirmedAt IS NULL AND discardedAt IS NULL`; unicidad de archivo por versión; terna del ítem de reemplazo |

**Pruebas nuevas contra base**, en `modelConstraintsPersistence`: el checksum obligatorio por archivo; que un `fileKey` no se repita dentro de una versión ni cambiando de rol; que la segunda copia de trabajo abierta se rechace **y que descartar la primera habilite otra**, que es lo que verifica que el índice sea parcial; y que un documento no se repita con el mismo papel en un acto de reemplazo, pero sí con el otro.

**Lo que la verificación no cubre:** la base local estaba vacía al migrar, de modo que el respaldo de metadata a las revisiones y la conversión de versiones a `doc_version_files` **se ejercitaron sin filas**. En un despliegue con datos conviene contrastar los conteos antes y después.

### Fase D — utilidades puras

**Completada.** Cuatro derivaciones, sin operaciones que las usen todavía: eso es la fase E.

**El payload firmado pasa a `v2`,** y el cambio de forma es mayor que agregar una lista. La identificación **se muda de `document` a `revision`**, porque después de `B1` es ahí donde vive: el título, la clase y el tipo están impresos en el rótulo, y lo impreso pertenece a la emisión que lo produjo. Bajo `document` queda solo lo que es suyo —el id y el código—, que no necesita snapshot precisamente porque no cambia.

**El orden de los archivos se fija en el código y no se confía a la base.** `canonicalize` ordena las claves de los objetos pero conserva el orden de los arreglos, de modo que la misma versión habría producido hashes distintos según cómo viniera de la consulta. `orderSignedFiles` ordena por rol y después por `fileKey`, y hay una prueba que verifica que invertir la lista no altera el hash.

**Las firmas anteriores siguen verificándose**, y hay una prueba que lo demuestra con un payload `v1` construido a mano: verificar es recalcular sobre el payload guardado, no reconstruirlo desde entidades que pudieron cambiar.

**La réplica de metadata resultó ser la regla que ya existía.** La copia del documento es la metadata de `lastLiveRevision` —la última no abandonada—, que es la misma función de la que sale el código sucesor: una regla con tres usos. De ahí cae sola la propiedad que el bloque perseguía: **abandonar una revisión devuelve la metadata anterior sin necesidad de revertir nada**, porque la abandonada deja de ser la última viva y el cálculo cae en la que estaba antes. Nunca se sobrescribió el origen.

**La causa de la obsolescencia se deriva del papel en el acto**, no de su existencia: haber reemplazado a otro (`REPLACING`) no vuelve obsoleto a nadie, y un documento que reemplazó y después fue reemplazado lo está por reemplazo. Ambos casos tienen prueba.

**La copia de trabajo distingue cambio de reordenamiento.** Un archivo cambió si cambió su `checksum` o su rol; el nombre y el tamaño acompañan al contenido y no se evalúan aparte, porque no pueden cambiar sin que cambie el archivo. Recibir los mismos archivos en otro orden **no** es un cambio, y arrastrar la fuente sin volver a subirla tampoco — es lo que vuelve barata la edición.

| Verificación | Resultado |
| ------------ | --------- |
| `tsc --noEmit` | Sin errores |
| `npm run test:block03b-all` | **210 pruebas, 0 fallos** |
| `rover subgraph check` | Aprobado. Solo cambia la descripción del payload |

Suites nuevas `test:document-metadata` y `test:working-copy`, y los guiones `test:block03b`, `-db` y `-all` que las incorporan.

### Fase E — operaciones

**Completada.** Es la primera fase que cambia comportamiento.

| Operación | Qué resuelve |
| --------- | ------------ |
| `updateRevisionMetadata` | La identificación se edita en la revisión, y se replica a la copia del documento en el mismo acto |
| `updateDocument` | Queda solo con lo administrativo, y **pierde su precondición de congelamiento** |
| `correctDocumentCode` | La ventana del error de carga, con acción propia en la traza |
| `replaceDocuments` | El acto N:M, que deja obsoletos a los reemplazados |
| `obsoleteDocument` | La segunda causa: fuera de alcance, sin que nada reemplace |
| `openWorkingCopy`, `putWorkingCopyFile`, `removeWorkingCopyFile`, `confirmWorkingCopy`, `discardWorkingCopy` | El ciclo de la copia, con la versión naciendo al confirmar |

**El congelamiento dejó de tener código.** `updateDocument` llevaba una precondición que leía la última revisión viva y rechazaba si estaba aprobada. Con la identificación en la revisión, esa precondición **se borra**: lo que queda en el documento no aparece en ningún rótulo. La regla no se trasladó, desapareció — que es lo que `B1` prometía al volverla estructural.

**Adjuntar y reemplazar un archivo resultaron ser la misma operación.** `putWorkingCopyFile` cubre las dos: el hecho es que el conjunto pasa a tener este archivo con este contenido. Distinguirlas obligaría al llamador a saber qué había antes, que es justamente lo que la copia precargada le evita.

**Someter también exige la copia cerrada,** no solo aprobar y rechazar. Someter es declarar que la elaboración terminó, y es la misma contradicción.

**Un defecto que las pruebas puras no habrían encontrado.** `preloadFrom` devolvía los archivos con un `spread` de la fila, arrastrando `id`, `versionId` y `createdAt`: la copia intentaba nacer con la identidad de otro y fallaba recién al escribir en base. Se corrigió proyectando la forma exacta, y **se agregó la prueba pura que lo habría atrapado** — verifica las claves que la proyección devuelve, no solo los valores.

| Verificación | Resultado |
| ------------ | --------- |
| `tsc --noEmit` | Sin errores |
| `npm run test:block03b-all` | **220 pruebas, 0 fallos** |
| Búsqueda en `201-mi-webapp` | Ningún consumidor escrito a mano usa las operaciones ni los campos retirados |

**El `rover subgraph check` cambió de veredicto, y el motivo no es el código.** Ahora informa *"Compared 47 schema changes against 0 operations"* y marca los retiros como `FAIL`; en las fases B y C la misma comprobación pasó. Lo que cambió es que **no queda ninguna operación registrada en la ventana**, de modo que el veredicto pasó a ser el que corresponde por defecto a un cambio incompatible cuando no hay con qué probar que es seguro.

Conviene ser preciso sobre qué afirmaba aquel `PASSED`: que **ninguna operación registrada usaba** lo retirado. No que los cambios no fueran incompatibles — siempre lo fueron, y están declarados como tales. Hoy la comprobación ya no distingue *"nadie lo usa"* de *"no sabemos"*, y por eso la evidencia que sostiene el retiro es la búsqueda en la webapp y no el check. El `Linter Check` sigue aprobando.

**`registerVersion` queda marcada como obsoleta y no se retira todavía**: internamente ya escribe el conjunto con el archivo como entregable, y romperla antes de que la fase G retire el campo del contrato no compra nada.

### Fase F — trazabilidad

**Completada.** Migración `20260814160000_replacement_object_type`.

Las acciones y transiciones se habían incorporado en la fase E, porque las operaciones no podían emitir sin ellas. Lo que esta fase resuelve es **de qué objeto cuelga cada traza**, que es donde había quedado un defecto.

**El acto de reemplazo recibe tipo de objeto propio.** En la fase E su evento apuntaba a `replacingIds[0]` —el primero de los que reemplazan—, y esa elección era arbitraria: el acto toca varios documentos y ninguno lo representa. Con `DOC_REPLACEMENT`, el evento apunta al acto, que es lo que tiene identidad propia, y desde ahí se llega a todos.

**Su contexto se deriva de cualquiera de sus documentos, y eso no es una comodidad.** Los documentos de un acto comparten ámbito por `B5`, y esa invariante es justamente lo que vuelve **bien definida** la derivación: cualquiera da la misma respuesta. Si el acto pudiera cruzar de un proyecto al régimen de publicación, no habría contexto único que derivar — otra consecuencia de que lo que cruza sea promoción y no reemplazo.

**La copia de trabajo no recibe tipo propio, y es deliberado.** Su traza cuelga de la revisión: no es un objeto del dominio sino el conjunto en preparación de esa revisión, y lo que alguien consulta es qué le pasó a la revisión, no qué le pasó a la copia 17 que se descartó. Ponerla aparte partiría en dos una línea de tiempo que se lee entera.

| Verificación | Resultado |
| ------------ | --------- |
| `tsc --noEmit` | Sin errores |
| `npm run test:block03b-all` | **224 pruebas, 0 fallos** |
| Enumeración en base | `DocObjectType` con catorce valores |
| Derivación de contexto | Los catorce tipos con derivador, y ninguno devuelve contexto vacío para un objeto inexistente |

Pruebas nuevas: la derivación del acto de reemplazo contra base; que las siete acciones y las dos transiciones del bloque queden registradas; que el evento del reemplazo apunte al acto y no a un documento; y que la traza de la copia de trabajo cuelgue de la revisión con su contexto derivado.

### Fase G — contrato GraphQL

**Completada.**

| Cambio | |
| ------ | --- |
| Tipos nuevos | `DocWorkingCopy`, `DocWorkingCopyFile`, `DocReplacement`, `DocReplacementItem`, `DocVersionFile` |
| Enumeraciones nuevas | `DocFileRole`, `DocReplacementRole`, `ObsolescenceCause`, y `DOC_REPLACEMENT` en `DocObjectType` |
| Mutaciones nuevas | Nueve: la edición de identificación, la corrección de código, el reemplazo, la obsolescencia y las cinco de la copia |
| Retiros | `registerVersion` y `RegisterVersionInput`; `title`, `documentType` y `documentClass` de `UpdateDocumentInput` |

**`registerVersion` se retiró de verdad, no se marcó obsoleta.** La fase E la había dejado en pie con el comentario correspondiente; acá se fue con su input, y su archivo quedó **vacío a propósito**: el objeto sigue existiendo y sus lecturas viven en `resolversTypes`, de modo que borrar el módulo diría algo distinto de lo que corresponde. Que no haya operaciones sobre versiones es una decisión, y el archivo vacío la declara — que es lo que `H-34` pedía.

**La causa de la obsolescencia se expone derivada.** `Document.obsolescenceCause` la calcula en el resolver, y aprovecha los `replacementItems` si el padre ya los trajo.

**Se agregó una prueba que ninguna verificación existente cubría:** que el contrato y los resolvers digan lo mismo, **en las dos direcciones**. `tsc` no sabe qué declara el `.graphql`, y `rover subgraph check` compara el esquema contra las operaciones registradas —que hoy son cero—, no contra la implementación. Las dos direcciones fallan distinto: una operación declarada sin resolver devuelve `null` en silencio, y un resolver sin declarar es inalcanzable hasta que alguien lo busca.

El primer intento de esa prueba tenía un defecto propio: contaba los argumentos de las operaciones multilínea como si fueran campos, porque se declaran con la misma forma. Se corrigió llevando la profundidad de paréntesis.

| Verificación | Resultado |
| ------------ | --------- |
| `tsc --noEmit` | Sin errores |
| `npm run test:block03b-all` | **230 pruebas, 0 fallos** |
| Contrato ↔ resolvers | Sin operaciones declaradas sin resolver, ni resolvers sin declarar |
| `rover subgraph check` | `Linter Check` aprobado. El `Operation Check` sigue fallando por los 0 operaciones registradas, no por el contenido |

**Pendiente del cierre**: `rover-publish-current` y `npm run codegen` en la webapp. Se difieren a propósito — publicar cambia lo que ve el desarrollo local, y conviene hacerlo cuando el bloque esté cerrado y no entre fases.

### Fase H — pruebas de las tres capas

**Completada.** **238 pruebas, 0 fallos**: **138 puras**, **46 contra base** y **54 de integración**.

**Auditar los criterios uno por uno encontró un invariante sin implementar.** El criterio 12 pedía que un documento reemplazado rechazara abrir una revisión nueva, y **no había código que lo hiciera**: `createRevision` no miraba `obsoletedAt`. Ni la compilación ni las 230 pruebas anteriores lo señalaban, porque nada lo ejercitaba. Es exactamente lo que esta fase existe para encontrar, y la razón de recorrer los criterios en lugar de dar por buena la cobertura acumulada.

Emitir sobre lo que ya fue superado —o sobre lo que salió del alcance— es contradictorio. Todo lo demás se conserva, que es justamente lo que la obsolescencia preserva y la baja lógica no.

**Ocho criterios estaban cubiertos solo a medias**, y se completaron:

| Criterio | Lo que faltaba |
| -------- | -------------- |
| 5 y 16 | Una firma con **los tres** archivos y sus tres `checksum`, con el respaldo adentro |
| 9 | Que el filtro por tipo resuelva sobre el documento y no por join |
| 10 | Los dos valores a la vez: `currentTitle` en la B y la vigente conservando el de la A |
| 11 | Que el acto se alcance desde **los tres** documentos, y no solo desde el que lo creó |
| 13 | Que el código de un obsoleto siga tomado — dar de alta el mismo se rechaza |
| 15 | Que la causa derivada distinga las dos, y devuelva nulo para el que reemplaza |
| 17 | Que ningún estado de revisión sea `CANCELLED` en toda la base del proyecto |
| 24 | Que el atajo y la secuencia incremental produzcan **la misma versión**, comparada archivo por archivo |

El criterio 17 quedó como una comprobación sobre el conjunto y no sobre un caso: recorre las revisiones del proyecto y verifica que **ninguna** lleve el estado del circuito. Es la forma de probar una colisión de vocabulario — un caso puntual no demuestra que no reaparezca en otro lado.

| Verificación | Resultado |
| ------------ | --------- |
| `tsc --noEmit` | Sin errores |
| `npm run test:block03b-all` | 238 pruebas, 0 fallos |
| Los 24 criterios | Cubiertos, con la implementación del 12 incorporada en esta fase |

## Referencias

- `DOCUMENT_EVOLUTION_PLAN.md` — D-23, D-24, D-25 y la nota prospectiva de promoción al activo
- `BLOCK_03_CICLO_INTERNO.md` — B4, B6, B12, B14
- `BLOCK_02_CONTEXTO_DE_PROYECTO.md` — unicidad del código
- `../SFS/domain/10_cycle/80_Principios_del_Modelo.md` — §3, §4, §5, §6, §12, §13
- `../../prisma/schema.prisma`
- `../../src/utils/stepSignature.ts`
