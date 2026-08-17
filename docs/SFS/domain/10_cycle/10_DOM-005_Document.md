# DOM-005 — Document

**Ámbito:** Ciclo interno
**Categoría:** Entity
**Estado:** Approved
**Versión:** 2.0

---

# Propósito

Identificar una pieza de documentación a lo largo de toda su vida, con independencia de cuántas veces se revise.

---

# Descripción

Un `Document` es **la identidad**, no el contenido. Lo que se emite, se revisa y se aprueba son sus revisiones; el documento es lo que permite reconocerlas como sucesivas versiones externas de la misma cosa.

Su identificación se compone de código, título, clase y tipo. En el control documental esa identificación **no es descripción sino identidad**: el rótulo de un plano la lleva impresa, y de hecho el código habitualmente se compone de clase y tipo.

De esa identificación, **el documento conserva solo el código**. El título, la clase y el tipo pertenecen a la revisión, porque están impresos dentro del archivo y lo impreso pertenece a la emisión que lo produjo. El documento los replica para poder listarlos y filtrarlos, pero como copia y no como dato propio.

El documento pertenece a un proyecto o al régimen de publicación, según lo define el ámbito de contexto de proyecto.

**Un documento existe desde su alta con un circuito ya en marcha**, aunque todavía no tenga archivo: el paso de elaboración existe precisamente para producirlo.

---

# Responsabilidades

`Document` es responsable de:

- portar el código, que es su identificador estable;
- agrupar sus revisiones como historia sucesiva;
- exponer cuál es su revisión vigente y cuál está en curso;
- registrar el fin de su vida útil.

No es responsable de:

- guardar la identificación impresa en el rótulo, que pertenece a la revisión;
- guardar el esquema con que se numeran sus revisiones, que se elige en cada una;
- guardar contenido, que pertenece a la versión;
- definir el circuito, que pertenece a la revisión.

---

# Atributos Conceptuales

Entre los atributos propios del `Document` podrán encontrarse:

- **código identificador**, que no cambia;
- descripción y ámbito —proyecto o módulo de publicación—;
- **ubicación física** y la ruta de esa ubicación como snapshot;
- copia de la identificación de su revisión en curso: título, clase y tipo;
- fecha, actor y motivo de su obsolescencia;
- fechas y actores de alta y modificación.

**No se encuentra entre ellos el esquema de revisión.** Se elige al crear cada revisión y se lee de la última no abandonada.

**La ubicación se edita siempre, como la descripción.** No entra en el congelamiento de la revisión aprobada ni en el payload de la firma: clasifica y no identifica, de modo que corregir dónde está un equipo no exige abrir una revisión. Su ruta es un snapshot que el propio catálogo recalcula al renombrar o mover el nodo. Es opcional, y el proyecto puede exigirla por configuración — ver `../20_classification/10_DOM-019_DocLocation.md`.

La copia de la identificación **se nombra por la lectura que sirve** —`currentTitle` y equivalentes—, para que ningún consumidor la confunda con la identificación de la revisión aprobada.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**El código es el identificador y no cambia.** Está en los transmittals emitidos, en el payload de cada firma, en las referencias cruzadas de otros documentos y en el rótulo de cada archivo que salió. Solo se corrige **mientras el documento no tenga ninguna revisión aprobada**, que es la condición material de que nada salió; después, lo que corresponde es un documento nuevo que lo reemplace.

**El código es único dentro de su ámbito**: dentro del proyecto para la documentación en circulación, dentro del módulo para la publicada. **El documento obsoleto no lo libera.**

**La identificación se congela con la revisión aprobada, y el congelamiento es estructural.** No es una precondición de la edición: es que una revisión aprobada no se modifica, y la identificación vive en ella. Abrir la revisión siguiente la vuelve a habilitar.

**Lo administrativo se edita siempre.** La descripción no aparece en ningún rótulo, y corregirla no exige abrir una revisión.

**Todo documento tiene al menos una revisión, y esa revisión tiene circuito.** El alta crea las tres cosas en un solo acto.

**El documento obsoleto no admite revisiones nuevas.** Emitir sobre lo que ya fue superado, o sobre lo que salió del alcance, sería contradictorio.

---

# Relaciones Conceptuales

**Se clasifica por**

- `DocumentClass` y `DocumentType`, por la copia de la identificación de su revisión en curso

**Agrupa a**

- `DocumentRevision`, como historia sucesiva ordenada por creación

**Participa de**

- `DocReplacement`, como reemplazado o como reemplazante

**Pertenece a**

- un proyecto, por referencia externa, o a ninguno bajo el régimen de publicación

---

# Observaciones

**Un documento está pendiente cuando su revisión en curso todavía no salió.** No es un atributo ni una clase aparte: se deriva de que esa revisión no figure en ninguna emisión, y su significado depende del rol del proyecto. No hay documento esperado y documento adicional — todo el que se da de alta en el proyecto es esperado, y el que aparece más tarde también. Ver `../15_circulation/80_Principios_del_Modelo.md`.

El documento expone **dos lecturas distintas** de su estado, y confundirlas es el defecto que su especificación previene: la revisión **vigente** es la última aprobada y solo esa, y la revisión **en curso** es la última no abandonada en cualquier estado. Un documento sin ninguna revisión aprobada no tiene revisión vigente, y devolver un borrador en su lugar afirmaría que el proyecto tiene un documento que en realidad no aprobó.

**Esas mismas dos lecturas alcanzan a la identificación**, y por eso la copia lleva el prefijo que la nombra. La metadata **vigente** es la de la última aprobada —lo que dice el rótulo que efectivamente salió—; la metadata **en curso** es la de la revisión abierta. Un campo que callara cuál de las dos es se derivaría mal en cada consumidor.

**Abandonar una revisión devuelve la identificación anterior**, y no hay nada que revertir: la abandonada deja de ser la última viva y la copia se recalcula sobre la que estaba antes. El origen nunca se sobrescribió.

**Obsoleto no es dado de baja.** La baja lógica corrige un alta que no debió existir. La obsolescencia es un hecho del ciclo de vida —el documento existió, sirvió y dejó de servir— y conserva su historia entera: su código, sus revisiones, sus versiones firmadas y sus transmittals.

**La causa de la obsolescencia se deriva y no se guarda.** El documento que figura como reemplazado en algún acto lo está por reemplazo; el que no figura en ninguno, por haber salido del alcance. Un indicador sería un dato calculable capaz de contradecir a los que lo originan. El **hecho** sí se registra, porque dos causas llegan al mismo estado y ninguna se deduce de la otra.

---

# Referencias

- `20_DOM-006_DocumentRevision.md`, `90_DOM-013_DocReplacement.md`
- `80_Principios_del_Modelo.md`
- `../05_project/80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
