# DOM-007 — DocumentVersion

**Ámbito:** Ciclo interno
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Registrar **un archivo** dentro de una revisión, de forma inmutable y verificable.

---

# Descripción

Una `DocumentVersion` **es un archivo**. No existe sin archivo nuevo: un cambio de metadata no la produce, porque eso es una actualización del documento.

Lo que guarda no es descripción del documento sino **descripción del contenido** —nombre, tamaño, tipo y hash—, y ninguno de esos datos puede cambiar sin que cambie el archivo. Es lo que permite que una firma acredite contenido: la firma acredita una versión **porque una versión es un archivo**.

Las versiones son la **iteración interna** de la revisión. Se acumulan durante el circuito: la produce el elaborador, la marca el revisor, la marca el aprobador. Su numeración es continua dentro de la revisión y **no se reinicia** cuando un rechazo abre un circuito nuevo, porque lo que se corrige es el mismo entregable.

---

# Responsabilidades

`DocumentVersion` es responsable de:

- registrar un archivo con su descripción y su hash de contenido;
- sostener la secuencia de iteraciones internas de una revisión;
- ser el objeto que una firma acredita.

No es responsable de:

- clasificar su origen o su naturaleza: una versión no se distingue por haber sido producida al elaborar o al marcar;
- registrar la objeción de un revisor, que vive en el comentario de su paso.

---

# Atributos Conceptuales

Entre los atributos propios de la `DocumentVersion` podrán encontrarse:

- número de versión dentro de la revisión;
- referencia al archivo almacenado, con su nombre, tamaño y tipo;
- hash de contenido;
- comentario sobre el cambio;
- fecha y actor de alta.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**El hash de contenido es obligatorio en toda versión.** Es lo que la firma acredita como contenido, y una regla condicional obligaría a decidir qué ocurre con la versión que entró sin él y después resulta ser la firmada.

**La versión no se modifica ni se elimina**, y eso incluye su comentario: si quedó mal, la corrección va en la traza y no editando la evidencia.

**La produce quien tiene el paso vigente**, o quien cuente con el permiso de administración del circuito. No es una restricción de identidad sino de momento.

**Una revisión aprobada no admite versiones nuevas**, porque no tiene paso vigente. Es lo que impide que una firma quede acreditando una versión que dejó de ser la última.

**El comentario es opcional.** La observación casi siempre viaja dentro del archivo, como marcas sobre el documento; el comentario es complemento y no el registro de la objeción.

---

# Relaciones Conceptuales

**Pertenece a**

- `DocumentRevision`

**Es acreditada por**

- `DocStepSignature`, que la incorpora a su payload firmado

---

# Observaciones

**La versión vigente es la última, y coincide con la aprobada.** No son dos reglas: como el circuito cierra aprobando y después no se admiten versiones, la última versión de una revisión aprobada **es** la que se aprobó.

**Someter exige al menos una versión.** Es la precondición que reemplaza a exigir el archivo en el alta, ahora que el documento nace sin él.

**El hash lo calcula quien produce el archivo**, y el módulo no lo deriva: el servicio de almacenamiento no ve los bytes por diseño. Reforzar esa garantía haciendo que el almacenamiento lo valide es un trabajo propio, ajeno a esta especificación.

---

# Referencias

- `20_DOM-006_DocumentRevision.md`, `60_DOM-010_DocStepSignature.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
