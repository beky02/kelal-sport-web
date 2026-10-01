#!/usr/bin/env node
/**
 * Copies the API contract from the backend repo, which owns it, and regenerates
 * the TypeScript types. The copy in this repo is never edited by hand.
 *
 *   pnpm contract:sync                 # from CONTRACTS_SOURCE or ../../kelal backend/contracts
 *   pnpm contract:sync --check         # exit 1 if the copy differs from the source
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(
  root,
  process.env.CONTRACTS_SOURCE ?? "../../kelal backend/contracts",
);
const target = join(root, "contracts");
const check = process.argv.includes("--check");

if (!existsSync(join(source, "openapi.yaml"))) {
  console.error(
    `No contract at ${source}. Set CONTRACTS_SOURCE to the backend repo's contracts/ folder.`,
  );
  process.exit(check ? 0 : 1); // --check is advisory where the backend is not checked out
}

const skip = (name) => name === "__pycache__" || name === ".DS_Store";

function files(dir) {
  return readdirSync(dir)
    .filter((name) => !skip(name))
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    });
}

if (check) {
  const differ = files(source)
    .map((path) => relative(source, path))
    .filter((rel) => {
      const mine = join(target, rel);
      return (
        !existsSync(mine) ||
        !readFileSync(mine).equals(readFileSync(join(source, rel)))
      );
    });
  if (differ.length > 0) {
    console.error(
      `contracts/ is behind the backend (${differ.join(", ")}). Run: pnpm contract:sync`,
    );
    process.exit(1);
  }
  console.log("contracts/ matches the backend.");
  process.exit(0);
}

cpSync(source, target, {
  recursive: true,
  filter: (path) => !skip(path.split("/").pop()),
});
execFileSync("pnpm", ["api:types"], { cwd: root, stdio: "inherit" });
console.log(
  `Synced contracts/ from ${source}. Review \`git diff contracts src/lib/api/schema.d.ts\`.`,
);
