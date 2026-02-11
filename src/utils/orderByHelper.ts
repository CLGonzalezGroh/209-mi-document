import { DocumentOrderByInput } from "../resolvers/documents.js"
import { DocumentTypeOrderByInput } from "../resolvers/documentTypes.js"
import { TransmittalOrderByInput } from "../resolvers/transmittals.js"

// Mapeo de campos GraphQL a campos de Prisma para documentos
const documentFieldMap: Record<string, string> = {
  CODE: "code",
  TITLE: "title",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
  MODULE: "module",
}

const documentTypeFieldMap: Record<string, string> = {
  NAME: "name",
  CODE: "code",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
}

const transmittalFieldMap: Record<string, string> = {
  CODE: "code",
  CREATED_AT: "createdAt",
  ISSUED_AT: "issuedAt",
  STATUS: "status",
}

export function buildDocumentOrderBy(
  orderBy?: DocumentOrderByInput,
): Record<string, string> | undefined {
  if (!orderBy) return undefined
  const field = documentFieldMap[orderBy.field]
  if (!field) return undefined
  return { [field]: orderBy.direction.toLowerCase() }
}

export function buildDocumentTypeOrderBy(
  orderBy?: DocumentTypeOrderByInput,
): Record<string, string> | undefined {
  if (!orderBy) return undefined
  const field = documentTypeFieldMap[orderBy.field]
  if (!field) return undefined
  return { [field]: orderBy.direction.toLowerCase() }
}

export function buildTransmittalOrderBy(
  orderBy?: TransmittalOrderByInput,
): Record<string, string> | undefined {
  if (!orderBy) return undefined
  const field = transmittalFieldMap[orderBy.field]
  if (!field) return undefined
  return { [field]: orderBy.direction.toLowerCase() }
}
