# DOM-013 — DocReplacement

**Ámbito:** Ciclo interno
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Registrar que unos documentos **reemplazan y superan** a otros, con su motivo.

---

# Descripción

Un `DocReplacement` es **un acto**, no un par de referencias. Agrupa los documentos que salen y los que entran, y declara por qué.

Que sea un acto es lo que le da sentido: sin la agrupación, una reorganización de dos documentos en otros dos sería indistinguible de dos reemplazos separados, y la razón que los une se perdería.

**Reemplazar es superar.** Los documentos reemplazados quedan obsoletos en el mismo acto — no son dos decisiones, porque el documento superado deja de representar nada vigente en el instante en que otro lo hace. Es el mismo hecho que un nivel más abajo ocurre al aprobar una revisión, que supersede a la anterior.

Su origen habitual es la imposibilidad de editar el código: aprobada una revisión, el documento ya salió con él, y corregirlo exige dar de alta uno nuevo que lo reemplace.

---

# Responsabilidades

`DocReplacement` es responsable de:

- agrupar los documentos del acto con su papel;
- portar el motivo, la fecha y el actor;
- ser el objeto del que cuelga la traza del reemplazo.

No es responsable de:

- declarar de qué clase de reemplazo se trata, que se deriva de su cardinalidad;
- cerrar los documentos reemplazados, que es baja lógica y no obsolescencia;
- expresar el paso de un documento de contrato al activo de planta, que es promoción y no reemplazo.

---

# Atributos Conceptuales

Entre los atributos propios del `DocReplacement` podrán encontrarse:

- motivo, obligatorio;
- fecha y actor del acto.

Y de cada documento que agrupa, su **papel**: reemplazado o reemplazante.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**El acto exige al menos un documento reemplazado y uno reemplazante**, y ningún documento se reemplaza a sí mismo.

**Un documento no aparece dos veces con el mismo papel** dentro de un acto.

**Los documentos de un acto comparten ámbito**: todos del mismo contrato, o todos del régimen de publicación. Lo que cruza de uno a otro no es reemplazar sino promover.

**El motivo es obligatorio**, con el criterio que rige todo acto consecuente del ciclo.

**Un documento ya obsoleto no se reemplaza de nuevo.**

---

# Relaciones Conceptuales

**Agrupa a**

- `Document`, con el papel de reemplazado o de reemplazante

---

# Observaciones

**La relación es N:M, y con una sola quedan expresados tres hechos** que antes no tenían forma de registrarse:

| Cardinalidad | Hecho |
| ------------ | ----- |
| 1:1 | Recodificación: el mismo documento con otro código |
| N:1 | Unificación: dos documentos pasan a ser uno |
| 1:N | División: un documento se separa en dos |

**Qué clase de reemplazo es se deriva de la cardinalidad y no se declara.** Un indicador sería un dato calculable capaz de contradecir a los que lo originan.

**El acto es informativo respecto de los documentos que entran**: no los condiciona ni los bloquea. Lo único que produce es la obsolescencia de los que salen.

**Reemplazar no es dar de baja.** El documento reemplazado conserva su código —que sigue tomado dentro del ámbito—, su historia de revisiones, sus versiones firmadas y sus transmittals. Lo único que pierde es la posibilidad de emitir de nuevo.

**Que compartan ámbito no es solo una regla de negocio.** Es lo que vuelve bien definido el contexto del acto en la traza: cualquiera de sus documentos da la misma respuesta, de modo que no hay que elegir uno.

**La promoción al activo de planta es otra cosa**, y no se registra acá. Ocurre entre revisiones y no entre documentos, el documento de contrato no queda obsoleto —quedó terminado—, produce una revisión en el activo en lugar de un documento, y cruza de ámbito. Pertenece al módulo de activos.

---

# Referencias

- `10_DOM-005_Document.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
