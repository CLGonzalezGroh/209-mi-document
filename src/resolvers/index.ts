import { GraphQLResolverMap } from "@apollo/subgraph/dist/schema-helper/index.js"
import { ResolverContext } from "../types.js"
import * as scalars from "../scalars/index.js"
import { resolverTypes } from "./resolversTypes/index.js"
import { documentResolvers } from "./documents.js"
import { documentTypeResolvers } from "./documentTypes.js"
import { revisionResolvers } from "./revisions.js"
import { replacementResolvers } from "./replacements.js"
import { workingCopyResolvers } from "./workingCopies.js"
import { versionResolvers } from "./versions.js"
import { workflowResolvers } from "./workflows.js"
import { transmittalResolvers } from "./transmittals.js"
import { documentSysLogResolvers } from "./documentSysLogs.js"
import { attachmentResolvers } from "./attachments.js"
import { scannedFileResolvers } from "./scannedFiles.js"
import { documentClassResolvers } from "./documentClasses.js"
import { areaResolvers } from "./areas.js"
import { dependencyResolvers } from "./dependencies.js"
import { taskDocumentReferenceResolvers } from "./taskDocumentReferences.js"
import { eventResolvers } from "./events.js"
import { projectSettingsResolvers } from "./projectSettings.js"
import { projectMemberResolvers } from "./projectMembers.js"
import { docSettingsResolvers } from "./docSettings.js"
import { workflowTemplateResolvers } from "./workflowTemplates.js"
import { qualificationResolvers } from "./qualifications.js"
import { locationResolvers } from "./locations.js"
import { catalogScopeResolvers } from "./catalogScopes.js"

export const resolvers: GraphQLResolverMap<ResolverContext> = {
  ...scalars,
  Query: {
    ...documentResolvers.Query,
    ...documentTypeResolvers.Query,
    ...documentClassResolvers.Query,
    ...areaResolvers.Query,
    ...revisionResolvers.Query,
    ...workflowResolvers.Query,
    ...transmittalResolvers.Query,
    ...documentSysLogResolvers.Query,
    ...attachmentResolvers.Query,
    ...scannedFileResolvers.Query,
    ...dependencyResolvers.Query,
    ...eventResolvers.Query,
    ...projectSettingsResolvers.Query,
    ...projectMemberResolvers.Query,
    ...docSettingsResolvers.Query,
    ...workflowTemplateResolvers.Query,
    ...qualificationResolvers.Query,
    ...locationResolvers.Query,
    ...catalogScopeResolvers.Query,
  },
  Mutation: {
    ...projectSettingsResolvers.Mutation,
    ...projectMemberResolvers.Mutation,
    ...documentResolvers.Mutation,
    ...documentTypeResolvers.Mutation,
    ...documentClassResolvers.Mutation,
    ...areaResolvers.Mutation,
    ...versionResolvers.Mutation,
    ...revisionResolvers.Mutation,
    ...replacementResolvers.Mutation,
    ...workingCopyResolvers.Mutation,
    ...workflowResolvers.Mutation,
    ...transmittalResolvers.Mutation,
    ...documentSysLogResolvers.Mutation,
    ...attachmentResolvers.Mutation,
    ...scannedFileResolvers.Mutation,
    ...taskDocumentReferenceResolvers.Mutation,
    ...docSettingsResolvers.Mutation,
    ...workflowTemplateResolvers.Mutation,
    ...qualificationResolvers.Mutation,
    ...locationResolvers.Mutation,
    ...catalogScopeResolvers.Mutation,
  },
  ...resolverTypes,
}
