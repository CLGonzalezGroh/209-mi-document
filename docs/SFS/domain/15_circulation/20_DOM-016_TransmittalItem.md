# DOM-016 — TransmittalItem

**Ámbito:** Circulación
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Declarar que **una revisión concreta salió en una emisión concreta**, y con qué propósito.

---

# Descripción

Un `TransmittalItem` es una línea de la carátula: qué documento va, en qué revisión, y para qué. Esa última parte no es una etiqueta — **el propósito gobierna dos reglas** y es lo que distingue una entrega para aprobación de una que solo informa.

**Primera regla: declara si se espera calificación.**

| Propósito | ¿Espera calificación? |
| --------- | --------------------- |
| `FOR_APPROVAL` | Sí |
| `FOR_REVIEW` | Sí |
| `FOR_INFORMATION` | No |
| `FOR_CONSTRUCTION` | No |
| `AS_BUILT` | No |

Es **expectativa y no permiso**: si la contraparte igual responde sobre una emisión informativa, la respuesta se registra. Lo que la regla gobierna es qué figura como pendiente, y sin ella la lista de lo que falta contestar acumularía para siempre envíos que nadie va a responder.

**Segunda regla: declara qué archivos se esperan.** La emisión final —apto para construcción, conforme a obra— espera el editable además del entregable, porque ahí el documento deja de ser una etapa y pasa a ser aquello con lo que se construye.

Esa segunda regla **advierte y no impide**, y el motivo es estructural antes que práctico: al emitir, la revisión ya está aprobada y su versión es inmutable, de modo que **no hay forma legal de agregar el archivo que falta**. Una puerta dura exigiría algo que el propio sistema hace imposible.

---

# Responsabilidades

`TransmittalItem` es responsable de:

- vincular una revisión con la emisión por la que salió;
- declarar el propósito de ese envío;
- ser el punto del que cuelga la respuesta de la contraparte.

No es responsable de:

- alojar la calificación ni sus archivos, que pertenecen a la respuesta;
- cambiar después de emitido.

---

# Atributos Conceptuales

Entre los atributos propios del `TransmittalItem` podrán encontrarse:

- transmittal al que pertenece;
- revisión que sale;
- propósito del envío.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**Toda revisión incluida en una emisión saliente debe estar aprobada.** Sin excepción, cualquiera sea el propósito: la función del módulo es garantizar la calidad de lo que sale.

La puerta **se aplica al incorporar el ítem** y no solo al emitir. Una revisión en circuito no es candidata a salir, de modo que tampoco es candidata a entrar en la carpeta. Se verifica de nuevo al emitir, porque entre una cosa y la otra la revisión pudo abandonarse.

**En modo Receptor no hay puerta**, y no es una excepción a la regla sino su consecuencia: la puerta exige aprobación **interna**, y el contratista sube documentación ya aprobada por sus propios medios, cuyo ciclo la planta no modela.

**Una revisión se emite una sola vez.** Lo sostiene la unicidad de la revisión en el ítem, no una validación. Con eso quedan cubiertos, sin regla propia, que una revisión ya respondida no vuelva a emitirse y que un reintento no duplique la emisión.

**Los ítems se agregan y se quitan solo en borrador.** Quitar uno **libera la revisión**, que vuelve a ser candidata para otra carpeta: nunca salió.

---

# Relaciones Conceptuales

**Pertenece a**

- `Transmittal` de naturaleza emisión

**Refiere a**

- `DocumentRevision`, una sola vez en todo el sistema

**Es respondido por**

- `DocTransmittalResponse`, a lo sumo una

---

# Observaciones

**La advertencia de archivos faltantes se adelanta al momento en que sirve.** Mientras la revisión está abierta y su copia de trabajo sin confirmar, incorporar el editable no cuesta nada; al emitir, la advertencia se repite ya sin remedio y **el hecho queda en la auditoría**. El caso legítimo existe —el editable que por tamaño o formato viaja por otro medio— y así pasa a ser un dato registrado en lugar de un silencio.

**La revisión abierta también responde qué le faltaría**, tomando el propósito como pregunta: todavía no sabe con cuál va a salir.

**El ítem que espera calificación y no tiene respuesta es lo que falta contestar.** No hace falta ningún estado que lo declare.

**Que una revisión se emita una sola vez es también lo que define al documento pendiente**, leído al revés: pendiente es aquel cuya revisión en curso no tiene ítem.

---

# Referencias

- `10_DOM-015_Transmittal.md`, `30_DOM-017_DocTransmittalResponse.md`
- `../10_cycle/20_DOM-006_DocumentRevision.md`, `../10_cycle/30_DOM-007_DocumentVersion.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
