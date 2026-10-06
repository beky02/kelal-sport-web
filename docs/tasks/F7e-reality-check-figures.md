---
id: F7e
title: Split from F7b — the reality check's figures and play session from the API, the player's interval
status: todo
depends_on: [F7b]
contract_tags: [Me]
touches_money: true
touches_ui: true
---

# F7e — Reality-check figures

Split from [F7b](F7b-account-reality-check.md) (2026-10-05, at F7b's plan gate). **Waits for contract request
[012](../contract-requests/012-reality-check-and-account.md)** to be in the contract and synced.

## Goal

The reality check shows what the player staked, won and netted in the play session, as the API reports it,
and is timed by the API's play session rather than the browser's visit. A player can choose their own
interval where the tenant allows it.

## Read first

- `docs/contract-requests/012-reality-check-and-account.md` and what the backend made of it
- `docs/tasks/F7b/plan.md` (decisions 1–4, 11) and `docs/design/02-journeys.md` (Reality check)
- `docs/backend/design/components/c12-rg-aml.md` §2, §7; SRS RG-04
- Existing: `src/features/system/hooks/use-reality-check.ts`, `src/stores/reality-check.store.ts`,
  `src/features/system/components/SystemOverlays.tsx`, the responsible-gaming session-reminder card

## Scope

In:

- The figures from the operation 012 adds, through a route handler, read fresh each time the check opens;
  money as the API's strings (FD4), the net's sign and loss tint from the API's value: split the leading
  `-` off the `Money` string and show it as "−" (`formatMoney` takes the sign as it comes), never
  `Math.abs`/`Number` (F7b money review, m2).
- Timing from the API's play session (`started_at` / `next_check_at`); the browser's visit clock and its
  `sessionStorage` store removed.
- The player's interval on the session-reminder card, if `MePatch` takes one.

Out: anything 012 doesn't add.

## Acceptance criteria

- [ ] **AC-1** The dialog shows staked, won and net exactly as the API sent them, loss tinted when `net` is
      negative; nothing about them is computed in the browser (component test against the contract's
      example; `pnpm ui` `reality-check`).
- [ ] **AC-2** The check opens when the API says the next one is due, across reloads and tabs (hook test with
      fake timers).
- [ ] **AC-3** If 012 lets the player choose an interval, the card offers the allowed values and saves the
      choice through the API (component test).
