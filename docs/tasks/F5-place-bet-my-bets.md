---
id: F5
title: Place bet with Idempotency-Key and the 409 flow; My bets; /t/[ticket]
status: todo
depends_on: [F3, F4]
contract_tags: [Bets, Bookings]
touches_money: true
touches_ui: true
---

# F5 — Place bet and My bets

## Goal

A player places singles, accumulators and system bets through the contract; a price that moved comes back
as a clear old-vs-new choice; My bets and ticket detail show the API's own figures; anyone can check a
ticket at `/t/[ticket]`.

## Read first

- `../kelal backend/docs/engineering-decisions.md` D1.10, D3 (ticket numbers), D7 (`/t/{ticket}`)
- `../kelal backend/docs/design/components/c08-bet-placement-risk.md`, `c18-client-apps.md` §4.2
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

- [ ] **AC-1** Placing twice with the same key (retry) sends the same `Idempotency-Key` (request log test).
- [ ] **AC-2** `Prefer: code=409` shows old and new odds and accepting re-places with a new key.
- [ ] **AC-3** The ticket shows the API's `net_payout`, not the preview's.
- [ ] **AC-4** `/t/R7K2-M9XP-K` renders the ticket status with JavaScript disabled.
- [ ] **AC-5** My bets pages with `next_cursor`.
