# Bloque 03 — Ciclo interno de revisión

**Estado:** `LISTO_PARA_PROMOVER` — implementado y validado en local. Resta la verificación por cliente y el despliegue; la SFS se escribe después.
**Versión:** 1.0
**Depende de:** `BLOCK_02`, cuyo contexto de proyecto y autorización en dos capas este bloque da por sentados.
**Decisiones que ejecuta:** D-03, D-04, D-05, D-10, D-11, D-13, D-17 y la consecuencia de D-19 sobre la toma de conocimiento. Resuelve H-01 a H-10, H-20, H-27 y H-34, y cierra H-19 en los dos catálogos.
**Registro de definiciones:** `BLOCK_03_REGISTRO_DE_DEFINICIONES.md`, con el planteo y las alternativas de cada decisión.

## Objetivo

Corregir el ciclo del documento: cómo se arma el circuito, quién elabora, cómo se generan versiones, cómo se somete a uno o varios circuitos de aprobación, qué acredita la firma, y cómo se sale de un rechazo, de una cancelación o de un abandono.

**Es el primer bloque que cambia reglas funcionales.** `BLOCK_01` sustituyó el registro y `BLOCK_02` agregó contexto sin tocar el ciclo; acá cambian estados, precondiciones, operaciones y contrato.

## Línea base confirmada

Verificada sobre el código después de `BLOCK_02`. El relevamiento completo está en el registro de definiciones; lo que sigue es lo que condiciona el trabajo.

- **El circuito empieza tarde y termina mal.** Se crea con `initiateReview`, cuando el documento ya está hecho: la elaboración y su asignación no existen en el modelo. `ReviewWorkflow.revisionId` es `@unique`, de modo que una revisión admite un solo circuito.
- **H-01 está confirmado en el código**: `rejectStep` devuelve la revisión a `DRAFT`, `initiateReview` rechaza un segundo circuito por la unicidad, y `createRevision` rechaza abrir otra revisión mientras haya una en `DRAFT`. Las tres juntas dejan al documento sin salida.
- **La firma no acredita nada verificable.** `SHA-256(stepId + userId + timestamp + action)`, sin la versión, sin el `checksum` y **sin persistir los insumos** (H-06). `approveStep` tampoco verifica que el actor sea el asignado (H-03).
- **Los pasos `ACKNOWLEDGE` quedan pendientes y además invisibles**: `completesWorkflow` los excluye del cálculo, y `pendingReviewSteps` filtra por circuitos abiertos, de modo que dejan de listarse apenas el workflow se completa. Nadie los ve ni puede cerrarlos.
- **La cancelación es indistinguible del rechazo**: deja el workflow en `REJECTED`, emite la transición de rechazo y guarda el motivo solo en el `meta` del evento (H-05).
- **`RevisionScheme` tiene dos valores** —`ALPHABETICAL` y `NUMERIC`—, vive en el documento, y `createRevision` acepta cualquier código sin validarlo (H-09). `DocumentType.requiresWorkflow` se persiste y **no se consulta nunca** (H-02).
- **`checksum` es anulable y nadie lo calcula**: no está en `mi-fileserver`, que por diseño no ve los bytes. El precedente portable es digitalización, donde el navegador lo computa antes de pedir la URL presignada.
- **`Document.currentRevision` tiene dos implementaciones divergentes** en el mismo resolver, que pueden devolver revisiones distintas para el mismo documento.
- **`202-mi-common` no tiene permiso de revisión ni de versión** (H-22), por lo que `createRevision` y `registerVersion` exigen permiso de documento. El precedente de un permiso administrativo es `DOCUMENTS_SCANNED_FILE_ADMIN_UPDATE`.
- **Ningún consumidor.** No hay pantallas del ciclo y ningún subgraph invoca estas operaciones: los cambios incompatibles de contrato no rompen a nadie.
- **43 pruebas puras** corriendo hoy, y 72 en total con base e integración. `src/utils/reviewWorkflow.ts` ya aísla la lógica del circuito y declara en su comentario que su corrección corresponde a este bloque.
- **PostgreSQL 16** en producción y en testing, 17 en local: `NULLS NOT DISTINCT` está disponible.

## Decisiones ya aprobadas que aplican

- **D-03** — toda revisión se aprueba por workflow. Ampliada por `B1`: el circuito abarca además el armado y la elaboración.
- **D-04** — la aprobación admite delegación registrada. Ampliada por `B9`: se incorpora la reasignación.
- **D-05** — la firma acredita quién aprobó y qué aprobó, con los datos firmados persistidos.
- **D-10** — la revisión es la unidad externa y la versión la iteración interna.
- **D-11** — una revisión admite varios circuitos sucesivos.
- **D-13** — el esquema de revisión es configurable, con tres valores.
- **D-17** — cancelar aborta sin borrar historia. Confirmada y ampliada por `B11`.
- **D-19** — en el rol `INTERNAL` la aprobación es terminal, y la toma de conocimiento comunica el documento aprobado.
- **B1 y B5 de `BLOCK_01`** — prefijo `Doc` en los nombres genéricos; acciones en imperativo y transiciones en participio.
- **B7 de `BLOCK_02`** — autorización en dos capas, con filtrado en los listados.

## Alcance incluido

1. El circuito completo, desde el armado hasta la toma de conocimiento, instanciado con la revisión.
2. La plantilla del circuito y la designación obligatoria del armador.
3. Varios circuitos sucesivos por revisión, con un solo circuito abierto.
4. El documento y la revisión que se crean sin archivo (H-20).
5. La versión como archivo inmutable, con `checksum` obligatorio.
6. El congelamiento de la metadata con la revisión aprobada.
7. La firma como objeto propio, con su payload persistido.
8. Delegación y reasignación, bajo un permiso único.
9. El cierre de la toma de conocimiento.
10. La cancelación del circuito y el abandono de la revisión.
11. El esquema de revisión propuesto y no persistido.
12. La revisión vigente y la revisión en curso, resueltas en un solo lugar.
13. El cierre de H-19 en `DocumentClass` y `DocumentType`.
14. Exposición GraphQL de todo lo anterior, y pruebas automatizadas.

## Fuera de alcance

- **Toda la circulación**: transmittals, respuesta de la contraparte, puerta de emisión, matriz de responsabilidad, documentos esperados y paquete de información de entrada. Es `BLOCK_04`.
- **El circuito del rol Receptor**, que solo existe después de una recepción. `B16` declara sus dos particularidades y este bloque las **habilita**, no las implementa.
- **El catálogo de calificaciones de la contraparte** (D-22), que reemplaza a la enumeración fija `ClientStatus`.
- **Los estados terminales de la revisión por respuesta de la contraparte** (D-10).
- **La validación del `checksum` por el almacenamiento**, diferida a un trabajo propio sobre `mi-fileserver` (registro, Q49).
- **La ubicación física jerárquica** (D-14), que es `BLOCK_02B`, y **el alcance por proyecto de los catálogos** (D-21), que es `BLOCK_02C`.
- **La interfaz de usuario** (`BLOCK_05`), incluido el cálculo del `checksum` en la carga.
- **H-22 en su parte de catálogo**: recursos de permiso propios para revisión y versión.
- `Attachment` (D-08), `TaskDocumentReference` y `Document.projectTaskId` (D-07). `ScannedFile` y `Area`.

## Decisiones del bloque

### B1 — El circuito abarca el ciclo completo y se instancia con la revisión

El circuito deja de ser el trámite de aprobación de un documento terminado y pasa a ser el ciclo entero. **Se crea junto con la revisión**, no con `initiateReview`.

| Paso | `StepType` | Quién | Completarlo significa |
| ---- | ---------- | ----- | --------------------- |
| Armado | `ASSIGN` | El armador designado al crear la revisión | Quedan designados el elaborador y los revisores, y **se materializan los pasos siguientes** |
| Elaboración | `PREPARE` | El elaborador designado | El documento está hecho y **se somete a revisión** |
| Revisión, aprobación, toma de conocimiento | `REVIEW`, `APPROVE`, `ACKNOWLEDGE` | Los designados | Lo que ya significan hoy |

Los dos nombres nuevos los aporta el dominio: el rótulo de un plano declara *Prepared by / Reviewed by / Approved by*. `PREPARE` es elaborar el documento; `ASSIGN` es el acto sobre el circuito, que no es lo mismo.

**`initiateReview` desaparece** y se reparte en dos operaciones: **definir el circuito** —completa el armado— y **someter** —completa la elaboración—.

**Estados de la revisión:** `DRAFT` mientras el circuito está en armado o en elaboración; `IN_REVIEW` desde que se somete. No se agregan estados: el detalle de dónde está el trabajo lo da el paso vigente, y duplicarlo en la revisión crearía dos máquinas de estados describiendo lo mismo.

**Reinstanciación, según la salida:**

| Salida | Circuito nuevo | Elenco |
| ------ | -------------- | ------ |
| Rechazo | Desde `PREPARE` | El mismo, **copiado** |
| Cancelación del circuito (`B11`) | Desde `ASSIGN` | Redefinible |
| Revisión nueva | Desde `ASSIGN` | Redefinible |

El elenco se **copia** y no se referencia: reasignar un paso del circuito nuevo no debe alterar la historia del anterior.

**El workflow mínimo de D-03 deja de ser un objeto**: es un circuito cuyo armado designa un único paso de aprobación. No necesita regla propia.

**`DocumentType.requiresWorkflow` se renombra a `requiresFormalReview`** y pasa a distinguir el circuito formal del mínimo. Es **sugerencia y no invariante**: propone el armado, no lo impone. Mismo criterio con que D-18 trata la matriz de responsabilidad.

### B2 — Una revisión tiene un solo circuito abierto

`ReviewWorkflow.revisionId` deja de ser único, conforme a D-11. Lo reemplaza un **índice único parcial**:

```sql
CREATE UNIQUE INDEX review_workflows_open_revision_key
  ON review_workflows (revision_id) WHERE status = 'IN_PROGRESS';
```

Prisma no expresa índices parciales: va como SQL en la migración y se documenta como comentario en el modelo, igual que en B2 de `BLOCK_02`.

Bajo `B1` el índice describe el estado normal y no solo un tope: **toda revisión viva tiene exactamente un circuito abierto**, desde que nace hasta que se aprueba o se abandona.

**El circuito vigente se deriva**; no se almacena un `currentWorkflowId`, que sería un dato derivado con riesgo de desincronizarse.

**Contrato:** `DocumentRevision.workflow` se retira y lo reemplazan `workflows: [ReviewWorkflow!]!` y `currentWorkflow: ReviewWorkflow`. Conservar el singular perpetuaría la lectura de que hay uno solo.

**`WorkflowStatus.PENDING` se retira** (H-08): el circuito nace iniciado. Arrastra tres cambios — el filtro de `pendingReviewSteps`, el `@default` de `ReviewWorkflow.status`, y el valor en `WorkflowStatusInput`.

**`RevisionStatus.OBSOLETE` se conserva sin uso**, declarado como tal, hasta que `BLOCK_04` defina los estados terminales por respuesta. Retirarlo para reponerlo costaría dos migraciones de enumeración.

### B3 — La plantilla propone el circuito; el armado lo define

**Una plantilla con sus pasos**: orden, tipo y **actor preasignado opcional**.

- **Alcance por proyecto, con refinamiento por clase y por tipo de documento.** Las columnas de clase y tipo admiten nulo y **la más específica gana**: tipo, después clase, después proyecto. La plantilla del proyecto con ambas nulas **es** su default, sin necesidad de una marca aparte.
- **Unicidad del alcance con `NULLS NOT DISTINCT`**, disponible desde PostgreSQL 15 y verificado en los tres ambientes. Sin eso la tupla con dos columnas anulables repetiría el defecto de H-19.
- **La plantilla no incluye el armado ni la elaboración.** Esos pasos los pone el sistema **según el rol del proyecto**: en el rol Receptor no hay elaboración (`B16`).
- **Los valores se copian al materializarse.** Cambiar la plantilla no altera circuitos en curso, con el mismo criterio del snapshot de D-14 y del payload firmado de `B7`.

**El elaborador nunca se preasigna.** Designarlo es distribuir carga de trabajo y se decide documento por documento. Por eso el armado tiene contenido incluso con la plantilla más completa, y por eso siempre existe.

**El armador se designa al crear el documento y es obligatorio.** Es el único actor que debe conocerse en el alta; todo lo demás lo trae la plantilla o lo decide el armado.

- Con **valor por defecto configurado en `DocProjectSettings`** —habitualmente el jefe de proyecto—, de modo que en la práctica el campo llega lleno.
- **Puede serlo cualquiera con permiso y membresía vigente.** No se crea un padrón de armadores: sería una tercera lista y D-15 ya descartó multiplicarlas.
- **El paso de armado se reasigna como cualquier otro** (`B9`). Es lo que cubre que el alta se lo asigne al jefe de proyecto y este lo derive al jefe de especialidad.

**Entre el alta y el armado existe el circuito**, con su paso de armado pendiente y la plantilla propuesta referenciada. **Los pasos siguientes se materializan al completarse el armado**, y no antes, porque hasta entonces no tienen actor y `ReviewStep.assignedToId` no admite nulo.

En consecuencia **no existe documento sin circuito**: lo que en la práctica se describe como dar de alta ahora y asignar el workflow después es este estado, y no una excepción a D-03.

La plantilla propuesta se resuelve por alcance en el alta y **puede cambiarse**, por quien crea el documento y por el armador. Propone, no impone.

### B4 — Una versión es un archivo, y es inmutable

| Nivel | Qué incluye | Qué produce al cambiar |
| ----- | ----------- | ---------------------- |
| Documento | Código, título, descripción, clase, tipo | Actualización auditada |
| Revisión | Código de revisión, estado | Transición de la revisión |
| Versión | `fileKey`, `fileName`, `fileSize`, `mimeType`, `checksum` | **Solo existe con archivo nuevo** |

Lo que la versión guarda no es metadata del documento sino **descripción del archivo**: no puede cambiar sin que cambie el archivo. Es lo que le da sentido a D-05 — la firma acredita una versión porque una versión **es** un archivo.

**La versión no se modifica ni se elimina**, y eso incluye su comentario: si quedó mal, la corrección va en la traza y no editando la evidencia.

**El comentario es opcional.** La observación casi siempre viaja dentro del archivo, como marcas; el comentario es complemento y no el registro de la objeción. Exigirlo reintroduciría por la puerta de atrás la clasificación de versiones que D-10 descarta y que H-35 dejó `DESCARTADO`.

**El `checksum` es obligatorio en toda versión** (H-27). No hay datos productivos, de modo que la migración es directa, y cualquier regla condicional obligaría a decidir qué pasa con la versión que entró sin él y después resulta ser la firmada.

**Declarado: hoy nadie lo calcula.** `mi-fileserver` no lo produce y por diseño no ve los bytes. Hasta que exista `BLOCK_05`, quien invoque la API debe enviarlo. Es la única regla del bloque cuyo cumplimiento depende de un componente que este bloque no construye.

### B5 — La versión la produce quien tiene el paso vigente

**No es una restricción de identidad sino de momento**: cada versión es el producto del paso que se está ejecutando. La elabora el elaborador, la marca el revisor, la marca el aprobador.

- El **permiso de `B9`** habilita hacerlo por otro.
- **Una revisión aprobada no admite versiones nuevas**, porque no tiene paso vigente. Es lo que impide que la firma quede acreditando una versión que dejó de ser la última.
- **Al crear el documento o la revisión, quien crea puede adjuntar el archivo inicial.** El archivo deja de ser obligatorio (H-20), no admisible.
- **Registrar una versión no cambia el estado de la revisión**: durante el circuito permanece en `IN_REVIEW`. Solo el rechazo la devuelve a `DRAFT`.

**Comentar no genera versión; marcar el archivo sí.** El comentario del revisor vive en el paso, que ya lo tiene.

Los dos recorridos que el bloque debe sostener:

| | Documento nuevo | Documento preexistente |
| - | --------------- | ---------------------- |
| **v1** | La registra el elaborador en su paso | La adjunta quien da de alta el documento |
| **v2** | El revisor marca el archivo | El elaborador incorpora el cambio del proyecto |
| **v3…** | El aprobador aprueba, o marca y rechaza | El revisor marca, si tiene observaciones |

**La vigente es la última, y coincide con la aprobada**: como el circuito cierra aprobando y después no se admiten versiones, la última versión de una revisión aprobada es la que se aprobó.

### B6 — La metadata se congela con la revisión aprobada

**Toda la metadata del documento**, y se corrige abriendo una revisión nueva.

El motivo es material: parte de la metadata está **impresa dentro del archivo**. El rótulo lleva el código, el título y a menudo la clase y el tipo — de hecho el código habitualmente **se compone** de clase y tipo. La clasificación no es descripción sino **identidad**.

- Mientras la revisión vigente **no esté aprobada**, la metadata se edita libremente.
- **Aprobada, se congela.** Corregirla exige abrir una revisión nueva, que es lo que el control documental hace igual: un rótulo distinto es un documento distinto.
- **Abrir la revisión siguiente la vuelve a habilitar.**

**La metadata vigente al firmar se incorpora al payload firmado** (`B7`): la firma pasa a acreditar la identificación además del contenido, que es lo que D-05 persigue, y el snapshot por revisión queda resuelto sin estructura nueva.

Tres bordes declarados:

- **El esquema de revisión queda fuera**: es configuración de cómo se numeran las revisiones siguientes, no identificación de esta.
- **Colisión a resolver en `BLOCK_02B`**: D-14 admite corregir un nodo de ubicación y propagarlo de forma auditada a documentos ya emitidos. Es una excepción controlada a este congelamiento y las dos reglas deben conciliarse allí.
- **Abandonar una revisión no revierte la metadata** cambiada mientras estaba abierta. El documento queda declarando algo que ninguna revisión aprobada reproduce, hasta que se emita la siguiente. Retroceder sería peor.

### B7 — La firma es un objeto propio con su payload

`DocStepSignature`, **uno por firma**, referenciado por el paso. La firma es evidencia inmutable y el paso se sigue actualizando; separarlos permite declararla inmutable sin excepciones y la hace trazable con su propio tipo de objeto.

**Se persiste el payload canónico serializado** que se usó para calcular el hash, más el algoritmo. Un hash sin sus insumos no es verificable, que es el defecto de H-06.

Contenido del payload:

- el **paso**, su **workflow** y su **revisión**;
- la **versión vigente al firmar**, con su número, `fileKey` y `checksum`;
- la **metadata del documento** vigente al firmar (`B6`);
- el usuario **asignado** y el que **resolvió**, y el motivo cuando difieren (`B9`);
- la **acción** y el momento.

**El rechazo firma igual que la aprobación** — de hecho su evidencia importa más, porque documenta qué se objetó.

**Firman los pasos que actúan sobre una versión**: `PREPARE`, `REVIEW`, `APPROVE` y `ACKNOWLEDGE`. **`ASSIGN` no firma**: al completarse puede no existir todavía ninguna versión, de modo que no habría objeto que acreditar; su evidencia es el evento de auditoría.

Son exactamente las casillas del rótulo más el acuse: quien elabora firma lo que entrega, quien revisa firma lo que revisó, quien aprueba firma lo que aprobó, y quien toma conocimiento firma lo que vio.

**Las firmas anteriores no se invalidan cuando aparece una versión nueva.** Cada una acredita la versión sobre la que actuó su autor y **ninguna afirma nada sobre las posteriores**. Cuando el cambio es sustantivo, lo que corresponde no es invalidar sino **retirar la revisión del circuito** (`B11`).

### B8 — Hay pasos que deciden y pasos que se cumplen

`StepStatus` incorpora **`COMPLETED`**, estado terminal de cumplimiento para los pasos que no emiten juicio: `ASSIGN`, `PREPARE` y `ACKNOWLEDGE`. Dejarlos en `APPROVED` diría que alguien aprobó el armado.

Deja explícita una partición que hoy vive escondida en `completesWorkflow`:

- **`REVIEW` y `APPROVE` deciden**: son los únicos que pueden rechazar y los únicos que cuentan para completar el circuito;
- **`ASSIGN`, `PREPARE` y `ACKNOWLEDGE` se cumplen.**

Cumplir y juzgar son cosas distintas, pero **ambas se acreditan**: la partición no coincide con la de `B7` sobre qué pasos firman.

### B9 — Delegar y reasignar, bajo un permiso único

**Se registra siempre quién resolvió efectivamente el paso** (`resolvedById`), y la divergencia con el asignado se **deriva** de ambos campos. Un indicador booleano sería un dato calculable que puede contradecir a los que lo originan.

**La delegación exige motivo**, conservado en el paso y dentro del payload firmado. Es lo que la vuelve trazable y no solo permitida.

**Se incorpora la reasignación del paso**, que convive con la firma delegada y resuelve otra cosa: la delegación resuelve el momento, la reasignación la conducción — el revisor que no está, o la redistribución de carga de trabajo, incluida la elaboración de un documento ya asignado.

- Alcanza a los pasos **pendientes**, incluido el vigente. **Un paso resuelto no se reasigna**: su firma acredita quién lo resolvió.
- **No altera el circuito**: cambia el actor, nunca el tipo del paso, su orden ni cuántos son.
- Es **acción de auditoría y no transición de estado**, porque el paso sigue `PENDING`. El historial de asignados queda en la traza, sin columna nueva.

**La estructura del circuito es inmutable una vez armada**: no se agregan, quitan ni reordenan pasos. La excepción aparente no lo es — el armado **crea** los pasos siguientes, y la inmutabilidad rige desde que se completa. Es lo que le deja a la cancelación un uso propio (`B11`).

**Un solo permiso especial gobierna todo acto sobre el trabajo ajeno**: firmar por otro, reasignar, registrar una versión sobre un paso ajeno y consultar pendientes ajenos. Sigue el precedente de `DOCUMENTS_SCANNED_FILE_ADMIN_UPDATE`.

**`pendingReviewSteps` devuelve los del usuario autenticado** (H-07). Su argumento `userId` pasa a **opcional**: informado y distinto, exige el permiso especial. Sigue acotado por membresía — el permiso habilita ver pendientes ajenos, no proyectos ajenos.

### B10 — La toma de conocimiento cierra después de la aprobación

El circuito cierra con los pasos que deciden, y **los acuses se resuelven después**, con operación propia. Es lo que D-19 describe: el acuse **comunica** un documento ya aprobado, de modo que bloquear la aprobación invertiría su función y cerrarlo de oficio lo convertiría en un registro vacío.

Exige tres cosas, ninguna opcional:

1. **Una operación de acuse**, que hoy no existe;
2. **el estado terminal de `B8`**;
3. **corregir `pendingReviewSteps`**, que hoy los oculta apenas el circuito se completa. Los acuses viven precisamente en circuitos cerrados, que es el conjunto que esa consulta excluye — es la razón por la que hoy quedan pendientes para siempre.

**Sin permiso propio**: `DOCUMENTS_WORKFLOW_UPDATE`, el mismo de aprobar y rechazar. Un acuse es la resolución de un paso asignado.

### B11 — Cancelar el circuito y abortar la revisión son dos actos

D-17 se confirma y se amplía: **se conserva** que la cancelación no elimina historia y que adopta identidad propia con su motivo en el modelo; **cae** la restricción de cancelar solo antes de la primera firma.

**Se cancela en cualquier punto, aun con pasos ya firmados.** El caso que lo exige es el real: se abre una revisión, se avanza, y a mitad del circuito se concluye que no corresponde continuarla. Exigir que ninguna firma exista obligaría a completar un circuito que ya se sabe inútil, o a rechazarlo simulando un rechazo que nadie emitió. **El riesgo que motivaba la restricción no se reabre porque nada se elimina.**

| Acto | Cuándo | Efecto |
| ---- | ------ | ------ |
| **Cancelar el circuito** | Quedó mal armado, o se sometió lo que no correspondía | El circuito queda cancelado; **la revisión sobrevive**, vuelve a `DRAFT` y se rearma desde `ASSIGN` |
| **Abortar la revisión** | La revisión dejó de tener sentido | La revisión queda abortada en la historia; si tiene circuito abierto, se cancela con ella |

Ambas exigen motivo. **La reasignación no las suple**: cubre *quién*, mientras que la cancelación cubre *cómo está armado* y *qué se sometió*. Como `B9` fija que los pasos no se editan, un paso olvidado no tiene otra salida que rearmar.

**Formas:**

- `WorkflowStatus.CANCELLED`, con `cancelledAt`, `cancelledById` y `cancelReason`, y transición `WorkflowCancelled`. Hoy la cancelación emite la transición de rechazo, que es la misma confusión de H-05 trasladada a la traza. Los pasos pendientes quedan `SKIPPED` y **los resueltos conservan su estado y su firma**.
- `RevisionStatus.CANCELLED`, con los mismos tres campos y transición `RevisionCancelled`. **No se reutiliza `OBSOLETE`**: obsoleto es lo que dejó de aplicar, no lo que se abandonó antes de salir.

**Solo se aborta una revisión no aprobada** — `DRAFT` o `IN_REVIEW`. Aprobada, la revisión es el documento vigente y lo que corresponde es abrir la siguiente. Como la emisión exige aprobación (D-18), **una revisión abortada nunca fue emitida**, y este bloque no le deja a `BLOCK_04` ningún caso de transmittal sobre una revisión abandonada.

**No hace falta restituir la revisión anterior**: la supersesión ocurre al aprobarse la sucesora, y una abortada nunca se aprueba. La anterior nunca dejó de estar vigente.

**Permisos**: `DOCUMENTS_WORKFLOW_UPDATE` para cancelar el circuito —hoy exige `CREATE`, que es la parte de H-22 que este bloque toca— y `DOCUMENTS_DOCUMENT_UPDATE` para abortar la revisión.

### B12 — La revisión abortada no consume código

Sobre un documento en revisión `A` puede abrirse `B`, abortarse, y abrirse más adelante otra vez `B`, que se completa. Es el mismo principio con que D-10 impide que el rechazo interno agote la secuencia: **lo que la contraparte ve son las revisiones que salieron.**

Exige dos cambios, y uno solo no alcanza:

1. **La unicidad `@@unique([documentId, revisionCode])` se reemplaza por un índice único parcial** que excluye a las abortadas:

   ```sql
   CREATE UNIQUE INDEX document_revisions_code_key
     ON document_revisions (document_id, revision_code) WHERE status <> 'CANCELLED';
   ```

2. **El cálculo del código sucesor ignora las abortadas.** Sin esto el sistema propondría `C` donde el usuario espera `B`.

Consecuencia aceptada: un documento puede tener **varias revisiones abortadas con el mismo código**. Es correcto y el índice lo admite; cada una se distingue por su fecha y su motivo.

**Las revisiones se ordenan por secuencia de creación y nunca por código** (H-10). Con el cambio de esquema la secuencia puede quedar `A, B, C, 0, 1`, de modo que ordenar por código pierde sentido. Es invariante y no observación: alcanza a cada `orderBy` del módulo, a la derivación del sucesor —la última **no abortada** por creación— y a la interfaz de `BLOCK_05`.

### B13 — El esquema de revisión se propone y no se persiste

`RevisionScheme` pasa a `ALPHA`, `NUMERIC` y `FREE_TEXT`, alineado con el precedente de digitalización.

**El esquema no se guarda en el documento. Se elige al crear la revisión, y el sistema propone el código.**

- **Primera revisión** — el código se propone según el esquema del proyecto, o el valor por defecto del despliegue.
- **Revisiones siguientes** — el código se calcula a partir de la **última revisión no abortada**, infiriendo el esquema de la forma de su código: dígitos continúan en `NUMERIC`, letras en `ALPHA`. La inferencia solo interpreta valores que el propio sistema generó, porque bajo `FREE_TEXT` el código lo escribe el usuario.
- **Cambiar de esquema** es elegir otro en ese momento, y la secuencia se reinicia: de `C` a `NUMERIC` da `0`, que es lo que H-10 describía como el comportamiento buscado.

El motivo es que un esquema almacenado **puede contradecir a los hechos**: declararlo `NUMERIC` con la revisión vigente en `A` afirma algo que el documento no muestra, y obliga a inventar una precondición para tapar la incoherencia.

**Se retiran `Document.revisionScheme`, la operación `switchRevisionScheme` y su acción de auditoría.**

La precedencia de tres niveles se conserva —documento, proyecto, despliegue— pero **el escalón del documento se lee de su última revisión en lugar de guardarse**.

**Validación de los códigos** (H-09): bajo `ALPHA` y `NUMERIC` el sistema calcula el código y **rechaza el informado**; bajo `FREE_TEXT` lo ingresa el usuario y solo se valida que no se repita entre las revisiones no abortadas.

**Configuración**: el esquema por proyecto reside en `DocProjectSettings` (B4 de `BLOCK_02`), y el valor por defecto del despliegue en un **registro único**, con el patrón de `CatalogSettings`. **Sin etiqueta configurable**: "revisión" es terminología establecida del dominio.

**Se extrae `src/utils/revisionScheme.ts`**, con la generación del **sucesor** y la inferencia del esquema. No se porta `revisionListSize`: la lista responde a validar contra un conjunto cerrado, que es el problema de digitalización y no el de acá.

Lo que se pierde, declarado: un documento no puede fijar de antemano el esquema que va a seguir. Existe la secuencia de sus revisiones, que es el hecho.

### B14 — Revisión vigente y revisión en curso

| Campo | Qué devuelve |
| ----- | ------------ |
| `currentRevision` | **La última aprobada, y solo la aprobada.** Nulo mientras el documento no haya aprobado ninguna |
| `lastRevision` | **La última no abortada por secuencia de creación**, en cualquier estado |

Con `A` aprobada y `B` en circuito, `currentRevision` es `A` y `lastRevision` es `B`. **Ninguna considera las abortadas.**

**Se exponen y no se derivan en cada consumidor.** Ambas son derivables, y precisamente por eso las dos ramas divergentes de `currentRevision` llegaron a devolver revisiones distintas para el mismo documento. Resolverlas en un solo lugar es la corrección.

Dos apoyos: **a lo sumo hay una revisión en `APPROVED`**, porque aprobar supersede a las anteriores; y **`lastRevision` es la misma revisión de la que `B12` deriva el código sucesor** — una sola regla con dos usos.

**`currentRevision` cambia de significado sin cambiar de forma**: hoy cae en `DRAFT` cuando no hay aprobada. `rover subgraph check` no lo va a señalar y debe declararse por escrito en la evidencia.

**Frontera con `BLOCK_04`**: cuando la respuesta de la contraparte cierre la revisión emitida, habrá que revisar si la vigente sigue siendo la que está en `APPROVED`.

### B15 — La unicidad de los catálogos se cierra con `NULLS NOT DISTINCT`

Cierra la parte de H-19 que `BLOCK_02` dejó abierta.

| Modelo | Restricción | Cuándo no impide el duplicado |
| ------ | ----------- | ----------------------------- |
| `DocumentClass` | `[name, module]`, `[code, module]` | `module` nulo |
| `DocumentType` | `[name, classId, module]`, `[code, classId, module]` | `module` o `classId` nulos |

**El caso que no protegen es el más frecuente**: un catálogo recién sembrado tiene casi todas sus entradas sin módulo y sin clase. No cambia ninguna regla funcional: la restricción pasa a impedir lo que siempre quiso impedir.

**Condición operativa, distinta del resto del bloque: estos catálogos tienen datos en producción.** La migración falla si ya existen duplicados. Antes de aplicarla hay que verificarlo por cliente con una consulta de solo lectura y **limpiar los que aparezcan** — a diferencia de la precondición de `BLOCK_02`, donde un resultado no vacío cancelaba la migración.

Deja preparado el terreno para D-21, que agrega otra columna anulable a estas mismas tuplas.

### B16 — El ciclo no se ramifica por rol

| Rol | Circuitos por revisión | Cómo termina |
| --- | ---------------------- | ------------ |
| **Emisor** | Varios: cada rechazo abre uno nuevo | La aprobación habilita la emisión al cliente |
| **Interno** | Varios, igual que Emisor | La aprobación es terminal |
| **Receptor** | **Uno solo**: la calificación cierra la revisión | La calificación se comunica a quien emitió |

**Las dos diferencias del rol Receptor se desprenden de un solo hecho: allí la elaboración no ocurre dentro del sistema.** El contratista sube documentación ya aprobada por sus propios medios y la planta no modela su ciclo interno (D-18), de modo que el circuito no tiene a quién devolverle el trabajo.

La regla uniforme es **el rechazo devuelve el trabajo a quien elabora**; lo que cambia es dónde vive esa persona. En Receptor está afuera, así que la revisión se cierra y la siguiente emisión lleva revisión nueva — que es D-10 aplicada, no una regla nueva: allí el circuito no es el ciclo interno sino el mecanismo con que la contraparte produce su respuesta.

**Como ese circuito solo existe después de una recepción, pertenece a `BLOCK_04`.** Este bloque construye el ciclo tal como lo viven Emisor e Interno, idénticos entre sí salvo por lo que ocurre después de aprobar.

**Lo que este bloque deja habilitado:**

- que un circuito pueda armarse **sin paso de elaboración** (`B3`);
- que la conclusión de un circuito pueda ser **terminal para la revisión**;
- que el armado admita ser **propuesto por una matriz de responsabilidad** y no solo por una plantilla: en la forma de `B3`, la matriz de D-18 es otra fuente de propuesta para el mismo paso.

**Los tres finales son comunicaciones y ninguna forma parte del circuito**: la emisión al cliente y la calificación al contratista son `BLOCK_04`; el aviso interno ya está resuelto acá, porque en el rol Interno la comunicación **es** el paso de toma de conocimiento (`B10`).

## Cambios de modelo

| Objeto | Cambio |
| ------ | ------ |
| `StepType` | `+ ASSIGN`, `+ PREPARE` |
| `StepStatus` | `+ COMPLETED` |
| `WorkflowStatus` | `− PENDING`, `+ CANCELLED` |
| `RevisionStatus` | `+ CANCELLED`; `OBSOLETE` se conserva sin uso |
| `RevisionScheme` | `ALPHABETICAL → ALPHA`, `+ FREE_TEXT` |
| `ReviewWorkflow` | Cae `@unique` en `revisionId`; índice parcial de circuito abierto; `+ cancelledAt`, `cancelledById`, `cancelReason`; referencia a la plantilla propuesta |
| `ReviewStep` | `+ resolvedById`, motivo de delegación; `signatureHash` se traslada a la firma |
| `DocStepSignature` | **Nuevo**: payload canónico, hash, algoritmo. Inmutable |
| `DocumentRevision` | `+ assignedOrganizerId`; `+ CANCELLED` con sus tres campos; unicidad del código por índice parcial |
| `DocumentVersion` | `checksum` pasa a obligatorio |
| `Document` | `− revisionScheme` |
| `DocumentType` | `requiresWorkflow → requiresFormalReview` |
| `DocWorkflowTemplate` y sus pasos | **Nuevos**, con alcance `[projectId, classId, typeId]` y `NULLS NOT DISTINCT` |
| `DocSettings` | **Nuevo**: registro único con el esquema por defecto del despliegue |
| `DocProjectSettings` | `+ revisionScheme`, `+ defaultOrganizerId` |
| `DocumentClass`, `DocumentType` | Sus cuatro restricciones pasan a `NULLS NOT DISTINCT` |

Cuatro índices únicos parciales en total en el módulo: los dos de `Document` que `BLOCK_02` creó, más los de `B2` y `B12`.

## Mapa de operaciones

| Operación | Cambio |
| --------- | ------ |
| `createDocument` | Deja de exigir archivo; designa armador; instancia el circuito con su paso `ASSIGN`; propone plantilla y código; ya no recibe esquema |
| `createRevision` | Igual que la anterior; valida el código según el esquema; ignora abortadas al derivar el sucesor |
| `updateDocument` | Precondición nueva: rechaza si la revisión vigente está aprobada (`B6`) |
| `registerVersion` | Admite `IN_REVIEW`; exige `checksum` y paso vigente; admite el permiso especial |
| `initiateReview` | **Se retira.** La reemplazan `defineWorkflow` y `submitRevision` |
| `defineWorkflow` | **Nueva**: completa `ASSIGN`, designa elaborador y revisores, materializa los pasos |
| `submitRevision` | **Nueva**: completa `PREPARE`, exige al menos una versión, pasa la revisión a `IN_REVIEW` |
| `approveStep` | Firma con payload; registra `resolvedById` y motivo; excluye `ACKNOWLEDGE` del cómputo por tipo y no por excepción |
| `rejectStep` | Igual, y **reinstancia el circuito desde `PREPARE`** copiando el elenco |
| `acknowledgeStep` | **Nueva**: cierra un paso `ACKNOWLEDGE` en `COMPLETED`, con firma |
| `reassignStep` | **Nueva**: cambia el actor de un paso pendiente, con motivo y permiso especial |
| `cancelWorkflow` | Precondición nueva; estado `CANCELLED` con motivo en el modelo; permiso `WORKFLOW_UPDATE` |
| `cancelRevision` | **Nueva**: aborta la revisión en `DRAFT` o `IN_REVIEW`, con motivo |
| `switchRevisionScheme` | **Se retira** |
| `pendingReviewSteps` | `userId` opcional; incluye acuses de circuitos cerrados; sin `PENDING` en el filtro |
| `workflowsByStatus` | Sin `PENDING`; `+ CANCELLED` |
| `docProjectSettings`, `declareDocProjectSettings` | Suman esquema y armador por defecto |
| Plantillas y `DocSettings` | **Nuevas**: lectura y administración |
| `Document.currentRevision`, `lastRevision` | Una única implementación, con la semántica de `B14` |

**Autorización**: todas conservan la capa de `BLOCK_02`. Las operaciones nuevas siguen el mismo mapa — doble capa sobre objeto, filtrado en listados.

## Trazabilidad

- **Tipos de objeto nuevos**: `DOC_STEP_SIGNATURE` y `DOC_WORKFLOW_TEMPLATE`, con su derivador de contexto en `objectContext.ts`. La prueba de `BLOCK_01` que verifica que ningún tipo quede sin regla debe seguir pasando.
- **Acciones de auditoría nuevas**: `DefineWorkflow`, `SubmitRevision`, `AcknowledgeStep`, `ReassignStep`, `CancelRevision`, más las de plantilla y configuración. **Se retira `SwitchRevisionScheme`.**
- **Transiciones nuevas**: `WorkflowCancelled`, `RevisionCancelled`, `StepCompleted`.
- La prueba que fija el número de acciones del catálogo se actualiza explicando por qué, como se hizo en `BLOCK_02`.

## Fases de implementación

| Fase | Contenido |
| ---- | --------- |
| A | **Permisos**: el permiso especial de `B9` y el del registro de configuración del despliegue, en `202-mi-common`; alta en el seed de `205-mi-admin` y asignación a los roles; republicación y actualización de la dependencia. |
| B | **Modelo y migración**: enumeraciones, entidades nuevas, columnas, los dos índices parciales y las cuatro restricciones de catálogo. Precedida por la verificación de duplicados de `B15`. |
| C | **Utilidades puras**: `revisionScheme` con sucesor e inferencia; construcción y verificación del payload firmado; extensión de `reviewWorkflow` con la partición de `B8`. |
| D | **Operaciones**, según el mapa, resolver por resolver. |
| E | **Trazabilidad**: tipos, acciones, transiciones y derivadores de contexto. |
| F | **Contrato GraphQL**, con los retiros declarados. |
| G | **Pruebas** de las tres capas. |
| H | **Cierre documental**: recién entonces se evalúa la promoción a la SFS. |

La fase A precede a todas, como en `BLOCK_02`: sin los permisos publicados no hay con qué autorizar las operaciones nuevas.

## Estrategia de pruebas

Mismo enfoque que los bloques anteriores: `node:test` con `node --import tsx --test`, sin dependencias nuevas.

**Puras**, extendiendo `src/utils/reviewWorkflow.test.ts`:

- completitud del circuito con acuses pendientes, y la partición de `B8`;
- pasos salteados por rechazo y por cancelación;
- cálculo del código sucesor por esquema, **inferencia del esquema** y omisión de las abortadas;
- resolución de la plantilla por alcance, con la más específica ganando;
- construcción del payload firmado y su verificación posterior;
- precondiciones: metadata congelada, cancelación, abandono, registro de versión.

**Contra base**:

- los dos índices parciales —circuito abierto único, y código único entre no abortadas—;
- las cuatro restricciones de catálogo con módulo y clase nulos;
- la unicidad del alcance de la plantilla con nulos;
- la inmutabilidad de la firma y la secuencia de versiones con varios circuitos.

**Integración**, sobre el arnés de `BLOCK_02`, **cuatro recorridos completos**:

1. **Documento nuevo** — alta con armador, armado, elaboración, someter, revisión, aprobación y acuse.
2. **Documento preexistente** — alta con archivo adjunto, y el resto del recorrido.
3. **Rechazo** — versión marcada, rechazo, circuito nuevo desde `PREPARE` con el mismo elenco, corrección y aprobación. Es el escenario que H-01 hoy vuelve imposible.
4. **Abandono** — circuito a mitad de camino con un paso firmado, abandono con motivo, y revisión nueva que **recupera el mismo código**.

## Criterios de aceptación

1. Los cuatro recorridos de integración se ejecutan de punta a punta.
2. Una revisión rechazada admite corrección y un circuito nuevo sin consumir código — H-01 cerrado.
3. Un documento sin revisión formal llega a aprobado por un circuito de un solo paso de aprobación — H-02 cerrado.
4. Toda resolución de paso registra quién la ejecutó, y la delegación queda visible y motivada — H-03 cerrado.
5. Un paso pendiente se reasigna sin alterar la estructura del circuito, y uno resuelto no admite reasignación.
6. El alta designa al armador y propone la plantilla resuelta por alcance; el armado la confirma o la cambia y materializa los pasos.
7. Un documento se crea sin archivo y su primera versión aparece durante la elaboración; someter exige al menos una versión con `checksum` — H-20 y H-27 cerrados.
8. Con una revisión aprobada la metadata no se edita, y abrir la siguiente la habilita.
9. Los pasos de toma de conocimiento tienen operación, estado terminal y visibilidad — H-04 cerrado.
10. La cancelación es distinguible del rechazo y conserva su motivo en el modelo — H-05 cerrado.
11. El ciclo `A` aprobada ▸ `B` abortada a mitad de circuito ▸ `B` nueva completada se ejecuta, y el sistema propone `B` y no `C`.
12. `currentRevision` devuelve la aprobada o nada, `lastRevision` la última no abortada, y ambas coinciden en una única implementación.
13. La firma es verificable a posteriori sobre datos persistidos, e incluye la identificación del documento — H-06 cerrado.
14. `pendingReviewSteps` devuelve los propios, y los ajenos solo con el permiso especial — H-07 cerrado.
15. Los códigos responden al esquema vigente y el orden de las revisiones no depende del código — H-09 y H-10 cerrados.
16. Ninguna operación modifica ni elimina una versión existente — H-34 cerrado.
17. Las cuatro restricciones de los catálogos rechazan el duplicado con módulo o clase nulos, después de verificar y limpiar duplicados preexistentes en cada cliente — **H-19 cerrado por completo**.
18. Ninguna regla de circulación cambió: `BLOCK_04` parte del estado que dejó `BLOCK_02`, con lo que `B16` deja habilitado.
19. `prisma validate`, `migrate`, `tsc --noEmit` y `npm run build` sin error; las 72 pruebas previas siguen aprobadas.
20. Verificación de tablas vacías del subsistema documental en cada cliente antes de migrar.
21. `rover subgraph check` ejecutado, con los retiros documentados y aceptados, y con el **cambio de significado de `currentRevision` declarado por escrito**, que la herramienta no señala.
22. La SFS se actualiza únicamente después de reunir estas evidencias.

## Evidencia de validación

Se completa por fase, como en los bloques anteriores.

### Fase A — permisos

**`202-mi-common` 2.6.0 publicado** en GitHub Packages, con un recurso y tres permisos:

| Recurso | Permisos | Qué gobierna |
| ------- | -------- | ------------ |
| `documentsSettings` | `documents:documentsSettings:read`, `:update` | El registro único de configuración del despliegue de `B13`, donde reside el esquema de revisión por defecto |
| `workflow` | `documents:workflow:admin:update` | El permiso único de `B9` sobre el trabajo ajeno del circuito: firmar por otro, reasignar un paso pendiente, registrar una versión sobre un paso ajeno y consultar pendientes ajenos |

- El permiso especial sigue la forma de `DOCUMENTS_SCANNED_FILE_ADMIN_UPDATE` —acción literal `admin:update` sobre el recurso ya existente— y no crea recurso propio: **no es H-22**, que sigue fuera de alcance. El recurso nuevo es solo el de configuración, que no tenía ninguno.
- Commit `1d1a561` más el de versión `5355e77`, con tag `v2.6.0`. Local y remoto coinciden; árbol limpio.
- `prettier --check`, `tsc --noEmit` y `eslint` sin errores. El total del catálogo pasó de 404 a **407 permisos**.

**`205-mi-admin` 2.2.5**, commit `d8294f3`:

- Las tres altas en `prisma/seeds/seedPermissions.ts`, con nombre y descripción, y el reparto en `prisma/seeds/shared/rolePermissions.ts`: **`doc-basic` lee la configuración del despliegue**; **`doc-full` suma su edición y la administración de circuitos ajenos**. El permiso especial queda solo en el rol completo, como el precedente de archivos escaneados.
- `tsc --noEmit` y `npm run build` sin errores contra la versión publicada. Verificado además que las 407 entradas del seed no tienen códigos repetidos y que ningún rol referencia un código inexistente.
- Se revirtió otra vez el ruido de regeneración del cliente Prisma, que era solo espacios en blanco.
- `WhatIsNew.md` actualizado.

**`209-mi-document`**: dependencia en `^2.6.0`, commit `24b3c24`, `tsc --noEmit` y `npm run build` sin errores, y las **72 pruebas siguen aprobadas** — 43 puras (15 de eventos, 7 del circuito, 11 de alcance de proyecto, 10 de configuración y contexto) y 29 de base e integración.

**Aplicación en base, únicamente local** (`mi-admin-pg`, `mi_admin_db`, puerto 5405), con `npm run seed:permissions`, que opera por upsert:

- permisos: 404 → **407**;
- `role_permissions`: 790 → **794**, es decir las cuatro asignaciones nuevas;
- reparto verificado en base: `doc-basic` recibe `documentsSettings:read`; `doc-full` recibe los tres.

**Pendiente de esta fase**: la aplicación sobre las bases de los demás clientes (`proion`, `maria`, `austin`, `optimal`). Los permisos existen como constante publicada y como seed, pero todavía no están en esas bases.

### Fase B — modelo y migración

Ejecutada sobre la base local de desarrollo (`mi-document-pg`, `mi_document_db`, puerto 5409, PostgreSQL 17.9), con respaldo previo.

**Precondición verificada primero**, con `prisma/checks/block03_precondicion.sql`: veredicto **`APTO PARA MIGRAR`** — subsistema documental en 0 filas y **ningún grupo duplicado** en los catálogos, que es la condición propia de `B15`. Los catálogos locales tienen 5 clases y 3 tipos, todos con módulo informado.

- `prisma validate` sin error. Migración `20260812120000_add_internal_review_cycle`, aplicada con `prisma migrate deploy`. Son **10 migraciones** en total.
- **El orden de la migración no es el que genera `prisma migrate diff`.** El generador emite el cambio de `RevisionScheme` antes de crear las tablas que la usan y antes de que `documents` pierda su columna, de modo que la migración fallaría. Se reordenó a mano y se verificó que `migrate diff` contra el estado resultante devuelva **una migración vacía**: el archivo y el esquema coinciden.
- **`requiresWorkflow` se renombró con `ALTER TABLE ... RENAME COLUMN`** y no con el `DROP`/`ADD` que genera Prisma, para conservar los valores ya cargados. Verificado en base sobre los tres tipos existentes.
- **Los `ADD VALUE` fijan la posición del valor nuevo.** Sin `BEFORE`/`AFTER` el valor queda al final del tipo, y el orden físico de una enumeración es el que PostgreSQL usa al ordenar por esa columna: `ASSIGN` y `PREPARE` habrían quedado después de `ACKNOWLEDGE`, invirtiendo la secuencia del circuito. Las cinco enumeraciones quedaron en base con el orden que declara el modelo.

| Enumeración | Estado en base |
| ----------- | -------------- |
| `StepType` | `ASSIGN`, `PREPARE`, `REVIEW`, `APPROVE`, `ACKNOWLEDGE` |
| `StepStatus` | `PENDING`, `COMPLETED`, `APPROVED`, `REJECTED`, `SKIPPED` |
| `WorkflowStatus` | `IN_PROGRESS`, `COMPLETED`, `REJECTED`, `CANCELLED` — sin `PENDING` |
| `RevisionStatus` | `DRAFT`, `IN_REVIEW`, `APPROVED`, `SUPERSEDED`, `CANCELLED`, `OBSOLETE` |
| `RevisionScheme` | `ALPHA`, `NUMERIC`, `FREE_TEXT` |

**Entidades nuevas**: `doc_step_signatures`, `doc_settings`, `doc_workflow_templates` y `doc_workflow_template_steps`. **Columnas**: las de cancelación en revisión y circuito, `assignedOrganizerId`, `templateId`, `resolvedById`, `delegationReason`, `revisionScheme` y `defaultOrganizerId` en la configuración de proyecto. **Retiros**: `Document.revisionScheme`, `ReviewStep.signatureHash` y el `@unique` de `ReviewWorkflow.revisionId`.

**Los nueve índices especiales existen en base y fueron probados en las dos direcciones**, dentro de una transacción revertida:

| Caso | Resultado |
| ---- | --------- |
| Clase o tipo duplicado con `module`/`classId` nulos | **Rechazado** por las cuatro restricciones de `B15` |
| Segunda plantilla con el mismo alcance, todo nulo | **Rechazada** por `doc_workflow_templates_scope_key` |
| Plantilla refinada por clase sobre el mismo proyecto nulo | Aceptada |
| Dos revisiones `A` abortadas sobre el mismo documento | **Aceptadas** — el código no se consume (`B12`) |
| Segunda revisión `A` no abortada | **Rechazada** por `document_revisions_code_key` |
| Circuitos sucesivos cancelado + rechazado + abierto | **Aceptados** — es H-01 cerrado en la base |
| Segundo circuito abierto sobre la misma revisión | **Rechazado** por `review_workflows_open_revision_key` |
| Versión sin `checksum` | **Rechazada** por la restricción `NOT NULL` |
| Segunda firma sobre el mismo paso | **Rechazada** por `doc_step_signatures_stepId_key` |

Las cuatro restricciones de catálogo y el alcance de la plantilla se declaran igual como `@@unique` en el modelo, aunque la cláusula la aporte la migración: Prisma no expresa `NULLS NOT DISTINCT` pero tampoco la ve, de modo que retirarlas del modelo dejaría una deriva permanente y perdería la clave compuesta en el cliente. Los índices parciales, en cambio, son invisibles para Prisma y viven solo en SQL, como en `BLOCK_02`.

**`prisma.config.ts` incorpora `shadowDatabaseUrl`**, que `migrate diff` sobre un directorio de migraciones ahora exige. Es de desarrollo: `migrate deploy` no la usa.

**Estado declarado al cerrar la fase**: `tsc --noEmit` reporta **12 errores**, todos en resolvers —`documents`, `revisions`, `versions` y `workflows`—, y **4 de las 16 pruebas de integración fallan** por la misma causa. Son exactamente las operaciones que la fase D reescribe: `revisionScheme` retirado, `checksum` obligatorio, `WorkflowStatus.PENDING` retirado y `revision.workflow` ahora plural. Las **56 pruebas restantes siguen aprobadas**, incluidas las 43 puras.

### Fase C — utilidades puras

Tres utilidades, sin dependencias nuevas y sin tocar la base.

**`src/utils/revisionScheme.ts`** — sucesor, inferencia y validación del código.

- `firstRevisionCode`, `nextRevisionCode` e `inferRevisionScheme`. Se porta de digitalización la **generación y no la lista**: `revisionListSize` responde a validar contra un conjunto cerrado, que es el problema de allá.
- `proposeRevisionCode` reúne los tres casos de `B13` — primera revisión por precedencia, siguiente por inferencia, y **reinicio de la secuencia al cambiar de esquema**, que es el `C` ▸ `0` que H-10 describía como el comportamiento buscado.
- `decideRevisionCode` cierra H-09 devolviendo una decisión y no lanzando: bajo `ALPHA` y `NUMERIC` **rechaza el código informado** cuando difiere del calculado; bajo `FREE_TEXT` lo exige y verifica que no se repita entre las revisiones vivas.
- `lastLiveRevision` ordena **por creación y nunca por código** (`B12`, H-10), con desempate por alta. Es una sola regla con dos usos: de esa revisión se deriva el código sucesor y es la que `lastRevision` expondrá (`B14`).

**`src/utils/stepSignature.ts`** — construcción y verificación del payload firmado.

- `buildSignature` produce payload canónico, algoritmo y hash. La serialización **ordena las claves en todos los niveles**: `JSON.stringify` conserva el orden de inserción, de modo que el mismo contenido construido de otra forma produciría otro hash y la verificación posterior dejaría de ser concluyente.
- El payload lleva un **`payloadVersion`** que se firma junto con el resto. Sin él, un cambio futuro en la forma del payload dejaría las firmas viejas indistinguibles de las nuevas y no se sabría con qué reglas recalcularlas.
- `verifySignature` recalcula el hash **sobre el payload guardado** y no reconstruyéndolo desde las entidades, que pudieron cambiar. Es lo que cierra H-06: la verificación responde si la evidencia fue alterada.
- `signsStep` declara la partición de `B7`: `ASSIGN` no firma.

**`src/utils/reviewWorkflow.ts`** — la partición de `B8`, que hasta ahora vivía escondida dentro de `completesWorkflow`.

- `DECIDING_STEP_TYPES` y `FULFILLING_STEP_TYPES`, con `isDecidingStep` y `favorableStatusFor`.
- `completesWorkflow` cuenta **por tipo y no por excepción**. Para `ACKNOWLEDGE` el resultado no cambia; lo que cambia es que la regla está declarada y alcanza también a `ASSIGN` y `PREPARE`.
- `pendingAcknowledgeSteps` e `isReassignable`, que las operaciones de `B9` y `B10` consumen.

**Las dos particiones no coinciden, y quedan como dos funciones distintas**: `ACKNOWLEDGE` se cumple pero firma. Cumplir y juzgar son cosas distintas, pero ambas se acreditan.

**Un borde declarado**: `completesWorkflow` devuelve `false` cuando el circuito no tiene ningún paso que decida. No debería existir —el armado designa al menos un paso de aprobación (`B1`)— y la operación de la fase D debe exigirlo; queda probado que, de construirse uno así, el circuito no cierra solo.

**Pruebas**: se adelantó la parte pura de la fase G, porque la evidencia de una utilidad pura **es** su prueba. Las de base e integración siguen en G.

| Suite | Antes | Ahora |
| ----- | ----- | ----- |
| `reviewWorkflow` | 7 | **13** |
| `revisionScheme` | — | **22** |
| `stepSignature` | — | **11** |
| Puras del módulo | 43 | **82** |

`npm run test:block03` corre las seis suites puras. `tsc --noEmit` conserva **los mismos 12 errores** de la fase B y ninguno nuevo: las utilidades compilan limpias.

### Fase D — operaciones

Las 17 operaciones del mapa, resolver por resolver. **`tsc --noEmit` y `npm run build` vuelven a pasar sin error**, por primera vez desde la fase B.

**Tres cosas se adelantaron de la fase E, porque sin ellas las operaciones no podían emitir**: el catálogo de acciones y transiciones, los tres tipos de objeto nuevos y sus derivadores de contexto. Una operación que no puede registrar lo que hizo no está terminada.

- Migración `20260812140000_add_internal_cycle_object_types`, puramente aditiva. Son **11 migraciones**.
- **`DOC_SETTINGS` es un tercer tipo de objeto que el bloque no enumera.** Se incorpora porque el bloque **sí** exige acciones de auditoría sobre la configuración del despliegue, y toda acción declara el tipo del objeto que afecta: sin él, esas acciones no tendrían dónde apuntar.
- El catálogo pasa de **28 a 35 acciones**: retira `InitiateReview` y `SwitchRevisionScheme` —cuyas operaciones desaparecen— y suma nueve. Tres transiciones nuevas: `WorkflowCancelled`, `RevisionCancelled` y `StepCompleted`. La prueba que fija el número se actualizó explicando el saldo, como en `BLOCK_02`.

**Decisiones de implementación que el bloque no fijaba**, declaradas acá para que no pasen inadvertidas:

- **`defineWorkflow` exige `DOCUMENTS_WORKFLOW_CREATE`**, que es el permiso que tenía `initiateReview`: materializar los pasos es crear el circuito. `submitRevision`, `acknowledgeStep` y `cancelWorkflow` exigen `WORKFLOW_UPDATE`, porque resuelven un paso o el circuito.
- **`holdsPermission`** es un verificador nuevo que devuelve booleano en lugar de rechazar. Lo necesita el permiso especial de `B9`: `admin:update` no condiciona el acceso a la operación sino **qué se admite dentro de ella**, de modo que su ausencia no puede cortar. Solo el rechazo por permiso se traduce en `false`; un token inválido o una caída del servicio de administración siguen propagándose.
- **`cancelWorkflow` abre el circuito siguiente desde el armado**, con el armador que la revisión designó. Es lo que `B11` describe —«la revisión sobrevive, vuelve a `DRAFT` y se rearma desde `ASSIGN`»— y sin ello la revisión quedaría viva sin circuito, contra el invariante de `B2`.
- **`pendingReviewSteps` deja de filtrar por estado del circuito**, en lugar de ampliar el filtro. El rechazo y la cancelación dejan sus pasos en `SKIPPED`, de modo que el estado del **paso** ya alcanza: filtrar por circuito abierto era justamente lo que ocultaba los acuses.
- **El armado exige al menos un paso que decida.** Cierra el borde que la fase C dejó declarado: `completesWorkflow` no completa un circuito sin `REVIEW` ni `APPROVE`, y ahora la operación que lo arma lo impide en origen.
- **Se agrega `proposedWorkflowTemplate`**, que no está en el mapa: resuelve la plantilla por alcance sin crear nada, para que la interfaz pueda mostrar el circuito propuesto **antes** de dar de alta. Es la misma resolución que hace el alta, expuesta.
- **`updateDocWorkflowTemplate` reemplaza los pasos en bloque.** Una plantilla es una propuesta completa, y editarla paso por paso invitaría a dejarla a medias. Dar de baja **no elimina**: los circuitos que la referencian conservan de dónde salió su propuesta.

**Utilidad nueva, `src/utils/workflowTemplate.ts`**, con la resolución de la plantilla por alcance, la materialización del armado y el elenco que hereda el circuito por rechazo. **17 pruebas puras**; la resolución por alcance figuraba en la estrategia de pruebas del bloque y no tenía dónde vivir. `src/utils/revisionSetup.ts` reúne lo que `createDocument` y `createRevision` resuelven igual —código, armador y plantilla—, con acceso a base y por eso fuera de las puras.

**Humo del ciclo completo** (`src/resolvers/cycle.smoke.ts`), ejecutado contra la base local y `mi-admin`. No reemplaza a los cuatro recorridos de la fase G; es la verificación de que las operaciones funcionan de punta a punta, porque compilar no prueba nada sobre el comportamiento:

| Verificado | Resultado |
| ---------- | --------- |
| Alta **sin archivo**, con código `A` propuesto y circuito en armado | Correcto — H-20 |
| Armado que completa en `COMPLETED` y materializa los cuatro pasos | Correcto — `B1`, `B8` |
| Someter **sin versión** | Rechazado |
| Rechazo que abre circuito nuevo desde `PREPARE` con el mismo elenco | Correcto — **H-01 cerrado en ejecución** |
| Aprobación que cierra el circuito con el acuse pendiente | Correcto — `B10` |
| Acuse **visible en circuito cerrado** y resuelto con operación propia | Correcto — H-04 |
| **6 firmas** persistidas, todas verificables sobre su payload | Correcto — **H-06 cerrado** |
| Metadata con la revisión aprobada | Rechazada — `B6` |
| `B` abandonada y `B` propuesta otra vez | Correcto — `B12` |
| `currentRevision` = `A` aprobada, `lastRevision` = `B` viva | Correcto — `B14` |

**Pruebas**: **130 en total**, de 111. Las puras pasan de 82 a **101** con las 17 de plantilla y 2 de paso vigente; 13 contra base y 16 de integración, **todas aprobadas**. Las de integración de `BLOCK_02` se adaptaron al alta sin archivo, que es un cambio mecánico de su fixture.

**Lo que queda para la fase F, declarado**: `schema.graphql` todavía declara `initiateReview` y `switchRevisionScheme` —que ya no tienen resolver— y no declara ninguna de las siete operaciones nuevas, de modo que son inalcanzables por GraphQL. El subgrafo **sí arma** —se verificó con `buildSubgraphSchema`—, pero esas dos operaciones fallarían en ejecución si alguien las invocara. No hay consumidores.

### Fase E — trazabilidad

**El grueso se ejecutó en la fase D**, porque una operación que no puede registrar lo que hizo no está terminada: el catálogo, los tres tipos de objeto y sus derivadores viajaron con los resolvers y quedaron registrados allí. Lo que esta fase aporta es **la verificación que faltaba**, que es justamente lo que no da ni la compilación ni la prueba pura.

**Ninguna acción ni transición quedó sin emisor.** Se recorrieron las **35 acciones** y las **24 transiciones** del catálogo contra los resolvers: todas tienen al menos uno. Es el control que impide que una entrada del catálogo quede declarada y muerta, o que una operación registre con un nombre que nadie más usa.

**Prueba nueva contra base**, `src/utils/objectContextPersistence.test.ts`, con **11 casos** que cubren **los trece tipos de objeto**:

| Verificado | Resultado |
| ---------- | --------- |
| Documento de proyecto, y documento publicado sin proyecto | Proyecto y módulo derivados; en el publicado el módulo es el único eje |
| Revisión, versión, circuito y paso | Derivan del documento, cadena completa |
| **Firma** | Deriva del paso: un nivel más en la misma cadena, la más larga del módulo |
| Transmittal | Lleva su proyecto; el módulo es `PROJECTS` por lo que el modelo afirma |
| Clases y tipos | Sin proyecto, con su módulo opcional |
| Configuración y membresía de proyecto | Con proyecto, sin módulo |
| **Plantilla** | Con el proyecto de su alcance, sin módulo |
| **Configuración del despliegue** | Sin proyecto y sin módulo — es lo que la vuelve el último escalón |
| Objeto inexistente, en los trece tipos | **`null`**, y no contexto vacío |

El último caso es el que la autorización necesita: distinguir «no pertenece a ningún proyecto» —que autoriza por permiso global— de «no existe» —que debe cortar con `NOT_FOUND`—. Confundirlos autorizaría operaciones sobre objetos inexistentes. **Una derivación equivocada no rompe la compilación**, porque el `Record` solo exige que la función exista: por eso esta prueba es la única evidencia posible.

**Dos cosas declaradas:**

- **`DOC_STEP_SIGNATURE` no tiene acción ni transición propias, y es correcto.** La firma se crea dentro de la resolución del paso, que ya emite `ApproveStep`, `RejectStep`, `SubmitRevision` o `AcknowledgeStep`; una acción aparte duplicaría el mismo hecho. El tipo existe para que la firma sea **direccionable**: se le puede consultar la traza y se le deriva contexto para autorizar su lectura.
- **`docWorkflowEvents` y `docAuditEvents` no necesitaron cambios.** Resuelven el permiso desde el catálogo y el alcance desde el derivador, de modo que los tres tipos nuevos quedaron consultables sin tocar el resolver. Es lo que `BLOCK_01` perseguía al derivar en lugar de declarar.

**Ninguno de los seis resolvers nuevos o reescritos escribe en `DocumentSysLog`**: la traza funcional va por eventos y el log operacional queda para los errores, que es la separación de `BLOCK_01`.

**Pruebas**: **141 en total**, de 130. 101 puras, **24 contra base** —11 nuevas— y 16 de integración, todas aprobadas.

### Fase F — contrato GraphQL

`schema.graphql` al día con las operaciones y el modelo. **`rover subgraph check` ejecutado contra `Maria-Ingenieria@current`, con los dos controles aprobados** y salida `0`.

| Control | Resultado |
| ------- | --------- |
| Operation Check | **PASSED** — 179 cambios comparados contra 49 operaciones registradas, **ninguna afectada** |
| Linter Check | **PASSED** — sin advertencias |

**Los 26 cambios incompatibles, aceptados con evidencia.** Ninguna operación registrada los toca, que es lo que la línea base ya anticipaba al declarar que el ciclo no tiene consumidores:

| Clase | Qué se retira o cambia |
| ----- | ---------------------- |
| `FIELD_REMOVED` (6) | `Document.revisionScheme`, `DocumentRevision.workflow`, `DocumentType.requiresWorkflow`, `ReviewStep.signatureHash`, y las mutaciones `initiateReview` y `switchRevisionScheme` |
| `FIELD_REMOVED_FROM_INPUT_OBJECT` (12) | El archivo obligatorio de `CreateDocumentInput` y `CreateRevisionInput`, y los pasos de `InitiateReviewInput` |
| `VALUE_REMOVED_FROM_ENUM` (4) | `ALPHABETICAL` en `RevisionScheme` y su input; `PENDING` en `WorkflowStatus` y su input |
| `TYPE_REMOVED` (1) | `InitiateReviewInput` |
| `FIELD_CHANGED_TYPE` (2) | `DocumentVersion.checksum` y `RegisterVersionInput.checksum`, de `String` a `String!` |
| `ARG_CHANGED_TYPE` (1) | `pendingReviewSteps.userId`, de `Int!` a `Int` |

> **DECLARADO POR ESCRITO — `currentRevision` cambia de significado sin cambiar de forma.**
>
> Sigue siendo `currentRevision: DocumentRevision`, de modo que **`rover` no lo señala y no lo va a señalar nunca**. Lo que cambia es qué devuelve:
>
> - **antes**: la aprobada si existía y, si no, la que estuviera en `DRAFT` o `IN_REVIEW` —una lectura corriente podía recibir un borrador como si fuera el documento del proyecto—;
> - **ahora**: **la última aprobada, y solo la aprobada.** Nula mientras el documento no haya aprobado ninguna.
>
> La revisión en curso pasa a leerse en **`lastRevision`**, que es campo nuevo. Un consumidor que use `currentRevision` para mostrar «en qué anda el documento» dejará de ver nada hasta la primera aprobación, y debe migrar a `lastRevision`. Es el único cambio del bloque que ninguna herramienta detecta.

**Tipos nuevos en el contrato**: `DocStepSignature`, `DocWorkflowTemplate`, `DocWorkflowTemplateStep` y `DocSettings`. **Inputs nuevos**: `InitialVersionInput`, `DefineWorkflowInput`, `WorkflowTemplateStepInput`, los dos de plantilla y `DeclareDocSettingsInput`. `DocObjectType` y su input suman los tres valores.

**Cruce contrato ↔ resolvers, en las dos direcciones.** Se verificó con `buildSubgraphSchema` que **las 59 mutaciones y las 36 consultas declaradas tienen resolver, y que ningún resolver quedó sin declarar**. El mismo cruce sobre los resolvers de tipo encontró un defecto **anterior a este bloque**:

- **`DocumentSysLogArchive.user` nunca se resolvía.** El resolver estaba registrado como `DocumentSysLogsArchive` —en plural— y el contrato declara el tipo en singular, de modo que el campo caía en el resolver por defecto y devolvía nulo. Se corrigió acá porque el cruce lo hizo visible; está fuera del alcance del bloque y no afecta a ninguna de sus reglas.

**Verificación posterior**: `tsc --noEmit`, `npm run build` y **las 141 pruebas** siguen sin error.

### Fase G — pruebas de las tres capas

**174 pruebas en total**, de 72 al abrir el bloque: **101 puras**, **42 contra base** y **31 de integración**. `npm run test:block03-all` corre las trece suites.

| Capa | Antes del bloque | Ahora |
| ---- | ---------------- | ----- |
| Puras | 43 | **101** |
| Contra base | 13 | **42** |
| Integración | 16 | **31** |

**Contra base**, `src/utils/modelConstraintsPersistence.test.ts` con **18 casos**. Automatiza lo que la fase B verificó a mano, y la razón de que vivan acá y no en una prueba pura está declarada en el archivo: **son invariantes que la aplicación no puede garantizar sola**, porque dos peticiones concurrentes pueden pasar la misma precondición y escribir las dos. Por eso viven en índices.

- **`B12`** — varias abandonadas comparten código; una viva convive con ellas; una segunda viva se rechaza; y abandonar no libera el código de una aprobada.
- **`B2`** — una revisión acumula circuitos cancelado, rechazado y completado más **uno solo abierto**; el segundo abierto se rechaza; cerrar el abierto habilita el siguiente. Es H-01 sostenido por la base y no por el resolver.
- **`B15`** — las cuatro restricciones de catálogo rechazan el duplicado con módulo o clase nulos, y siguen admitiendo la misma entrada en otro módulo.
- **`B3`** — el alcance de la plantilla rechaza el repetido con nulos y admite el refinamiento por clase.
- **`B7`** — un paso admite una sola firma.
- **`B5`** — la secuencia de versiones es de la **revisión** y no del circuito: no se reinicia con el circuito nuevo del rechazo, porque lo que se corrige es el mismo entregable.
- **`B4`** — toda versión exige `checksum`, verificado con SQL directo para saltear la capa de la aplicación.

**Una prueba de forma distinta, y conviene explicar por qué.** El criterio 16 —ninguna operación modifica ni elimina una versión— **no tiene restricción de base que lo sostenga**: una columna no impide un `UPDATE`. El invariante vive en que la operación *no exista*, de modo que la prueba **recorre el contrato** y verifica que no haya ninguna mutación de actualización o borrado sobre versiones ni firmas, y que `registerVersion` siga siendo la única. Impide que aparezca sin que nadie lo note.

**Integración**, `src/resolvers/cycle.integration.test.ts` con **15 casos** sobre el arnés de `BLOCK_02`. Los cuatro recorridos que el bloque exige:

| Recorrido | Qué demuestra |
| --------- | ------------- |
| **1. Documento nuevo** | Alta sin archivo con armador y circuito en armado ▸ armado que materializa los cinco pasos ▸ elaboración ▸ someter ▸ revisión ▸ aprobación ▸ **acuse cerrado después**, con el circuito ya completado |
| **2. Documento preexistente** | Alta **con** archivo adjunto ▸ el elaborador incorpora el cambio ▸ aprobación. El payload firmado acredita la **versión 2** y el código del documento |
| **3. Rechazo** | Versión marcada ▸ rechazo ▸ circuito nuevo desde `PREPARE` **con el elenco copiado** ▸ reasignar en el nuevo **no altera** el paso del anterior ▸ corrección y aprobación **sobre la misma revisión `A`**. La firma del rechazo se verifica y declara `REJECTED` |
| **4. Abandono** | `A` aprobada ▸ `B` sometida **con un paso ya firmado** ▸ abandono con motivo ▸ el circuito abierto se cancela con ella y **la firma sobrevive** ▸ la siguiente vuelve a proponerse **`B`** ▸ `currentRevision` sigue siendo `A` |

Once casos más cubren los criterios que los recorridos no tocan: el **circuito mínimo de un solo paso de aprobación** que cierra H-02; el armado sin paso que decida; la **inmutabilidad de la estructura** una vez armada; el paso resuelto que no se reasigna; la revisión aprobada que no admite versiones nuevas; la **metadata congelada y rehabilitada** por la revisión siguiente; la validación del código bajo los tres esquemas —incluido que **el esquema no se persiste**, porque un `FREE_TEXT` no revela esquema a la revisión siguiente—; someter sin versión; la **cancelación del circuito** que conserva la revisión, la rearma desde el armado y emite `WorkflowCancelled` **y no** `WorkflowRejected`; los pendientes propios y ajenos; y que la traza registre las once acciones nuevas del ciclo.

**El humo de la fase D se retira**: la prueba de integración lo absorbe y lo supera, y mantener dos recorridos paralelos habría dejado uno desactualizado.

**Sobre la estrategia de pruebas del bloque**: las precondiciones —metadata congelada, cancelación, abandono, registro de versión— figuraban entre las puras. Se implementaron **como integración**, porque ninguna es pura: todas dependen del estado de la revisión en la base. Lo puro de cada una —la partición de `B8`, el sucesor, el payload— ya está cubierto en sus utilidades.

### Fase H — cierre documental

**Criterios de aceptación: 21 de 22 verificados; el restante es una decisión, no una brecha.**

Al revisarlos uno por uno aparecieron **tres criterios implementados pero sin prueba que los cubriera**. Se cerraron antes de evaluar, con tres casos de integración más: la delegación con permiso y motivo, el rechazo de pendientes ajenos sin el permiso, y la plantilla propuesta por alcance en el alta. **177 pruebas** en total.

| # | Criterio | Estado |
| - | -------- | ------ |
| 1 | Los cuatro recorridos de integración se ejecutan de punta a punta | Verificado |
| 2 | Revisión rechazada: corrección y circuito nuevo sin consumir código — **H-01** | Verificado — recorrido 3 |
| 3 | Documento sin revisión formal aprobado por un circuito de un solo paso — **H-02** | Verificado |
| 4 | Toda resolución registra quién la ejecutó; delegación visible y motivada — **H-03** | Verificado — **prueba agregada en esta fase** |
| 5 | Un paso pendiente se reasigna; uno resuelto no | Verificado |
| 6 | El alta designa armador y propone plantilla por alcance; el armado la confirma o la cambia | Verificado — **prueba agregada en esta fase** |
| 7 | Documento sin archivo; someter exige una versión con `checksum` — **H-20, H-27** | Verificado |
| 8 | Metadata congelada con la revisión aprobada, y rehabilitada por la siguiente | Verificado |
| 9 | Toma de conocimiento con operación, estado terminal y visibilidad — **H-04** | Verificado |
| 10 | Cancelación distinguible del rechazo, con motivo en el modelo — **H-05** | Verificado — emite `WorkflowCancelled` y no `WorkflowRejected` |
| 11 | `A` aprobada ▸ `B` abortada ▸ `B` nueva completada; el sistema propone `B` | Verificado — recorrido 4, con `B` aprobada y `A` superada |
| 12 | `currentRevision` y `lastRevision` con la semántica de `B14`, en una sola implementación | Verificado |
| 13 | Firma verificable a posteriori, con la identificación del documento — **H-06** | Verificado |
| 14 | `pendingReviewSteps` propios; ajenos solo con el permiso especial — **H-07** | Verificado — **las dos direcciones**, con un contexto de rol `doc-basic` |
| 15 | Códigos según el esquema; orden de revisiones independiente del código — **H-09, H-10** | Verificado |
| 16 | Ninguna operación modifica ni elimina una versión — **H-34** | Verificado — por recorrido del contrato |
| 17 | Las cuatro restricciones de catálogo, **tras verificar y limpiar duplicados en cada cliente** — H-19 | Verificado — **los cinco clientes desplegados**, sin duplicados en ninguno: no hay nada que limpiar |
| 18 | Ninguna regla de circulación cambió | Verificado — ver abajo |
| 19 | `prisma validate`, `migrate`, `tsc`, `build`; las 72 pruebas previas aprobadas | Verificado — ver abajo |
| 20 | Tablas documentales vacías **en cada cliente** antes de migrar | Verificado — **los cinco clientes desplegados**, en cero |
| 21 | `rover subgraph check` con los retiros y el cambio de `currentRevision` declarados | Verificado |
| 22 | La SFS se actualiza solo después de reunir estas evidencias | **Habilitado**: la evidencia está reunida. Queda la decisión de cuándo escribirla |

**Criterio 18, verificado por diferencia y no por declaración.** Entre el commit que abrió el bloque y este, `transmittals.ts`, `attachments.ts`, `scannedFiles.ts`, `areas.ts` y `dependencies.ts` **no registran una sola línea de cambio**, y el modelo no toca `Transmittal`, `TransmittalItem`, `PurposeCode` ni `ClientStatus`. `mi-quality` compila sin cambios. `BLOCK_04` parte exactamente del estado que dejó `BLOCK_02`, con lo que `B16` deja habilitado.

**Criterio 19, con una precisión.** De las **72 pruebas previas**, 71 siguen intactas palabra por palabra y **una sola cambió**: la que fija el número de acciones del catálogo, que pasó de 28 a 35 explicando el saldo —dos retiros y nueve altas—. Es el cambio que el propio bloque prescribe. Ninguna prueba previa fue retirada.

#### Evaluación de la promoción a la SFS

#### Precondición verificada en testing

Ejecutada con `210-mi-deploy/check-document-precondition.sh` sobre los tres clientes desplegados. **Veredicto `APTO PARA MIGRAR` en los tres**, con PostgreSQL **16.14** —`NULLS NOT DISTINCT` disponible— y las nueve tablas del subsistema documental en cero.

| Cliente | Subsistema documental | Grupos duplicados | Veredicto |
| ------- | --------------------- | ----------------- | --------- |
| `rbb` | 0 | 0 | `APTO PARA MIGRAR` |
| `optimal` | 0 | 0 | `APTO PARA MIGRAR` |
| `proion` | 0 | 0 | `APTO PARA MIGRAR` |

**Ninguna de las cuatro restricciones de `B15` encuentra duplicados**, de modo que los índices con `NULLS NOT DISTINCT` pueden crearse sin limpiar nada. Los tres confirman además que la migración **no fue aplicada**: `documents` conserva `revisionScheme` junto a `projectId`, que es el estado que dejó `BLOCK_02`.

**Línea base del subsistema legado**, que la migración no toca y que se registra para poder demostrarlo después en lugar de suponerlo:

| Cliente | `scanned_files` | `areas` | `document_sys_logs` |
| ------- | --------------- | ------- | ------------------- |
| `rbb` | 0 | 0 | 0 |
| `optimal` | **9** | **3** | **32** |
| `proion` | 1 | 0 | 1 |

Los tres coinciden **exactamente** con los que `BLOCK_02` registró en su cierre: testing no se movió desde entonces.

**Al script se le agregó la población de los catálogos** —cuántas clases y tipos hay, y cuántos con módulo o clase nulos—, que es justamente el conjunto que la restricción nueva pasa a cubrir. Sin ese número, «cero duplicados» puede significar que la restricción protege algo real o que el catálogo está vacío.

#### Precondición verificada en producción

**Veredicto `APTO PARA MIGRAR` en los dos clientes productivos**, con PostgreSQL 16.14 y el subsistema documental en cero. **Es la segunda vez que el supuesto central del plan se contrasta con una base productiva, y vuelve a confirmarse**: ningún cliente utiliza hoy el subsistema de Gestión Documental.

| Cliente | Subsistema | Clases | Tipos | Grupos duplicados | Veredicto |
| ------- | ---------- | ------ | ----- | ----------------- | --------- |
| `proion` | 0 | 0 | 0 | 0 | `APTO PARA MIGRAR` |
| `optimal` | 0 | **7** | **57** | 0 | `APTO PARA MIGRAR` |

**El dato que cambia la lectura de `B15`: en producción no hay una sola entrada con módulo o clase nulos.** Los 7 clases y 57 tipos de `optimal` tienen todos su módulo informado, y los 57 tipos su clase. La restricción anterior ya era plenamente efectiva sobre esos datos.

Es un matiz que conviene registrar y que **no debilita la decisión, la reubica**: `B15` no corrige un agujero activo sino uno **latente**. El módulo y la clase son opcionales por diseño —nulo significa «disponible para todos»—, de modo que la primera entrada que se cree sin módulo entraría hoy sin control de duplicados. Lo que la migración cierra es esa puerta, sobre un catálogo que en `optimal` ya es real: 57 tipos de documento en uso.

También significa que **la migración no tiene nada que limpiar en ningún cliente**, que era el único desenlace capaz de frenarla.

**Línea base del subsistema legado en producción:**

| Cliente | `scanned_files` | `areas` | `document_sys_logs` |
| ------- | --------------- | ------- | ------------------- |
| `proion` | 0 | 0 | 0 |
| `optimal` | **3.260** | **52** | **5.093** |

`optimal` sumó 12 archivos y 12 registros de log desde el cierre de `BLOCK_02` —3.248 y 5.081—, con `areas` sin cambios: la firma de altas normales en un sistema en uso.

**Esta línea base no es la que sirve para la comparación posterior.** El sistema sigue operando, de modo que hay que **volver a tomarla inmediatamente antes de migrar** y comparar contra esa. El criterio no es la igualdad sino que **no disminuya**: una pérdida de datos se manifiesta como una baja, no como la ausencia de crecimiento.

#### Evaluación de la promoción a la SFS

**Los 21 criterios verificables están cumplidos y la precondición está levantada en los cinco clientes.** Lo que resta no es evidencia sino ejecución: el bloque **no está desplegado en ningún ambiente**.

**El criterio 22 queda habilitado pero no ejecutado, y es deliberado.** La SFS describe «comportamiento implementado y validado», y `BLOCK_02` fijó el precedente de promover **después** de aplicar y verificar en los ambientes reales, no antes. Escribirla ahora afirmaría como vigente algo que ningún despliegue ejecuta todavía.

**La restricción que gobierna el despliegue**: la migración es incompatible con el código desplegado hoy —`assignedOrganizerId` es `NOT NULL` y el `createDocument` vigente no lo informa—, de modo que migrar antes de desplegar el subgraph rompería el alta de documentos. **Modelo, operaciones y contrato viajan en la misma ventana.**

**Estado del bloque: `LISTO_PARA_PROMOVER`.** Implementación y validación completas; resta desplegar, verificar y escribir la SFS.

#### Condiciones de despliegue, por cliente

Lo que resta ejecutar, en este orden. Los clientes desplegados son `rbb`, `optimal` y `proion` en testing, y `optimal` y `proion` en producción.

1. **Precondición**, con `210-mi-deploy/check-document-precondition.sh <cliente> <ambiente>`: veredicto `APTO PARA MIGRAR`. Un resultado con duplicados **no cancela la migración: obliga a limpiarlos antes**, que es lo contrario del veredicto de `BLOCK_02`. Ya verificado en los tres clientes de testing.
2. **Línea base del subsistema legado** —`scanned_files`, `areas`, `document_sys_logs`—, para poder demostrar después que quedó intacto. `optimal` en producción es el único con uso real.
3. **Permisos**: `npm run seed:permissions` en `mi-admin`. 404 → 407 permisos, 790 → 794 asignaciones.
4. **Migración**: las dos del bloque, con el subgraph nuevo en la misma ventana.
5. **Verificación posterior**: legado sin disminuir —el criterio es que no baje, no que sea igual—, y estructura confirmada.

Recién con esa evidencia reunida corresponde escribir la SFS y marcar `PROMOVIDO_A_SFS`.

#### Qué va a promoverse, y qué no

Anotado ahora para que la decisión no se rehaga desde cero:

- **Sí**: el circuito como ciclo completo con sus cinco tipos de paso y la partición entre los que deciden y los que se cumplen; la revisión con sus circuitos sucesivos y su armador; la versión como archivo inmutable con `checksum`; la firma con payload verificable; la plantilla y su resolución por alcance; el esquema de revisión propuesto y no persistido; y las dos lecturas del documento vigente.
- **No**: nada que dependa del rol Receptor. `B16` **habilita** el circuito sin elaboración y la conclusión terminal, pero no los implementa: son `BLOCK_04`. Es el mismo criterio con que `BLOCK_02` se abstuvo de promover el comportamiento del rol sobre el ciclo.
- **`Document` recién ahora puede promoverse por completo**: pierde `revisionScheme`, gana las dos lecturas de revisión y su metadata queda gobernada por el congelamiento. `BLOCK_02` lo había diferido por esto mismo.

## Referencias

- `README.md`
- `BLOCK_03_REGISTRO_DE_DEFINICIONES.md` — planteo y alternativas de cada decisión
- `DOCUMENT_EVOLUTION_PLAN.md` — D-03, D-04, D-05, D-10, D-11, D-13, D-17, D-19, D-21, D-22
- `BLOCK_01_TRAZABILIDAD_FUNCIONAL.md` — catálogo de eventos y base de pruebas
- `BLOCK_02_CONTEXTO_DE_PROYECTO.md` — B2, B4, B7 y B9
- `../SFS/00_Convenciones.md`
- `../../prisma/schema.prisma`, `../../schema.graphql`
- `../../src/utils/reviewWorkflow.ts`, `../../src/utils/objectContext.ts`
- `212-mi-digitalization/src/utils/revisionScheme.ts`
- `200-mi/docs/specs/DIGITALIZATION_CATALOG_ATTRIBUTES_SPEC.md` — `CatalogSettings`
