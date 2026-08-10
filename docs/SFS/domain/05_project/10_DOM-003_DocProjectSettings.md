# DOM-003 — DocProjectSettings

**Ámbito:** Contexto de proyecto
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Declarar el **rol documental** que un proyecto cumple dentro del sistema, y la contraparte con la que ese proyecto se relaciona.

---

# Descripción

Un `DocProjectSettings` es la configuración documental de un proyecto: existe **uno por proyecto** y es donde el proyecto declara de qué lado de la relación documental está.

El rol es un atributo **del proyecto, no del despliegue**: una misma organización puede tener proyectos en roles distintos, porque el rol expresa la relación de ese proyecto y no la naturaleza de quien hospeda el sistema.

Se reconocen tres roles:

| Rol | Significado | Contraparte |
| --- | ----------- | ----------- |
| Emisor | El sistema lo usa quien produce la documentación | Cliente |
| Receptor | El sistema lo hospeda quien la recibe | Contratista |
| Interno | El proyecto se desarrolla sin contraparte externa | Ninguna |

El rol Interno no es un modo propio de una industria: expresa la **ausencia de contraparte**, y cualquier organización puede tener proyectos así para su desarrollo propio.

El proyecto se identifica por referencia externa: la entidad Proyecto pertenece a otro subgraph y este módulo no la posee.

---

# Responsabilidades

`DocProjectSettings` es responsable de:

- declarar el rol documental del proyecto;
- declarar el nombre de la contraparte cuando el rol la tiene;
- ser el lugar único donde reside la configuración documental de un proyecto.

No es responsable de:

- habilitar el acceso de usuarios al proyecto, que corresponde a `DocProjectMember`;
- definir permisos, que provienen del servicio de administración global;
- poseer ni administrar la entidad Proyecto, que pertenece a otro subgraph.

---

# Atributos Conceptuales

Entre los atributos propios del `DocProjectSettings` podrán encontrarse:

- proyecto al que corresponde, único;
- rol documental declarado;
- nombre de la contraparte, ausente cuando el rol no la tiene;
- fechas y actores de alta y modificación.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**La contraparte se exige o se prohíbe según el rol.** Los roles Emisor y Receptor deben declararla; el rol Interno no puede declararla, porque por definición no la tiene. Un nombre en blanco no constituye una declaración.

**Un proyecto admite una sola contraparte.** Cada proyecto es una relación contractual con una organización. Cuando cambia la contraparte, se trata de otro proyecto.

**El rol es inmutable desde que el proyecto tiene documentos o transmittals.** Mientras el proyecto esté vacío el rol se modifica libremente. Una vez que hay documentación en circulación, cambiarlo dejaría objetos cuyo ciclo ya no corresponde al modo declarado.

---

# Relaciones Conceptuales

**Configura a**

- el proyecto, por referencia externa

**Determina el rótulo de**

- `DocProjectMember`, cuyo lado se lee según el rol declarado

---

# Observaciones

Declarar la configuración documental es un acto **administrativo**: se gobierna por el permiso global y no exige membresía en el proyecto. Exigirla sería circular, porque un proyecto que todavía no declaró su configuración tampoco tiene miembros.

El rol gobierna el orden entre el circuito de revisión y la emisión, y el significado del estado terminal de una revisión. Ese comportamiento **no forma parte todavía de esta especificación**: se incorporará cuando se promuevan los bloques del ciclo interno y de la circulación.

---

# Referencias

- `20_DOM-004_DocProjectMember.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
