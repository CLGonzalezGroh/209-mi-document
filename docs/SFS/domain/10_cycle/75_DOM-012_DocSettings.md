# DOM-012 — DocSettings

**Ámbito:** Ciclo interno
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Declarar la convención documental **del despliegue**, para no tener que fijarla contrato por contrato ni al desplegar.

---

# Descripción

`DocSettings` es un **registro único**: existe uno solo por despliegue y expresa cómo se numeran las revisiones cuando nadie declara otra cosa.

Es el **último escalón de la precedencia** con que se resuelve el esquema de revisión:

1. el documento, que se lee de su última revisión no abandonada;
2. el contrato, que puede declarar el suyo;
3. **el despliegue**, que rige cuando ninguno de los anteriores aporta valor.

Existe porque la convención de numeración es una característica del cliente, no de cada contrato: fijarla una vez evita repetirla en cada alta y evita que dependa de una decisión de despliegue.

---

# Responsabilidades

`DocSettings` es responsable de:

- declarar el esquema de revisión por defecto del despliegue.

No es responsable de:

- imponerlo: el contrato puede declarar otro, y quien crea una revisión puede elegir otro en ese momento;
- revalidar lo ya creado: cambiarlo no altera ninguna revisión existente.

---

# Atributos Conceptuales

Entre los atributos propios del `DocSettings` podrán encontrarse:

- esquema de revisión por defecto;
- fecha y actor de la última modificación.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**Es un registro único.** No existen dos configuraciones de despliegue.

**Un despliegue recién instalado debe poder crear documentos.** Mientras nadie declare la configuración, rige el valor por defecto del modelo: la ausencia del registro no bloquea la operación.

---

# Relaciones Conceptuales

**Es consultado por**

- la creación de una revisión, como último escalón de la precedencia del esquema

---

# Observaciones

**No declara etiqueta configurable.** «Revisión» es terminología establecida del dominio documental y no se renombra por despliegue.

---

# Referencias

- `20_DOM-006_DocumentRevision.md`
- `80_Principios_del_Modelo.md`
- `../05_project/10_DOM-003_DocProject.md`
- `../../00_Convenciones.md`
