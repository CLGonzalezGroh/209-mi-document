# Principios del Modelo — Contexto de proyecto

**Ámbito:** Contexto de proyecto
**Estado:** Approved
**Versión:** 1.0

---

# 1. El proyecto es la unidad de agrupación y de alcance

Un documento pertenece a un proyecto. El proyecto habilita listar, filtrar y numerar documentación sin recurrir a convenciones implícitas, y es la unidad sobre la que se acota el acceso.

El proyecto se referencia de forma **externa**: la entidad Proyecto pertenece a otro subgraph y este módulo no la posee ni la administra.

---

# 2. Circulación y publicación son dos regímenes distintos

No toda la documentación circula.

- **Documentación en circulación**: vive en un proyecto, tiene partes que la producen y la reciben, y su acceso se acota por membresía.
- **Documentación publicada**: no circula. No tiene contraparte, y su acceso se gobierna por el permiso global y por su clasificación.

Que un documento **no tenga proyecto no es una ausencia de dato**: es la marca del segundo régimen.

De ahí el invariante que rige el contexto de un documento: la documentación del ámbito de proyectos **debe** pertenecer a un proyecto, y la del resto de los ámbitos **no** pertenece a ninguno.

La distinción existe porque la membresía tiene una causa concreta —la participación externa— y la participación externa ocurre en proyectos. Donde no hay contraparte, no hay nada que acotar más allá del permiso global.

---

# 3. La autorización combina dos capas

La autorización efectiva de una operación resulta de:

1. **el permiso global**, provisto por el servicio de administración: qué puede hacer el usuario;
2. **la membresía vigente en el proyecto**: qué alcanza.

Ninguna de las dos sustituye a la otra. Un permiso sin alcance no habilita nada concreto; un alcance sin permiso no habilita ninguna acción.

Se mantienen deliberadamente separadas de una tercera definición, la asignación del circuito de revisión, que determina qué documento concreto le toca revisar o aprobar a una persona.

---

# 4. La segunda capa se aplica de dos formas

La membresía se exige o se filtra, según la operación permita determinar un proyecto:

- **operaciones sobre un objeto**: se resuelve el proyecto del objeto y se exige membresía. Sin ella, la operación se rechaza;
- **listados que no nombran un proyecto**: no puede exigirse membresía en un proyecto que la consulta no menciona. El resultado se **restringe** a los proyectos alcanzados.

La distinción no es un detalle de implementación: un listado que rechazara sería inutilizable, y un objeto que solo filtrara dejaría el acceso abierto.

Los objetos sin proyecto quedan gobernados únicamente por el permiso global, conforme al principio 2.

---

# 5. La administración del alcance está por encima del alcance

Declarar la configuración documental de un proyecto e incorporar o dar de baja a sus miembros son actos **administrativos**: se gobiernan por el permiso global y no exigen membresía.

Es una condición de arranque, no una excepción de conveniencia: el primer miembro de un proyecto no puede exigir una membresía que todavía no existe.

---

# 6. La identidad de un objeto se expresa con referencias, no con convenciones

Cuando un objeto de este módulo pertenece a una entidad de otro subgraph, esa pertenencia se expresa con una referencia propia, con su índice y su semántica declarada.

No se expresa con un par genérico de tipo y ubicación descritos en texto libre, que carece de integridad, no admite índice propio y obliga a cada consumidor a conocer una convención implícita.

El mismo criterio aplica a cualquier ámbito que se incorpore en el futuro.

---

# 7. El contexto de la traza se deriva, no se informa

Los eventos funcionales conservan el proyecto y el ámbito del objeto al que se refieren. Ese contexto se **deriva del objeto afectado** y no lo informa quien emite el evento.

Es la misma regla que rige el tipo de objeto: declarada en un único lugar, de modo que no puede haber discrepancia entre lo que un evento afirma y lo que el objeto es.

Conservarlo en el evento permite consultar la traza por proyecto o por ámbito sin recorrer la cadena de objetos, y es lo que hace aplicable el alcance a la propia trazabilidad.

---

# Referencias

- `10_DOM-003_DocProjectSettings.md`
- `20_DOM-004_DocProjectMember.md`
- `../00_transversal/10_DOM-001_DocWorkflowEvent.md`
- `../00_transversal/20_DOM-002_DocAuditEvent.md`
