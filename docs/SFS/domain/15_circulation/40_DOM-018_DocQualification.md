# DOM-018 — DocQualification

**Ámbito:** Circulación
**Categoría:** Catalog
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Declarar **con qué vocabulario responde cada contraparte**, y qué significa cada valor para el sistema.

---

# Descripción

Una `DocQualification` es una entrada del juego de calificaciones que un cliente usa: *Aprobado*, *Aprobado con comentarios*, *Revisado sin objeción*, *Rechazado* — o los tres, cuatro o cinco valores que ese contrato tenga, con **sus códigos y sus rótulos**. El rótulo que el usuario ve es el del cliente, no una traducción nuestra.

Cada entrada declara tres cosas. El **código** y el **rótulo** son lo que el usuario ve; el **efecto** es lo único que el sistema interpreta.

El efecto responde dos preguntas independientes, y solo tres de sus cuatro combinaciones existen:

| Efecto | ¿Habilita usar el documento? | ¿Obliga a emitir revisión nueva? | Calificación habitual |
| ------ | ---------------------------- | -------------------------------- | --------------------- |
| `ACCEPTED` | Sí | No | Aprobado, revisado sin objeción |
| `ACCEPTED_WITH_COMMENTS` | Sí | **Sí** | Aprobado con comentarios |
| `REJECTED` | **No** | Sí | Rechazado |

La cuarta no existe: si el documento no sirve, hay que volver a emitirlo. Ese par es lo que explica sin casos especiales por qué *aprobado con comentarios* no es ni una cosa ni la otra, que es justamente lo que un mapeo binario pierde.

**Las dos preguntas se derivan del efecto y no se almacenan.** Con dos indicadores independientes, la combinación inexistente podría escribirse y habría que impedirla por validación; así no puede expresarse.

---

# Responsabilidades

`DocQualification` es responsable de:

- declarar el vocabulario con que la contraparte responde;
- traducir cada valor a un efecto que el sistema pueda interpretar;
- conservar el orden en que la lista se presenta.

No es responsable de:

- definir el desenlace del circuito, que se deriva de su efecto;
- eliminarse cuando ya fue usada.

---

# Atributos Conceptuales

Entre los atributos propios de la `DocQualification` podrán encontrarse:

- alcance: contrato, o el despliegue entero;
- código y rótulo;
- efecto;
- orden dentro de la lista;
- baja lógica.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**El código es único dentro de su alcance.** Dos contratos pueden usar el mismo código con rótulos distintos, porque son contratos distintos.

**El contrato reemplaza al despliegue; no lo hereda.** El que declara una calificación propia usa **las suyas y solo las suyas**.

**El alcance no se edita.** Mover una calificación entre el despliegue y un contrato cambiaría los valores disponibles sin que nadie lo declare: se crea en el alcance que corresponde y se da de baja la que sobra.

**La baja es lógica y no revalida lo ya calificado.** Una calificación dada de baja deja de poder elegirse; las respuestas que la usaron no se tocan.

---

# Relaciones Conceptuales

**Alcanza a**

- un contrato, o al despliegue entero cuando no declara ninguno

**Es elegida por**

- `DocTransmittalResponse`

---

# Observaciones

**Es un catálogo y no una enumeración porque el usuario elige el rótulo.** Cuando el que interpreta el efecto es el sistema y el usuario no elige nada, corresponde una enumeración: por eso el rol del archivo dentro de una versión no es catálogo, y esto sí.

**No hereda, a diferencia de otros catálogos con alcance por contrato.** La lista de calificaciones es la del **contrato**, y una mezclada —cuatro del despliegue más tres del cliente— no es la de nadie y admitiría calificar con un valor que la contraparte no usa. Donde el alcance más específico agrega opciones sin estorbar, heredar tiene sentido; acá no.

**La baja lógica no cambia el alcance.** El alcance se decide sobre el catálogo completo, de modo que dar de baja la última calificación propia no devuelve el contrato al catálogo del despliegue y no le cambia en silencio los valores disponibles.

**Sirve a los dos modos con el mismo catálogo**, y esa es la razón de modelarlo una sola vez: en modo Receptor la planta emite la calificación al cerrar el circuito, y en modo Emisor el control documental transcribe la que el cliente devolvió. Misma lista y mismos efectos.

**No incluye el acuse de recibo.** Un acuse no habilita nada y no obliga a nada — la combinación que este catálogo declara inexistente— porque no dice nada sobre el documento: dice que el envío llegó.

**El despliegue se siembra con las cuatro calificaciones habituales**, de modo que un despliegue nuevo queda operativo sin configurar nada y cada contrato declara las suyas cuando su contrato lo pide.

---

# Referencias

- `30_DOM-017_DocTransmittalResponse.md`
- `../10_cycle/75_DOM-012_DocSettings.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
