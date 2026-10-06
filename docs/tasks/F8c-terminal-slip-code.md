---
id: F8c
title: Split from F8 — kiosk sportsbook and slip to code
status: in_progress
depends_on: [F8b]
contract_tags: [Retail - terminal, Catalogue, Config]
touches_money: true
touches_ui: true
---

# F8c — Terminal slip to code

Split from [F8](F8-terminal.md) (2026-10-03, before planning).

Split again (2026-10-06, while planning; about 3,500 changed lines in one PR) into
[F8ca — kiosk sportsbook](F8ca-kiosk-sportsbook.md) (browsing, picks, the kiosk's language,
`features.retail`), [F8cb — the kiosk's slip](F8cb-kiosk-slip.md) (**AC-3**) and
[F8cc — slip to code](F8cc-slip-code.md) (**AC-1**, **AC-6**). F8c is done when all three are.

## Goal

A customer at the kiosk browses matches, builds a slip priced with the retail rule set, and gets an
8-digit code with a QR to pay at the counter; the screen resets when idle.

## Read first

- `docs/decisions.md` **FD1** (the `(terminal)` group reuses `src/features/*`), **FD4** (money)
- `docs/backend/design/components/c19-retail-network.md` §4.2, §9.1, §13; `c18-client-apps.md` §5
- `docs/backend/engineering-decisions.md` D1 (the slip), D7
- `contracts/openapi.yaml`: `POST /v1/retail/slip-codes` (30 per terminal per 10 minutes), the retail
  rule set in `/v1/config/public`

## Scope

In: the kiosk pages under `/terminal/*` (large targets, no account); the catalogue and the slip from
`src/features/*`, the slip in a `terminal` mode (no login, no balance, the retail rule set, a stake typed on
an on-screen keypad); slip codes with a QR; idle reset; the rate limit.

## Acceptance criteria

- [ ] **AC-1** (F8cc) Code screen shows `4829 1735` with a QR code, then resets after the idle timeout.
- [ ] **AC-3** (F8cb) The retail rule set is used for slip figures.
- [ ] **AC-6** (F8cc) A 429 from `POST /v1/retail/slip-codes` says when the terminal can make the next code
      (`Retry-After`).
