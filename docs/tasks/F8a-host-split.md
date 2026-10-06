---
id: F8a
title: Split the app by host — (player) and (terminal) route groups, the proxy on every route
status: verifying
depends_on: [F7b]
contract_tags: []
touches_money: false
touches_ui: false
---

# F8a — Host split

Rewritten 2026-10-05 with the new **FD1** (it was "convert to a pnpm + Turborepo workspace"). It no longer
waits for all of F7: it can start once F7b is merged, and the remaining player tasks (F1, F2a, F2b, F7c,
F7d, F7e) are built inside `(player)` afterwards.

## Goal

The app serves two sites from one build: the player site on `www.{brand}` and, from F8b, the shop terminal
on `terminal.{brand}`. Each has its own root layout, so neither loads the other's code, and the proxy
keeps each host to its own routes. Nothing a player sees changes.

## Read first

- `docs/decisions.md` **FD1** (the layout, and what this Next.js version's docs say), **FD3** (routes)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` (multiple root
  layouts and their caveats), `…/proxy.md` (matcher, rewrites, runtime),
  `…/05-config/01-next-config-js/rewrites.md` (`has: host`)
- `docs/design/09-security.md` (what the proxy does today), `07-tenancy-and-theming.md` (host → tenant)
- Existing: `src/app/**`, `src/proxy.ts`, `src/lib/server/config.ts` (`TENANT_HOST_MAP`, trusted proxy),
  `tests/e2e/*`, `tests/unit/proxy.test.ts`

## Scope

In:

- Today's routes move under `src/app/(player)/` with their history (`git mv`); the root `layout.tsx` becomes
  `(player)/layout.tsx`. URLs don't change (route groups aren't in the path); `/` sits inside the group.
- An empty `(terminal)` group with its own root layout and a placeholder `/terminal` page, and the
  `/api/terminal/*` namespace (no handlers yet: F8b).
- Which host is which: a terminal host maps to its tenant and is marked as a terminal (for example a
  `TERMINAL_HOST_MAP` beside `TENANT_HOST_MAP`, decided in the plan; `.env.example` documents it).
- `src/proxy.ts` runs on every page and route handler (excluding `_next/static`, `_next/image` and public
  files) and keeps its current jobs. On a terminal host it serves only `/terminal/*` and `/api/terminal/*`,
  rewrites `/` to `/terminal`, and answers anything else 404. On a player host it answers `/terminal/*` and
  `/api/terminal/*` 404.
- `09-security.md`, `07-tenancy`, `00-overview` updated; `.claude` skills or hooks that name paths under
  `src/app` updated.

Out: the terminal itself (F8b, F8c); anything in `kelalsport-ops` (F12).

## Acceptance criteria

- [ ] **AC-1** `pnpm verify` passes with the same unit, component and screen test counts as before, plus
      the new proxy tests.
- [ ] **AC-2** `pnpm ui` screenshots are pixel-identical to the run before the move for every screen (or
      the differences are listed and explained).
- [ ] **AC-3** On a player host, `/terminal` and `/api/terminal/x` answer 404; on a terminal host, `/`
      shows the terminal placeholder and `/profile`, `/login`, `/wallet` and `/api/me` answer 404 (proxy
      unit tests and a Playwright check with both hosts).
- [ ] **AC-4** A player page's JavaScript contains nothing from `(terminal)`, and the terminal page's
      nothing from the player's layout (build output checked in a test or by `next build`'s route list).
- [ ] **AC-5** `git log --follow 'src/app/(player)/layout.tsx'` shows the file's history.
