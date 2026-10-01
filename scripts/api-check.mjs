#!/usr/bin/env node
/**
 * Fails when `src/lib/api/schema.d.ts` is not what `contracts/openapi.yaml`
 * generates — i.e. someone edited the generated file or forgot `pnpm api:types`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fresh = join(mkdtempSync(join(tmpdir(), "api-types-")), "schema.d.ts");

execFileSync(
  join(root, "node_modules/.bin/openapi-typescript"),
  ["contracts/openapi.yaml", "-o", fresh],
  { cwd: root, stdio: "ignore" },
);

if (
  !readFileSync(fresh).equals(
    readFileSync(join(root, "src/lib/api/schema.d.ts")),
  )
) {
  console.error(
    "src/lib/api/schema.d.ts is stale or hand-edited. Run: pnpm api:types",
  );
  process.exit(1);
}
console.log("Generated API types match contracts/openapi.yaml.");
