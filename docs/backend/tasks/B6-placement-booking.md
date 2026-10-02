---
id: B6
title: C08 bet placement; C09 bookings and ticket check
status: todo
depends_on: [B2, B3, B4, B5]
components: [C08, C09]
contract_tags: [Bets, Bookings, Slips]
touches_money: true
---

# B6 — Bet placement and booking codes

## Goal
A logged-in player places singles, multiples and system bets with exact re-pricing, limits and an idempotent
`BET_STAKE` posting; anyone can create and load booking codes and check a ticket.

## Read first
- `docs/design/components/c08-bet-placement-risk.md`, `c09-booking-codes.md`
- `docs/design/td-00-architecture.md` §3 (placement flow; only one DB transaction)
- `docs/engineering-decisions.md` D1, D2 (BET_STAKE posting), D3 (ticket numbers), D4 (`betting.bet` and `booking.booking` DDL corrections)
- `contracts/openapi.yaml`, tags `Bets`, `Bookings`, `Slips`

## Scope
In: betting and booking schemas per D4; placement pipeline (validate → re-price from Redis → RG/limit checks →
liability in Redis → slipcalc quote → one transaction: ledger `BET_STAKE` + bet rows + outbox `bet.placed`);
odds-change policy (409 `BET_ODDS_CHANGED` with current odds in `errors[]`); My bets list/detail; public
ticket check; booking create/get with expiry; optional `POST /v1/slips/quote`.
Plan should split this task (e.g. B6a placement, B6b bookings + ticket check).
Out: settlement (B7), retail channel (B9), free bets.

## Acceptance criteria
- [ ] **AC-1** Placing with the same `Idempotency-Key` twice returns one ticket and one ledger txn (db test).
- [ ] **AC-2** Odds moved since the slip → 409 `BET_ODDS_CHANGED` with the new odds; suspended market → `BET_MARKET_SUSPENDED`; started event → `BET_EVENT_STARTED`.
- [ ] **AC-3** Stake, tax and potential win stored on the bet equal `slipcalc.quote` for the same inputs (no second calculation anywhere).
- [ ] **AC-4** Ledger after placement matches D2 exactly; insufficient funds → `WALLET_INSUFFICIENT_FUNDS` and no bet row.
- [ ] **AC-5** Ticket numbers are valid Luhn-32 and unique per tenant; public ticket check leaks no player identity.
- [ ] **AC-6** Booking codes: create, load, expire (`BOOKING_EXPIRED`), unknown (`BOOKING_NOT_FOUND`); nightly sweeper deletes expired rows.
- [ ] **AC-7** p95 placement < 800 ms in a local benchmark of 200 placements (report the number).
- [ ] **AC-8** `make conformance` passes for the three tags.
