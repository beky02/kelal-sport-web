#!/usr/bin/env node
// SessionStart: tell Claude the branch, any task mid-flight and whether the mock
// API is up, so a resumed or compacted session picks up where it left off.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const root = resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || ".");
const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const lines = [
  `Git branch: ${git("rev-parse", "--abbrev-ref", "HEAD") || "unknown"}.`,
];

const unmerged = git(
  "branch",
  "--list",
  "task/*",
  "--no-merged",
  "main",
  "--format=%(refname:short)",
)
  .split("\n")
  .filter(Boolean);
if (unmerged.length)
  lines.push(`Unmerged task branches: ${unmerged.join(", ")}.`);

const tasksDir = join(root, "docs", "tasks");
const active = (
  existsSync(tasksDir) ? readdirSync(tasksDir, { withFileTypes: true }) : []
)
  .filter((f) => f.isFile() && /^F\d+[a-z]?-.*\.md$/.test(f.name))
  .flatMap((f) => {
    const status = readFileSync(join(tasksDir, f.name), "utf8").match(
      /^status:\s*(\S+)/m,
    )?.[1];
    return status &&
      ["planned", "in_progress", "verifying", "blocked"].includes(status)
      ? [`${f.name.replace(/\.md$/, "")} (${status})`]
      : [];
  });
if (active.length) {
  lines.push(
    `Tasks in flight: ${active.join(", ")}. Read docs/tasks/<id>/plan.md and verification.md before continuing; resume with /task <id>.`,
  );
}

try {
  const res = await fetch("http://localhost:4010/v1/sports", {
    // Node sends `Accept-Language: *`, which the contract (am | en) rejects.
    headers: { "X-Tenant-Id": "demo", "Accept-Language": "en" },
    signal: AbortSignal.timeout(1500),
  });
  lines.push(
    res.ok
      ? "Prism mock is up on :4010."
      : `Prism on :4010 answered ${res.status}.`,
  );
} catch {
  lines.push(
    "Prism mock is NOT reachable on :4010 — `make up` in the backend, or `pnpm mock`.",
  );
}

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: lines.join(" "),
    },
  }),
);
