import { GraphQLScalarType, Kind, ValueNode } from "graphql"

export const DateTime = new GraphQLScalarType({
  name: "DateTime",
  description: "Represents a date time object",
  serialize(value: any) {
    return value.toISOString() // Convert outgoing Date to ISOString for JSON
  },
  parseValue(value: any) {
    return new Date(value) // Convert incoming integer to Date
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10)) // Convert hard-coded AST string to integer and then to Date
    }
    return null // Invalid hard-coded value (not an integer)
  },
})

function parseLiteralJSON(ast: ValueNode): any {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value)
    case Kind.OBJECT: {
      const obj: Record<string, any> = {}
      ast.fields.forEach((field) => {
        obj[field.name.value] = parseLiteralJSON(field.value)
      })
      return obj
    }
    case Kind.LIST:
      return ast.values.map(parseLiteralJSON)
    case Kind.NULL:
      return null
    default:
      return null
  }
}

export const JSON = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value (metadata, configuración)",
  serialize: (value: any) => value,
  parseValue: (value: any) => value,
  parseLiteral: parseLiteralJSON,
})
