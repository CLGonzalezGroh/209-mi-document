# Principios del Modelo — Contexto de proyecto

**Ámbito:** Contexto de proyecto
**Estado:** Approved
**Versión:** 2.0

---

# 1. El contrato es la unidad de agrupación y de alcance, y el módulo es su dueño

Un documento pertenece a un contrato. El contrato habilita listar, filtrar y numerar documentación sin recurrir a convenciones implícitas, y es la unidad sobre la que se acota el acceso.

**El módulo posee esta entidad.** No la referencia en otro subgraph ni la federa. Tres consecuencias, y ninguna es de implementación:

- **la gestión documental puede ofrecerse sin el módulo de proyectos**, porque el alta del contrato vive acá;
- **la pertenencia es estructural y no una convención entre servicios**: nada puede pertenecer a un contrato inexistente;
- **una obra admite varios contratos**, uno por contraparte, sin que ninguno tenga que fingir ser una obra distinta.

El vínculo con la gestión de proyecto del otro módulo es **opcional y de muchos a uno**. Su ausencia no es una falta de dato: dice que esa obra no se administra con aquel módulo.

---

# 2. Circulación y publicación son dos regímenes distintos

No toda la documentación circula.

- **Documentación en circulación**: vive en un contrato, tiene partes que la producen y la reciben, y su acceso se acota por membresía.
- **Documentación publicada**: no circula. No tiene contraparte, y su acceso se gobierna por el permiso global y por su clasificación.

Que un documento **no tenga contrato no es una ausencia de dato**: es la marca del segundo régimen.

De ahí el invariante que rige el contexto de un documento: la documentación del ámbito de proyectos **debe** pertenecer a un contrato, y la del resto de los ámbitos **no** pertenece a ninguno. **La estructura lo garantiza**, y no la aplicación: es lo que permite que la unicidad del código se discrimine por ámbito sin dejar ninguna documentación fuera de toda regla.

**Los dos "sin dato" de este ámbito viven en niveles distintos y no se confunden**: un documento sin contrato es documentación publicada; un contrato sin obra es un contrato sin gestión de proyecto asociada. El segundo no dice nada sobre el primero.

La distinción existe porque la membresía tiene una causa concreta —la participación externa— y la participación externa ocurre en proyectos. Donde no hay contraparte, no hay nada que acotar más allá del permiso global.

---

# 3. La autorización combina dos capas

La autorización efectiva de una operación resulta de:

1. **el permiso global**, provisto por el servicio de administración: qué puede hacer el usuario;
2. **la membresía vigente en el contrato**: qué alcanza.

Ninguna de las dos sustituye a la otra. Un permiso sin alcance no habilita nada concreto; un alcance sin permiso no habilita ninguna acción.

Se mantienen deliberadamente separadas de una tercera definición, la asignación del circuito de revisión, que determina qué documento concreto le toca revisar o aprobar a una persona.

---

# 4. La segunda capa se aplica de dos formas

La membresía se exige o se filtra, según la operación permita determinar un contrato:

- **operaciones sobre un objeto**: se resuelve el contrato del objeto y se exige membresía. Sin ella, la operación se rechaza;
- **listados que no nombran un contrato**: no puede exigirse membresía en un contrato que la consulta no menciona. El resultado se **restringe** a los contratos alcanzados.

La distinción no es un detalle de implementación: un listado que rechazara sería inutilizable, y un objeto que solo filtrara dejaría el acceso abierto.

Los objetos sin contrato quedan gobernados únicamente por el permiso global, conforme al principio 2.

---

# 5. La administración del alcance está por encima del alcance

Dar de alta un contrato e incorporar o dar de baja a sus miembros son actos **administrativos**: se gobiernan por el permiso global y no exigen membresía.

Es una condición de arranque, no una excepción de conveniencia: el primer miembro de un contrato no puede exigir una membresía que todavía no existe.

---

# 5b. El estado del contrato dice qué admite, no quién puede

La autorización y el estado del contrato responden preguntas distintas y se mantienen separados:

- la **autorización** —permiso global más membresía— responde *quién puede*;
- el **estado del contrato** responde *qué admite el contrato*.

Un contrato cerrado no es un problema de permisos: no hay permiso que habilite escribir en él, y ninguna membresía lo cambia. Confundirlos haría que la operación rechazada se leyera como una falta de acceso.

La puerta alcanza a **toda escritura** sobre lo que pertenece al contrato, se llegue por el objeto o por el contrato mismo, y **no alcanza a la lectura**.

---

# 6. La identidad de un objeto se expresa con referencias, no con convenciones

Cuando un objeto de este módulo pertenece a una entidad de otro subgraph, esa pertenencia se expresa con una referencia propia, con su índice y su semántica declarada.

No se expresa con un par genérico de tipo y ubicación descritos en texto libre, que carece de integridad, no admite índice propio y obliga a cada consumidor a conocer una convención implícita.

El mismo criterio aplica a cualquier ámbito que se incorpore en el futuro.

---

# 7. El contexto de la traza se deriva, no se informa

Los eventos funcionales conservan el contrato y el ámbito del objeto al que se refieren. Ese contexto se **deriva del objeto afectado** y no lo informa quien emite el evento.

Es la misma regla que rige el tipo de objeto: declarada en un único lugar, de modo que no puede haber discrepancia entre lo que un evento afirma y lo que el objeto es.

Conservarlo en el evento permite consultar la traza por contrato o por ámbito sin recorrer la cadena de objetos, y es lo que hace aplicable el alcance a la propia trazabilidad.

El contrato **se conserva como copia y no como vínculo**: la traza es un registro inmutable, y hacerla depender del ciclo de vida de lo que audita invertiría la relación.

---

# Referencias

- `10_DOM-003_DocProject.md`
- `20_DOM-004_DocProjectMember.md`
- `../00_transversal/10_DOM-001_DocWorkflowEvent.md`
- `../00_transversal/20_DOM-002_DocAuditEvent.md`
