# Evolución funcional de OperMask Documents

Este directorio contiene cambios propuestos o aprobados que todavía no forman parte de la especificación funcional vigente.

## Fuentes de verdad

- `docs/SFS/` describe exclusivamente comportamiento implementado y validado.
- `docs/EVOLUTION/` describe el estado objetivo, sus brechas y el trabajo necesario para alcanzarlo.
- La implementación determina cuándo una definición puede promoverse a la SFS, pero no puede introducir reglas funcionales que no hayan sido aprobadas previamente.

Este módulo se documenta por ingeniería inversa: el comportamiento ya existe en el código. Relevarlo no equivale a aprobarlo. Cada comportamiento relevado se revisa antes de documentarse y puede ser confirmado, ajustado o reemplazado.

## Estados de evolución

| Estado | Significado |
| ------ | ----------- |
| `PROPUESTO` | Alternativa pendiente de decisión funcional. |
| `APROBADO_PENDIENTE` | Decisión aprobada todavía no implementada o no validada completamente. |
| `IMPLEMENTADO_CON_BRECHA` | Existe comportamiento relacionado, pero no satisface la decisión objetivo. |
| `LISTO_PARA_PROMOVER` | Implementación y validación completadas; falta actualizar la SFS. |
| `PROMOVIDO_A_SFS` | La definición definitiva ya fue incorporada a la SFS vigente. |
| `DESCARTADO` | Se evaluó y se resolvió no incorporar el cambio. Se conserva el registro para no volver a plantearlo. |

## Flujo por bloque

1. Confirmar alcance, reglas y criterios de aceptación.
2. Identificar impactos en modelo, API, permisos, migración y frontend.
3. Implementar el bloque sin agregar decisiones funcionales implícitas.
4. Validar migraciones, compilación y comportamiento funcional.
5. Registrar la trazabilidad entre decisión, archivos modificados y evidencia de validación.
6. Incorporar el comportamiento definitivo en `docs/SFS/`.
7. Marcar el bloque como `PROMOVIDO_A_SFS`.

Una definición parcialmente implementada permanece en este directorio. No se publica en la SFS como comportamiento vigente hasta completar y validar el bloque acordado.

## Insumos de relevamiento

Las siguientes fuentes se utilizan para relevar el comportamiento actual. Son observaciones del sistema implementado, no reglas aprobadas.

| Fuente | Contenido |
| ------ | --------- |
| `prisma/schema.prisma` | Modelo de datos vigente, enumeraciones y restricciones de unicidad. |
| `prisma/migrations/` | Historia de cambios aplicados al modelo. |
| `schema.graphql` | Contrato GraphQL federado expuesto por el subgraph. |
| `src/resolvers/` | Comportamiento implementado, validaciones y permisos exigidos. |
| `src/utils/userAuthorization.ts` | Modelo de autorización y delegación de permisos a `mi-admin`. |
| `README.md` | Arquitectura, modelo de datos y catálogo de operaciones. |
| `WhatIsNew.md` | Changelog funcional por versión. |
| `DOCUMENT_MANAGEMENT_STRATEGY.md` | Estrategia de gestión documental, workflow ISO 9001 y transmittals. |
| `DIGITALIZATION_STRATEGY.md` | Flujo de digitalización de escaneos (fuera del alcance de la SFS). |
| `FILESERVER_API_DOCUMENTATION.md` | Contrato con `mi-fileserver` y convención de file keys. |
| `201-mi-webapp/app/(withSidebar)/documents/` | Pantallas implementadas de catálogos y registros de auditoría. |
| `201-mi-webapp/app/(withSidebar)/projects/documents/` | Pantallas implementadas del ámbito de proyecto. |
| `200-mi/docs/specs/PROJECTS_DOCUMENTS_INTEGRATION_SPEC.md` | Integración federada con `mi-project`. |

## Temas abiertos fuera del plan

Los hallazgos del subsistema de Gestión Documental se registran en `DOCUMENT_EVOLUTION_PLAN.md`. Los siguientes temas no forman parte de ese alcance y quedan anotados aquí para no perderlos.

| Tema | Situación observada | Estado |
| ---- | ------------------- | ------ |
| Salida de `ScannedFile` y `Area` | Implementados con interfaz completa en la webapp, pero su dominio corresponde a `212-mi-digitalization`. La orientación acordada es que dejen de formar parte de este módulo. Es el único subsistema con uso productivo: un cliente lo utiliza hoy, por lo que la migración debe preservar sus datos y su operación. El momento y la forma se definirán en su propio bloque. | `APROBADO_PENDIENTE` |
| Páginas de documentos en calidad y etiquetas | `/quality/documents` y `/tags/documents` son stubs con datos fijos y enlaces directos a un sistema externo. Su tratamiento depende de la cuestión de fondo sobre el alcance del módulo, planteada en `DOCUMENT_EVOLUTION_PLAN.md`. | `PROPUESTO` |

## Documentos

| Documento | Contenido | Estado |
| --------- | --------- | ------ |
| `DOCUMENT_EVOLUTION_PLAN.md` | Relevamiento del comportamiento implementado, hallazgos y decisiones funcionales objetivo | Decisiones aprobadas — en ejecución por bloques |
| `BLOCK_01_TRAZABILIDAD_FUNCIONAL.md` | Primer bloque: eventos de dominio de workflow y auditoría, y base de pruebas automatizadas | `PROMOVIDO_A_SFS` |
| `BLOCK_02_CONTEXTO_DE_PROYECTO.md` | Segundo bloque: pertenencia del documento al proyecto, rol documental Emisor / Receptor / Interno, membresía y alcance de acceso en dos capas | `PROMOVIDO_A_SFS` |
| `BLOCK_03_CICLO_INTERNO.md` | Tercer bloque: el circuito completo desde el armado hasta la toma de conocimiento, revisión externa y versión interna, circuitos sucesivos, firma verificable, delegación y reasignación, esquema de revisión propuesto y no persistido, y abandono de la revisión | `PROMOVIDO_A_SFS` |
| `BLOCK_03_REGISTRO_DE_DEFINICIONES.md` | Cómo se llegó a cada decisión del tercer bloque: planteo, alternativas consideradas y resolución, en 50 cuestiones | Cerrado |
