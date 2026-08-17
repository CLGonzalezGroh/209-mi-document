# DOM-006 — DocumentRevision

**Ámbito:** Ciclo interno
**Categoría:** Entity
**Estado:** Approved
**Versión:** 2.0

---

# Propósito

Representar **una emisión del documento**: la unidad que el mundo exterior reconoce y numera.

---

# Descripción

Una `DocumentRevision` es lo que se somete, se aprueba y eventualmente se emite. Es la **unidad externa** del ciclo: lo que ocurre dentro de ella —cuántas versiones se produjeron, cuántas veces se rechazó— es historia interna que no consume numeración.

**Lleva su propia identificación**: el título, la clase y el tipo con que se emitió. Viven acá y no en el documento porque están impresos en el rótulo del archivo, y lo impreso pertenece a la emisión que lo produjo. Se copian de la revisión anterior al crearla, y quedan congelados al aprobarla.

La revisión **nace con su circuito**, con el armado pendiente y el armador ya designado. Puede nacer sin archivo, o con el archivo de un documento preexistente adjunto en el alta.

Su ciclo de vida:

```mermaid
stateDiagram-v2
    [*] --> DRAFT: se crea con su circuito en armado
    DRAFT --> IN_REVIEW: se somete
    IN_REVIEW --> DRAFT: rechazo, o cancelación del circuito
    IN_REVIEW --> APPROVED: el circuito cierra favorablemente
    APPROVED --> SUPERSEDED: se aprueba una revisión posterior
    DRAFT --> ABANDONED: se abandona
    IN_REVIEW --> ABANDONED: se abandona
    IN_REVIEW --> REJECTED: la contraparte la rechaza, en modo Receptor
```

El último es el único desenlace que no pertenece al ciclo interno: ocurre donde el circuito **es** el mecanismo con que la contraparte produce su respuesta, y por eso concluye la revisión en lugar de devolverla al elaborador. Ver `../15_circulation/80_Principios_del_Modelo.md`.

Está en borrador mientras el trabajo se arma o se elabora, y en revisión desde que se somete. **No hay un estado por cada paso**: dónde está el trabajo lo dice el paso vigente del circuito.

---

# Responsabilidades

`DocumentRevision` es responsable de:

- ser la unidad de emisión y de numeración externa;
- designar al armador de su circuito;
- agrupar sus versiones y sus circuitos sucesivos;
- registrar su abandono con motivo, cuando ocurre.

No es responsable de:

- describir el avance interno del trabajo, que expresa el paso vigente;
- guardar el esquema con que se numeró, que es una decisión del momento de crearla.

---

# Atributos Conceptuales

Entre los atributos propios de la `DocumentRevision` podrán encontrarse:

- código de revisión;
- estado;
- **identificación con que se emite**: título, clase y tipo;
- armador designado;
- fecha y actor de aprobación;
- fecha, actor y motivo del abandono;
- fechas y actores de alta y modificación.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**El armador es obligatorio.** Es el único actor que debe conocerse en el alta: todo lo demás lo trae la plantilla o lo decide el armado. Cuando no se informa, lo aporta la configuración del proyecto.

**Un documento tiene a lo sumo una revisión en curso.** Abrir otra exige completar o abandonar la anterior.

**El código es único entre las revisiones no abandonadas del documento.** Las abandonadas **no consumen código**, y un documento puede tener varias con el mismo, distinguidas por su fecha y su motivo.

La rechazada por la contraparte **sí lo consume**: salió, y la contraparte la recibió con él. La secuencia sigue de largo en los tres desenlaces —aprobada, aprobada con comentarios o rechazada— de modo que rechazada la `A`, la siguiente es la `B`.

**Toda revisión viva tiene exactamente un circuito abierto.**

**A lo sumo una copia de trabajo abierta.** Es el mismo invariante que el documento aplica a su revisión en curso y la revisión a su circuito, en un tercer nivel.

**La identificación se edita mientras la revisión está en curso, y no después.** No hace falta una precondición que lo diga: una revisión aprobada no se modifica.

**A lo sumo hay una revisión aprobada por documento**, porque aprobar supersede a las anteriores.

**Solo se abandona una revisión no aprobada.** Aprobada, es el documento vigente y lo que corresponde es abrir la siguiente. Como la emisión exige aprobación, **una revisión abandonada nunca fue emitida**.

---

# Relaciones Conceptuales

**Pertenece a**

- `Document`

**Agrupa a**

- `DocumentVersion`, en secuencia continua propia de la revisión
- `ReviewWorkflow`, como circuitos sucesivos ordenados por creación

**Designa a**

- el armador, por referencia externa al usuario

---

# Observaciones

**El código lo propone el sistema.** Bajo los esquemas calculados se deriva de la última revisión no abandonada, infiriendo el esquema de la forma de su código, y el valor informado se rechaza; bajo texto libre lo ingresa el usuario y solo se valida que no se repita.

**Las revisiones se ordenan por creación y nunca por código.** Con el cambio de esquema la secuencia puede quedar `A, B, C, 0, 1`.

**Registrar una versión no cambia su estado**: durante el circuito permanece en revisión. Solo el rechazo y la cancelación la devuelven a borrador.

**Resolver un paso exige no tener copia de trabajo abierta**, y someter también. Declarar que se terminó mientras una iteración sigue abierta es una contradicción, y evita que la revisión llegue a aprobarse con trabajo colgando.

**No hace falta restituir la revisión anterior al abandonar una.** La supersesión ocurre al aprobarse la sucesora, y una abandonada nunca se aprueba: la anterior nunca dejó de estar vigente.

**La palabra del nivel es «abandonada».** El circuito se cancela, la revisión se abandona y el documento queda obsoleto: cada término pertenece a un solo nivel y no se usa en ningún otro. Retirar un armado, desistir de una emisión y dar por concluida una identidad son hechos que no se confunden en el trabajo real, y no deben confundirse en el nombre.

**El estado `OBSOLETE` se retiró.** Estaba declarado sin uso, reservado a los estados terminales por respuesta de la contraparte. No hace falta: lo que la contraparte responde es una calificación y no un estado de la revisión, y dejarlo disponible invitaba a que lo ocupara — dos máquinas de estados describiendo lo mismo.

**`REJECTED` no es aquel estado con otro nombre.** No expresa la respuesta de la contraparte, que vive en la respuesta del ítem y no mueve a la revisión emitida. Expresa la conclusión del **circuito** allí donde el circuito es interno a quien recibe: en modo Receptor el elaborador está afuera y el rechazo no tiene a quién devolverle el trabajo, de modo que la revisión concluye. Sin ese estado quedaría en borrador de forma permanente, bloqueando la emisión siguiente.

---

# Referencias

- `10_DOM-005_Document.md`, `30_DOM-007_DocumentVersion.md`, `40_DOM-008_ReviewWorkflow.md`
- `95_DOM-014_DocWorkingCopy.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
