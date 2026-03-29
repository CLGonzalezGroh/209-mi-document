import { GraphQLResolverMap } from "@apollo/subgraph/dist/schema-helper/index.js"
import { DocumentNode } from "graphql"
import { IncomingHttpHeaders } from "http"
import type { PrismaClient } from "./generated/prisma/client.js"

// Definición del módulo de esquema GraphQL
export interface GraphQLSchemaModule {
  typeDefs: DocumentNode
  resolvers?: GraphQLResolverMap<any> //note the `any` here
}

// Tipo para el contexto de los resolutores
export type ResolverContext = {
  orm: PrismaClient
  token: IncomingHttpHeaders["authorization"]
}
