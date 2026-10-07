#!/usr/bin/env node
// Stop: if code or config changed, run the fast gate (`pnpm check`). On failure,
// block the stop once and hand Claude the failure; a second stop in a row is
// allowed (stop_hook_active), so this never loops. CLAUDE_STOP_GATE=off disables it.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
if (input.stop_hook_active || process.env.CLAUDE_STOP_GATE === "off")
  process.exit(0);

const root = resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || ".");
const WATCHED = /\.(tsx?|mts|mjs|css|json)$/;

let changed = [];
try {
  changed = execFileSync("git", ["status", "--porcelain", "-uall"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.slice(3))
    .filter(Boolean);
} catch {
  process.exit(0);
}
if (!changed.some((file) => WATCHED.test(file))) process.exit(0);

const run = spawnSync("pnpm", ["check"], {
  cwd: root,
  encoding: "utf8",
  timeout: 590_000,
});
if (run.status === 0) process.exit(0);

const tail = `${run.stdout}\n${run.stderr}`
  .trim()
  .split("\n")
  .slice(-40)
  .join("\n");
console.log(
  JSON.stringify({
    decision: "block",
    reason: `\`pnpm check\` fails on uncommitted changes. Fix the root cause before finishing:\n${tail}`,
  }),
);
