import { PERMISSIONS } from "@CLGonzalezGroh/mi-common"
import { DocObjectType } from "../generated/prisma/enums.js"

/**
 * Catálogo de eventos de dominio del subsistema de Gestión Documental (Bloque 01).
 *
 * Convención de nombres (B5):
 * - acciones de auditoría: verbo en inglés imperativo, PascalCase;
 * - nombres de transición: participio, PascalCase.
 *
 * Se usan como constantes con nombre —`AuditAction.CreateDocument`—, nunca como
 * texto libre en el resolver. Cada constante corresponde a un único tipo de objeto,
 * de modo que el tipo se deriva del catálogo y no lo informa quien emite.
 */

// ================================
// ACCIONES — DocAuditEvent
// ================================

export const AuditAction = {
  CreateDocument: "CreateDocument",
  UpdateDocument: "UpdateDocument",
  TerminateDocument: "TerminateDocument",
  ActivateDocument: "ActivateDocument",
  CreateRevision: "CreateRevision",
  // `RegisterVersion` se retira con su operación (BLOQUE 03B, B12): la versión
  // dejó de ser un archivo y pasó a ser un conjunto, de modo que registrarla
  // dejó de ser un acto único. La reemplazan las cuatro de la copia de trabajo.
  ApproveStep: "ApproveStep",
  RejectStep: "RejectStep",
  CancelWorkflow: "CancelWorkflow",
  CreateTransmittal: "CreateTransmittal",
  IssueTransmittal: "IssueTransmittal",
  CloseTransmittal: "CloseTransmittal",
  CreateDocumentClass: "CreateDocumentClass",
  UpdateDocumentClass: "UpdateDocumentClass",
  TerminateDocumentClass: "TerminateDocumentClass",
  ActivateDocumentClass: "ActivateDocumentClass",
  DeleteDocumentClass: "DeleteDocumentClass",
  CreateDocumentType: "CreateDocumentType",
  UpdateDocumentType: "UpdateDocumentType",
  TerminateDocumentType: "TerminateDocumentType",
  ActivateDocumentType: "ActivateDocumentType",
  DeleteDocumentType: "DeleteDocumentType",

  // Contexto de proyecto (BLOQUE 02)
  DeclareProjectSettings: "DeclareProjectSettings",
  AssignProjectMember: "AssignProjectMember",
  RevokeProjectMember: "RevokeProjectMember",

  // Ciclo interno (BLOQUE 03).
  //
  // `InitiateReview` se retira con la operación que la emitía: someter dejó de
  // ser "crear el circuito" y pasó a ser "completar el paso de elaboración",
  // que es lo que efectivamente ocurre (B1). La reemplazan `DefineWorkflow` y
  // `SubmitRevision`.
  //
  // `SwitchRevisionScheme` se retira porque el esquema dejó de persistirse: no
  // hay nada que cambiar, el esquema se elige al crear cada revisión (B13).
  DefineWorkflow: "DefineWorkflow",
  SubmitRevision: "SubmitRevision",
  AcknowledgeStep: "AcknowledgeStep",
  ReassignStep: "ReassignStep",
  AbandonRevision: "AbandonRevision",
  CreateWorkflowTemplate: "CreateWorkflowTemplate",
  UpdateWorkflowTemplate: "UpdateWorkflowTemplate",
  DeleteWorkflowTemplate: "DeleteWorkflowTemplate",
  DeclareDocSettings: "DeclareDocSettings",

  // Titularidad por nivel (BLOQUE 03B).
  //
  // `UpdateRevisionMetadata` es donde ahora se edita la identificación: vive en
  // la revisión porque está impresa en el rótulo (B1). `UpdateDocument` queda
  // para lo administrativo, que no se congela.
  //
  // `CorrectDocumentCode` tiene acción propia y no es un `UpdateDocument` más:
  // es la IDENTIDAD cambiando, y sin evento sería inexplicable en una auditoría
  // posterior (B4).
  UpdateRevisionMetadata: "UpdateRevisionMetadata",
  CorrectDocumentCode: "CorrectDocumentCode",
  ReplaceDocuments: "ReplaceDocuments",
  ObsoleteDocument: "ObsoleteDocument",
  OpenWorkingCopy: "OpenWorkingCopy",
  UpdateWorkingCopy: "UpdateWorkingCopy",
  ConfirmWorkingCopy: "ConfirmWorkingCopy",
  DiscardWorkingCopy: "DiscardWorkingCopy",

  // Emisión y respuesta (BLOQUE 04). El catálogo de calificaciones es
  // configuración del contrato: quién agregó o dio de baja una calificación
  // explica por qué una respuesta pudo registrarse con ese valor.
  // `RespondTransmittal` se retira con su operación (BLOQUE 04, B5): responder
  // dejó de ser un acto sobre el transmittal —que actualizaba sus ítems en
  // lote— y pasó a ser un acto sobre el DOCUMENTO emitido. Las reemplazan
  // `RegisterItemResponse` y `CorrectItemResponse`.
  AddTransmittalItem: "AddTransmittalItem",
  RemoveTransmittalItem: "RemoveTransmittalItem",
  CreateQualification: "CreateQualification",
  UpdateQualification: "UpdateQualification",
  TerminateQualification: "TerminateQualification",
  ActivateQualification: "ActivateQualification",

  // La respuesta de la contraparte (B5). Corregirla tiene acción propia y no es
  // un registro más: nadie la firma, de modo que se corrige, y sin evento la
  // diferencia entre lo que el cliente dijo y lo que quedó registrado sería
  // indemostrable.
  AcknowledgeTransmittal: "AcknowledgeTransmittal",
  RegisterItemResponse: "RegisterItemResponse",
  CorrectItemResponse: "CorrectItemResponse",

  // Ubicación física (BLOQUE 02B). Mover tiene acción propia y no es un
  // `UpdateLocation` más: reescribe la ruta de toda una rama, de modo que sin
  // registro del movimiento los cambios de nodos que nadie tocó serían
  // inexplicables después.
  CreateLocation: "CreateLocation",
  UpdateLocation: "UpdateLocation",
  MoveLocation: "MoveLocation",
  TerminateLocation: "TerminateLocation",
  ActivateLocation: "ActivateLocation",
  DeleteLocation: "DeleteLocation",
} as const

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction]

export const AUDIT_ACTIONS = Object.values(AuditAction)

export const AUDIT_ACTION_OBJECT: Record<AuditAction, DocObjectType> = {
  [AuditAction.CreateDocument]: DocObjectType.DOCUMENT,
  [AuditAction.UpdateDocument]: DocObjectType.DOCUMENT,
  [AuditAction.TerminateDocument]: DocObjectType.DOCUMENT,
  [AuditAction.ActivateDocument]: DocObjectType.DOCUMENT,
  [AuditAction.CreateRevision]: DocObjectType.DOCUMENT_REVISION,
  [AuditAction.ApproveStep]: DocObjectType.REVIEW_STEP,
  [AuditAction.RejectStep]: DocObjectType.REVIEW_STEP,
  [AuditAction.CancelWorkflow]: DocObjectType.REVIEW_WORKFLOW,
  [AuditAction.CreateTransmittal]: DocObjectType.TRANSMITTAL,
  [AuditAction.IssueTransmittal]: DocObjectType.TRANSMITTAL,
  [AuditAction.CloseTransmittal]: DocObjectType.TRANSMITTAL,
  [AuditAction.CreateDocumentClass]: DocObjectType.DOCUMENT_CLASS,
  [AuditAction.UpdateDocumentClass]: DocObjectType.DOCUMENT_CLASS,
  [AuditAction.TerminateDocumentClass]: DocObjectType.DOCUMENT_CLASS,
  [AuditAction.ActivateDocumentClass]: DocObjectType.DOCUMENT_CLASS,
  [AuditAction.DeleteDocumentClass]: DocObjectType.DOCUMENT_CLASS,
  [AuditAction.CreateDocumentType]: DocObjectType.DOCUMENT_TYPE,
  [AuditAction.UpdateDocumentType]: DocObjectType.DOCUMENT_TYPE,
  [AuditAction.TerminateDocumentType]: DocObjectType.DOCUMENT_TYPE,
  [AuditAction.ActivateDocumentType]: DocObjectType.DOCUMENT_TYPE,
  [AuditAction.DeleteDocumentType]: DocObjectType.DOCUMENT_TYPE,
  [AuditAction.DeclareProjectSettings]: DocObjectType.DOC_PROJECT_SETTINGS,
  [AuditAction.AssignProjectMember]: DocObjectType.DOC_PROJECT_MEMBER,
  [AuditAction.RevokeProjectMember]: DocObjectType.DOC_PROJECT_MEMBER,

  // Ciclo interno (BLOQUE 03). Definir el circuito, someter, acusar y reasignar
  // son actos sobre un PASO, que es el objeto que cambia: el armado se completa,
  // la elaboración se completa, el acuse se cierra y la reasignación cambia su
  // actor sin alterar su estado.
  [AuditAction.DefineWorkflow]: DocObjectType.REVIEW_STEP,
  [AuditAction.SubmitRevision]: DocObjectType.REVIEW_STEP,
  [AuditAction.AcknowledgeStep]: DocObjectType.REVIEW_STEP,
  [AuditAction.ReassignStep]: DocObjectType.REVIEW_STEP,
  [AuditAction.AbandonRevision]: DocObjectType.DOCUMENT_REVISION,
  [AuditAction.CreateWorkflowTemplate]: DocObjectType.DOC_WORKFLOW_TEMPLATE,
  [AuditAction.UpdateWorkflowTemplate]: DocObjectType.DOC_WORKFLOW_TEMPLATE,
  [AuditAction.DeleteWorkflowTemplate]: DocObjectType.DOC_WORKFLOW_TEMPLATE,
  [AuditAction.DeclareDocSettings]: DocObjectType.DOC_SETTINGS,

  // Titularidad por nivel (BLOQUE 03B). El objeto es el que CAMBIA: la revisión
  // cuando se edita su identificación, el documento cuando se corrige su código
  // o caduca, y la revisión cuando se opera su copia de trabajo —la copia no es
  // un objeto del dominio sino el conjunto en preparación de esa revisión—.
  [AuditAction.UpdateRevisionMetadata]: DocObjectType.DOCUMENT_REVISION,
  [AuditAction.CorrectDocumentCode]: DocObjectType.DOCUMENT,
  [AuditAction.ReplaceDocuments]: DocObjectType.DOC_REPLACEMENT,
  [AuditAction.ObsoleteDocument]: DocObjectType.DOCUMENT,
  [AuditAction.OpenWorkingCopy]: DocObjectType.DOCUMENT_REVISION,
  [AuditAction.UpdateWorkingCopy]: DocObjectType.DOCUMENT_REVISION,
  [AuditAction.ConfirmWorkingCopy]: DocObjectType.DOCUMENT_REVISION,
  [AuditAction.DiscardWorkingCopy]: DocObjectType.DOCUMENT_REVISION,

  // Emisión y respuesta (BLOQUE 04)
  // Agregar y quitar un documento son actos sobre el TRANSMITTAL, que es lo
  // que cambia de contenido. Quitar además libera la revisión para otra carpeta,
  // y sin registro esa liberación sería inexplicable después.
  [AuditAction.AddTransmittalItem]: DocObjectType.TRANSMITTAL,
  [AuditAction.RemoveTransmittalItem]: DocObjectType.TRANSMITTAL,
  [AuditAction.CreateQualification]: DocObjectType.DOC_QUALIFICATION,
  [AuditAction.UpdateQualification]: DocObjectType.DOC_QUALIFICATION,
  [AuditAction.TerminateQualification]: DocObjectType.DOC_QUALIFICATION,
  [AuditAction.ActivateQualification]: DocObjectType.DOC_QUALIFICATION,
  [AuditAction.AcknowledgeTransmittal]: DocObjectType.TRANSMITTAL,
  [AuditAction.RegisterItemResponse]: DocObjectType.DOC_TRANSMITTAL_RESPONSE,
  [AuditAction.CorrectItemResponse]: DocObjectType.DOC_TRANSMITTAL_RESPONSE,

  // Ubicación física (BLOQUE 02B)
  [AuditAction.CreateLocation]: DocObjectType.DOC_LOCATION,
  [AuditAction.UpdateLocation]: DocObjectType.DOC_LOCATION,
  [AuditAction.MoveLocation]: DocObjectType.DOC_LOCATION,
  [AuditAction.TerminateLocation]: DocObjectType.DOC_LOCATION,
  [AuditAction.ActivateLocation]: DocObjectType.DOC_LOCATION,
  [AuditAction.DeleteLocation]: DocObjectType.DOC_LOCATION,
}

// ================================
// TRANSICIONES — DocWorkflowEvent
// ================================

export const WorkflowEvent = {
  DocumentTerminated: "DocumentTerminated",
  DocumentActivated: "DocumentActivated",
  RevisionCreated: "RevisionCreated",
  RevisionSubmitted: "RevisionSubmitted",
  RevisionApproved: "RevisionApproved",
  RevisionSuperseded: "RevisionSuperseded",
  RevisionReturned: "RevisionReturned",
  WorkflowStarted: "WorkflowStarted",
  WorkflowCompleted: "WorkflowCompleted",
  WorkflowRejected: "WorkflowRejected",
  StepApproved: "StepApproved",
  StepRejected: "StepRejected",
  StepSkipped: "StepSkipped",
  TransmittalCreated: "TransmittalCreated",
  TransmittalIssued: "TransmittalIssued",
  TransmittalResponded: "TransmittalResponded",
  TransmittalClosed: "TransmittalClosed",
  DocumentClassTerminated: "DocumentClassTerminated",
  DocumentClassActivated: "DocumentClassActivated",
  DocumentTypeTerminated: "DocumentTypeTerminated",
  DocumentTypeActivated: "DocumentTypeActivated",

  // Ciclo interno (BLOQUE 03)
  //
  // `WorkflowCancelled` separa la cancelación del rechazo, que hasta ahora
  // compartían transición: era la confusión de H-05 trasladada a la traza.
  // `StepCompleted` acompaña al estado terminal de los pasos que se cumplen sin
  // juzgar (B8), que no pueden emitir `StepApproved`.
  WorkflowCancelled: "WorkflowCancelled",
  RevisionAbandoned: "RevisionAbandoned",
  // La revisión que la contraparte rechazó en modo Receptor (BLOQUE 04, B12).
  // No es `RevisionReturned`: ahí el trabajo vuelve al elaborador, y acá el
  // elaborador está afuera y la revisión concluye.
  RevisionRejected: "RevisionRejected",
  StepCompleted: "StepCompleted",

  // Titularidad por nivel (BLOQUE 03B). `DocumentObsoleted` es una transición y
  // no solo una acción: el documento deja de admitir revisiones nuevas, que es
  // un cambio de estado y no una edición.
  DocumentObsoleted: "DocumentObsoleted",
  VersionRegistered: "VersionRegistered",

  // Emisión y respuesta (BLOQUE 04). La baja de una calificación es una
  // transición y no solo una edición: deja de estar disponible para calificar,
  // sin revalidar lo ya calificado.
  // El acuse es una transición del transmittal, y no solo un registro: el
  // envío pasa a estar recibido. Es lo que le faltaba a H-12 —el estado existía
  // y ninguna operación lo asignaba—.
  TransmittalAcknowledged: "TransmittalAcknowledged",
  QualificationTerminated: "QualificationTerminated",
  QualificationActivated: "QualificationActivated",

  // Ubicación física (BLOQUE 02B). La baja de un nodo es una transición: deja de
  // estar disponible para clasificar, sin revalidar lo ya clasificado.
  LocationTerminated: "LocationTerminated",
  LocationActivated: "LocationActivated",
} as const

export type WorkflowEvent = (typeof WorkflowEvent)[keyof typeof WorkflowEvent]

export const WORKFLOW_EVENTS = Object.values(WorkflowEvent)

export const WORKFLOW_EVENT_OBJECT: Record<WorkflowEvent, DocObjectType> = {
  [WorkflowEvent.DocumentTerminated]: DocObjectType.DOCUMENT,
  [WorkflowEvent.DocumentActivated]: DocObjectType.DOCUMENT,
  [WorkflowEvent.RevisionCreated]: DocObjectType.DOCUMENT_REVISION,
  [WorkflowEvent.RevisionSubmitted]: DocObjectType.DOCUMENT_REVISION,
  [WorkflowEvent.RevisionApproved]: DocObjectType.DOCUMENT_REVISION,
  [WorkflowEvent.RevisionSuperseded]: DocObjectType.DOCUMENT_REVISION,
  [WorkflowEvent.RevisionReturned]: DocObjectType.DOCUMENT_REVISION,
  [WorkflowEvent.WorkflowStarted]: DocObjectType.REVIEW_WORKFLOW,
  [WorkflowEvent.WorkflowCompleted]: DocObjectType.REVIEW_WORKFLOW,
  [WorkflowEvent.WorkflowRejected]: DocObjectType.REVIEW_WORKFLOW,
  [WorkflowEvent.StepApproved]: DocObjectType.REVIEW_STEP,
  [WorkflowEvent.StepRejected]: DocObjectType.REVIEW_STEP,
  [WorkflowEvent.StepSkipped]: DocObjectType.REVIEW_STEP,
  [WorkflowEvent.TransmittalCreated]: DocObjectType.TRANSMITTAL,
  [WorkflowEvent.TransmittalIssued]: DocObjectType.TRANSMITTAL,
  [WorkflowEvent.TransmittalResponded]: DocObjectType.TRANSMITTAL,
  [WorkflowEvent.TransmittalClosed]: DocObjectType.TRANSMITTAL,
  [WorkflowEvent.DocumentClassTerminated]: DocObjectType.DOCUMENT_CLASS,
  [WorkflowEvent.DocumentClassActivated]: DocObjectType.DOCUMENT_CLASS,
  [WorkflowEvent.DocumentTypeTerminated]: DocObjectType.DOCUMENT_TYPE,
  [WorkflowEvent.DocumentTypeActivated]: DocObjectType.DOCUMENT_TYPE,
  [WorkflowEvent.WorkflowCancelled]: DocObjectType.REVIEW_WORKFLOW,
  [WorkflowEvent.RevisionAbandoned]: DocObjectType.DOCUMENT_REVISION,
  [WorkflowEvent.RevisionRejected]: DocObjectType.DOCUMENT_REVISION,
  [WorkflowEvent.StepCompleted]: DocObjectType.REVIEW_STEP,
  [WorkflowEvent.DocumentObsoleted]: DocObjectType.DOCUMENT,
  [WorkflowEvent.VersionRegistered]: DocObjectType.DOCUMENT_VERSION,
  [WorkflowEvent.TransmittalAcknowledged]: DocObjectType.TRANSMITTAL,
  [WorkflowEvent.QualificationTerminated]: DocObjectType.DOC_QUALIFICATION,
  [WorkflowEvent.QualificationActivated]: DocObjectType.DOC_QUALIFICATION,
  [WorkflowEvent.LocationTerminated]: DocObjectType.DOC_LOCATION,
  [WorkflowEvent.LocationActivated]: DocObjectType.DOC_LOCATION,
}

// ================================
// ACCESO A LA TRAZA
// ================================

/**
 * Permiso exigido para consultar la traza de cada tipo de objeto.
 *
 * La traza forma parte del objeto: quien puede leer el objeto puede leer su
 * historia. No se introduce un permiso propio de eventos, que obligaría a
 * modificar el catálogo compartido de permisos y a otorgarlo por separado.
 */
export const DOC_OBJECT_READ_PERMISSION: Record<DocObjectType, string> = {
  [DocObjectType.DOCUMENT]: PERMISSIONS.DOCUMENTS_DOCUMENT_READ,
  [DocObjectType.DOCUMENT_REVISION]: PERMISSIONS.DOCUMENTS_DOCUMENT_READ,
  [DocObjectType.DOCUMENT_VERSION]: PERMISSIONS.DOCUMENTS_DOCUMENT_READ,
  [DocObjectType.REVIEW_WORKFLOW]: PERMISSIONS.DOCUMENTS_WORKFLOW_LIST,
  [DocObjectType.REVIEW_STEP]: PERMISSIONS.DOCUMENTS_WORKFLOW_LIST,
  [DocObjectType.TRANSMITTAL]: PERMISSIONS.DOCUMENTS_TRANSMITTAL_READ,
  [DocObjectType.DOCUMENT_CLASS]: PERMISSIONS.DOCUMENTS_DOCUMENT_CLASS_READ,
  [DocObjectType.DOCUMENT_TYPE]: PERMISSIONS.DOCUMENTS_DOCUMENT_TYPE_READ,
  [DocObjectType.DOC_PROJECT_SETTINGS]: PERMISSIONS.DOCUMENTS_PROJECT_SETTINGS_READ,
  [DocObjectType.DOC_PROJECT_MEMBER]: PERMISSIONS.DOCUMENTS_PROJECT_MEMBER_READ,
  // La firma es parte del circuito y se lee con él; la plantilla también, porque
  // es la propuesta del armado. La configuración del despliegue tiene su recurso
  // propio desde BLOQUE 03.
  [DocObjectType.DOC_STEP_SIGNATURE]: PERMISSIONS.DOCUMENTS_WORKFLOW_LIST,
  [DocObjectType.DOC_WORKFLOW_TEMPLATE]: PERMISSIONS.DOCUMENTS_WORKFLOW_LIST,
  [DocObjectType.DOC_SETTINGS]: PERMISSIONS.DOCUMENTS_SETTINGS_READ,
  // El acto de reemplazo se lee con los documentos que toca: la traza forma
  // parte del objeto, y quien puede leer el documento puede leer su historia.
  [DocObjectType.DOC_REPLACEMENT]: PERMISSIONS.DOCUMENTS_DOCUMENT_READ,
  // El catálogo de calificaciones tiene recurso propio: administrarlo es
  // configurar el contrato, distinto de operar los documentos que califica.
  [DocObjectType.DOC_QUALIFICATION]: PERMISSIONS.DOCUMENTS_QUALIFICATION_READ,
  // La respuesta se lee con el transmittal por el que el documento salió: la
  // traza forma parte del objeto.
  [DocObjectType.DOC_TRANSMITTAL_RESPONSE]: PERMISSIONS.DOCUMENTS_TRANSMITTAL_READ,
  // La ubicación tiene recurso propio: administrar el árbol de la instalación es
  // distinto de operar los documentos que se clasifican con él.
  [DocObjectType.DOC_LOCATION]: PERMISSIONS.DOCUMENTS_LOCATION_READ,
}