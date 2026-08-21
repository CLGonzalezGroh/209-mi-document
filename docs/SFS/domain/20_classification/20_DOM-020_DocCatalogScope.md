# DOM-020 — DocCatalogScope

**Ámbito:** Clasificación
**Categoría:** Configuration
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Declarar **cómo resuelve un contrato cada catálogo documental**: heredando el del despliegue y ampliándolo, o teniendo el suyo propio.

---

# Descripción

Un `DocCatalogScope` es una fila por **ámbito y catálogo**, con dos modos:

| Modo | Qué ve el contrato |
| ---- | ------------------ |
| `INHERIT` | Las entradas del despliegue **más** las que el contrato agregue. Vínculo vivo: una entrada nueva del despliegue aparece sin que el contrato haga nada |
| `OWN` | Solo las propias. Sin vínculo con el despliegue |

En una planta rige el primero, porque cada contrato interviene sobre la misma instalación. En una empresa de ingeniería el catálogo del despliegue queda vacío o mínimo y cada contrato carga la estructura de su cliente — salvo la ingeniería de un solo cliente, que puede usar el global.

**La ausencia de fila es `INHERIT`.** No hace falta declarar nada para operar, y es lo que vuelve aditiva la incorporación del mecanismo: todo contrato existente hereda.

**Los catálogos documentales son dos**: la ubicación y la clasificación. Clase y tipo no son dos catálogos sino uno —el tipo cuelga de la clase—, de modo que se heredan ambos o ninguno. Declararlos por separado admitiría un contrato con clasificación propia heredando tipos que apuntan a clases que no ve.

**El ámbito se declara con los mismos dos ejes que la entrada del catálogo**: el módulo, siempre presente, y el contrato, que puede no estarlo.

| Ámbito | Módulo | Contrato | Qué declara |
| ------ | ------ | -------- | ----------- |
| Contrato | Proyectos | el suyo | Cómo resuelve ese contrato |
| Módulo | Calidad, comercial, activos | — | Cómo resuelve ese módulo |

Un contrato pertenece siempre al módulo de proyectos, de modo que los dos ejes **conviven en lugar de excluirse**: no son dos referencias anulables con una regla de exclusión mutua, que es la forma que este dominio evita.

La declaración por módulo está modelada y todavía no tiene operación que la produzca. Existe para que la **ausencia de contrato no equivalga al despliegue**, que es lo que haría falta corregir después con una migración.

---

# Responsabilidades

`DocCatalogScope` es responsable de:

- declarar el modo con que un contrato resuelve un catálogo;
- conservar quién lo declaró y cuándo.

No es responsable de:

- las entradas del catálogo, que son de cada catálogo;
- los valores de configuración que el contrato declara, que viven en `DocProject`.

---

# Atributos Conceptuales

Contrato, catálogo alcanzado y modo, con la autoría del alta y de la última modificación. Único por el par contrato–catálogo.

---

# Ciclo de Vida

**Se declara y se vuelve a declarar.** Volver a `INHERIT` es declararlo, no borrar la fila: que quede el registro de haber vuelto es justamente lo que la traza necesita.

**Declarar `OWN` se rechaza mientras algo del contrato cuelgue de algo del despliegue.** Al dejar de heredar, esas entradas quedarían apuntando a un padre que el contrato ya no ve: los nodos de ubicación colgados del árbol global, y los tipos colgados de una clase del despliegue. El rechazo los nombra, y moverlos a una entrada propia es la vía para habilitarlo.

No se resuelve desprendiéndolos de oficio, porque eso reescribiría entradas que nadie tocó por un cambio de configuración.

**Cambiar de modo con documentos ya clasificados se admite.** La validación ocurre solo en escritura y nunca revalida lo existente: un documento clasificado conserva su valor aunque su entrada deje de estar disponible. No se le impone la inmutabilidad que el rol documental exige, porque acá no hay semántica que cambie de significado.

---

# Relaciones Conceptuales

**Alcanza a**

- un contrato y un catálogo

---

# Observaciones

**Es una entidad propia y no columnas del propio contrato**, y esa es la forma de que el mecanismo sea uno para los dos catálogos en lugar de dos veces el mismo. Incorporar la clasificación no costó una columna sino un valor más del catálogo alcanzado. Es también lo que permitió agregarle el eje de módulo sin tocar al contrato, que no lo tiene.

**Es además la distinción entre configurar un valor y configurar un conjunto.** Las demás definiciones del contrato —el rol documental, el esquema de revisión, el armador por defecto— son **valores**, donde lo específico reemplaza a lo general. Un catálogo es un **conjunto**, y lo que se declara es si se hereda.

**La declaración es por catálogo y no una sola por ámbito**, porque los casos difieren: un cliente puede dictar la clasificación de sus documentos y no tener nomenclatura formal de áreas.

**Heredar suma y no reemplaza**, al contrario del catálogo de calificaciones, donde el contrato que declara una propia usa las suyas y solo las suyas porque la lista es la del contrato. Acá ampliar es el caso normal, y por eso el modo **se declara** en lugar de derivarse de que existan entradas propias.

**La siembra por copia no es un tercer modo.** Es puntual y no deja vínculo: una copia permanente *es* herencia. Copia lo que la fuente ve —el catálogo del despliegue o el de otro contrato que el usuario alcance por membresía—, solo agrega y no duplica.

**Lo que no duplica lo decide la identidad, y difiere entre los dos catálogos.** Un nodo de ubicación **es** su ruta completa; una clase es su código, y un tipo su código dentro de su clase. La clasificación se siembra entera en un acto, y **un tipo arrastra su clase** cuando el destino no la tiene — un tipo sin su clase es el huérfano que la declaración conjunta descarta.

Sembrar en un contrato que hereda no agrega nada, y es correcto: ya lo ve.

**El orden natural es declarar primero y sembrar después.** Un contrato que todavía hereda ya ve el árbol del despliegue, de modo que sembrárselo sería una operación vacía.

---

# Referencias

- `10_DOM-019_DocLocation.md`
- `../05_project/10_DOM-003_DocProject.md`
- `../15_circulation/40_DOM-018_DocQualification.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
