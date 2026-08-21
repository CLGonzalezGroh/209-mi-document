# DOM-021 — DocumentClass

**Ámbito:** Clasificación
**Categoría:** Catalog
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Declarar la **familia** a la que pertenece un documento. En contratos de ingeniería la clase **es** la disciplina —civil, eléctrica, mecánica, piping—, y es el eje con que la organización agrupa lo que produce.

---

# Descripción

Una `DocumentClass` es una entrada de catálogo con nombre, código y orden de presentación, alcanzada por **dos ejes independientes**:

| Eje | Qué declara | Nulo significa |
| --- | ----------- | -------------- |
| Módulo | Qué módulo la usa | Compartida entre todos los módulos que heredan |
| Contrato | Qué contrato la agregó | Del catálogo del despliegue, del que los contratos heredan |

Los dos conviven en lugar de excluirse. El contrato solo tiene sentido como alcance **dentro del módulo que lo tiene**: una entrada con contrato exige el módulo de proyectos, y la base lo sostiene.

**El catálogo del despliegue es el estándar de la propia organización.** El de un contrato es el de su cliente, y por eso el segundo contrato para el mismo cliente se siembra del primero.

---

# Responsabilidades

`DocumentClass` es responsable de:

- declarar una familia documental disponible, con su código y su rótulo;
- declarar en qué ámbito está disponible;
- conservar su vigencia.

No es responsable de:

- decidir qué documentos la usan, que es de la revisión que se clasifica con ella;
- el modo con que un contrato resuelve el catálogo, que es de `DocCatalogScope`.

---

# Atributos Conceptuales

Nombre, código, descripción y orden de presentación, más los dos ejes de alcance. Con la autoría del alta y de la última modificación, y la marca de vigencia.

**Nombre y código son únicos dentro de su ámbito**, entendiendo por ámbito la combinación de módulo y contrato. Dos clientes pueden nombrar igual su propia clase, y un contrato puede agregar un código que el despliegue ya usa: son entradas distintas porque viven en ámbitos distintos.

La unicidad trata los nulos como **iguales entre sí**. Sin eso, la restricción no impediría duplicados en el caso más frecuente —el catálogo del despliegue, donde los dos ejes son nulos—.

---

# Ciclo de Vida

**Se da de alta en un ámbito y no cambia de ámbito.** Corregir dónde vive una entrada es darla de baja y crear la que corresponde: mover una clase entre ámbitos reclasificaría en silencio todo lo que la usa.

**La baja es lógica.** Lo ya clasificado con ella la conserva —la validación ocurre solo en escritura y nunca revalida lo existente— pero **una entrada dada de baja no se elige**: no aparece en el selector, y clasificar con ella se rechaza. Es lo que distingue *no se elige* de *deja de valer*.

**La eliminación definitiva no procede si algo la referencia.** Una revisión clasificada con ella acredita esa clase en su firma, de modo que borrarla dejaría a la firma sin objeto verificable.

---

# Relaciones Conceptuales

**Es referida por**

- la revisión, que declara con qué clase se identifica el documento
- el documento, como copia de su revisión en curso
- el tipo de documento, que puede colgar de ella
- la plantilla del circuito, que puede alcanzarse por clase

---

# Observaciones

**Clase y tipo son un solo sistema de clasificación**, y por eso declaran su alcance juntos. No son dos catálogos que coinciden en pantalla: el tipo cuelga de la clase, de modo que un contrato con clasificación propia que heredara tipos los tendría apuntando a clases que no ve.

**La clase es identidad y no descripción.** Integra el payload de la firma junto con el código, el título y el tipo, porque a menudo el propio código del documento se compone de la clase y el tipo, y porque está impresa en el rótulo del plano. Con una revisión aprobada, la clasificación queda congelada con el resto de la identificación.

**El eje de módulo tiene un significado que va a precisarse.** Hoy *sin módulo* significa disponible para todos, sin condición. Cuando un módulo pueda declarar catálogo propio, pasará a significar disponible para los módulos que heredan — la misma generalización que el contrato ya recibió, un escalón más arriba.

---

# Referencias

- `40_DOM-022_DocumentType.md`
- `20_DOM-020_DocCatalogScope.md`
- `../10_cycle/20_DOM-006_DocumentRevision.md`
- `../10_cycle/60_DOM-010_DocStepSignature.md`
- `80_Principios_del_Modelo.md`
