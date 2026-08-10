# DOM-002 — DocAuditEvent

**Ámbito:** Transversal
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.1

---

# Propósito

Registrar las **acciones ejecutadas** por los usuarios o por el sistema sobre los Objetos del Dominio documental.

El `DocAuditEvent` constituye la traza de auditoría funcional de OperMask Documents.

---

# Descripción

Un `DocAuditEvent` representa un hecho puntual e inmutable que deja constancia de una acción funcional realizada: crear un documento, registrar una versión, aprobar un paso de revisión, emitir un transmittal.

Es un concepto **transversal**: todas las capacidades del dominio documental generan `DocAuditEvent` para preservar la responsabilidad y la trazabilidad de las operaciones.

Los `DocAuditEvent` no se modifican ni se eliminan.

---

# Responsabilidades

El `DocAuditEvent` es responsable de:

- registrar una acción ejecutada por un usuario o por el sistema;
- identificar al actor, la acción y el objeto afectado;
- preservar el momento en que ocurrió la acción y sus datos de contexto;
- conformar la traza de auditoría funcional del sistema.

No es responsable de:

- representar transiciones de estado (eso corresponde a `DocWorkflowEvent`);
- registrar la operación técnica del servicio ni sus errores (eso corresponde a `DocumentSysLog`);
- validar la autorización de la acción.

---

# Atributos Conceptuales

Entre los atributos propios del `DocAuditEvent` podrán encontrarse:

- acción ejecutada, expresada como verbo en imperativo (`CreateDocument`, `ApproveStep`, `IssueTransmittal`);
- tipo y referencia del objeto afectado;
- fecha y hora;
- actor, que puede ser nulo cuando la emite el sistema;
- datos contextuales de la acción;
- proyecto y ámbito del objeto afectado, derivados de él y no informados por quien emite. Pueden ser nulos: los catálogos no pertenecen a ningún proyecto, y la documentación publicada tampoco.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Relaciones Conceptuales

**Registra acciones sobre**

- cualquier Objeto del Dominio documental

---

# Observaciones

Una acción se registra **una sola vez**, aunque produzca varias transiciones (DOM-001).

La acción se registra **dentro de la misma transacción** que aplica el cambio, de modo que no puede existir una operación aplicada sin su registro.

El acceso a la traza de un objeto se rige por el permiso de lectura de ese objeto: la traza forma parte del objeto, y quien puede leerlo puede leer su historia.

El `DocAuditEvent` responde a **quién hizo qué y cuándo**, mientras que el `DocWorkflowEvent` responde a **qué estado cambió**. Ambos son complementarios y transversales.

---

# Referencias

- `10_DOM-001_DocWorkflowEvent.md`
- `../05_project/80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`