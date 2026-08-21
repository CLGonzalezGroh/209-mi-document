# Principios del Modelo — Ciclo interno de revisión

**Ámbito:** Ciclo interno
**Estado:** Approved
**Versión:** 2.0

---

# 1. El circuito es el ciclo, no el trámite de aprobación

El circuito de revisión no empieza cuando el documento está terminado: **empieza cuando la revisión nace**, y abarca el ciclo completo.

| Paso | Completarlo significa |
| ---- | --------------------- |
| Armado | Quedan designados el elaborador y los revisores, y **se materializan los pasos siguientes** |
| Elaboración | El documento está hecho y se somete a revisión |
| Revisión, aprobación, toma de conocimiento | Lo que cada uno significa por su nombre |

Los dos primeros pasos los aporta el dominio: el rótulo de un plano declara *Prepared by / Reviewed by / Approved by*. Elaborar el documento y armar el circuito son actos distintos, y por eso son pasos distintos.

**No existe documento sin circuito.** Lo que en la práctica se describe como «dar de alta ahora y asignar el circuito después» es un circuito en armado, no una excepción.

**La revisión no duplica el detalle del circuito.** Está en borrador mientras el trabajo se arma o se elabora, y en revisión desde que se somete. Dónde está el trabajo lo dice el paso vigente; un estado de revisión por cada paso serían dos máquinas de estados describiendo lo mismo.

---

# 2. Hay pasos que deciden y pasos que se cumplen

**Deciden** la revisión y la aprobación: son los únicos que pueden rechazar y los únicos que cuentan para completar el circuito.

**Se cumplen** el armado, la elaboración y la toma de conocimiento: no emiten juicio, y su estado terminal lo dice. Dejarlos en aprobado afirmaría que alguien aprobó el armado.

Cumplir y juzgar son cosas distintas, pero **ambas se acreditan**: la partición entre lo que decide y lo que se cumple **no coincide** con la de qué pasos firman.

---

# 3. Una revisión admite varios circuitos sucesivos, y uno solo abierto

La revisión es la unidad externa; lo que ocurre dentro es historia interna.

| Salida | Circuito siguiente | Elenco |
| ------ | ------------------ | ------ |
| Rechazo | Desde la elaboración | El mismo, **copiado** |
| Cancelación del circuito | Desde el armado | Redefinible |
| Revisión nueva | Desde el armado | Redefinible |

**El elenco se copia y no se referencia**: reasignar un paso del circuito nuevo no debe alterar la historia del anterior.

**Toda revisión viva tiene exactamente un circuito abierto**, desde que nace hasta que se aprueba o se abandona. El circuito vigente **se deriva** y no se almacena: un dato derivado que se guarda puede desincronizarse de aquello que lo origina.

De ahí que un rechazo **no consuma una revisión**. El trabajo vuelve a quien elabora dentro de la misma revisión, y lo que la contraparte llegue a ver son las revisiones que salieron.

---

# 4. Una versión es un conjunto de archivos, y es inmutable

Los tres niveles guardan cosas distintas, y cambiarlos produce cosas distintas:

| Nivel | Qué cambia al cambiar |
| ----- | --------------------- |
| Documento | Una actualización auditada de lo administrativo |
| Revisión | Una transición, o un cambio de la identificación que emitirá |
| Versión | **Nada: la versión solo existe con contenido nuevo** |

Un documento se entrega habitualmente como más de un archivo: el PDF que se revisa y se marca, con su editable en custodia y la evidencia que lo sustenta. La versión es **el conjunto registrado en un mismo acto**, con al menos un entregable.

Lo que cada archivo guarda no es metadata del documento sino **descripción del contenido**: nombre, tamaño, tipo y hash no pueden cambiar sin que cambie el archivo. Es lo que da sentido a que una firma acredite una versión.

**La versión no se modifica ni se elimina**, y eso incluye su comentario y su conjunto: si quedó mal, la corrección va en la traza y no editando la evidencia. Agregar un archivo a una versión existente dejaría a una firma acreditando un conjunto distinto del que su autor tuvo delante.

**La produce quien tiene el paso vigente.** No es una restricción de identidad sino de momento: la elabora el elaborador, la marca el revisor, la marca el aprobador. Comentar no genera versión; marcar el archivo sí.

---

# 5. La firma acredita quién y qué, sobre datos verificables

Una firma persiste el **payload canónico** que se usó para calcularla, además del hash y el algoritmo. Un hash sin sus insumos no es verificable: verificar es recalcular sobre lo guardado, y no reconstruirlo desde entidades que pudieron cambiar después.

Lo firmado incluye el paso y su circuito, la **revisión con su identificación** en ese momento, la **versión vigente con todos los archivos de su conjunto y sus hashes**, el **código del documento**, quién estaba asignado y quién resolvió, la acción con su momento, y la **versión del formato del payload**.

**Se firma el conjunto entero, incluidos los archivos que nadie revisó.** La custodia del editable importa porque es la fuente del entregable: si pudiera sustituirse sin producir versión nueva, la correspondencia entre uno y otro sería una afirmación sin evidencia. Que hayan sido firmados juntos es lo que la sostiene.

**La identificación viaja con la revisión** y no con el documento, porque es donde vive. El documento aporta su código, que no necesita snapshot precisamente porque no cambia.

**El rechazo firma igual que la aprobación** — de hecho su evidencia importa más, porque documenta qué se objetó.

**Ninguna firma afirma nada sobre las versiones posteriores.** Cada una acredita aquella sobre la que actuó su autor, de modo que una versión nueva no invalida las firmas anteriores. Cuando el cambio es sustantivo, lo que corresponde no es invalidar sino retirar la revisión del circuito.

---

# 6. La identificación pertenece a la revisión, y por eso se congela sola

El motivo es material y no formal: parte de la metadata está **impresa dentro del archivo**. El rótulo lleva el código y el título, y a menudo la clase y el tipo — de hecho el código habitualmente se compone de clase y tipo. La clasificación no es descripción sino **identidad**, y un rótulo distinto es un documento distinto.

De ahí se sigue dónde vive el dato: **si está impreso en el archivo, pertenece a la emisión que lo produjo**. El título, la clase y el tipo son atributos de la revisión.

Y de ahí se sigue el congelamiento, **sin necesidad de enunciarlo**: una revisión aprobada no se modifica. No hay una regla que prohíba editar la metadata después de aprobar; hay una estructura en la que esa edición no tiene dónde ocurrir. Abrir la revisión siguiente la vuelve a habilitar, y la nueva nace con la identificación copiada de la anterior.

Cambiarla después de aprobar no invalidaría la firma, que acredita bytes que no cambiaron: produciría algo peor, una divergencia silenciosa entre lo que el sistema afirma y lo que el entregable dice.

**El documento conserva una copia**, para que los listados y los filtros no paguen un join. Es copia y no dato: su único escritor es la transición de la revisión, y se nombra por la lectura que sirve —la de la revisión en curso— para que nadie la confunda con lo que dice el rótulo aprobado.

**Lo administrativo no se congela.** La descripción no aparece en ningún rótulo, y corregirla no debe exigir abrir una revisión.

**El código queda fuera de todo esto**, y tiene su propio principio.

---

# 7. Delegar y reasignar resuelven cosas distintas

**Se registra siempre quién resolvió efectivamente el paso**, y la divergencia con el asignado se **deriva** de ambos datos. Un indicador de delegación sería un dato calculable que puede contradecir a los que lo originan.

- **La delegación resuelve el momento**: alguien firma por otro, y exige motivo. Es lo que la vuelve trazable y no solo permitida.
- **La reasignación resuelve la conducción**: el revisor que no está, o la redistribución de carga de trabajo. Cambia el actor y nada más.

**Un paso resuelto no se reasigna**: su firma acredita quién lo resolvió.

**La estructura del circuito es inmutable una vez armada.** No se agregan, quitan ni reordenan pasos. La excepción aparente no lo es: el armado **crea** los pasos siguientes, y la inmutabilidad rige desde que se completa. Es lo que le deja a la cancelación un uso propio — la reasignación cubre *quién*, la cancelación cubre *cómo está armado* y *qué se sometió*.

**Un solo permiso especial gobierna todo acto sobre el trabajo ajeno**: firmar por otro, reasignar, registrar una versión sobre un paso ajeno y consultar pendientes ajenos.

---

# 8. La toma de conocimiento comunica lo ya aprobado

El circuito cierra con los pasos que deciden, y **los acuses se resuelven después**, con operación propia.

Es lo que su función exige: el acuse comunica un documento **ya aprobado**. Bloquear la aprobación hasta que todos acusen invertiría esa función, y cerrarlos de oficio los convertiría en un registro vacío.

---

# 9. Cancelar el circuito y abandonar la revisión son dos actos

| Acto | Cuándo | Efecto |
| ---- | ------ | ------ |
| **Cancelar el circuito** | Quedó mal armado, o se sometió lo que no correspondía | El circuito queda cancelado; **la revisión sobrevive**, vuelve a borrador y se rearma desde el armado |
| **Abandonar la revisión** | La revisión dejó de tener sentido | La revisión queda abandonada en la historia; si tiene circuito abierto, se cancela con ella |

Ambos exigen motivo, y ambos **conservan la historia**: los pasos resueltos mantienen su estado y su firma. Por eso se admiten en cualquier punto, aun con pasos ya firmados — exigir que ninguna firma exista obligaría a completar un circuito que ya se sabe inútil, o a simular un rechazo que nadie emitió.

**La cancelación es distinguible del rechazo**, en el estado y en la traza. Un rechazo es un circuito que se ejecutó y concluyó negativamente; una cancelación es un circuito que se retiró sin que nadie emitiera juicio.

**Solo se abandona una revisión no aprobada.** Aprobada, la revisión es el documento vigente y lo que corresponde es abrir la siguiente. No hace falta restituir la revisión anterior: la supersesión ocurre al aprobarse la sucesora, y una abandonada nunca se aprueba.

---

# 10. La revisión abandonada no consume código

Sobre un documento en revisión `A` puede abrirse `B`, abandonarse, y abrirse más adelante otra vez `B`, que se completa. Es el mismo principio por el que un rechazo interno no agota la secuencia: **lo que la contraparte ve son las revisiones que salieron.**

Un documento puede tener varias revisiones abandonadas con el mismo código; cada una se distingue por su fecha y su motivo.

**Las revisiones se ordenan por secuencia de creación y nunca por código.** Con el cambio de esquema la secuencia puede quedar `A, B, C, 0, 1`, de modo que ordenar por código pierde sentido.

---

# 11. El esquema de revisión se propone y no se persiste

El esquema no es un atributo del documento: **se elige al crear cada revisión**, y el sistema propone el código.

- **Primera revisión** — según el esquema del contrato o, en su defecto, el del despliegue.
- **Revisiones siguientes** — a partir de la última revisión no abandonada, **infiriendo el esquema de la forma de su código**: dígitos continúan la secuencia numérica, letras la alfabética.
- **Cambiar de esquema** es elegir otro en ese momento, y la secuencia se reinicia.

El motivo es que un esquema almacenado **puede contradecir a los hechos**: declararlo numérico con la revisión vigente en `A` afirma algo que el documento no muestra.

La precedencia se conserva en tres escalones —documento, contrato, despliegue—, pero **el del documento se lee de su última revisión en lugar de guardarse**.

Bajo los esquemas que el sistema calcula, el código informado se rechaza; bajo texto libre lo ingresa el usuario y solo se valida que no se repita entre las revisiones no abandonadas.

---

# 12. La plantilla propone el circuito; el armado lo define

Sin plantilla, el armador declararía el circuito paso por paso en cada documento, que es el trabajo que el control documental no puede asumir.

La plantilla se resuelve por alcance contra la tupla del propio documento, y **gana la más específica**: tipo, después clase, después contrato. La plantilla del contrato sin clase ni tipo **es** su default, sin necesidad de una marca aparte.

**Los valores se copian al materializarse.** Cambiar la plantilla después no altera ningún circuito en curso, con el mismo criterio del payload firmado.

**El elaborador nunca se preasigna.** Designarlo es distribuir carga de trabajo y se decide documento por documento. Por eso el armado tiene contenido incluso con la plantilla más completa, y por eso siempre existe.

La plantilla **propone y no impone**: quien crea el documento y el armador pueden cambiarla.

---

# 13. Vigente y en curso son dos lecturas distintas

| Lectura | Qué devuelve |
| ------- | ------------ |
| Revisión **vigente** | La última aprobada, y **solo la aprobada**. Nula mientras el documento no haya aprobado ninguna |
| Revisión **en curso** | La última no abandonada por secuencia de creación, en cualquier estado |

Con `A` aprobada y `B` en circuito, la vigente es `A` y la que está en curso es `B`. **Ninguna de las dos considera las abandonadas.**

**Se exponen y no se derivan en cada consumidor.** Ambas son derivables, y precisamente por eso conviene resolverlas en un solo lugar: la mayoría de los consumidores quiere la vigente, y solo quien está dentro del proceso necesita ver el par completo.

Dos hechos las sostienen: a lo sumo hay una revisión aprobada por documento, porque aprobar supersede a las anteriores; y la revisión en curso es la misma de la que se deriva el código sucesor — una sola regla con dos usos.

**Las dos lecturas alcanzan también a la identificación.** Con `A` aprobada y `B` en borrador con otro título, la metadata vigente es la de `A` —lo que dice el rótulo que salió— y la metadata en curso es la de `B`. Un campo que callara cuál de las dos es se derivaría mal en cada consumidor, que es el defecto que este principio previene: por eso la copia del documento lleva el nombre de su lectura.

**De ahí sale sola una propiedad que no hubo que construir**: abandonar una revisión devuelve la identificación anterior. La abandonada deja de ser la última viva, y la copia se recalcula sobre la que estaba antes. No hay nada que revertir porque el origen nunca se sobrescribió — la misma regla, con un tercer uso.

---

# 14. El código es el identificador, y no cambia

El código no es metadata: es **la referencia**. Está en los transmittals emitidos, en el payload de cada firma, en las referencias cruzadas de otros documentos, en el sistema de la contraparte y en el rótulo de cada archivo que salió. Cambiarlo no renombra un registro: rompe la correspondencia con todo lo que ya lo nombra **y que el sistema no controla**.

Es la diferencia con el título y la clase, que también se imprimen. Aquellos **describen**, y pueden corregirse de una revisión a la otra porque nadie referencia un documento por su título. El código **identifica**.

**Se corrige mientras el documento no tenga ninguna revisión aprobada**, que es la condición material de que nada salió: ningún transmittal lo nombra, ninguna firma lo lleva, ningún rótulo emitido lo imprime. Es más preciso que «antes de la primera revisión» —si la primera se abandona, sigue sin haberse aprobado nada— y no requiere ningún dato nuevo, porque es la lectura de revisión vigente nula.

La corrección **emite un evento propio**. Es la identidad cambiando, y sin él sería inexplicable en una auditoría posterior.

**Después, lo que corresponde es un documento nuevo que lo reemplace.**

---

# 15. Reemplazar es superar, y promover es otra cosa

Un documento nuevo que declara a cuál reemplaza conserva lo que la edición del código destruiría: el anterior mantiene su código —que sigue tomado—, su historia, sus versiones firmadas y sus transmittals.

**El reemplazado queda obsoleto en el mismo acto.** No son dos decisiones: el documento superado deja de representar nada vigente en el instante en que otro lo hace. Es el mismo hecho que un nivel más abajo ocurre al aprobar una revisión, que supersede a la anterior.

**Es un acto y no un par de referencias.** Agrupa los que salen y los que entran, con su motivo; sin esa agrupación, una reorganización de dos documentos en otros dos sería indistinguible de dos reemplazos separados. La relación es N:M, y con una sola quedan expresadas la recodificación, la unificación y la división. Qué clase de reemplazo es **se deriva de la cardinalidad** y no se declara.

**La obsolescencia tiene dos causas**, y por eso el hecho se registra en lugar de derivarse: un documento también caduca **por salir del alcance**, sin que nada lo reemplace. Lo que sí se deriva es cuál de las dos, según figure o no en un acto.

**Obsoleto no es dado de baja.** La baja lógica corrige un alta que no debió existir; la obsolescencia es un hecho del ciclo de vida. Lo único que el documento obsoleto pierde es la posibilidad de emitir de nuevo.

**Los documentos de un acto comparten ámbito.** Lo que cruza del contrato al régimen de publicación no es reemplazar sino **promover**, y son cosas distintas en los cuatro rasgos que importan: ocurre entre revisiones y no entre documentos, el de origen no queda obsoleto —quedó terminado—, produce una revisión y no un documento, y cambia de ámbito. La promoción pertenece al módulo de activos y no se registra acá.

---

# 16. La versión nace al confirmar

La inmutabilidad de la versión y la comodidad de editar **no están en conflicto: ocurren en momentos distintos**. La versión debe ser inmutable *una vez que existe*; lo que hay que decidir es **cuándo existe**.

Antes de eso hay una **copia de trabajo**: el conjunto en preparación, mutable por naturaleza, que todavía no acredita nada. Se abre precargada con los archivos de la versión vigente, admite incorporar y retirar, y al confirmarse se convierte en la versión siguiente, completa e inmutable.

**Precargar es lo que vuelve barata la edición.** Quien corrige el entregable abre, lo reemplaza y confirma: la fuente y el respaldo viajan solos conservando su referencia y su hash, sin volver a subirse. Lo que se crea al confirmar es el registro del conjunto, no el objeto almacenado.

Tres reglas caen solas:

- **a lo sumo una copia abierta por revisión**, que es el mismo invariante del documento sobre su revisión en curso y de la revisión sobre su circuito, en un tercer nivel;
- **confirmar exige al menos un cambio**, porque la versión solo existe con contenido nuevo;
- **resolver un paso exige no tener copia abierta** —y someter también—, porque declarar que se terminó con una iteración en curso es una contradicción.

**No es un check-out en el sentido habitual.** No descarga —leer un archivo nunca fue un acto del ciclo— y no bloquea, porque la exclusividad ya la da el circuito: la versión la produce quien tiene el paso vigente. Agregar un candado duplicaría la regla.

**Se descartó que abrir cree la versión y confirmar la sobrescriba.** Volvería mutable a la entidad cuya razón de ser es no serlo, y una apertura abandonada dejaría una versión consumiendo un número en la secuencia — lo mismo que el ciclo evita al decidir que la revisión abandonada no consume código.

---

# 17. Cada nivel tiene su palabra para terminar mal

| Nivel | Palabra | Qué nombra |
| ----- | ------- | ---------- |
| Circuito | **Cancelado** | Se retiró sin que nadie emitiera juicio. La revisión sobrevive |
| Revisión | **Abandonada** | Se desistió antes de aprobarla. No consume código |
| Documento | **Obsoleto** | Fue superado por otro, o salió del alcance |
| Copia de trabajo | **Descartada** | Se abandonó sin producir versión |

Cada término pertenece a un solo nivel y no se usa en ningún otro. Retirar un armado, desistir de una emisión, dar por concluida una identidad y tirar un borrador son hechos que no se confunden en el trabajo real, y no deben confundirse en el nombre.

Importa donde más cuesta: en la traza. Un registro de auditoría que dijera «cancelado» sin decir de qué obligaría a mirar el objeto para saber qué ocurrió.

---

# Referencias

- `10_DOM-005_Document.md`, `20_DOM-006_DocumentRevision.md`, `30_DOM-007_DocumentVersion.md`
- `40_DOM-008_ReviewWorkflow.md`, `50_DOM-009_ReviewStep.md`, `60_DOM-010_DocStepSignature.md`
- `70_DOM-011_DocWorkflowTemplate.md`, `75_DOM-012_DocSettings.md`
- `90_DOM-013_DocReplacement.md`, `95_DOM-014_DocWorkingCopy.md`
- `../05_project/80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
