/**
 * Versiones — sin operaciones propias (BLOQUE 03B, B12).
 *
 * `registerVersion` se retiró: la versión dejó de ser un archivo y pasó a ser un
 * CONJUNTO, y con eso "registrar la versión" dejó de ser un acto único. La
 * produce ahora `confirmWorkingCopy`, que además admite el conjunto completo en
 * un solo acto para quien no necesite acumular.
 *
 * El archivo se conserva porque el objeto sigue existiendo: sus lecturas viven
 * en `resolversTypes`, y dejar el módulo vacío en lugar de borrarlo declara que
 * la ausencia de operaciones es una decisión y no un olvido (H-34).
 */
export const versionResolvers = {
  Mutation: {},
}
