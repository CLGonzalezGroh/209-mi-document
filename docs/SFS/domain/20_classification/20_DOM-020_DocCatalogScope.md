# DOM-020 — DocCatalogScope

**Ámbito:** Clasificación
**Categoría:** Configuration
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Declarar **cómo resuelve un proyecto cada catálogo documental**: heredando el del despliegue y ampliándolo, o teniendo el suyo propio.

---

# Descripción

Un `DocCatalogScope` es una fila por **proyecto y catálogo**, con dos modos:

| Modo | Qué ve el proyecto |
| ---- | ------------------ |
| `INHERIT` | Las entradas del despliegue **más** las que el proyecto agregue. Vínculo vivo: una entrada nueva del despliegue aparece sin que el proyecto haga nada |
| `OWN` | Solo las propias. Sin vínculo con el despliegue |

En una planta rige el primero, porque cada proyecto interviene sobre la misma instalación. En una empresa de ingeniería el catálogo del despliegue queda vacío o mínimo y cada proyecto carga la estructura de su cliente — salvo la ingeniería de un solo cliente, que puede usar el global.

**La ausencia de fila es `INHERIT`.** No hace falta declarar nada para operar, y es lo que vuelve aditiva la incorporación del mecanismo: todo proyecto existente hereda.

**El mecanismo es uno para los tres catálogos documentales** —ubicación, clase y tipo—, y por eso el catálogo alcanzado es un valor y no una entidad distinta por cada uno.

---

# Responsabilidades

`DocCatalogScope` es responsable de:

- declarar el modo con que un proyecto resuelve un catálogo;
- conservar quién lo declaró y cuándo.

No es responsable de:

- las entradas del catálogo, que son de cada catálogo;
- los valores de configuración que el proyecto declara, que viven en `DocProjectSettings`.

---

# Atributos Conceptuales

Proyecto, catálogo alcanzado y modo, con la autoría del alta y de la última modificación. Único por el par proyecto–catálogo.

---

# Ciclo de Vida

**Se declara y se vuelve a declarar.** Volver a `INHERIT` es declararlo, no borrar la fila: que quede el registro de haber vuelto es justamente lo que la traza necesita.

**Declarar `OWN` sobre la ubicación se rechaza mientras algún nodo del proyecto cuelgue del árbol del despliegue.** Al dejar de heredar, esos nodos quedarían colgados de un padre que el proyecto ya no ve. El rechazo nombra las rutas que lo impiden, y moverlas a un nodo propio es la vía para habilitarlo.

**Cambiar de modo con documentos ya clasificados se admite.** La validación ocurre solo en escritura y nunca revalida lo existente: un documento clasificado conserva su valor aunque su entrada deje de estar disponible. No se le impone la inmutabilidad que el rol documental exige, porque acá no hay semántica que cambie de significado.

---

# Relaciones Conceptuales

**Alcanza a**

- un proyecto y un catálogo

---

# Observaciones

**Es una entidad propia y no columnas de la configuración del proyecto**, y esa es la forma de que el mecanismo sea uno para los tres catálogos en lugar de tres veces el mismo. Incorporar clase y tipo no cuesta una columna sino un valor más del catálogo alcanzado.

**Es además la distinción entre configurar un valor y configurar un conjunto.** Las demás definiciones por proyecto —el rol documental, el esquema de revisión, el armador por defecto— son **valores**, donde lo específico reemplaza a lo general. Un catálogo es un **conjunto**, y lo que se declara es si se hereda.

**La declaración es por catálogo y no una sola por proyecto**, porque los casos difieren: un cliente puede dictar los tipos de documento y no tener nomenclatura formal de áreas.

**Heredar suma y no reemplaza**, al contrario del catálogo de calificaciones, donde el proyecto que declara una propia usa las suyas y solo las suyas porque la lista es la del contrato. Acá ampliar es el caso normal, y por eso el modo **se declara** en lugar de derivarse de que existan entradas propias.

**La siembra por copia no es un tercer modo.** Es puntual y no deja vínculo: una copia permanente *es* herencia. Copia lo que la fuente ve —el árbol del despliegue o el de otro proyecto que el usuario alcance por membresía—, solo agrega, y no duplica, porque la identidad de un nodo es su ruta completa. Sembrar en un proyecto que hereda esas rutas no agrega nada, y es correcto: ya las ve.

**El orden natural es declarar primero y sembrar después.** Un proyecto que todavía hereda ya ve el árbol del despliegue, de modo que sembrárselo sería una operación vacía.

---

# Referencias

- `10_DOM-019_DocLocation.md`
- `../05_project/10_DOM-003_DocProjectSettings.md`
- `../15_circulation/40_DOM-018_DocQualification.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
