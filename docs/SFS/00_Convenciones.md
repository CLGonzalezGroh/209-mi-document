# 00. Convenciones

**Estado:** Draft de cobertura
**Versión:** 0.1

## 1. Objetivo

Este documento define las convenciones utilizadas en la SFS de **OperMask Documents** para mantener un lenguaje uniforme entre negocio, documentación, implementación y pruebas.

## 2. Idioma

La SFS se redacta en español.

Se mantienen en inglés los nombres oficiales presentes en el dominio o la implementación, entre ellos:

- entidades y propiedades, como `Document`, `DocumentRevision`, `Transmittal`, `documentId` y `fileKey`;
- enumeraciones y sus valores;
- acciones funcionales cuando se expresen como comandos;
- términos consolidados del dominio, como transmittal, revision, ISO 9001, file key y presigned URL.

Las entidades y propiedades se escriben en formato de código.

## 3. Nomenclatura técnica

- Entidades y enumeraciones: PascalCase.
- Propiedades: camelCase.
- Valores de enumeraciones: SCREAMING_SNAKE_CASE.
- Acciones funcionales: verbo en inglés en modo imperativo, como `CreateRevision`, `RegisterVersion`, `InitiateReview`, `ApproveStep` e `IssueTransmittal`.

La terminología funcional definitiva se mantendrá alineada con el glosario, la API GraphQL y el modelo de dominio aprobado.

## 4. Identificadores documentales

| Prefijo | Significado                                                 |
| ------- | ----------------------------------------------------------- |
| `UC`    | Caso de Uso                                                 |
| `BR`    | Regla de Negocio                                            |
| `INV`   | Invariante del Dominio                                      |
| `ADR`   | Architecture Decision Record                                |
| `WF`    | Workflow                                                    |
| `UI`    | Pantalla o experiencia de usuario                           |
| `KPI`   | Indicador                                                   |
| `DOM`   | Objeto del Dominio                                          |
| `GAP`   | Brecha entre la especificación aprobada y la implementación |

Los prefijos de reglas podrán incorporar un identificador de modelo cuando se defina la Arquitectura Conceptual.

## 5. Estado documental

La SFS no asigna estados de propuesta o implementación a sus reglas. Todo comportamiento normativo incluido debe estar implementado y validado.

El estado se expresa en la cabecera de cada documento:

- `Draft de cobertura`: contiene solo comportamiento vigente, pero todavía no cubre completamente el alcance previsto;
- `Approved`: el alcance declarado fue implementado, validado y documentado completamente;
- `Superseded`: fue reemplazado por una definición posterior.

Los estados de propuesta, brecha y promoción pertenecen a `docs/EVOLUTION/`.

## 6. Trazabilidad

Antes de incorporar o actualizar una capacidad se verificará, según corresponda:

- evidencia de implementación relevante;
- comportamiento observado;
- migraciones aplicadas;
- validaciones técnicas ejecutadas;
- aceptación del comportamiento funcional resultante;
- bloque de evolución del que proviene el cambio.

La SFS describe el resultado funcional. El detalle transitorio de archivos modificados, alternativas y brechas permanece en el plan de evolución.

## 7. Decisiones y cambios pendientes

Las propuestas y decisiones pendientes no se redactan como reglas normativas en la SFS. Se registran en `docs/EVOLUTION/` con:

- contexto;
- comportamiento implementado;
- cambio propuesto;
- alternativas consideradas;
- impacto esperado;
- estado de decisión.

Una decisión aprobada permanece en evolución hasta completar su implementación y validación. Solo entonces se promueve su resultado definitivo a la SFS.

## 8. Diagramas

Los diagramas se expresan preferentemente en Mermaid.

- `flowchart`: flujos y organización funcional;
- `stateDiagram-v2`: ciclos de vida;
- `erDiagram`: relaciones conceptuales;
- `sequenceDiagram`: interacción entre actores o servicios cuando resulte necesaria.

## 9. Principio general

La documentación debe mantener dos fuentes separadas:

- `docs/SFS/`: comportamiento vigente implementado y validado;
- `docs/EVOLUTION/`: propuestas, decisiones objetivo, brechas, migraciones y trazabilidad de implementación.

La SFS no debe describir como vigente un comportamiento que todavía no pueda observarse en el sistema.

## 10. Relación con la documentación preexistente

El módulo cuenta con documentación técnica previa a esta especificación, ubicada en la raíz del repositorio:

- `README.md`;
- `DOCUMENT_MANAGEMENT_STRATEGY.md`;
- `DIGITALIZATION_STRATEGY.md`;
- `FILESERVER_API_DOCUMENTATION.md`;
- `WhatIsNew.md`.

Esos documentos describen decisiones técnicas, estrategias y detalle de implementación. No son normativos para el dominio funcional y no deben citarse como fuente de reglas.

Se utilizan como insumo de relevamiento. A medida que su contenido funcional se releve, confirme y promueva, esta SFS lo reemplaza como referencia; el contenido estrictamente técnico permanece donde está.
