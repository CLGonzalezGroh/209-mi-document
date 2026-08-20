-- BLOQUE 02D, fase 6 — La unicidad del código se discrimina por módulo (B5, B6).
--
-- `Document` resolvía la unicidad de su código con dos índices únicos parciales
-- cuya condición era **el nulo de la columna de alcance**: único por proyecto
-- donde había proyecto, único por módulo donde no. Funcionaba porque el
-- invariante de D-06 exige alcance cuando `module = 'PROJECTS'`, de modo que
-- las dos condiciones coincidían — pero el régimen quedaba expresado por una
-- columna anulable en lugar de por el discriminador que lo nombra.
--
-- Los dos regímenes, dichos de frente:
--
--   Circulación  → UNIQUE (code, docProjectId) WHERE module  = 'PROJECTS'
--   Publicación  → UNIQUE (code, module)       WHERE module <> 'PROJECTS'
--
-- **Consecuencia declarada, y deliberada: dos contratos de la misma obra pueden
-- repetir el código de documento.** La unicidad es por contrato y no por obra.
-- Es lo correcto —son contrapartes distintas, y cada contratista numera su
-- documentación con su propia convención— y es la contracara exacta del N:1 de
-- la fase 4. Obligar a que los códigos no se repitieran entre contratos
-- hermanos sería imponerle a tres empresas una numeración común que ninguna
-- acordó.
--
-- D-24 no se toca: el código sigue siendo el identificador y sigue sin cambiar.
-- Lo que esta migración precisa es **dentro de qué ámbito** se exige único, que
-- es lo que aquella decisión ya dice.
--
-- Los dos nulos siguen viviendo en niveles distintos (B6): `documents.
-- docProjectId` nulo nombra el régimen de publicación; `doc_projects.projectId`
-- nulo dice que el contrato no tiene gestión PMI. No se tocan entre sí.
--
-- **Prisma no expresa índices parciales**, de modo que `migrate diff` no los ve
-- en ninguna dirección y lo que verifica estas dos reglas son las pruebas de
-- persistencia, no el diff.

DROP INDEX "documents_code_projectId_key";
DROP INDEX "documents_code_module_key";

-- Circulación: el código es único DENTRO DE SU CONTRATO.
CREATE UNIQUE INDEX "documents_code_docProjectId_key"
  ON "documents" ("code", "docProjectId")
  WHERE "module" = 'PROJECTS';

-- Publicación: el código es único dentro de su módulo. Dos módulos distintos
-- pueden publicar el mismo código sin conflicto.
CREATE UNIQUE INDEX "documents_code_module_key"
  ON "documents" ("code", "module")
  WHERE "module" <> 'PROJECTS';

-- ---------------------------------------------------------------------------
-- El CHECK que vuelve sano al discriminador nuevo
-- ---------------------------------------------------------------------------
--
-- **Sin esto, cambiar de discriminador abriría un hueco**, y conviene decir
-- exactamente cuál. Con la condición vieja —el nulo del alcance— un documento
-- de `module = 'PROJECTS'` SIN contrato caía en el índice de publicación y
-- quedaba cubierto por `UNIQUE (code, module)`. Con la condición nueva cae en
-- el de circulación, `UNIQUE (code, docProjectId)`, y **como Postgres trata los
-- nulos como distintos, ese documento no queda cubierto por ninguna unicidad**:
-- dos filas iguales entrarían las dos.
--
-- El invariante de D-06 —alcance obligatorio cuando `module = 'PROJECTS'`—
-- existía desde BLOQUE 02, pero **vivía solo en la aplicación**, de modo que la
-- base admitía la combinación que abre el hueco. Se vuelve estructura, que es
-- lo mismo que B1 hizo con la pertenencia al convertirla en clave foránea.
--
-- Es BICONDICIONAL, y por eso más fuerte que el de los catálogos: allá
-- `CHECK (docProjectId IS NULL OR module = 'PROJECTS')` solo impide el alcance
-- fuera de proyectos; acá hace falta además la dirección inversa, que es la que
-- garantiza que los dos índices parciales cubran juntos todas las filas.

DO $$
DECLARE
  filas INTEGER;
BEGIN
  SELECT COUNT(*) INTO filas
    FROM "documents"
   WHERE ("module" = 'PROJECTS' AND "docProjectId" IS NULL)
      OR ("module" <> 'PROJECTS' AND "docProjectId" IS NOT NULL);

  IF filas > 0 THEN
    RAISE EXCEPTION
      'BLOQUE 02D: hay % documentos donde el modulo y el alcance no coinciden. El invariante de D-06 vivia solo en la aplicacion y la base admitio la combinacion. Resolver antes de migrar.',
      filas;
  END IF;
END $$;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_module_scope_check"
  CHECK (
    ("module" =  'PROJECTS' AND "docProjectId" IS NOT NULL)
    OR
    ("module" <> 'PROJECTS' AND "docProjectId" IS NULL)
  );
