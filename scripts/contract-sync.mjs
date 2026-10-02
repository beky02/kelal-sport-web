#!/usr/bin/env node
/**
 * Copies the API contract and the backend's docs from the backend repo, which
 * owns them, and regenerates the TypeScript types. The copies in this repo
 * (contracts/, docs/backend/) are never edited by hand.
 *
 *   pnpm contract:sync                 # from CONTRACTS_SOURCE or ../../kelal backend/contracts
 *   pnpm contract:sync --check         # exit 1 if the copy differs from the source
 *
 * Only the backend docs the frontend reads are copied (DOCS_KEEP below).
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

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
 * The backend docs the frontend reads (CLAUDE.md "Sources of truth" and the
 * task files' "Read first"): the engineering decisions, the build plan's
 * frontend track, the API standards, the component pages the screens are
 * built against, and the product docs. The backend's own task files, its
 * implementation guide and the infrastructure pages stay in the backend repo.
 * Paths are relative to the backend's docs/ folder; a trailing slash keeps a
 * whole folder.
 */
const DOCS_KEEP = [
  "engineering-decisions.md",
  "build-plan.md",
  "product/",
  "design/td-01-api-standards.md",
  "design/components/c01-identity-auth.md",
  "design/components/c02-kyc.md",
  "design/components/c03-wallet-ledger.md",
  "design/components/c04-payments.md",
  "design/components/c06-sports-catalogue.md",
  "design/components/c07-slip-calculator.md",
  "design/components/c08-bet-placement-risk.md",
  "design/components/c09-booking-codes.md",
  "design/components/c11-bonuses.md",
  "design/components/c12-rg-aml.md",
  "design/components/c13-reporting-audit.md",
  "design/components/c14-notifications.md",
  "design/components/c15-back-office-trading.md",
  "design/components/c16-config-tenancy.md",
  "design/components/c18-client-apps.md",
  "design/components/c19-retail-network.md",
];

const keepDoc = (rel) =>
  DOCS_KEEP.some((keep) =>
    keep.endsWith("/") ? rel.startsWith(keep) : rel === keep,
  );

/**
 * What is copied from the backend repo, which owns both: the API contract, and
 * the docs that explain it. This repo reads only its own copies.
 */
const pairs = [
  { from: source, to: target, name: "contracts/", keep: () => true },
  {
    from: join(source, "..", "docs"),
    to: join(root, "docs", "backend"),
    name: "docs/backend/",
    keep: keepDoc,
  },
];

if (check) {
  let behind = false;
  for (const { from, to, name, keep } of pairs) {
    if (!existsSync(from)) continue;
    const differ = files(from)
      .map((path) => relative(from, path))
      .filter(keep)
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

for (const { from, to, keep } of pairs) {
  if (!existsSync(from)) continue;
  for (const path of files(from)) {
    const rel = relative(from, path);
    if (!keep(rel)) continue;
    mkdirSync(dirname(join(to, rel)), { recursive: true });
    cpSync(path, join(to, rel));
  }
}
execFileSync("pnpm", ["api:types"], { cwd: root, stdio: "inherit" });
console.log(
  `Synced contracts/ and docs/backend/ from the backend. Review \`git diff contracts docs/backend src/lib/api/schema.d.ts\`.`,
);
