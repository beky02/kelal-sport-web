---
id: F3
title: Slip on slipcalc (D1), rules from config, bookings and /b/[code]
status: todo
depends_on: [F0]
contract_tags: [Config, Slips, Bookings]
touches_money: true
touches_ui: true
---

# F3 — Slip calculator and bookings

## Goal

Every number on the slip comes from the shared calculator `contracts/golden/ts/slipcalc.ts`, with the
tenant's rule set from `/v1/config/public`, so the slip matches the backend to the santim. Booking codes
are created and loaded through the contract.

## Read first

- `docs/decisions.md` **FD4** (no `decimal.js`; `lib/money.ts` on BigInt santim; lint rule) and **FD3**
  (`/b/{code}` deep link)
- `../kelal backend/docs/engineering-decisions.md` D1 (all 12 rules), D7 (quick stakes set the total)
- `contracts/golden/README.md`, `contracts/golden/ts/slipcalc.ts`, `contracts/golden/ts/golden.test.ts`
- `../kelal backend/docs/design/components/c07-slip-calculator.md` (worked example, net payout 690.29)
- `../kelal backend/docs/design/components/c09-booking-codes.md`
- `contracts/openapi.yaml`: `GET /v1/config/public` (`RuleSet`), `POST /v1/slips/quote`,
  `POST /v1/bookings`, `GET /v1/bookings/{code}`
- Existing: `src/features/bet-slip/lib/calculate.ts` (float estimate, five known differences from D1),
  `combinations.ts`, `stores/bet-slip.store.ts`, `features/bets/lib/figures.ts`, `tests/unit/calculate.test.ts`

## Scope

In:

- Import `slipcalc.ts` from `contracts/golden/ts/` (do not copy or edit it) behind a thin adapter that
  `calculateBetSlip` and `settleBet` call; keep the UI-only logic (CTA resolution, conflicts, odds-change
  acceptance, system picker).
- Selections carry the contract `outcome_id` and the odds as the API's decimal string.
- Rule set from `/v1/config/public`; delete the placeholder tax/cap constants from `config/constants.ts`.
- Quick stakes from `RuleSet.quick_stakes` set the **total** stake; show the remainder warning.
- Show D1 warnings (`STAKE_REMAINDER_NOT_CHARGED`, `ACCA_BONUS_CAPPED`, `MAX_PAYOUT_REACHED`) and errors
  (`BET_TOO_MANY_LEGS`, `BET_TOO_MANY_LINES`, `BET_STAKE_TOO_LOW`) in both languages.
- Bookings: create (`POST /v1/bookings`), load by code into the slip, `/b/[code]` page (server-rendered
  with Open Graph metadata); `BOOKING_NOT_FOUND`, `BOOKING_EXPIRED` (410) handled.
- `golden.test.ts` as a Vitest test over all of `slips.csv`.
- `lib/money.ts` (FD4): string ↔ BigInt santim with slipcalc's rule, comparisons, sums; a test pins its
  parse to slipcalc's `money()` round trip. ESLint `no-restricted-syntax` bans `parseFloat`, `Number(…)`
  and unary `+` on money/odds outside `lib/money.ts`, slipcalc and the display formatters.
- `loadPublicConfig` in `lib/server` if F1 or F2a has not built it yet.

Out: placing the bet (F5); `POST /v1/slips/quote` only if a screen needs a server quote.

## Acceptance criteria

- [ ] **AC-1** Vitest runs all 366 golden rows: 366 passed, 0 mismatches, 0 skipped.
- [ ] **AC-2** The C07 worked example shows net payout `690.29` on the slip (component test).
- [ ] **AC-3** No float arithmetic in `features/bet-slip` or `features/bets` money paths (grep + money-reviewer).
- [ ] **AC-4** Quick stake 100 on a 3-line system bet charges 99.99 and shows the remainder warning.
- [ ] **AC-5** Changing the rule set (test fixture with `no_tax`) changes the slip without code changes.
- [ ] **AC-6** Booking `7KQ2M9X` (Prism) loads its selections into the slip; a 410 shows "expired".
- [ ] **AC-8** `/b/7KQ2M9X` (unprefixed, FD3) works and `lib/money.ts` round-trips every money value in
      `slips.csv` exactly; the lint rule fails on a deliberate `parseFloat(stake)` in a fixture file.
- [ ] **AC-7** The anchor test `1.62 × 3.05 × 1.38 at 100` is updated to D1's figure, with the arithmetic
      in the test comment (it was 507.64 under the old float maths).

## Notes

FD4 decided against `decimal.js` (2026-10-01): slipcalc's BigInt rationals are the D1 definition.
