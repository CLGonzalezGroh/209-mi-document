# DOM-017 — DocTransmittalResponse

**Ámbito:** Circulación
**Categoría:** Entity
**Estado:** Approved
**Versión:** 1.0

---

# Propósito

Registrar **qué dijo la contraparte sobre un documento emitido**, quién lo dijo y cuándo, con la evidencia que lo acompaña.

---

# Descripción

Una `DocTransmittalResponse` cuelga del **ítem por el que ese documento salió**, y no del transmittal. Es lo que permite responder documento a documento —la práctica actual, donde cada revisor califica y devuelve a medida que trata cada uno— sin que la carpeta entera tenga que esperar.

Su único dato obligatorio es la **calificación**. El archivo es opcional: un rechazo trae el plano marcado, un sello de aprobado no trae nada. Lo que no existe es una respuesta sin calificación y sin archivo, porque no registraría ningún hecho.

**El archivo que devuelve la contraparte no es una versión**, y la regla que lo decide vale para los dos modos con un solo enunciado:

> Un archivo producido **dentro** del circuito, por quien tiene el paso vigente, es una versión. Un archivo que llega de **afuera** del circuito es evidencia de una respuesta.

En modo Emisor el cliente no tiene paso ni firma nuestra, de modo que lo que vuelve es evidencia. En modo Receptor la misma regla da el resultado contrario, y las marcas de la planta sí son versiones: ahí el revisor está adentro.

**Distingue quién respondió de quién registró.** El cliente que contesta por correo o por un repositorio compartido no es usuario del sistema y no tiene con qué representarse, así que va como texto; quien la transcribe —habitualmente el control documental— sí es usuario. La divergencia entre ambos **se deriva de que los dos existan** y no se almacena como indicador.

---

# Responsabilidades

`DocTransmittalResponse` es responsable de:

- conservar la calificación con que la contraparte respondió;
- conservar los archivos devueltos, cuando los hay;
- distinguir el autor de la respuesta de quien la registró, y la fecha real de la de registro;
- declarar el remito en que viajó, cuando llegó consolidada.

No es responsable de:

- alterar el estado de la revisión que califica;
- ser inmutable: nadie la firma, y se corrige.

---

# Atributos Conceptuales

Entre los atributos propios de la `DocTransmittalResponse` podrán encontrarse:

- ítem que responde;
- calificación elegida;
- comentarios;
- quién respondió, como texto, y quién la registró;
- fecha real de la respuesta y fecha de registro;
- transmittal de respuesta que la transportó, cuando lo hubo;
- archivos devueltos, cada uno con su nombre, referencia, tamaño y tipo.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**Un documento se responde una sola vez.** La contraparte califica una emisión una vez; corregir esa respuesta es editarla, no abrir otra.

**Solo se responde lo que salió.** Un transmittal en borrador es la carpeta que se está armando y todavía no llegó a nadie. Uno cerrado sí admite respuesta tardía.

**La calificación debe pertenecer al catálogo vigente del contrato.** Una lista mezclada admitiría calificar con un valor que la contraparte no usa.

**El sobre declarado, cuando existe, debe contestar la emisión por la que ese documento salió.** Sin esa condición un remito podría transportar la calificación de documentos que nunca contestó.

**La respuesta no cambia el estado de la revisión.** La revisión emitida permanece aprobada, y que esté cerrada se lee de que tiene respuesta.

**La corrección conserva el valor anterior en la traza.** Sin él registraría que algo cambió sin decir desde qué.

---

# Relaciones Conceptuales

**Responde a**

- `TransmittalItem`, uno a uno

**Elige**

- `DocQualification` del catálogo vigente del contrato

**Viajó en**

- `Transmittal` de naturaleza respuesta, opcionalmente

**Conserva**

- los archivos devueltos por la contraparte

---

# Observaciones

**Las dos formas de responder usan el mismo objeto.** Si la respuesta llegó consolidada en un remito, lo declara; si llegó documento a documento, ese dato va vacío. La respuesta es siempre del documento, y el transmittal de respuesta es apenas el sobre en que viajó.

**Se corrige porque nadie la firma.** El cliente no participa de nuestro circuito, de modo que la inmutabilidad que rige para la versión y la firma no le aplica; y siendo transcripta a mano en el caso habitual, el error de transcripción es esperable. Lo que la corrección no puede hacer es borrar que existió.

**Los archivos devueltos no son entregable, ni fuente, ni respaldo.** No integran la entrega: son lo que la contraparte dijo sobre la entrega, y por eso cuelgan de la respuesta y no de la versión. Su hash de contenido es opcional, porque ninguna firma depende de él.

**El archivo marcado no se copia a la revisión siguiente.** Queda enganchado al ítem y visible desde el documento; quien elabore la revisión siguiente trabaja con él a la vista, y si decide incorporarlo lo hace explícitamente.

**En modo Receptor la calificación la produce el circuito** en lugar de transcribirla el control documental, pero queda en el mismo lugar. Ese es el punto: es el único lugar donde los dos modos la leen igual, y es lo que permite que quien emitió pueda consultarla.

---

# Referencias

- `20_DOM-016_TransmittalItem.md`, `40_DOM-018_DocQualification.md`
- `../10_cycle/30_DOM-007_DocumentVersion.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
