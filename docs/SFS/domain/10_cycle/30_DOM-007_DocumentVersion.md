# DOM-007 — DocumentVersion

**Ámbito:** Ciclo interno
**Categoría:** Entity
**Estado:** Approved
**Versión:** 2.0

---

# Propósito

Registrar **el conjunto de archivos** entregado en un mismo acto dentro de una revisión, de forma inmutable y verificable.

---

# Descripción

Una `DocumentVersion` **es un conjunto de archivos**. Un documento se entrega habitualmente como más de uno: el PDF que se revisa y se marca, con su editable en custodia y la evidencia que lo sustenta. También existe el documento compuesto por varios entregables, de modo que la exigencia no es *un* entregable sino *al menos uno*.

No existe sin contenido nuevo: un cambio de metadata no la produce, porque eso es una actualización de la revisión o del documento.

Lo que cada archivo guarda no es descripción del documento sino **descripción del contenido** —nombre, tamaño, tipo y hash—, y ninguno de esos datos puede cambiar sin que cambie el archivo. Es lo que permite que una firma acredite contenido.

**Nace al confirmar una copia de trabajo**, no al subir cada archivo. Antes de eso hay un conjunto en preparación, mutable por naturaleza, que todavía no acredita nada.

Las versiones son la **iteración interna** de la revisión. Se acumulan durante el circuito: la produce el elaborador, la marca el revisor, la marca el aprobador. Su numeración es continua dentro de la revisión y **no se reinicia** cuando un rechazo abre un circuito nuevo, porque lo que se corrige es el mismo entregable.

---

# Responsabilidades

`DocumentVersion` es responsable de:

- registrar el conjunto de archivos de una iteración, cada uno con su rol y su hash;
- sostener la secuencia de iteraciones internas de una revisión;
- ser el objeto que una firma acredita.

No es responsable de:

- clasificar su origen o su naturaleza: una versión no se distingue por haber sido producida al elaborar o al marcar;
- registrar la objeción de un revisor, que vive en el comentario de su paso;
- sostener el conjunto mientras se prepara, que pertenece a la copia de trabajo.

---

# Atributos Conceptuales

Entre los atributos propios de la `DocumentVersion` podrán encontrarse:

- número de versión dentro de la revisión;
- comentario sobre el cambio;
- fecha y actor de alta.

Y de cada archivo del conjunto:

- **rol**: entregable, fuente o respaldo;
- referencia al archivo almacenado, con su nombre, tamaño y tipo;
- hash de contenido.

La definición detallada de estos atributos corresponde al Modelo de Datos.

---

# Invariantes

**El conjunto tiene al menos un archivo, y al menos uno con rol de entregable.** El entregable es lo que se revisa y se marca; un conjunto sin él no es una emisión. La fuente y el respaldo son opcionales y admiten varios.

**El hash de contenido es obligatorio en cada archivo.** Es lo que la firma acredita, y una regla condicional obligaría a decidir qué ocurre con el archivo que entró sin él y después resulta ser el firmado.

**Ningún archivo se repite dentro de la misma versión.**

**La versión no se modifica ni se elimina**, y eso incluye su comentario y su conjunto: si quedó mal, la corrección va en la traza y no editando la evidencia. Agregar un archivo a una versión existente dejaría a una firma acreditando un conjunto distinto del que su autor tuvo delante.

**La produce quien tiene el paso vigente**, o quien cuente con el permiso de administración del circuito. No es una restricción de identidad sino de momento.

**Una revisión aprobada no admite versiones nuevas**, porque no tiene paso vigente. Es lo que impide que una firma quede acreditando una versión que dejó de ser la última.

**El comentario es opcional.** La observación casi siempre viaja dentro del archivo, como marcas sobre el documento; el comentario es complemento y no el registro de la objeción.

---

# Relaciones Conceptuales

**Pertenece a**

- `DocumentRevision`

**Agrupa a**

- sus archivos, cada uno con su rol

**Es producida por**

- `DocWorkingCopy`, al confirmarse

**Es acreditada por**

- `DocStepSignature`, que incorpora el conjunto completo a su payload firmado

---

# Observaciones

**El rol lo interpreta el sistema, y por eso es enumeración y no catálogo configurable.** Qué se revisa, qué se marca y qué se exige al emitir dependen de él; un valor libre no tendría comportamiento asociado.

**El respaldo no invade al adjunto, y la frontera no es la naturaleza del archivo sino a qué se ata.** El archivo de una versión integra la entrega, es inmutable y queda acreditado por la firma; un adjunto cuelga del documento, es mutable y no acredita nada. Que la evidencia que sustenta un cálculo quede firmada junto con el entregable que la usa es lo que antes no se podía afirmar.

**Que el editable se exija recién en la emisión final** —apto para construcción, conforme a obra— es una regla real que este ámbito **no implementa**: depende del propósito de la emisión, que pertenece al bloque de circulación. Acá está la capacidad, no la obligación.

**La versión vigente es la última, y coincide con la aprobada.** No son dos reglas: como el circuito cierra aprobando y después no se admiten versiones, la última versión de una revisión aprobada **es** la que se aprobó.

**Someter exige al menos una versión.** Es la precondición que reemplaza a exigir el archivo en el alta, ahora que el documento nace sin él.

**El hash lo calcula quien produce el archivo**, y el módulo no lo deriva: el servicio de almacenamiento no ve los bytes por diseño.

---

# Referencias

- `20_DOM-006_DocumentRevision.md`, `60_DOM-010_DocStepSignature.md`
- `95_DOM-014_DocWorkingCopy.md`
- `80_Principios_del_Modelo.md`
- `../../00_Convenciones.md`
