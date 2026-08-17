# Principios del Modelo — Circulación

**Ámbito:** Circulación
**Estado:** Approved
**Versión:** 1.0

---

# 1. La circulación empieza donde termina el ciclo interno

El ciclo interno es idéntico en los tres roles documentales: se elabora, se revisa, se marca, se rechaza, se corrige y se aprueba de la misma forma. **Lo único que distingue a un proyecto de otro es tener contraparte**, y eso es lo que este ámbito agrega.

Un proyecto sin contraparte no participa: su ciclo terminó al aprobar, y no hay nada que entregar ni nadie que responda.

De ahí que la frontera entre ámbitos no sea organizativa sino de dominio. El ciclo interno no sabe de transmittals; la circulación no reabre el circuito, salvo en el único punto donde el circuito **es** el mecanismo de respuesta.

---

# 2. El propósito clasifica; el sentido se deriva

Lo que determina qué reglas gobiernan un transmittal no es su dirección sino su propósito: entregar documentación producida, o consolidar la calificación de una entrega.

El sentido —saliente o entrante— **se deriva** del rol del proyecto y de la naturaleza, y no se declara. Es la misma razón por la que el esquema de revisión no se persiste: un dato guardado que puede contradecir a los hechos obliga a inventar una precondición que tape la incoherencia.

La distinción tiene una consecuencia práctica que conviene no perder: **los dos casos entrantes no comparten una sola regla**. Lo que entra en modo Emisor es una respuesta que contesta algo nuestro; lo que entra en modo Receptor es una emisión que no contesta nada, y que llega sin haber pasado por ningún circuito nuestro.

---

# 3. Una puerta solo puede ser dura si existe una manera legal de satisfacerla

La emisión tiene dos condiciones y las trata distinto, y la diferencia no es de criterio sino estructural.

**La aprobación interna es puerta.** Toda revisión que sale debe estar aprobada, sin excepción por propósito. Se puede satisfacer: se completa el circuito y se emite después.

**Los archivos que el propósito espera son advertencia.** Al emitir, la revisión ya está aprobada y su versión es inmutable, de modo que **no hay forma legal de agregar el que falta**. Una puerta dura ahí exigiría algo que el propio sistema hace imposible, y las salidas serían todas peores que el problema.

Donde no se puede exigir, se advierte **y se registra**: el hecho queda en la auditoría, y el caso legítimo —el editable que por tamaño o formato viaja por otro medio— pasa a ser un dato en lugar de un silencio. Y la advertencia se adelanta al momento en que todavía sirve, mientras la revisión está abierta.

---

# 4. Una revisión se emite una sola vez, y eso define lo que falta

Que una revisión aparezca en un solo ítem de emisión es una restricción del modelo, no una validación. De ella se desprenden tres cosas que de otro modo serían reglas separadas:

- una revisión ya respondida no vuelve a emitirse, porque ya salió;
- un reintento no puede duplicar la emisión;
- **pendiente es el documento cuya revisión en curso no tiene ítem**, leyendo la misma relación al revés.

Quitar el ítem, posible solo en borrador, libera la revisión: nunca salió.

---

# 5. No hay documento esperado: hay documento

Todo documento dado de alta en el proyecto es un documento esperado, y el que aparece después del alcance inicial también — nació más tarde, no es de otra clase.

Esperado y adicional describen **cuándo apareció**, no **qué es**, y el cuándo ya lo registra la auditoría. Por eso no existe un objeto de expectativa ni un acto de promoción entre él y el documento.

Lo que el negocio necesita ver —qué falta— se deriva. Y se mira **la revisión en curso** y no cualquiera: después de que la contraparte rechaza, el documento debe la revisión siguiente, y mirar *ninguna revisión salió* lo haría desaparecer de la lista para siempre por haber salido una vez.

---

# 6. Lo que llega de afuera es evidencia; lo que se produce adentro es versión

Un archivo producido **dentro** del circuito, por quien tiene el paso vigente, es una versión. Uno que llega de **afuera** del circuito es evidencia de una respuesta.

Es una regla con dos resultados según dónde viva el revisor. En modo Emisor el cliente no tiene paso ni firma nuestra, de modo que su plano marcado es evidencia. En modo Receptor el revisor de la planta sí lo tiene, y su marca es una versión como cualquier otra.

El archivo devuelto tampoco es entregable, ni fuente, ni respaldo: no integra la entrega, es lo que la contraparte dijo **sobre** la entrega.

---

# 7. La respuesta no es un estado de la revisión

La calificación de la contraparte tiene forma propia. Meterla en el estado de la revisión sería sostener dos máquinas de estados sobre el mismo hecho, y la revisión emitida no se mueve: permanece aprobada, y que esté cerrada se lee de que tiene respuesta.

El efecto de la calificación es información para quien conduce el documento, no una transición automática. Abrir la revisión siguiente es un acto posterior y deliberado.

**La única excepción es el rol Receptor**, y no contradice lo anterior: ahí el circuito no es el ciclo interno sino el mecanismo con que la planta produce su respuesta, de modo que su conclusión sí es la del trabajo.

---

# 8. El rechazo devuelve el trabajo a quien elabora; lo que cambia es dónde vive

Es una regla uniforme con dos consecuencias distintas.

En los roles Emisor e Interno quien elabora está dentro del sistema: el rechazo devuelve la revisión a borrador y abre un circuito nuevo, y la revisión sobrevive para intentarlo otra vez.

En el rol Receptor está afuera —el contratista sube documentación ya aprobada por sus propios medios, y la planta no modela su ciclo interno— de modo que **no hay a quién devolverle nada**. El circuito concluye la revisión, se apruebe o se rechace, y la emisión siguiente llega con revisión nueva.

Por eso la revisión rechazada por la contraparte tiene estado terminal propio. No es la revisión abandonada, que se desistió antes de salir y no consume código: esta salió, y la contraparte la recibió con el suyo. **La secuencia sigue de largo en los tres desenlaces**: rechazada la `A`, la siguiente es la `B`.

---

# 9. Donde el circuito responde, la calificación es su conclusión

En el rol Receptor la calificación no es un dato al lado del circuito: es lo que lo cierra. Se exige exactamente cuando la resolución concluye —al aprobar el último paso que decide, o al rechazar en cualquiera— y no en un paso intermedio, donde todavía no hay respuesta que dar.

**El desenlace del paso se deriva del efecto**, de modo que la lógica del circuito no se ramifica: la calificación es lo que el usuario elige y lo que la interfaz muestra, y el paso queda aprobado o rechazado según lo que ella significa. La operación elegida no puede contradecirla; si pudiera, el circuito diría lo contrario que la respuesta que la contraparte lee.

Y la calificación queda **en el mismo lugar en los dos modos**: la respuesta del ítem. Lo que cambia es quién la produce, no dónde vive.

---

# 10. Donde no hay elaboración, tampoco hay armado

El armado de un circuito siempre tiene contenido porque **el elaborador nunca se preasigna**: designarlo es distribuir carga de trabajo y se decide documento por documento.

En el rol Receptor no hay elaborador. Con la plantilla del proyecto completa, el armado queda literalmente vacío, y entonces lo resuelve el sistema: emitir el transmittal entrante arma el circuito de cada documento y somete su revisión, en un solo acto y sin intervención.

La plantilla resuelve su alcance por proyecto, clase y tipo, con actores preasignados — y en el ámbito de proyectos **la clase es la disciplina**. Es, para esos ejes, la matriz de responsabilidad.

Cuando la plantilla no alcanza, ese documento conserva su armado pendiente y quien recibe lo resuelve a mano, mientras el resto del transmittal avanza. Es una red y no el camino: rechazar la emisión dejaría al contratista trabado por una configuración que él no puede corregir.

---

# 11. El transmittal agrupa la entrega, y no gobierna el ciclo

Su estado acompaña lo que ocurre con sus documentos y no lo condiciona. Las respuestas son **parciales y no bloquean**: cada documento respondido reinicia su propio ciclo con independencia de los demás, y la ingeniería produce la revisión siguiente sin esperar al resto de la carpeta.

Por eso el cierre es un acto documental explícito y no una condición derivada. Un cierre que exigiera respuestas completas no ocurriría nunca, porque las parciales son la práctica normal.

**Cerrar declara que se dejó de esperar, no que se dejó de escuchar**: una calificación tardía se registra igual y no reabre nada.

---

# 12. El vocabulario de la respuesta es del cliente; el efecto es nuestro

Cada contraparte responde con su propio juego de calificaciones, con sus códigos y su cantidad. Fijarlo en el modelo obligaría a acompañar cada variante con código.

Lo que el sistema interpreta no es el rótulo sino el **efecto**, y el efecto responde dos preguntas independientes: si habilita usar el documento, y si obliga a emitir una revisión nueva. Solo tres de sus cuatro combinaciones existen.

Es catálogo, y no enumeración, porque el usuario elige el rótulo. Cuando el usuario no elige nada y el sistema interpreta el efecto, corresponde lo contrario.

Y a diferencia de otros catálogos con alcance por proyecto, **este no hereda**: la lista es la del contrato, y una mezclada no es la de nadie.

---

# Referencias

- `10_DOM-015_Transmittal.md`, `20_DOM-016_TransmittalItem.md`
- `30_DOM-017_DocTransmittalResponse.md`, `40_DOM-018_DocQualification.md`
- `../10_cycle/80_Principios_del_Modelo.md`
- `../05_project/80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
