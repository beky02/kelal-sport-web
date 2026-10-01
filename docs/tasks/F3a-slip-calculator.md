---
id: F3a
title: Slip on slipcalc (D1), rules from config, money as strings
status: verifying
depends_on: [F0]
contract_tags: [Config]
touches_money: true
touches_ui: true
---

# F3a — Slip calculator on slipcalc

Split from [F3](F3-slip-calculator.md) (2026-10-01): the calculator half. Bookings are [F3b](F3b-bookings.md).

## Goal

Every number on the slip and on a ticket's breakdown comes from `contracts/golden/ts/slipcalc.ts` with the
tenant's rule set from `/v1/config/public`, so the slip matches the backend to the santim. Money and odds
stay the contract's decimal strings from the mapper to the screen (FD4).

## Read first

As F3: FD4, D1 (all 12 rules), D7 (quick stakes set the total), `contracts/golden/`, C07,
`GET /v1/config/public` (`RuleSet`), and the existing slip code.

## Scope

In:

- `slipcalc.ts` imported from `contracts/golden/ts/` (not copied) behind `calculateBetSlip` and
  `settleBet`; UI-only logic kept (CTA, conflicts, odds-change acceptance, system picker).
- Selections carry the contract `outcome_id` and odds as the API's decimal string; `Outcome.odds` is a
  decimal string.
- `loadPublicConfig` + `/api/config` + `usePublicConfig`; placeholder tax/cap constants deleted.
- Quick stakes from `RuleSet.quick_stakes` set the total stake; remainder warning.
- D1 warnings and errors shown in both languages, with the fix where there is one.
- `tests/unit/golden.test.ts` over all of `slips.csv`.
- `lib/money.ts` and the ESLint rule (FD4).

Out: bookings and `/b/[code]` (F3b); placing the bet for real (F5); wallet amounts as strings (F6).

## Acceptance criteria

- [ ] **AC-1** Vitest runs all 366 golden rows: 366 passed, 0 mismatches, 0 skipped.
- [ ] **AC-2** The C07 worked example shows net payout `690.29` on the slip (component test).
- [ ] **AC-3** No float arithmetic in `features/bet-slip` or `features/bets` money paths (grep + money-reviewer).
- [ ] **AC-4** Quick stake 100 on a 3-line system bet charges 99.99 and shows the remainder warning.
- [ ] **AC-5** Changing the rule set (test fixture with `no_tax`) changes the slip without code changes.
- [ ] **AC-7** The anchor test `1.62 × 3.05 × 1.38 at 100` is updated to D1's figure, with the arithmetic
      in the test comment (it was 507.64 under the old float maths).
- [ ] **AC-8m** `lib/money.ts` round-trips every money value in `slips.csv` exactly; the lint rule fails on a
      deliberate `parseFloat(stake)` in a fixture file.

## Verification

- `pnpm verify` passes; money-reviewer and ui-checker run.
