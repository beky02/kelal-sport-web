#!/usr/bin/env node
/**
 * Copies the API contract and the backend's docs from the backend repo, which
 * owns them, and regenerates the TypeScript types. The copies in this repo
 * (contracts/, docs/backend/) are never edited by hand.
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

/**
 * What is copied from the backend repo, which owns both: the API contract, and
 * the docs that explain it (engineering decisions, design pages, product docs).
 * This repo reads only its own copies.
 */
const pairs = [
  { from: source, to: target, name: "contracts/" },
  {
    from: join(source, "..", "docs"),
    to: join(root, "docs", "backend"),
    name: "docs/backend/",
  },
];

if (check) {
  let behind = false;
  for (const { from, to, name } of pairs) {
    if (!existsSync(from)) continue;
    const differ = files(from)
      .map((path) => relative(from, path))
      .filter((rel) => {
        const mine = join(to, rel);
        return (
          !existsSync(mine) ||
          !readFileSync(mine).equals(readFileSync(join(from, rel)))
        );
      });
    if (differ.length > 0) {
      behind = true;
      console.error(
        `${name} is behind the backend (${differ.join(", ")}). Run: pnpm contract:sync`,
      );
    } else {
      console.log(`${name} matches the backend.`);
    }
  }
  process.exit(behind ? 1 : 0);
}

for (const { from, to } of pairs) {
  if (!existsSync(from)) continue;
  cpSync(from, to, {
    recursive: true,
    filter: (path) => !skip(path.split("/").pop()),
  });
}
execFileSync("pnpm", ["api:types"], { cwd: root, stdio: "inherit" });
console.log(
  `Synced contracts/ and docs/backend/ from the backend. Review \`git diff contracts docs/backend src/lib/api/schema.d.ts\`.`,
);
