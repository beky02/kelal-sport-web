---
id: F12
title: Create kelalsport-ops — the staff and shop-counter project (POS, agent portal, back office, platform console)
status: todo
depends_on: [F8a]
contract_tags: []
touches_money: true
touches_ui: false
---

# F12 — The `kelalsport-ops` project

Added 2026-10-05 with the new **FD1**. Planned from this repo, built as a new repository. When it exists,
the task files of F9 (POS), F10 (agent portal and back office) and F11 (platform console) move there with
their history, and this repo's README says where they went.

## Goal

A second web project holds the apps staff use: the cashier POS, the agent portal, the back office and the
platform console. It starts with the same guarantees as this repo — contract first, money from slipcalc,
the browser never calling the API — so F9–F11 can begin on it without rebuilding the plumbing.

## Read first

- `docs/decisions.md` **FD1** (why two projects, and the three conditions), **FD4**, **FD6**
- `docs/backend/engineering-decisions.md` D1, D3, D7; `c18-client-apps.md` §3, §5, §7;
  `c15-back-office-trading.md` (Refine); `c19-retail-network.md` §9.2–§9.3
- In this repo, as the model: `scripts/contract-sync.mjs`, `pnpm api:types`, `src/lib/server/*`
  (`upstream`, `respond`, `session`, `csrf`), `src/lib/session-cookie.ts`, `src/lib/money.ts` and its
  tests, `tests/golden.ts`, `tests/contract.ts`, `CLAUDE.md`, `AGENTS.md`, `.claude/`

## Scope

In:

- **Layout**, decided in this task's plan: one Next.js app split by host (`pos.{brand}`, `agents.{brand}`,
  `bo.{brand}`, the platform's console host), as this repo does for the terminal (FD1); or a small
  workspace if Refine or the POS's kiosk needs make one app awkward. Each app has its own root layout and
  host either way.
- **Contract**: `contracts/` synced from the backend (`contract:sync` with `--check`), generated types,
  Prism for development; the drift check in CI.
- **Money**: slipcalc only from `contracts/golden/ts/slipcalc.ts`; the money helpers (FD4) and the golden
  CSV test in CI.
- **Server side** (D3): route handlers as the only API caller, the tenant header from the host, staff and
  device tokens in httpOnly cookies per audience (cashier, agent, back-office staff, platform staff), CSRF
  checks, `no-store`, `Prefer` only under `next dev`.
- **Basics**: both languages with the catalogue-parity test, tokens not hex, formats (06-language),
  `pnpm check`, `pnpm verify`, `pnpm ui`, and the `/task` workflow and reviewers adapted from this repo's
  `.claude/`.

Out: any screen of F9–F11 beyond an empty shell per app.

## Acceptance criteria

- [ ] **AC-1** `pnpm verify` passes in the new repo: types generated from the synced contract, the golden
      CSV rows pass, the drift check runs.
- [ ] **AC-2** Each app answers only on its own host; a route of another app answers 404 there.
- [ ] **AC-3** A route handler calls Prism with `X-Tenant-Id` from the host, and no token appears in
      storage JavaScript can read (Playwright check).
- [ ] **AC-4** F9–F11's task files are in the new repo, and this repo's `docs/tasks/README.md` points to
      them.
