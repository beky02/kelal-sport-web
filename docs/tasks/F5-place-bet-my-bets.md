---
id: F5
title: Place bet with Idempotency-Key and the 409 flow; My bets; /t/[ticket]
status: done
depends_on: [F3a, F3b, F4]
contract_tags: [Bets, Bookings]
touches_money: true
touches_ui: true
---

# F5 — Place bet and My bets

Split (2026-10-02) into [F5a — place a bet](F5a-place-bet.md) (AC-1, AC-2, AC-3 on the placed ticket,
AC-6, AC-7, AC-8) and [F5b — My bets and the ticket check](F5b-my-bets-ticket-check.md) (AC-3 on the
ticket in My bets, AC-4, AC-5, AC-9), as F3 and F4 were: one reviewable PR each. F5 is done when both
are. Plan for F5a: `F5/plan.md`.

## Goal

A player places singles, accumulators and system bets through the contract; a price that moved comes back
as a clear old-vs-new choice; My bets and ticket detail show the API's own figures; anyone can check a
ticket at `/t/[ticket]`.

## Read first

- `docs/decisions.md` **FD3** (`/t/{ticket}`, unprefixed, works for links shared from the app) and
  **FD4** (amounts through `lib/money.ts`)
- `docs/backend/engineering-decisions.md` D1.10, D3 (ticket numbers), D7 (`/t/{ticket}`)
- `docs/backend/design/components/c08-bet-placement-risk.md`, `c18-client-apps.md` §4.2
- `contracts/openapi.yaml`: `POST /v1/bets` (`Idempotency-Key`; 409 examples `odds_changed`,
  `event_started`; 403 RG), `GET /v1/bets` (cursor, status filter), `GET /v1/bets/{id}`,
  `GET /v1/tickets/{ticket_id}`
- Existing: `src/features/bet-slip/api/place-bet.ts`, `hooks/use-place-bet.ts`, `src/features/bets/*`

## Scope

In:

- `POST /api/bets` route handler; key created when the player taps Place and reused on retry; odds policy
  from the slip setting (`none` / `higher` / `any`).
- 409 `BET_ODDS_CHANGED`: show each changed leg old → new from `errors[].current`, recompute the preview
  with slipcalc, accept with a **new** key.
- `BET_EVENT_STARTED`, `BET_MARKET_SUSPENDED`, `BET_STAKE_TOO_HIGH` (offer the limit), RG 403s.
- My bets from `/v1/bets` with tabs and cursor paging; ticket from `/v1/bets/{id}`; figures from the API.
- `/t/[ticket]`: server-rendered, works without JavaScript (C18 §9), Open Graph metadata.
- Real ticket barcodes: Code 128 in `components/ui/Barcode.tsx`.

Out: cash out (Release 2 flag stays off).

## Acceptance criteria

- [x] **AC-1** Placing twice with the same key (retry) sends the same `Idempotency-Key` (request log test).
- [x] **AC-2** `Prefer: code=409` shows old and new odds and accepting re-places with a new key.
- [x] **AC-3** The ticket shows the API's `net_payout`, not the preview's.
- [x] **AC-4** `/t/R7K2-M9XP-K` renders the ticket status with JavaScript disabled.
- [x] **AC-5** My bets pages with `next_cursor`.

Added at the split (2026-10-02) so every scope item above has an observable criterion:

- [x] **AC-6** The `odds_policy` sent is the slip's setting (`none` / `higher` / `any`), which starts at
      the tenant's `betting.default_odds_policy`.
- [x] **AC-7** Each refusal in scope says what happened and offers its fix: `BET_EVENT_STARTED` /
      `BET_MARKET_SUSPENDED` mark the pick and offer Remove; `BET_STAKE_TOO_HIGH` offers `errors[].limit`;
      `WALLET_INSUFFICIENT_FUNDS` offers Deposit; `RG_LIMIT_REACHED` offers View limits; `RG_SELF_EXCLUDED`
      and `RG_COOLING_OFF` say betting is paused; `KYC_REQUIRED` offers Verify.
- [x] **AC-8** Ticket barcodes are Code 128 (symbol table, check character and stop pattern under test).
- [x] **AC-9** `/t/[ticket]` puts its Open Graph tags in `<head>` for Telegram's preview bot, answers 404
      in the ticket's own words for an unknown number, and redirects a typed number to its canonical path.

## Carried over from F3a review (2026-10-01)

- **Tickets must show the server's figures.** F3a recomputes ticket figures with slipcalc and today's
  rule set because bets are still mocks. Real tickets carry `stake_tax`, `win_tax`, `acca_bonus`,
  `potential_payout`, `payout`, `bet_type`, `system_sizes` and `rules_version`; put them on the domain
  `Bet` and show them. Recompute only as a labelled preview, with the bet's own type and rule version
  (money review M2, quality Q2).
- **Cash-out remainder** (Release 2) is priced by slipcalc on the remaining stake; replace it with the
  server's cash-out quote when cash out is built (M4).
- **Placement** still sends no `Idempotency-Key` and its request/receipt are not the contract's
  `PlacedBet` shapes; no 409 `BET_ODDS_CHANGED` flow yet (security SEC2, money M9).

## Done (2026-10-03)

F5a (placing) and F5b (My bets, the ticket, `/t/[ticket]`) are both done — see `F5/verification.md` and
`F5b/verification.md`. AC-3's "`net_payout`" is shown as the API's `potential_payout` / `payout` (the
contract has no `net_payout`; contract request 007 asks it to describe them).
