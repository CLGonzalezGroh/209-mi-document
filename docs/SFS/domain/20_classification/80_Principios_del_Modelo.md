# Principios del modelo — Clasificación

Lo que sostiene el ámbito, y por qué está separado del ciclo interno y de la circulación.

---

# 1. Clasificar no es identificar

El código **identifica** el documento y no cambia; el título **describe la emisión** y por eso vive en la revisión; la ubicación **clasifica**, y por eso vive en el documento y se edita siempre.

Que un dato aparezca impreso en el rótulo no lo vuelve identificación. Lo que la titularidad por nivel sostiene es que la **identificación** pertenece a la emisión que la produjo, no que todo lo impreso lo haga. Corregir dónde está un equipo no debe exigir abrir una revisión, y no puede invalidar una firma.

De ahí se desprende todo lo demás: la ubicación no integra el payload de la firma, no se congela con la revisión aprobada, y su ruta puede recalcularse sola.

---

# 2. La ubicación no gobierna nada

**Ninguna regla del módulo la lee.** No condiciona el circuito, no habilita ni impide una emisión, no participa de ninguna precondición. Es clasificación y filtrado.

Es lo que la vuelve barata de corregir y lo que permite que su snapshot se reescriba sin ceremonia. Y es la razón por la que el eje de área quedó fuera de la propuesta de revisores: distribuir el trabajo por sector habría convertido un atributo de filtrado en una puerta del ciclo.

---

# 3. Un catálogo es un conjunto, y por eso se hereda

Las configuraciones por proyecto son **valores**: el rol documental, el esquema de revisión, el armador por defecto. Lo específico reemplaza a lo general y no hay nada que combinar.

Un catálogo es un **conjunto**, de modo que la pregunta es otra: qué entradas están disponibles. Ahí sí tiene sentido heredar y ampliar, y por eso el alcance es una declaración propia y no un valor más de la configuración.

**Heredar suma.** Donde el alcance más específico agrega opciones sin estorbar, heredar es lo correcto; donde la lista es la del contrato —las calificaciones de la contraparte— mezclar produciría una lista que no es la de nadie. Los dos criterios conviven porque responden a preguntas distintas.

---

# 4. El mecanismo de alcance es uno, y los catálogos son dos

Ubicación y clasificación comparten la declaración, los dos modos y la siembra por copia. Está construido una vez sobre el catálogo que no tenía datos ni interfaz en producción, y el otro lo reutiliza sin migrar estructura.

**Clase y tipo son un solo catálogo y no dos.** El tipo cuelga de la clase, de modo que declararlos por separado admitiría un proyecto con clasificación propia heredando tipos que apuntan a clases que no ve. Los ejes de alcance son los mismos; lo que se declara una sola vez es cómo se resuelven.

**La invariante de cruce sí se generaliza, y no es del árbol.** Compara dos alcances y no dos nodos: lo del proyecto cuelga de lo del despliegue —eso es ampliar— y nunca al revés, porque el catálogo global quedaría dependiendo de un proyecto. Vale para el nodo y su padre, para el tipo y su clase, y para la plantilla del circuito y las entradas que referencia. La clase es lo único que no la necesita, porque no cuelga de nada.

**Lo que cambia entre los dos catálogos es la identidad, y de ahí sale la siembra.** Un nodo **es** su ruta completa; una clase es su código, y un tipo su código **dentro de su clase**. Por eso copiar un árbol resuelve rutas y copiar la clasificación resuelve códigos, con la misma regla: copiar solo lo vigente, comparar contra lo que el destino **ve**, y no duplicar.

---

# 5. La ruta es conveniencia, no evidencia

El snapshot de la ruta existe para no recorrer la jerarquía en cada listado, y para agrupar cada rama con su descendencia en una lista plana. No acredita nada.

Por eso el recálculo es automático y no un acto explícito, y por eso **no lleva la marca de quién lo produjo**: nadie editó los documentos cuya ruta cambió porque alguien renombró un nodo tres niveles más arriba. Registrar el movimiento que lo originó, con cuántos objetos alcanzó, es lo que vuelve explicable ese cambio.

Y por eso mismo el filtrado por rama **no** usa el prefijo de la ruta: dos nodos de alcances distintos pueden tener la misma, y el filtro los mezclaría. La conveniencia sirve para mostrar; la identidad la da el nodo.

---

# 6. El árbol de la instalación tiene más de un dueño legítimo

El registro de activos afirma que un equipo existe y es propio, con ciclo de vida real. El catálogo de clasificación afirma cómo nombra el cliente sus sectores. **No dicen lo mismo**, y por eso cada módulo que clasifica administra el suyo sin contradecir al de activos.

Es lo que resuelve una titularidad que de otro modo dependería de qué módulos tenga cada despliegue: una empresa de ingeniería necesita el atributo y no tiene activos; un contratista de digitalización debe entregarlo cuando su cliente lo exige.

El puente queda modelado desde el principio —origen e identificador del objeto externo que un nodo describe— para que sincronizar con el registro de activos sea después una operación y no una migración.

---

# 7. Lo dado de baja no se elige, y lo ya clasificado no se revalida

Las dos mitades son necesarias y dicen cosas distintas. Una entrada dada de baja **deja de ser elegible** —no aparece en el selector, y clasificar con ella se rechaza— porque de otro modo la baja lógica no significaría nada: quien conociera su identificador seguiría usándola.

Y **lo ya clasificado la conserva**: la validación ocurre solo en escritura y nunca revalida lo existente. Un documento no cambia de clasificación porque alguien dio de baja una entrada, ni queda inválido por eso.

Es la misma partición que gobierna el cambio de modo de un catálogo, y la razón por la que ninguna de esas operaciones necesita recorrer lo ya escrito.

---

# 8. Opcional en los tres roles

El atributo nace habilitado y no obligatorio, y un proyecto atraviesa el ciclo completo sin declarar ninguna ubicación. La obligatoriedad se configura, y **deshabilitado no exige**: exigir lo que no se puede declarar sería una contradicción, no una regla estricta.

La etiqueta sí es configurable —*área*, *unidad*, *sector*— a diferencia de la revisión, que es terminología establecida del dominio documental.

---

# Referencias

- `10_DOM-019_DocLocation.md`
- `20_DOM-020_DocCatalogScope.md`
- `../10_cycle/80_Principios_del_Modelo.md`
- `../05_project/80_Principios_del_Modelo.md`
