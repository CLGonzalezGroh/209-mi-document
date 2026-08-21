# DOM-011 — DocWorkflowTemplate

**Ámbito:** Ciclo interno
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

**Proponer** el circuito que corresponde a un documento, para que el armado no tenga que declararlo paso por paso en cada alta.

---

# Descripción

Una `DocWorkflowTemplate` declara un circuito habitual: qué pasos lo componen, en qué orden, y opcionalmente quién los ocupa.

Se resuelve **por alcance** contra la tupla del propio documento —contrato, clase y tipo—, y **gana la más específica**:

| Alcance declarado | Precedencia |
| ----------------- | ----------- |
| Contrato, clase y tipo | La más específica |
| Contrato y clase | Intermedia |
| Solo contrato | Es el default de ese contrato |

Una columna con valor debe coincidir con la del documento; una en blanco no restringe. La plantilla del contrato sin clase ni tipo **es** su default, sin necesidad de una marca aparte.

**La plantilla propone y no impone**: quien crea el documento y el armador pueden cambiarla o ignorarla.

---

# Responsabilidades

`DocWorkflowTemplate` es responsable de:

- declarar un circuito habitual con sus pasos y su orden;
- declarar el alcance en el que rige;
- preasignar actores cuando corresponda.

No es responsable de:

- declarar el armado ni la elaboración, que los pone el sistema;
- preasignar al elaborador;
- gobernar circuitos ya materializados.

---

# Atributos Conceptuales

Entre los atributos propios de la `DocWorkflowTemplate` podrán encontrarse:

- nombre y descripción;
- alcance: contrato, clase y tipo de documento, cualquiera de ellos sin declarar;
- pasos, con su orden, su tipo y su actor preasignado opcional;
- fecha de baja;
- fechas y actores de alta y modificación.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**El alcance es único.** No existen dos plantillas vigentes para la misma combinación de contrato, clase y tipo, y las combinaciones sin declarar cuentan como valor a estos efectos.

**La plantilla no declara el armado ni la elaboración.** Esos pasos los pone el sistema: una plantilla que pudiera omitirlos permitiría circuitos sin elaborador, y una que pudiera incluirlos permitiría dos armados.

**El elaborador nunca se preasigna.** Designarlo es distribuir carga de trabajo y se decide documento por documento. Por eso el armado tiene contenido incluso con la plantilla más completa, y por eso siempre existe.

**Los valores se copian al materializarse.** Cambiar la plantilla después no altera ningún circuito en curso.

**Una plantilla dada de baja deja de proponerse, pero no se elimina**: los circuitos que la referencian conservan de dónde salió su propuesta.

---

# Relaciones Conceptuales

**Propone a**

- `ReviewWorkflow`, que copia sus valores al materializarse

**Acota su alcance con**

- un contrato, por referencia externa
- `DocumentClass` y `DocumentType`, dentro del alcance que la propia plantilla resuelve: una del despliegue no referencia entradas de contrato

---

# Observaciones

La plantilla es **una** fuente de propuesta para el armado, no la única concebible. Otras fuentes de propuesta para el mismo paso pertenecen a bloques posteriores.

---

# Referencias

- `40_DOM-008_ReviewWorkflow.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
