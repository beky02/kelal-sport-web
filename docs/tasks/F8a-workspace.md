---
id: F8a
title: Convert to a pnpm + Turborepo workspace — apps/player and shared packages
status: todo
depends_on: [F7]
contract_tags: []
touches_money: false
touches_ui: false
---

# F8a — Web workspace

## Goal

The repo becomes the web workspace C18 §3 describes, so the terminal, POS and agent apps can reuse the
player app's API client, slip calculator, UI and translations instead of copying them. Nothing a player
sees changes.

## Read first

- `docs/decisions.md` **FD1**
- `../kelal backend/docs/design/components/c18-client-apps.md` §3 (layout and import rules), §7
- Existing: everything under `src/`, `scripts/`, `.claude/` (paths in hooks and skills), `CLAUDE.md`

## Scope

In:

- `pnpm-workspace.yaml`, `turbo.json`; the player app moves to `apps/player` with its history (`git mv`).
- Packages: `packages/api` (generated `schema.d.ts`, `lib/server` upstream client, mappers, `tests/contract.ts`),
  `packages/slipcalc` (adapter over `contracts/golden/ts/slipcalc.ts` + `lib/money.ts` + the golden test),
  `packages/ui` (tokens, primitives), `packages/i18n` (catalogues, formatting, dates), `packages/config`
  (ESLint, tsconfig, Tailwind preset).
- Import rules (C18 §3): apps import packages, never each other; packages never import apps — enforced by
  ESLint.
- `contracts/` stays at the root; `pnpm contract:sync`, `api:types`, `check`, `verify`, `ui` work from the
  root through Turborepo; `.claude` hooks, skills and `CLAUDE.md` updated to the new paths.

Out: any new app (F8–F10); behaviour changes.

## Acceptance criteria

- [ ] **AC-1** `pnpm verify` passes from the root with the same test and screen counts as before the move.
- [ ] **AC-2** `git log --follow apps/player/src/app/layout.tsx` shows the file's history.
- [ ] **AC-3** An import from `apps/player` inside a package fails lint.
- [ ] **AC-4** `pnpm ui` screenshots are pixel-identical to the pre-move run for every screen (or the
      differences are listed and explained).
