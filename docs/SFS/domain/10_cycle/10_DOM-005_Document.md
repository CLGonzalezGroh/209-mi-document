# DOM-005 — Document

**Ámbito:** Ciclo interno
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Identificar una pieza de documentación a lo largo de toda su vida, con independencia de cuántas veces se revise.

---

# Descripción

Un `Document` es **la identidad**, no el contenido. Lo que se emite, se revisa y se aprueba son sus revisiones; el documento es lo que permite reconocerlas como sucesivas versiones externas de la misma cosa.

Su identificación se compone de código, título, clase y tipo. En el control documental esa identificación **no es descripción sino identidad**: el rótulo de un plano la lleva impresa, y de hecho el código habitualmente se compone de clase y tipo.

El documento pertenece a un proyecto o al régimen de publicación, según lo define el ámbito de contexto de proyecto.

**Un documento existe desde su alta con un circuito ya en marcha**, aunque todavía no tenga archivo: el paso de elaboración existe precisamente para producirlo.

---

# Responsabilidades

`Document` es responsable de:

- portar la identificación estable de la documentación;
- agrupar sus revisiones como historia sucesiva;
- exponer cuál es su revisión vigente y cuál está en curso.

No es responsable de:

- guardar el esquema con que se numeran sus revisiones, que se elige en cada una;
- guardar contenido, que pertenece a la versión;
- definir el circuito, que pertenece a la revisión.

---

# Atributos Conceptuales

Entre los atributos propios del `Document` podrán encontrarse:

- código identificador;
- título y descripción;
- clase y tipo de documento;
- ámbito al que pertenece —proyecto o módulo de publicación—;
- fechas y actores de alta y modificación.

**No se encuentra entre ellos el esquema de revisión.** Se elige al crear cada revisión y se lee de la última no abandonada.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**La identificación se congela con la revisión vigente aprobada.** Mientras la revisión en curso no esté aprobada, la metadata se edita libremente; aprobada, corregirla exige abrir una revisión nueva, que vuelve a habilitarla.

**Todo documento tiene al menos una revisión, y esa revisión tiene circuito.** El alta crea las tres cosas en un solo acto.

**El código es único dentro de su ámbito**: dentro del proyecto para la documentación en circulación, dentro del módulo para la publicada.

---

# Relaciones Conceptuales

**Se clasifica por**

- `DocumentClass` y `DocumentType`

**Agrupa a**

- `DocumentRevision`, como historia sucesiva ordenada por creación

**Pertenece a**

- un proyecto, por referencia externa, o a ninguno bajo el régimen de publicación

---

# Observaciones

El documento expone **dos lecturas distintas** de su estado, y confundirlas es el defecto que su especificación previene: la revisión **vigente** es la última aprobada y solo esa, y la revisión **en curso** es la última no abandonada en cualquier estado. Un documento sin ninguna revisión aprobada no tiene revisión vigente, y devolver un borrador en su lugar afirmaría que el proyecto tiene un documento que en realidad no aprobó.

**Abandonar una revisión no revierte la metadata** que se cambió mientras estaba abierta. El documento queda declarando algo que ninguna revisión aprobada reproduce, hasta que se emita la siguiente. Retroceder sería peor: la historia no vuelve atrás.

---

# Referencias

- `20_DOM-006_DocumentRevision.md`
- `80_Principios_del_Modelo.md`
- `../05_project/80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
