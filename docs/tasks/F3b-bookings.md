---
id: F3b
title: Booking codes and the /b/[code] deep link
status: done
depends_on: [F3a]
contract_tags: [Bookings, Config]
touches_money: false
touches_ui: true
---

# F3b — Booking codes

Split from [F3](F3-slip-calculator.md) (2026-10-01): the bookings half. The calculator is [F3a](F3a-slip-calculator.md).

## Goal

A player can save the slip as a booking code, share it, and load a code (typed, or from a `/b/{code}` link)
back into the slip at current odds, through the contract.

## Read first

- `docs/decisions.md` FD3 (`/b/{code}` deep link)
- `docs/backend/design/components/c09-booking-codes.md`
- `contracts/openapi.yaml`: `POST /v1/bookings`, `GET /v1/bookings/{code}` (`PricedLeg`, 404, 410, 429)
- Existing: `src/features/bet-slip/components/BookingCode.tsx`, the stand-in code in `BetSlip.tsx`

## Scope

In:

- `lib/server/bookings.ts` (create, load in both languages), mapper `PricedLeg` → `BetSelection`,
  `/api/bookings` (POST) and `/api/bookings/[code]` (GET), hooks.
- Book bet creates a real code (`Idempotency-Key` per intent); the stand-in hash is deleted.
- Load by code into the slip; unavailable legs reported, not added; `stake_hint` sets the stake.
- `/b/[code]` page, server-rendered with Open Graph metadata; unprefixed until F2a adds `/{lang}`, then it
  redirects (FD3).
- `BOOKING_NOT_FOUND` (404), `BOOKING_EXPIRED` (410), `RATE_LIMITED` (429) handled in both languages.

Out: retail slip codes (F8/F9); sharing a placed bet (`source_bet_id`, F5).

## Acceptance criteria

- [x] **AC-6** Booking `7KQ2M9X` (Prism) loads its selections into the slip; a 410 shows "expired".
- [x] **AC-8r** `/b/7KQ2M9X` (unprefixed, FD3) works and carries Open Graph metadata.

## Verification

- `pnpm verify` passes; `curl -H 'Prefer: code=410' localhost:3000/api/bookings/7KQ2M9X` → 410 Problem.
