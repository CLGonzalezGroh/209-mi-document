# DOM-009 — ReviewStep

**Ámbito:** Ciclo interno
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Representar **un acto asignado a una persona** dentro del circuito, y registrar cómo se resolvió.

---

# Descripción

Un `ReviewStep` es una casilla del rótulo: alguien tiene que hacer algo, y cuando lo hace queda constancia de qué hizo y quién fue.

Los tipos, en el orden en que se recorren:

| Paso | Naturaleza | Completarlo significa |
| ---- | ---------- | --------------------- |
| Armado | Se cumple | Quedan designados el elaborador y los revisores, y **se materializan los pasos siguientes** |
| Elaboración | Se cumple | El documento está hecho y se somete |
| Revisión | **Decide** | Se revisó, y puede rechazar |
| Aprobación | **Decide** | Se aprobó, y puede rechazar |
| Toma de conocimiento | Se cumple | Se acusó recibo del documento aprobado |

El **paso vigente** es el primero pendiente por orden. Es el que gobierna quién puede registrar una versión y de quién es el turno.

---

# Responsabilidades

`ReviewStep` es responsable de:

- declarar qué acto corresponde y a quién está asignado;
- registrar **quién lo resolvió efectivamente** y con qué motivo, cuando no es el asignado;
- conservar el comentario de quien lo resolvió.

No es responsable de:

- guardar la evidencia de lo resuelto, que corresponde a `DocStepSignature`;
- guardar el historial de reasignaciones, que vive en la traza.

---

# Atributos Conceptuales

Entre los atributos propios del `ReviewStep` podrán encontrarse:

- orden dentro del circuito;
- tipo de paso;
- usuario asignado;
- estado;
- usuario que lo resolvió, y motivo cuando no es el asignado;
- comentario;
- fecha de resolución;
- fecha de alta.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**Los pasos que deciden terminan aprobados o rechazados; los que se cumplen, cumplidos.** Dejar un armado en aprobado afirmaría que alguien aprobó el armado.

**Solo los pasos que deciden pueden rechazar**, y son los únicos que cuentan para completar el circuito.

**El paso lo resuelve quien lo tiene asignado.** Resolverlo por otro exige el permiso de administración del circuito **y motivo**: es lo que vuelve la delegación trazable y no solo permitida.

**Quien resolvió se registra siempre**, y la divergencia con el asignado se **deriva** de ambos datos.

**Se resuelve en su turno**: todos los pasos anteriores deben estar resueltos. La toma de conocimiento es la excepción, porque se resuelve cuando el circuito ya cerró.

**Un paso pendiente se reasigna; uno resuelto no.** Su firma acredita quién lo resolvió, y reasignarlo la dejaría sin correspondencia. La reasignación cambia el actor y nada más: ni el tipo, ni el orden, ni cuántos son.

---

# Relaciones Conceptuales

**Pertenece a**

- `ReviewWorkflow`

**Produce**

- `DocStepSignature`, salvo el armado

**Asigna a**

- un usuario, por referencia externa

---

# Observaciones

**El armado no firma.** Al completarse puede no existir todavía ninguna versión, de modo que no habría objeto que acreditar; su evidencia es el evento de auditoría, que registra quién designó a quién.

**La partición entre lo que decide y lo que se cumple no coincide con la de qué pasos firman**: la toma de conocimiento se cumple, pero firma. Cumplir y juzgar son cosas distintas, pero ambas se acreditan.

**La toma de conocimiento se resuelve después de que el circuito cerró**, y es visible mientras siga pendiente. Bloquear la aprobación hasta que todos acusen invertiría su función, y cerrarla de oficio la convertiría en un registro vacío.

**La reasignación es una acción de auditoría y no una transición de estado**, porque el paso sigue pendiente: el historial de asignados queda en la traza, sin estructura nueva.

---

# Referencias

- `40_DOM-008_ReviewWorkflow.md`, `60_DOM-010_DocStepSignature.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
