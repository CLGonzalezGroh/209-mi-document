# SFS — Especificación Funcional de Software

Documentación funcional de **OperMask Documents**.

**Estado:** Draft de cobertura.

## Objetivo

Esta SFS describe exclusivamente el comportamiento implementado y validado de OperMask Documents.

Las propuestas, decisiones aprobadas pendientes, brechas y estrategias de migración se mantienen en `docs/EVOLUTION/`. Una definición se incorpora a esta SFS únicamente después de completar su implementación y verificar el comportamiento resultante.

El estado Draft indica que la cobertura documental todavía es incompleta. No significa que la SFS pueda contener comportamiento futuro.

## Alcance de la especificación

Esta SFS cubre el subsistema de **Gestión Documental**:

- catálogos documentales: `DocumentClass` y `DocumentType`;
- documentos y su identificación: `Document`;
- control de revisiones y versiones: `DocumentRevision` y `DocumentVersion`;
- circuito de revisión y aprobación: `ReviewWorkflow` y `ReviewStep`;
- emisión y seguimiento de transmittals: `Transmittal` y `TransmittalItem`;
- archivos adjuntos sin versionado: `Attachment`;
- vinculación de documentos con tareas de proyecto: `TaskDocumentReference`;
- eventos funcionales transversales de workflow y auditoría, con el mismo tratamiento de dominio que reciben en OperMask Digitalization.

No forman parte del alcance de esta especificación:

- la digitalización de documentación física implementada en este subgraph mediante `ScannedFile` y `Area`. Ese comportamiento se considera legado: su dominio está siendo especificado en `212-mi-digitalization` y su continuidad, migración o retiro se tratan en `docs/EVOLUTION/`;
- el registro técnico `DocumentSysLog`, que queda asociado a la operación del servicio y al subsistema legado de `ScannedFile`. La trazabilidad funcional del subsistema de Gestión Documental se expresa mediante eventos de dominio.

## Método de trabajo

Cada bloque funcional se incorpora de forma incremental:

1. relevar el comportamiento implementado;
2. contrastarlo con el bloque aprobado en `docs/EVOLUTION/`;
3. completar las migraciones y validaciones aplicables;
4. confirmar el comportamiento funcional resultante;
5. documentarlo sin conservar alternativas ni estados transitorios;
6. registrar la promoción en el plan de evolución.

El relevamiento no habilita por sí mismo la documentación. Un comportamiento existente en el código puede ser revisado, ajustado o reemplazado antes de incorporarse a esta especificación.

## Estados documentales

| Estado | Significado |
| ------ | ----------- |
| `Draft de cobertura` | Contiene solo comportamiento vigente, pero todavía no cubre todo el alcance declarado. |
| `Approved` | El alcance declarado fue implementado, validado y documentado completamente. |
| `Superseded` | El documento fue reemplazado por una versión posterior. |

Los estados `PROPUESTO`, `APROBADO_PENDIENTE` e `IMPLEMENTADO_CON_BRECHA` pertenecen al plan de evolución y no se utilizan como reglas normativas dentro de la SFS.

## Índice inicial

| Documento            | Contenido                                                   | Estado |
| -------------------- | ----------------------------------------------------------- | ------ |
| `00_Convenciones.md` | Convenciones de idioma, nomenclatura y promoción documental | Draft de cobertura |
| `domain/00_transversal/10_DOM-001_DocWorkflowEvent.md` | Transición de estado de un objeto del dominio | Approved |
| `domain/00_transversal/20_DOM-002_DocAuditEvent.md` | Acción ejecutada sobre un objeto del dominio | Approved |
| `domain/05_project/10_DOM-003_DocProjectSettings.md` | Rol documental que el proyecto declara y su contraparte | Approved |
| `domain/05_project/20_DOM-004_DocProjectMember.md` | Membresía que habilita el acceso a un proyecto | Approved |
| `domain/05_project/80_Principios_del_Modelo.md` | Principios del contexto de proyecto: regímenes, alcance y autorización | Approved |
| `domain/10_cycle/10_DOM-005_Document.md` | Identidad de la documentación y su metadata congelada | Approved |
| `domain/10_cycle/20_DOM-006_DocumentRevision.md` | Unidad de emisión, con sus circuitos sucesivos y su armador | Approved |
| `domain/10_cycle/30_DOM-007_DocumentVersion.md` | El archivo como iteración interna, inmutable y con hash | Approved |
| `domain/10_cycle/40_DOM-008_ReviewWorkflow.md` | El circuito como ciclo completo, desde el armado | Approved |
| `domain/10_cycle/50_DOM-009_ReviewStep.md` | El acto asignado, y cómo se resolvió | Approved |
| `domain/10_cycle/60_DOM-010_DocStepSignature.md` | La evidencia verificable de una resolución | Approved |
| `domain/10_cycle/70_DOM-011_DocWorkflowTemplate.md` | La propuesta del circuito, resuelta por alcance | Approved |
| `domain/10_cycle/75_DOM-012_DocSettings.md` | La convención documental del despliegue | Approved |
| `domain/10_cycle/80_Principios_del_Modelo.md` | Principios del ciclo interno: circuito, versión, firma y numeración | Approved |

Los dos primeros Objetos del Dominio provienen del bloque de trazabilidad funcional; los dos siguientes, junto con los principios del contexto de proyecto, del bloque de contexto de proyecto y rol documental. Los ocho del ámbito de ciclo interno, junto con sus principios, provienen del bloque del ciclo interno de revisión. La organización conceptual del dominio —modelos, arquitectura y su índice— se incorporará cuando los bloques correspondientes se promuevan; hasta entonces, este índice cumple esa función.

## Estructura prevista

La estructura se incorporará por partes a medida que se apruebe cada bloque:

```text
00_Convenciones.md
01_Glosario.md
10_Introduccion.md
20_Arquitectura_Conceptual.md
30_Modelo_Conceptual.md
40_Actores.md
50_casos_de_uso/
60_workflows/
70_pantallas/
80_indicadores/
90_Architecture_Decisions.md
domain/
```

No se crearán documentos vacíos ni se copiarán definiciones pendientes para anticipar una implementación.

## Plan de evolución

Las decisiones y cambios aprobados que aún no forman parte de esta especificación se encuentran en `../EVOLUTION/README.md`.
