# Estrategia de Digitalización de Documentos

## Objetivo

Convertir el acervo documental físico (papel) de la planta en archivos digitales clasificados, validados por el cliente y cargados en el sistema documental destino, garantizando trazabilidad completa del proceso y disposición controlada del papel original.

---

## Actores involucados

| Actor                        | Responsabilidad                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Equipo de digitalización** | Escanear documentos físicos, registrarlos en el sistema y clasificarlos (tipo, clase, área de planta)                                                      |
| **Cliente**                  | Revisar la clasificación y decidir si el archivo se carga en M-Files o se descarta. Decidir la disposición del papel físico original (destruir o archivar) |
| **Operador de carga**        | Una vez aprobado por el cliente, cargar el archivo en M-Files y registrar la referencia resultante                                                         |

---

## Flujo del proceso

### 1. Escaneo, registro y clasificación

El equipo de digitalización escanea el documento físico, lo sube al sistema y lo clasifica con los siguientes datos:

- **Proyecto** al que pertenece
- **Título** descriptivo
- **Referencia original** del papel (si existe un código impreso)
- **Ubicación física** donde se encontró el documento
- **Clase de documento** — Categoría general (ej: Instrumentación, Mecánica, Civil)
- **Tipo de documento** — Tipo específico (ej: Plano, Procedimiento, Informe)
- **Área de planta** — Ubicación física en planta a la que refiere el documento (ej: 01 - Urea, 02 - Amoníaco)
- **Notas de clasificación** — Observaciones relevantes para el cliente

El archivo queda registrado con estado digital **Pendiente** y estado físico **Pendiente**.

### 2. Decisión del cliente

El cliente revisa cada archivo clasificado por el equipo de digitalización y toma las siguientes decisiones:

#### a) Sobre el archivo digital

- **Aceptar** — El archivo se aprueba para ser cargado en M-Files. El estado digital pasa a **Aceptado**.
- **Descartar** — El archivo no tiene valor documental (duplicado, ilegible, irrelevante). Se indica el motivo y el estado digital pasa a **Descartado**.

#### b) Sobre el papel físico original

El cliente decide qué hacer con la copia papel:

| Disposición  | Descripción                                                |
| ------------ | ---------------------------------------------------------- |
| **Destruir** | El papel se programa para destrucción controlada           |
| **Archivar** | El papel se programa para almacenamiento físico permanente |

> _Ambas decisiones (digital y física) quedan registradas con usuario, fecha y criterio utilizado._

### 3. Carga en M-Files

Una vez que el cliente acepta el archivo, el operador de carga:

1. Sube el archivo a **M-Files**
2. Registra en nuestro sistema la **referencia externa** (código o ID del documento en M-Files)

El estado digital pasa a **Cargado**, cerrando el ciclo digital. El sistema genera automáticamente el enlace directo al documento en M-Files para consulta rápida.

### 4. Confirmación de disposición física

Una vez ejecutada la acción sobre el papel:

1. Se realiza la destrucción o el almacenamiento físico
2. Se confirma en el sistema la ejecución (**Destrucción confirmada** o **Almacenamiento confirmado**)

> _La confirmación cierra el ciclo físico y queda registrada con usuario y fecha para trazabilidad._

---

## Estados del proceso

### Ciclo digital

```
Pendiente → Aceptado → Cargado
    ↓
Descartado
```

| Estado         | Significado                                            |
| -------------- | ------------------------------------------------------ |
| **Pendiente**  | Escaneado, sin clasificar                              |
| **Aceptado**   | Aprobado por el cliente, pendiente de carga en M-Files |
| **Cargado**    | Subido a M-Files, ciclo digital cerrado                |
| **Descartado** | Sin valor documental, no se procesará                  |

### Ciclo físico (papel)

```
Pendiente → Destruir → Destrucción confirmada
    ↓
Pendiente → Archivar → Almacenamiento confirmado
```

| Estado                        | Significado                     |
| ----------------------------- | ------------------------------- |
| **Pendiente**                 | Sin decisión sobre el papel     |
| **Destruir**                  | Programado para destrucción     |
| **Destrucción confirmada**    | Papel destruido, ciclo cerrado  |
| **Archivar**                  | Programado para almacenamiento  |
| **Almacenamiento confirmado** | Papel almacenado, ciclo cerrado |

---

## Trazabilidad

El sistema registra en cada etapa:

- **Quién** realizó la acción (usuario)
- **Cuándo** se realizó (fecha y hora)
- **Qué** se decidió (clasificación, motivo de descarte, disposición física)

Esto permite auditar el proceso completo desde el escaneo hasta la disposición final, tanto del archivo digital como del papel original.

---

## Clasificación de documentos

Los documentos se organizan en una estructura de dos niveles:

- **Clase de documento** (nivel 1) — Agrupa por especialidad o categoría general
  - Ejemplo: _Instrumentación_, _Mecánica_, _Civil_, _Eléctrica_
- **Tipo de documento** (nivel 2) — Define el tipo específico dentro de una clase
  - Ejemplo: _Plano_, _Procedimiento_, _Informe_, _Data Sheet_

Adicionalmente, cada archivo se asocia a un **Área de planta** que representa la ubicación física o zona de la instalación a la que refiere el documento.

---

## Dashboards y seguimiento

El sistema proporciona estadísticas en tiempo real del proceso:

- Total de archivos por estado digital (pendientes, aceptados, cargados, descartados)
- Total de archivos por estado físico (pendientes, programados, confirmados)
- Avance general del proyecto de digitalización

Esto permite al equipo y al cliente tener visibilidad completa del progreso sin necesidad de reportes manuales.
