# DOM-001 — DocWorkflowEvent

**Ámbito:** Transversal
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.1

---

# Propósito

Representar una **transición de estado** ocurrida en el ciclo de vida de un Objeto del Dominio documental.

El `DocWorkflowEvent` deja constancia del avance de un objeto a través de sus estados, con independencia del objeto al que pertenezca.

---

# Descripción

Un `DocWorkflowEvent` representa un hecho puntual e inmutable que indica que un objeto cambió de estado dentro de su ciclo de vida: una `DocumentRevision` que pasa de `IN_REVIEW` a `APPROVED`, un `Transmittal` que pasa de `DRAFT` a `ISSUED`, un `ReviewStep` que queda `SKIPPED`.

Es un concepto **transversal**: cualquier objeto del dominio documental emite `DocWorkflowEvent` para preservar la trazabilidad de su ciclo.

Los `DocWorkflowEvent` no se modifican ni se eliminan.

---

# Responsabilidades

El `DocWorkflowEvent` es responsable de:

- registrar una transición de estado de un Objeto del Dominio;
- identificar el objeto afectado, el estado previo y el estado resultante;
- preservar el momento en que ocurrió la transición y el actor que la originó;
- mantener el orden cronológico del ciclo de vida del objeto.

No es responsable de:

- registrar acciones o intervenciones de usuario (eso corresponde a `DocAuditEvent`);
- registrar la operación técnica del servicio ni sus errores (eso corresponde a `DocumentSysLog`);
- ejecutar la transición ni validar sus precondiciones.

---

# Atributos Conceptuales

Entre los atributos propios del `DocWorkflowEvent` podrán encontrarse:

- nombre de la transición, expresado en participio (`RevisionApproved`, `TransmittalIssued`);
- tipo y referencia del objeto afectado;
- estado previo, que puede no existir cuando el objeto se da de alta;
- estado resultante;
- fecha y hora;
- actor que originó la transición, que puede ser nulo cuando la emite el sistema;
- contrato y ámbito del objeto afectado, derivados de él y no informados por quien emite. Pueden ser nulos: los catálogos no pertenecen a ningún contrato, y la documentación publicada tampoco.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Relaciones Conceptuales

**Registra transiciones de**

- cualquier Objeto del Dominio documental con ciclo de vida

---

# Observaciones

Una misma acción puede originar **varias** transiciones. La aprobación del último paso de un circuito de revisión aprueba el paso, completa el circuito, aprueba la revisión y deja como reemplazadas a las revisiones anteriores: cuatro transiciones y una sola acción. El modelo no impone correspondencia uno a uno entre acción y transición.

La transición se registra **dentro de la misma transacción** que aplica el cambio de estado. Un cambio de estado sin su registro, o un registro sin su cambio, no son estados posibles del sistema.

El `DocWorkflowEvent` se distingue del `DocAuditEvent`: el primero describe **qué** cambió; el segundo, **quién hizo qué**.

El contexto del evento —contrato y ámbito— se **deriva del objeto afectado** y no lo informa quien emite. La derivación está declarada en un único lugar, de modo que no puede haber discrepancia entre lo que el evento afirma y lo que el objeto es. Conservarlo permite consultar la traza por contrato o por ámbito sin recorrer la cadena de objetos.

---

# Referencias

- `20_DOM-002_DocAuditEvent.md`
- `../05_project/80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`