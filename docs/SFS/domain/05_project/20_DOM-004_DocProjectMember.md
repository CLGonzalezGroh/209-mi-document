# DOM-004 — DocProjectMember

**Ámbito:** Contexto de proyecto
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Habilitar el acceso de un usuario a un proyecto documental, y declarar de qué lado de la relación está.

---

# Descripción

Un `DocProjectMember` vincula un usuario con un proyecto. Su función es **de alcance**: determina qué proyectos alcanza ese usuario.

Existe porque el módulo admite usuarios ajenos a la organización que hospeda el sistema, y la relación con ellos es siempre por proyecto. La contraparte de un proyecto no es la misma que la de otro, de modo que el alcance no puede resolverse globalmente.

La membresía declara además el **lado**: anfitrión o contraparte. La estructura es binaria, y el rótulo visible lo aporta el rol declarado por el proyecto —Ingeniería y Cliente, o Planta y Contratista—. En un proyecto sin contraparte todos los miembros son del lado anfitrión, incluidas las personas ajenas a la organización que participen del desarrollo: que exista un tercero involucrado no lo convierte en contraparte.

La baja es lógica: la membresía conserva su historia de alta, baja y actor.

Es una lista **distinta** de la membresía que pueda llevar el módulo de proyectos, que registra personal propio asignado y no contempla externos. Son dos poblaciones y dos finalidades; no se derivan ni se sincronizan entre sí.

---

# Responsabilidades

`DocProjectMember` es responsable de:

- habilitar el acceso de un usuario a un proyecto;
- declarar de qué lado del proyecto está ese usuario;
- conservar la trazabilidad de alta, baja y actores.

No es responsable de:

- definir qué puede hacer el usuario sobre lo que alcanza. Eso lo resuelven el permiso global, provisto por el servicio de administración, y la asignación del circuito de revisión;
- otorgar ni denegar permisos;
- distinguir participación de solo lectura.

---

# Atributos Conceptuales

Entre los atributos propios del `DocProjectMember` podrán encontrarse:

- proyecto al que da acceso, por referencia externa;
- usuario habilitado, por referencia al servicio de administración;
- lado del proyecto;
- fecha y actor del alta;
- vigencia, y fecha y actor de la baja.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**La membresía es única por par usuario–proyecto.** Un alta repetida es una reincorporación, no un registro nuevo.

**Una membresía habilita solo mientras está vigente.** Una membresía dada de baja, o inactiva, no otorga alcance alguno.

**La membresía no define rol ni permisos.** Incorporarlos duplicaría definiciones que ya existen en otras dos capas y obligaría a resolver cuál prevalece ante una contradicción.

---

# Relaciones Conceptuales

**Habilita el acceso a**

- el proyecto, por referencia externa

**Toma su rótulo de**

- `DocProjectSettings`, según el rol declarado por el proyecto

---

# Observaciones

Administrar la membresía es un acto **administrativo**: se gobierna por el permiso global y no exige membresía previa en el proyecto. Aplicarle la restricción que ella misma define sería circular, porque el primer miembro de un proyecto no puede exigir una membresía que todavía no existe.

Como consecuencia, quien tenga el permiso de listar membresías las ve en **todos** los proyectos. Ese permiso corresponde a la administración documental y no debe otorgarse a un rol de contraparte.

---

# Referencias

- `10_DOM-003_DocProjectSettings.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
