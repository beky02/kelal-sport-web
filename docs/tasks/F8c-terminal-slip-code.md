---
id: F8c
title: Split from F8 — kiosk sportsbook and slip to code
status: todo
depends_on: [F8b]
contract_tags: [Retail - terminal, Catalogue, Config]
touches_money: true
touches_ui: true
---

# F8c — Terminal slip to code

Split from [F8](F8-terminal.md) (2026-10-03, before planning).

## Goal

A customer at the kiosk browses matches, builds a slip priced with the retail rule set, and gets an
8-digit code with a QR to pay at the counter; the screen resets when idle.

## Read first

- `docs/backend/design/components/c19-retail-network.md` §4.2, §9.1, §13; `c18-client-apps.md` §5
- `docs/backend/engineering-decisions.md` D1 (the slip), D7
- `contracts/openapi.yaml`: `POST /v1/retail/slip-codes` (30 per terminal per 10 minutes), the retail
  rule set in `/v1/config/public`

## Scope

In: the kiosk layout (large targets, no account); the shared catalogue and slip packages; slip codes with
a QR; idle reset; the rate limit.

## Acceptance criteria

- [ ] **AC-1** Code screen shows `4829 1735` with a QR code, then resets after the idle timeout.
- [ ] **AC-3** The retail rule set is used for slip figures.
- [ ] **AC-6** A 429 from `POST /v1/retail/slip-codes` says when the terminal can make the next code
      (`Retry-After`).
