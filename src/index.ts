import { ApolloServer } from "@apollo/server"
import { startStandaloneServer } from "@apollo/server/standalone"
import { buildSubgraphSchema } from "@apollo/subgraph"
import { readFileSync } from "fs"
import { gql } from "graphql-tag"
import { prisma } from "./lib/prisma.js"

const typeDefs = gql(readFileSync("./schema.graphql", { encoding: "utf-8" }))
import { resolvers } from "./resolvers/index.js"

const orm = prisma
const port = parseInt(process.env.PORT as string) || 4209

const server = new ApolloServer({
  schema: buildSubgraphSchema([
    {
      typeDefs,
      resolvers,
    },
  ]),
})

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => {
    const token = req.headers.authorization
    return { orm, token }
  },
  listen: { port },
})

console.log(`🚀  Server ready at: ${url}`)
