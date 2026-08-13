# Principios del Modelo — Ciclo interno de revisión

**Ámbito:** Ciclo interno
**Estado:** Approved
**Versión:** 1.0

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

# 4. Una versión es un archivo, y es inmutable

Los tres niveles guardan cosas distintas, y cambiarlos produce cosas distintas:

| Nivel | Qué cambia al cambiar |
| ----- | --------------------- |
| Documento | Una actualización auditada, que vale para todas sus revisiones |
| Revisión | Una transición de la revisión |
| Versión | **Nada: la versión solo existe con archivo nuevo** |

Lo que la versión guarda no es metadata del documento sino **descripción del archivo**: nombre, tamaño, tipo y hash no pueden cambiar sin que cambie el archivo. Es lo que da sentido a que una firma acredite una versión.

**La versión no se modifica ni se elimina**, y eso incluye su comentario: si quedó mal, la corrección va en la traza y no editando la evidencia.

**La produce quien tiene el paso vigente.** No es una restricción de identidad sino de momento: la elabora el elaborador, la marca el revisor, la marca el aprobador. Comentar no genera versión; marcar el archivo sí.

---

# 5. La firma acredita quién y qué, sobre datos verificables

Una firma persiste el **payload canónico** que se usó para calcularla, además del hash y el algoritmo. Un hash sin sus insumos no es verificable: verificar es recalcular sobre lo guardado, y no reconstruirlo desde entidades que pudieron cambiar después.

Lo firmado incluye el paso y su revisión, la **versión vigente al firmar con su hash de contenido**, la **identificación del documento** en ese momento, quién estaba asignado y quién resolvió, y la acción con su momento.

**El rechazo firma igual que la aprobación** — de hecho su evidencia importa más, porque documenta qué se objetó.

**Ninguna firma afirma nada sobre las versiones posteriores.** Cada una acredita aquella sobre la que actuó su autor, de modo que una versión nueva no invalida las firmas anteriores. Cuando el cambio es sustantivo, lo que corresponde no es invalidar sino retirar la revisión del circuito.

---

# 6. La metadata se congela con la revisión aprobada

Mientras la revisión vigente no esté aprobada, la metadata del documento se edita libremente. **Aprobada, se congela**, y corregirla exige abrir una revisión nueva. Abrir la revisión siguiente la vuelve a habilitar.

El motivo es material y no formal: parte de la metadata está **impresa dentro del archivo**. El rótulo lleva el código y el título, y a menudo la clase y el tipo — de hecho el código habitualmente se compone de clase y tipo. La clasificación no es descripción sino **identidad**, y un rótulo distinto es un documento distinto.

Cambiarla después de aprobar no invalidaría la firma, que acredita bytes que no cambiaron: produciría algo peor, una divergencia silenciosa entre lo que el sistema afirma y lo que el entregable dice.

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

- **Primera revisión** — según el esquema del proyecto o, en su defecto, el del despliegue.
- **Revisiones siguientes** — a partir de la última revisión no abandonada, **infiriendo el esquema de la forma de su código**: dígitos continúan la secuencia numérica, letras la alfabética.
- **Cambiar de esquema** es elegir otro en ese momento, y la secuencia se reinicia.

El motivo es que un esquema almacenado **puede contradecir a los hechos**: declararlo numérico con la revisión vigente en `A` afirma algo que el documento no muestra.

La precedencia se conserva en tres escalones —documento, proyecto, despliegue—, pero **el del documento se lee de su última revisión en lugar de guardarse**.

Bajo los esquemas que el sistema calcula, el código informado se rechaza; bajo texto libre lo ingresa el usuario y solo se valida que no se repita entre las revisiones no abandonadas.

---

# 12. La plantilla propone el circuito; el armado lo define

Sin plantilla, el armador declararía el circuito paso por paso en cada documento, que es el trabajo que el control documental no puede asumir.

La plantilla se resuelve por alcance contra la tupla del propio documento, y **gana la más específica**: tipo, después clase, después proyecto. La plantilla del proyecto sin clase ni tipo **es** su default, sin necesidad de una marca aparte.

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

---

# Referencias

- `10_DOM-005_Document.md`, `20_DOM-006_DocumentRevision.md`, `30_DOM-007_DocumentVersion.md`
- `40_DOM-008_ReviewWorkflow.md`, `50_DOM-009_ReviewStep.md`, `60_DOM-010_DocStepSignature.md`
- `70_DOM-011_DocWorkflowTemplate.md`, `75_DOM-012_DocSettings.md`
- `../05_project/80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
