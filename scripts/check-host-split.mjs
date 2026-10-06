#!/usr/bin/env node
/**
 * F8a AC-4, on the production build: a player page loads nothing from
 * `(terminal)`, and the terminal loads nothing from the player's layout (FD1).
 *
 *   pnpm build && node scripts/check-host-split.mjs     # part of `pnpm verify`
 *
 * Reads every route's client reference manifest in `.next/server/app` — the
 * client modules a route uses, the chunks each lives in, and the chunks each
 * of its layouts and pages loads — and exits 1 with what it found otherwise.
 *
 * "The player's layout" is its client modules under `src/app/(player)/`
 * (`providers.tsx`) and the chunks that hold them; a library the terminal
 * imports itself in its own chunk (React Query, a store) is not counted. F8b,
 * which gives the terminal its own providers, decides what it may share.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const PLAYER = "/src/app/(player)/";
const TERMINAL = "/src/app/(terminal)/";

/** `/_next/static/chunks/a.js` and `static/chunks/a.js` are the same file. */
const chunk = (path) => path.replace(/^\/?_next\//, "");

/** Which root layout a route renders in, from its manifest's entries. */
function site(manifest) {
  const entries = Object.keys(manifest.entryJSFiles ?? {});
  const player = entries.some((e) => e.includes(`${PLAYER}layout`));
  const terminal = entries.some((e) => e.includes(`${TERMINAL}layout`));
  if (player && terminal) return "both";
  return player ? "player" : terminal ? "terminal" : null;
}

/** Every chunk a route loads: its entries' and its client modules'. */
function chunksOf(manifest) {
  return new Set([
    ...Object.values(manifest.entryJSFiles ?? {})
      .flat()
      .map(chunk),
    ...Object.values(manifest.clientModules ?? {})
      .flatMap((m) => m.chunks ?? [])
      .map(chunk),
  ]);
}

/** The chunks holding the client modules under `folder`, across `manifests`. */
function chunksOfModulesIn(manifests, folder) {
  return new Set(
    manifests.flatMap((m) =>
      Object.entries(m.clientModules ?? {})
        .filter(([id]) => id.includes(folder))
        .flatMap(([, module]) => (module.chunks ?? []).map(chunk)),
    ),
  );
}

/**
 * What breaks the split, as sentences; empty when nothing does. Each manifest
 * is `{ route, entryJSFiles, clientModules }`. Fails when there is nothing to
 * check, so it can never pass by finding nothing.
 */
export function hostSplitViolations(manifests) {
  const found = [];
  const player = manifests.filter((m) => site(m) === "player");
  const terminal = manifests.filter((m) => site(m) === "terminal");

  for (const m of manifests.filter((m) => site(m) === "both")) {
    found.push(`${m.route} loads both root layouts`);
  }
  if (player.length === 0) found.push("Found no route under (player)");
  if (terminal.length === 0) found.push("Found no route under (terminal)");

  const playerLayout = chunksOfModulesIn(player, PLAYER);
  if (player.length > 0 && playerLayout.size === 0) {
    found.push(
      "Found no client module of the player's layout: nothing to check the terminal against",
    );
  }
  const terminalOwn = chunksOfModulesIn(terminal, TERMINAL);

  const check = (routes, otherFolder, otherChunks, whose) => {
    for (const m of routes) {
      for (const id of Object.keys(m.clientModules ?? {})) {
        if (id.includes(otherFolder)) found.push(`${m.route} references ${id}`);
      }
      for (const file of chunksOf(m)) {
        if (otherChunks.has(file)) {
          found.push(`${m.route} loads ${whose} chunk ${file}`);
        }
      }
    }
  };
  check(terminal, PLAYER, playerLayout, "the player layout's");
  check(player, TERMINAL, terminalOwn, "the terminal's");
  return found;
}

/** Every `*_client-reference-manifest.js` under `dir`. */
function manifestFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return manifestFiles(path);
    return name.endsWith("_client-reference-manifest.js") ? [path] : [];
  });
}

/** A manifest file sets `globalThis.__RSC_MANIFEST[route]`; run it apart. */
function readManifests(file) {
  const sandbox = {};
  runInNewContext(readFileSync(file, "utf8"), sandbox, { filename: file });
  return Object.entries(sandbox.__RSC_MANIFEST ?? {}).map(([route, m]) => ({
    route,
    ...m,
  }));
}

function main() {
  const app = resolve(import.meta.dirname, "../.next/server/app");
  let files;
  try {
    files = manifestFiles(app);
  } catch {
    console.error(`No build at ${app}. Run pnpm build first.`);
    process.exit(1);
  }
  const manifests = files.flatMap(readManifests);
  const found = hostSplitViolations(manifests);
  if (found.length > 0) {
    console.error("The host split leaks (F8a AC-4):");
    for (const line of found) console.error(`  - ${line}`);
    process.exit(1);
  }
  const count = (s) => manifests.filter((m) => site(m) === s).length;
  console.log(
    `Host split holds: ${count("player")} player routes load no module or chunk of (terminal); ` +
      `${count("terminal")} terminal route(s) load no module of (player) nor a chunk holding one ` +
      `(${relative(process.cwd(), app)}, ${files.length} manifests).`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
