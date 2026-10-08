---
id: F3c
title: Multiple only, and three slips to organise bets in
status: done
depends_on: [F8cb]
contract_tags: [Bets, Bookings, Config]
touches_money: true
touches_ui: true
---

# F3c — Multiple only, and three slips

## Goal

Players and shop customers in Ethiopia bet accumulators (multiples) and nothing else, so the slip offers
only that: no Single or System tabs. Instead it has **three slips** (Slip 1, Slip 2, Slip 3), each with
its own picks, stake, figures and Book bet (and Place bet on the player's site), so a customer can build
several bets side by side and jump between them. The same on the player's site and the shop kiosk.

## Read first

- The user's decisions (2026-10-08): multiple only; three separate slips, as tabs with a count each; a
  tapped price goes into the slip on screen and shows as picked only for it; a second pick from the same
  match replaces the first; both sites.
- `docs/backend/engineering-decisions.md` **D1** (bet types, lines, D1.11 total odds), FD4
- `docs/design/04-slip-and-money.md` (placing, booking, the unconfirmed bet), `10-terminal.md` (the kiosk's
  slip)
- `contracts/openapi.yaml`: `POST /v1/bets` (`bet_type`), `POST /v1/bookings`, `GET /v1/bookings/{code}`
- Existing code: `src/features/bet-slip/**` (the store, `use-place-bet`, `BetSlip`, `BetModeTabs`),
  `src/features/bookings/**`, `src/features/odds/components/OddsButton.tsx`,
  `src/features/terminal/components/kiosk/KioskSlip.tsx`, `src/lib/websocket/RealtimeProvider.tsx`

## Scope

In:

- Multiple only on both sites: no mode tabs; one pick is a single (a multiple needs two), two or more a
  multiple. A loaded code saved as single or system loads as a multiple, and the slip says so.
- A second pick from a match already in the slip replaces it (no same-match conflict state).
- Three slips: tabs Slip 1/2/3 with each one's count; the active slip receives taps; prices show as
  picked for the active slip only; each slip keeps its own picks, stake, booking (code, key), loaded-code
  notice and, on the player's site, its placing state; switching keeps the others as they were. The
  phone bar and the slip's sheet follow the active slip.
- Realtime price and suspension updates reach every slip.

Out (do not build here):

- Persisting slips across reloads; renaming slips; more than three.
- Any change to slipcalc, the contract or the golden files.

## Acceptance criteria

- [x] **AC-1** Neither site offers Single or System; one pick is priced as a single, two or more as a
      multiple; a code saved as single or system loads as a multiple and the slip says so.
- [x] **AC-2** Tapping a price of a match already in the slip replaces that pick, on both sites.
- [x] **AC-3** Three slips: a tap goes into the active slip; each tab shows its count; switching shows that
      slip's own picks, stake and figures and keeps the others unchanged; a price is shown as picked only
      for the active slip.
- [x] **AC-4** Booking and placing act on the active slip only, with one `Idempotency-Key` per slip's
      intent; a code booked or a bet placed in one slip stays with that slip.
- [x] **AC-5** A realtime price move or suspension updates the pick in every slip that holds it.

## Verification

- `pnpm verify` passes; `pnpm vitest run tests/unit/golden.test.ts` unchanged
- `pnpm ui --grep "slip"` (both sites, both languages, phone and desktop)

## Notes

- 2026-10-08: created on the user's direction ("here in ethiopia, all use only Multiple … lets have
  instead 3 slip so that the use can jump and they can organize bets as they like"). Branched from
  `task/F8cb-simple-slip` (not yet merged).
- 2026-10-08: verified (`docs/tasks/F3c/verification.md`). The panel's BLOCKER (another player's placing
  forgotten too late and wiping the new player's) is fixed and re-checked. Fast gate: `pnpm check`,
  build, host split, drift, the slip screens; the full 652-screen suite was not run (the user asked for
  fast tests). Follow-ups: drop the dormant `mode`/`systemK` setters; per-slip booking errors.
- 2026-10-08, the user's review: the slip's own "Bet slip" title and count are gone from view on both
  sites (the panel's tab and the slip tabs say both); the title stays a heading for screen readers
  (`BetSlipHeader`; `BetSlip.test.tsx` › "keeps the slip's title for screen readers only…"). Slip screens:
  80 pass.
