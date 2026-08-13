# DOM-010 — DocStepSignature

**Ámbito:** Ciclo interno
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Acreditar **quién resolvió un paso y qué resolvió**, de forma verificable a posteriori.

---

# Descripción

Una `DocStepSignature` es la evidencia de una resolución. Existe como objeto propio y no como atributo del paso porque **la firma es inmutable y el paso se sigue actualizando**: separarlos permite declararla inmutable sin excepciones.

Lo que la vuelve verificable es que **persiste el payload canónico** que se usó para calcularla, además del hash y el algoritmo. Un hash sin sus insumos no es verificable: verificar es recalcular sobre lo guardado, y no reconstruir el payload desde entidades que pudieron cambiar después.

Lo firmado incluye:

- el paso, su circuito y su revisión;
- la **versión vigente al firmar**, con su número, su referencia de archivo y su hash de contenido;
- la **identificación del documento** vigente al firmar;
- el usuario asignado y el que resolvió, con el motivo cuando difieren;
- la acción y el momento.

Con eso la firma acredita **la identificación además del contenido**: no solo qué bytes se aprobaron, sino con qué código y título se los aprobó.

---

# Responsabilidades

`DocStepSignature` es responsable de:

- conservar los insumos exactos sobre los que se calculó;
- permitir verificar, en cualquier momento posterior, que la evidencia no fue alterada.

No es responsable de:

- mantenerse consistente con el estado actual de las entidades que menciona: precisamente porque estas pueden cambiar, la firma guarda lo que firmó;
- afirmar nada sobre versiones posteriores a la suya.

---

# Atributos Conceptuales

Entre los atributos propios de la `DocStepSignature` podrán encontrarse:

- paso que acredita;
- payload canónico serializado;
- algoritmo y hash;
- fecha y actor de la firma.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**Un paso admite una sola firma**, porque se resuelve una sola vez.

**La firma es inmutable.** No se modifica ni se elimina.

**Firman los pasos que actúan sobre una versión**: elaboración, revisión, aprobación y toma de conocimiento. El armado no firma.

**El rechazo firma igual que la aprobación.** De hecho su evidencia importa más, porque documenta qué se objetó.

**Ninguna firma afirma nada sobre las versiones posteriores.** Cada una acredita aquella sobre la que actuó su autor, de modo que una versión nueva no invalida las firmas anteriores.

---

# Relaciones Conceptuales

**Acredita a**

- `ReviewStep`, uno a uno

**Incorpora, congelados en su payload**

- `DocumentVersion` vigente al firmar
- la identificación de `Document` vigente al firmar

---

# Observaciones

**Cuando el cambio es sustantivo, lo que corresponde no es invalidar firmas sino retirar la revisión del circuito.** La regla queda del lado del operador, que es quien sabe si lo que cambió invalida lo revisado.

**Las firmas sobreviven a la cancelación y al abandono.** Es precisamente lo que permite admitir ambos actos en cualquier punto: nada se elimina, de modo que la historia queda legible.

Los cuatro pasos que firman son las casillas del rótulo más el acuse: **quien elabora firma lo que entrega, quien revisa firma lo que revisó, quien aprueba firma lo que aprobó, y quien toma conocimiento firma lo que vio.**

---

# Referencias

- `50_DOM-009_ReviewStep.md`, `30_DOM-007_DocumentVersion.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
