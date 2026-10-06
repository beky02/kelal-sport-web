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
 * (`providers.tsx`) and the chunks that hold them. Since F8b gave the terminal
 * its own providers, both sites need the same libraries — React, React Query
 * — which the bundler puts in chunks both load. A module's `chunks` in the
 * manifest are everything it needs, those libraries included, so a layout's
 * chunks are the ones that **define** its modules: the chunk whose code
 * registers the module's id. Where none of a module's chunks does, every
 * chunk it needs counts, as before, so the check never passes by not finding.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const PLAYER = "/src/app/(player)/";
const TERMINAL = "/src/app/(terminal)/";

/**
 * Client code the player's layout owns: its route group, and what its
 * providers mount — the preferences and system stores, the realtime channel.
 * The terminal has its own providers and must load none of it (FD1), however
 * the bundler splits the chunks (review Q2).
 */
const PLAYER_ONLY = [PLAYER, "/src/stores/", "/src/lib/websocket/"];

const isUnder = (id, folders) => folders.some((folder) => id.includes(folder));

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

/**
 * The chunks holding a client module's own code: those of its chunks that
 * `defines` says register its id, or — when none does, or it has no id —
 * every chunk it needs.
 */
function holdingChunks(module, defines) {
  const chunks = (module.chunks ?? []).map(chunk);
  const own =
    module.id === undefined ? [] : chunks.filter((c) => defines(c, module.id));
  return own.length > 0 ? own : chunks;
}

/** The chunks holding the client modules under `folders`, across `manifests`. */
function chunksOfModulesIn(manifests, folders, defines) {
  return new Set(
    manifests.flatMap((m) =>
      Object.entries(m.clientModules ?? {})
        .filter(([id]) => isUnder(id, folders))
        .flatMap(([, module]) => holdingChunks(module, defines)),
    ),
  );
}

/**
 * What breaks the split, as sentences; empty when nothing does. Each manifest
 * is `{ route, entryJSFiles, clientModules }`; `defines(chunk, id)` says
 * whether a chunk (`static/chunks/…`) registers module `id` (by default none
 * does, so every chunk a module needs counts). Fails when there is nothing to
 * check, so it can never pass by finding nothing.
 *
 * @param {object[]} manifests
 * @param {(chunk: string, id: number | string) => boolean} [defines]
 */
export function hostSplitViolations(manifests, defines = () => false) {
  const found = [];
  const player = manifests.filter((m) => site(m) === "player");
  const terminal = manifests.filter((m) => site(m) === "terminal");

  for (const m of manifests.filter((m) => site(m) === "both")) {
    found.push(`${m.route} loads both root layouts`);
  }
  if (player.length === 0) found.push("Found no route under (player)");
  if (terminal.length === 0) found.push("Found no route under (terminal)");

  const playerLayout = chunksOfModulesIn(player, PLAYER_ONLY, defines);
  if (player.length > 0 && playerLayout.size === 0) {
    found.push(
      "Found no client module of the player's layout: nothing to check the terminal against",
    );
  }
  const terminalOwn = chunksOfModulesIn(terminal, [TERMINAL], defines);

  const check = (routes, otherFolders, otherChunks, whose) => {
    for (const m of routes) {
      for (const id of Object.keys(m.clientModules ?? {})) {
        if (isUnder(id, otherFolders)) {
          found.push(`${m.route} references ${id}`);
        }
      }
      for (const file of chunksOf(m)) {
        if (otherChunks.has(file)) {
          found.push(`${m.route} loads ${whose} chunk ${file}`);
        }
      }
    }
  };
  check(terminal, PLAYER_ONLY, playerLayout, "the player layout's");
  check(player, [TERMINAL], terminalOwn, "the terminal's");
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

/**
 * Whether a built chunk's code registers module `id`: Turbopack writes each
 * module as its id (or several ids sharing one factory) followed by the
 * factory, `…,21993,e=>{…` or `…},88109,6573,743,e=>{…`. A use of the module
 * (`e.i(21993)`) is not a definition, nor is a longer id ending in this one.
 */
export function definesModule(code, id) {
  return new RegExp(`[,\\[]${id},(?:\\d+,)*[A-Za-z_$][\\w$]*=>`).test(code);
}

/** `definesModule` over the build's chunk files, each read once. */
function chunkDefines(next) {
  const read = new Map();
  return (file, id) => {
    if (!read.has(file)) {
      let code = "";
      try {
        code = readFileSync(join(next, file), "utf8");
      } catch {
        code = "";
      }
      read.set(file, code);
    }
    return definesModule(read.get(file), id);
  };
}

function main() {
  const next = resolve(import.meta.dirname, "../.next");
  const app = join(next, "server/app");
  let files;
  try {
    files = manifestFiles(app);
  } catch {
    console.error(`No build at ${app}. Run pnpm build first.`);
    process.exit(1);
  }
  const manifests = files.flatMap(readManifests);
  const found = hostSplitViolations(manifests, chunkDefines(next));
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
