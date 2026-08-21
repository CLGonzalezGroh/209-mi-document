# DOM-019 — DocLocation

**Ámbito:** Clasificación
**Categoría:** Catalog (jerárquico, con alcance por contrato)
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Describir **dónde está físicamente lo que el documento documenta**: el sitio, la planta, el área o la unidad de proceso.

---

# Descripción

Una `DocLocation` es un nodo de un árbol **auto-referencial y de profundidad libre**. Se carga como lista plana de un nivel o como árbol de varios —sitio ▸ planta ▸ área ▸ unidad—, según cómo cada organización describa su instalación. **El sitio no es una entidad aparte**: es el nivel superior del mismo árbol, y modelarlo por separado duplicaría la estructura sin agregar capacidad.

Cada nodo conserva su **ruta completa**, la concatenación de los nombres de sus ascendientes y el propio.

**Es un catálogo de clasificación y no un registro de activos**, y esa distinción es lo que resuelve a quién pertenece el árbol:

| | Registro de activos | Catálogo de clasificación |
| --- | --- | --- |
| Qué afirma | Este equipo existe y es nuestro | Así nombra el cliente sus sectores |
| Ciclo de vida | Alta, modificación, decomisionamiento | Baja lógica del rótulo |
| Dueño | El módulo de activos | El módulo que clasifica |

La planta que tiene los dos mantiene un árbol en cada uno, y **esa divergencia no es un defecto**, porque no dicen lo mismo. La divergencia entre dos registros de activos sí lo sería, y no ocurre: registro de activos hay uno.

---

# Responsabilidades

`DocLocation` es responsable de:

- definir un valor admitido de ubicación física para la clasificación documental;
- mantener su posición en la jerarquía y su ruta consistente con su ascendencia;
- declarar a qué ámbito pertenece —el árbol del despliegue o el de un contrato—;
- conservar, cuando corresponde, la referencia al objeto de otro sistema que describe.

No es responsable de:

- determinar si el atributo participa de la clasificación ni su obligatoriedad, que declara `DocProject`;
- resolver qué nodos ve un contrato, que es de `DocCatalogScope`;
- representar el activo en sí, que pertenece a otro módulo.

---

# Atributos Conceptuales

Entre los atributos propios podrán encontrarse: nodo padre, alcance, código, nombre, ruta completa, orden de presentación, origen e identificador de una referencia externa, condición de registro reservado del sistema y fecha de baja lógica.

---

# Ciclo de Vida

**Vigente ⇄ dado de baja.** La baja lógica **no alcanza a la descendencia**: un nodo dado de baja con hijos vigentes es un estado legítimo —el área sigue existiendo, la unidad intermedia dejó de usarse— y cerrar la rama de oficio decidiría por el usuario algo que nadie pidió.

**La eliminación definitiva exige no tener descendencia ni documentos clasificados.** La clave es `RESTRICT` y no `SET NULL` ni `CASCADE`: la base no debe resolver el pedido borrando en silencio una rama entera ni vaciando la clasificación de los documentos que la usaban.

Un nodo dado de baja **no se elige**, y los documentos que ya lo tenían **lo conservan**: la validación ocurre solo en escritura y nunca revalida lo existente.

---

# Relaciones Conceptuales

**Pertenece a / Contiene**

- cero o un nodo padre y cero o más nodos hijos

**Alcanza a**

- un contrato, o al despliegue entero cuando no declara ninguno

**Es referenciada por**

- cero o más `Document`

---

# Observaciones

**El cruce de alcances se admite en un solo sentido.** Un nodo de contrato cuelga de uno del despliegue —eso *es* ampliar, y es cómo una planta agrega una unidad dentro de un área que ya existe—; al revés no, porque volvería el árbol global dependiente de un contrato: quien mirara el catálogo del despliegue vería una rama ajena, y borrar el contrato dejaría huérfano un nodo global. Y un contrato no cuelga del árbol de otro, que no ve.

**La ruta completa es denormalización de conveniencia y no evidencia.** Existe para evitar el recorrido recursivo en cada listado, y ordenar por ella agrupa cada rama con su descendencia. Como la ubicación del documento se edita siempre y no integra el payload de la firma, **renombrar o mover un nodo recalcula las rutas de su descendencia de forma automática**, sin propagación explícita ni auditada. Es donde este catálogo se aparta del precedente de digitalización, donde el snapshot forma parte de una publicación.

**El recálculo alcanza a las ampliaciones ajenas.** Renombrar un nodo del despliegue cambia la ruta de los nodos que los contratos le colgaron, y de los documentos clasificados con ellos. Lo mismo la cuenta de descendencia que protege el borrado: un nodo global con ampliaciones tiene descendencia, aunque quien lo mira no la vea desde su propio catálogo.

**Mover es un acto propio y no una edición más**, y verifica que el nodo no quede colgado de su propia descendencia: esa rama quedaría desconectada de toda raíz y ningún recálculo la alcanzaría.

**La unicidad del código es por nivel y por alcance.** Dos plantas pueden tener su área *100*, y dos contratos su propio nodo con el mismo código. Los nodos raíz del despliegue —que en un catálogo plano son todos— exigen `NULLS NOT DISTINCT` para que la restricción sea efectiva.

**La referencia externa se declara completa o no se declara.** Origen e identificador viajan juntos: un origen sin identificador no dice nada. Es el puente con el registro de activos cuando ese módulo exista, y con un sistema documental externo.

**No reutiliza `Area`**, que es plana, obligatoriamente atada a un contrato y pertenece al subsistema de `ScannedFile`.

---

# Referencias

- `20_DOM-020_DocCatalogScope.md`
- `../10_cycle/10_DOM-005_Document.md`
- `../05_project/10_DOM-003_DocProject.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
