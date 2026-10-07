#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): block edits to the contract copy
// and generated files, ask before changing the workflow itself.
import { readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

const DENY = [
  [
    "contracts/",
    "This is a copy of the backend's contract. Change it in the backend repo (/contract-change there), then `pnpm contract:sync`. To ask for a change, use /contract-request.",
  ],
  [
    "src/lib/api/schema.d.ts",
    "Generated from contracts/openapi.yaml. Run `pnpm api:types`.",
  ],
];
const ASK = [
  [
    ".claude/",
    "This changes the Claude Code workflow, agents, hooks or permissions.",
  ],
  ["CLAUDE.md", "This changes the project instructions."],
  ["AGENTS.md", "This changes the project conventions."],
];

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!path) process.exit(0);

const root = resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || ".");
const rel = relative(root, resolve(path)).split("\\").join("/");
if (rel.startsWith("..")) process.exit(0); // outside the project: normal rules apply

const decide = () => {
  const name = basename(rel);
  if (name.startsWith(".env") && name !== ".env.example") {
    return ["deny", "Environment files hold secrets; edit them yourself."];
  }
  for (const [prefix, why] of DENY) {
    if (rel === prefix || rel.startsWith(prefix)) return ["deny", why];
  }
  for (const [prefix, why] of ASK) {
    if (rel === prefix || rel.startsWith(prefix))
      return ["ask", `${why} Confirm it is intended.`];
  }
  return null;
};

const verdict = decide();
if (verdict) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: verdict[0],
        permissionDecisionReason: `${rel}: ${verdict[1]}`,
      },
    }),
  );
}
