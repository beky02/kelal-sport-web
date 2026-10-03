---
id: F5b
title: My bets and ticket detail from the contract with cursor paging; public ticket check /t/[ticket]
status: planned
depends_on: [F5a]
contract_tags: [Bets, Bookings]
touches_money: true
touches_ui: true
---

# F5b — My bets and the ticket check

Split from [F5](F5-place-bet-my-bets.md) (2026-10-02): the reading half. Placing a bet, its refusals and
the Code 128 barcode are [F5a](F5a-place-bet.md), which this builds on.

## Goal

My bets lists the player's tickets from `GET /v1/bets` (Open / Settled, paged by cursor) and a ticket
opens from `GET /v1/bets/{id}`, both with the API's own figures — never a recomputation. Anyone can check
a ticket number at `/t/[ticket]`: a server-rendered page that works without JavaScript and previews in
Telegram.

## Read first

As F5: `docs/decisions.md` FD3 (`/t/{ticket}` unprefixed); D3 (ticket numbers: Crockford base32 + Luhn
mod 32 check, `XXXX-XXXX-C`), D7 (`/t/{ticket}`); `c18-client-apps.md` §4.1 and §9 (no-JS ticket
check); `contracts/openapi.yaml` `GET /v1/bets` (`status`, `cursor`, `limit`, `next_cursor`),
`GET /v1/bets/{id}` (404), `GET /v1/tickets/{ticket_id}` (`TicketCheck`, its eight statuses, 404);
`docs/design/01-screens.md` (My bets, Ticket); F3b's `/b/[code]` page, metadata and e2e spec;
existing `src/features/bets/*`, `src/lib/api/mock/bets.ts`.

## Scope

In:

- `GET /api/bets?status=open|settled&cursor=` and `GET /api/bets/[id]` (session required; names in both
  languages); `checkTicket` for the page (public).
- The domain `Bet` from the contract's `Bet` (`stake_tax`, `win_tax`, `acca_bonus`, `potential_payout`,
  `payout`, `bet_type`, `system_sizes`, `lines`, legs with `odds_taken` and `result`); the bet mocks go.
- My bets: Open / Settled tabs (the contract's filter), cursor paging with Show more, loading, empty and
  error states; the aside's open count from the first page.
- Ticket detail: every leg with its result, the API's stake, stake tax, bonus, win tax and payout, the
  ticket number with its barcode. No slipcalc recomputation.
- `/t/[ticket]` (+ `/t` with the check form): canonical redirect, 404 and failed states, Open Graph in the
  head, no-JS. Share on Telegram links to it.

Out: cash out (Release 2: the panel stays behind its flag, with no quote to show).

## Acceptance criteria

- [ ] **AC-3** The ticket in My bets shows the API's `potential_payout` / `payout` and taxes, not a
      recomputation.
- [ ] **AC-4** `/t/R7K2-M9XP-K` renders the ticket status with JavaScript disabled.
- [ ] **AC-5** My bets pages with `next_cursor`.
- [ ] **AC-9** `/t/[ticket]` puts its Open Graph tags in `<head>` for Telegram's preview bot, answers 404
      in the ticket's own words for an unknown number, and redirects a typed number to its canonical path.

## Verification

- `pnpm verify` passes
- Playwright with JavaScript disabled on `/t/R7K2-M9XP-K`

## Notes

- 2026-10-02: split from F5. Starts when F5a is `done` on main.
