# DOM-003 — DocProject

**Ámbito:** Contexto de proyecto
**Categoría:** Aggregate Root
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Ser la **raíz de alcance** del módulo documental: la unidad a la que pertenece toda la documentación en circulación, y que declara el rol documental y la contraparte de esa relación.

---

# Descripción

Un `DocProject` es **un contrato**: la relación con una contraparte dentro de la cual se produce, se revisa y se emite documentación. La palabra no es una metáfora — es lo que la práctica relevada describe: la ingeniería civil constituye un contrato; la mecánica y de piping, otro; la construcción, otro más.

El módulo **es dueño de esta entidad**. No la referencia en otro subgraph ni la federa: la crea, la nombra y la administra. Eso es lo que permite que la gestión documental se ofrezca sin el módulo de proyectos, y lo que vuelve estructural —y no una convención entre servicios— el invariante de que toda documentación en circulación pertenece a un contrato.

Se reconocen tres roles, y el rol es un atributo **del contrato, no del despliegue**: una misma organización puede tener contratos en roles distintos, porque el rol expresa la relación de ese contrato y no la naturaleza de quien hospeda el sistema.

| Rol | Significado | Contraparte |
| --- | ----------- | ----------- |
| Emisor | El sistema lo usa quien produce la documentación | Cliente |
| Receptor | El sistema lo hospeda quien la recibe | Contratista |
| Interno | El contrato se desarrolla sin contraparte externa | Ninguna |

El rol Interno no es un modo propio de una industria: expresa la **ausencia de contraparte**, y cualquier organización puede tener contratos así para su desarrollo propio.

## El contrato y la obra no son lo mismo

Un contrato **puede** estar asociado a una gestión de proyecto en el módulo de proyectos, y varios contratos pueden compartir esa misma obra: una planta que contrata la ingeniería civil, la mecánica y la construcción a tres proveedores tiene **una obra y tres contratos**.

Que un contrato no tenga obra asociada **no es una ausencia de dato**: significa que esa obra no se administra con el módulo de proyectos —porque no se lo usa, o porque no se la sigue por cronograma—. El contrato opera igual, entero y sin diferencia alguna en su ciclo.

---

# Responsabilidades

`DocProject` es responsable de:

- ser la unidad de agrupación y de alcance de la documentación en circulación;
- llevar su propia identidad: un código que lo nombra y no cambia;
- declarar el rol documental y la contraparte cuando el rol la tiene;
- declarar si admite operaciones o si está cerrado;
- ser el lugar único donde reside la configuración documental del contrato.

No es responsable de:

- habilitar el acceso de usuarios, que corresponde a `DocProjectMember`;
- definir permisos, que provienen del servicio de administración global;
- administrar la obra en el módulo de proyectos, con la que solo mantiene un vínculo opcional;
- resolver qué entradas de catálogo alcanza, que declara `DocCatalogScope`.

---

# Atributos Conceptuales

Entre los atributos propios del `DocProject` podrán encontrarse:

- **código** que lo identifica dentro del módulo, y **nombre**;
- descripción;
- **estado**: en curso o cerrado, con la fecha y el actor del cierre;
- **gestión de proyecto asociada**, por referencia externa y opcional;
- **rol documental** declarado;
- **contraparte**, por referencia a la empresa, ausente cuando el rol no la tiene;
- esquema con que propone el código de la primera revisión de sus documentos;
- armador por defecto de sus documentos;
- configuración del atributo de ubicación física: si está habilitado, si es obligatorio y con qué etiqueta se lo nombra;
- fechas y actores de alta y modificación.

**La contraparte es la empresa, no la razón social.** Se contrata con la empresa; a cuál se le factura es un dato de facturación que este módulo no necesita, y por eso la referencia apunta al registro transversal de identidad y no a ninguna entidad de facturación.

**La ubicación nace habilitada y no obligatoria, en los tres roles.** Un contrato atraviesa el ciclo completo sin declarar ninguna, y la planta la usa para filtrar y no para exigir. **Deshabilitada no exige**, aunque quede marcada como obligatoria.

La etiqueta **sí** es configurable —*área*, *unidad*, *sector*—, a diferencia del esquema de revisión: cada organización la nombra distinto, mientras que *revisión* es terminología establecida del dominio documental.

**Acá viven los valores, no los conjuntos.** Qué entradas de catálogo resuelve el contrato lo declara `DocCatalogScope`, porque un catálogo se hereda y un valor se reemplaza.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**El código identifica al contrato y no cambia.** Es el mismo criterio con que el código identifica a un documento: lo que nombra una cosa no se edita, porque quien la conoce por ese nombre dejaría de encontrarla.

**La contraparte se exige o se prohíbe según el rol.** Los roles Emisor y Receptor deben declararla; el rol Interno no puede declararla, porque por definición no la tiene.

**Un contrato admite una sola contraparte.** Es la unidad de la relación: cuando la contraparte es otra, el contrato es otro. Que una misma obra admita varios contratos no debilita esta regla — la refuerza, porque es lo que evita representar dentro de un contrato una situación que la operación considera inválida.

**El rol es inmutable desde que el contrato tiene documentos o transmittals.** Mientras esté vacío el rol se modifica libremente. Una vez que hay documentación en circulación, cambiarlo dejaría objetos cuyo ciclo ya no corresponde al modo declarado.

**Un contrato cerrado solo admite lectura.** Ninguna escritura sobre los objetos que le pertenecen prospera mientras esté cerrado.

**Un contrato con documentación no se elimina.** Se cierra. La eliminación queda reservada al contrato que nunca tuvo nada.

---

# Ciclo de Vida

Un contrato nace **en curso** y admite todas las operaciones del ciclo documental.

**Cerrarlo es una puerta sobre la escritura, y no una máquina de estados.** No exige que los circuitos estén terminados y **no se propaga hacia abajo**: una revisión en circuito al momento del cierre queda donde está y deja de poder avanzar. Abandonarla o cancelar su circuito como efecto del cierre sería inventar desenlaces que nadie decidió, y cada nivel tiene su propia palabra para terminar mal.

**El cierre admite reapertura**, con actor y fecha registrados. Sin ella, un cierre por error dejaría la documentación de un contrato congelada sin ninguna salida.

**El cierre no promueve nada.** Llevar documentación de un contrato a un régimen de publicación es selectivo por naturaleza y no puede ser un efecto automático de cerrar.

---

# Relaciones Conceptuales

**Agrupa a**

- `Document`, `Transmittal`, `DocProjectMember`
- las entradas de catálogo con alcance propio: `DocumentClass`, `DocumentType`, `DocLocation`, `DocQualification`
- `DocCatalogScope` y `DocWorkflowTemplate`

**Se vincula opcionalmente con**

- la gestión de proyecto del módulo de proyectos, por referencia externa. Varios contratos pueden compartir la misma

**Declara como contraparte a**

- la empresa, por referencia al registro transversal de identidad

**Determina el rótulo de**

- `DocProjectMember`, cuyo lado se lee según el rol declarado

---

# Observaciones

Dar de alta un contrato y administrar sus miembros son actos **administrativos**: se gobiernan por el permiso global y no exigen membresía. Exigirla sería circular, porque un contrato recién creado todavía no tiene miembros.

**Sustituye a `DocProjectSettings`**, que era la configuración documental de un proyecto sin identidad propia. Aquella entidad describía correctamente lo que podía describirse mientras el proyecto viviera en otro módulo: el rol documental no es una preferencia de configuración, es lo que el contrato **es**.

---

# Referencias

- `20_DOM-004_DocProjectMember.md`
- `80_Principios_del_Modelo.md`
- `../20_classification/20_DOM-020_DocCatalogScope.md`
- `../../00_Convenciones.md`
