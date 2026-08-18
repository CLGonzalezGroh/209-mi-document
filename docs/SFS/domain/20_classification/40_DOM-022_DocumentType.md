# DOM-022 — DocumentType

**Ámbito:** Clasificación
**Categoría:** Catalog
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Declarar **qué clase de entregable** es un documento —plano, procedimiento, informe, memoria de cálculo— dentro de la familia a la que pertenece.

---

# Descripción

Un `DocumentType` es una entrada de catálogo con los **mismos dos ejes de alcance** que la clase, más un tercero propio: **la clase de la que cuelga**.

| Eje | Nulo significa |
| --- | -------------- |
| Módulo | Compartido entre todos los módulos que heredan |
| Proyecto | Del catálogo del despliegue |
| Clase | Disponible para todas las clases |

**El alcance del tipo y el de su clase pueden diferir, en un solo sentido.** Un tipo del proyecto puede colgar de una clase del despliegue: eso **es** ampliar la clasificación heredada, y es el caso normal. Al revés no — un tipo del despliegue colgado de una clase de proyecto dejaría al catálogo global dependiendo de un proyecto, y quien mirara el catálogo del despliegue vería una entrada que pertenece a otro. Tampoco cuelga de la clase de otro proyecto, que no ve.

---

# Responsabilidades

`DocumentType` es responsable de:

- declarar una clase de entregable disponible, con su código y su rótulo;
- declarar en qué ámbito está disponible y bajo qué clase;
- **proponer** el circuito formal frente al mínimo.

No es responsable de:

- imponer el circuito. La propuesta es sugerencia del armado y no invariante: toda revisión tiene circuito, y cuál se arma lo decide quien arma.

---

# Atributos Conceptuales

Nombre, código y descripción, más los tres ejes y la propuesta de circuito formal. Con la autoría del alta y de la última modificación, y la marca de vigencia.

**Nombre y código son únicos dentro de su clase y su ámbito.** El mismo código de tipo puede repetirse bajo dos clases distintas y son entradas distintas — un *plano* civil y un *plano* eléctrico no son el mismo tipo. Como en la clase, los nulos se tratan como iguales entre sí.

---

# Ciclo de Vida

**Se da de alta en un ámbito y no cambia de ámbito**, con el mismo criterio que la clase.

**Sí cambia de clase**, y el cambio verifica el cruce: mover un tipo a otra clase puede cruzar alcances igual que crearlo ahí.

**La baja es lógica**, y **un tipo dado de baja no se elige**. Lo ya clasificado lo conserva.

---

# Relaciones Conceptuales

**Cuelga de**

- una clase de documento, o de ninguna

**Es referido por**

- la revisión, que declara con qué tipo se identifica el documento
- el documento, como copia de su revisión en curso
- la plantilla del circuito, que puede alcanzarse por tipo

---

# Observaciones

**Declara su alcance junto con la clase**, no por separado. La declaración es una sola para el par, y es lo que impide el estado que no describe ninguna práctica: heredar tipos sin heredar las clases que los contienen.

**Es el único catálogo documental cuya entrada cuelga de otra entrada del mismo sistema**, y de ahí sale la invariante de cruce. La ubicación tiene la suya por el mismo motivo —su padre está en el mismo árbol—; la clase no la necesita porque no cuelga de nada.

**La propuesta de circuito formal cambió de significado y conserva el dato.** Antes indicaba si había circuito; hoy toda revisión lo tiene, y lo que distingue es el formal del mínimo. El atributo se renombró para conservar los valores ya cargados en lugar de recrearlos.

---

# Referencias

- `30_DOM-021_DocumentClass.md`
- `20_DOM-020_DocCatalogScope.md`
- `../10_cycle/40_DOM-008_ReviewWorkflow.md`
- `../10_cycle/70_DOM-011_DocWorkflowTemplate.md`
- `80_Principios_del_Modelo.md`
