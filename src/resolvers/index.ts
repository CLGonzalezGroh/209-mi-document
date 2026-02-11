import { GraphQLResolverMap } from "@apollo/subgraph/dist/schema-helper"
import { ResolverContext } from "../types.js"
import * as scalars from "../scalars/index.js"
import { resolverTypes } from "./resolversTypes/index.js"
import { documentResolvers } from "./documents.js"
import { documentTypeResolvers } from "./documentTypes.js"
import { revisionResolvers } from "./revisions.js"
import { versionResolvers } from "./versions.js"
import { workflowResolvers } from "./workflows.js"
import { transmittalResolvers } from "./transmittals.js"
import { documentSysLogResolvers } from "./documentSysLogs.js"

export const resolvers: GraphQLResolverMap<ResolverContext> = {
  ...scalars,
  Query: {
    ...documentResolvers.Query,
    ...documentTypeResolvers.Query,
    ...revisionResolvers.Query,
    ...workflowResolvers.Query,
    ...transmittalResolvers.Query,
    ...documentSysLogResolvers.Query,
  },
  Mutation: {
    ...documentResolvers.Mutation,
    ...documentTypeResolvers.Mutation,
    ...versionResolvers.Mutation,
    ...revisionResolvers.Mutation,
    ...workflowResolvers.Mutation,
    ...transmittalResolvers.Mutation,
  },
  ...resolverTypes,
}
