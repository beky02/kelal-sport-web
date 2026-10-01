#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): run Prettier on the file just written, so
// formatting never fails the gate. Silent on success; respects .prettierignore.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const path = input.tool_input?.file_path;
if (!path || !/\.(tsx?|mts|mjs|jsx?|css|json|md)$/.test(path)) process.exit(0);

const root = resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || ".");
if (relative(root, resolve(path)).startsWith("..")) process.exit(0);

const prettier = join(root, "node_modules", ".bin", "prettier");
if (!existsSync(prettier)) process.exit(0);
try {
  execFileSync(
    prettier,
    ["--write", "--ignore-unknown", "--log-level", "warn", path],
    {
      cwd: root,
      stdio: "ignore",
    },
  );
} catch {
  // A syntax error shows up in the gate with a better message than Prettier's.
}
