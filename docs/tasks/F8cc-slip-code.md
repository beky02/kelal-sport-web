---
id: F8cc
title: Split from F8c — slip to an 8-digit code with a QR, idle reset, the rate limit
status: planned
depends_on: [F8cb]
contract_tags: [Retail - terminal]
touches_money: true
touches_ui: true
---

# F8cc — Slip to code

Split from [F8c](F8c-terminal-slip-code.md) (2026-10-06, while planning). Carries F8c's **AC-1** and
**AC-6**.

## Goal

A customer turns the kiosk's slip into an 8-digit code with a QR code to pay at the counter; the screen
resets for the next customer after the code has been shown, or when nobody has touched it for a while.

## Read first

- `docs/backend/design/components/c19-retail-network.md` §4.2, §9.1, §11, §14; `c18-client-apps.md` §5
- `docs/backend/engineering-decisions.md` D3 (device signatures)
- `contracts/openapi.yaml`: `POST /v1/retail/slip-codes` (30 per terminal per 10 minutes; 401, 422,
  429 `Retry-After`), `GET /v1/retail/terminal` (`idle_reset_seconds`, `code_display_seconds`)
- `docs/tasks/F8b/plan.md` decision 2 (signed bodies forwarded byte for byte), F3b's booking intent

## Scope

In: `POST /api/terminal/slip-codes` (signed in the browser over the exact body, forwarded byte for byte,
one `Idempotency-Key` per Get code); the code screen (`display`, a QR of `qr`, valid until) for
`code_display_seconds` (60) and then a clean screen; the idle reset after `idle_reset_seconds` (90) without
a touch (slip, filters and language back to the start); no price polling while idle; the 429 with
`Retry-After`; the other refusals (422 with their fixes, 401 → the status decides, `RETAIL_SHOP_CLOSED`).

Out: the POS that sells the code (F9, `kelalsport-ops`).

## Acceptance criteria

- [ ] **AC-1** (F8c) The code screen shows `4829 1735` with a QR code, then resets after the display time
      and after the idle timeout (fake timers; `pnpm ui`).
- [ ] **AC-6** (F8c) A 429 from `POST /v1/retail/slip-codes` says when the terminal can make the next code
      (`Retry-After`), and Get code waits until then.
- [ ] **AC-c1** The slip code request is signed over its exact body and carries one `Idempotency-Key` per
      Get code, reused on retry; the route handler checks host, origin, body and signature before calling
      the API.
- [ ] **AC-c2** (added at the plan gate, from Scope) No price polling while the kiosk is idle; the first
      touch reads the prices on screen again and polling resumes; the terminal's status is still read while
      idle.
- [ ] **AC-c3** (added at the plan gate, from Scope) The other refusals: a refused stake hint offers the
      server's limit as a tap; a started or suspended leg is marked, with Remove it; a 401, a disallowed
      device or `RETAIL_SHOP_CLOSED` lets the terminal's status decide; a network failure says so, and Get
      code tries again with the same key.

## Verification

- `pnpm verify` passes
- `curl -H 'Prefer: code=429' …` through the dev server; `pnpm ui --grep terminal-code`

## Notes

- 2026-10-06: split from F8c while planning. Needs a QR encoder (C18 §5 names `qrcode`): a new
  dependency, decided in this sub-task's plan.
- 2026-10-08 (from F8cb's review, M2/Q3): the kiosk's stake starts empty through a mount effect in
  `Kiosk.tsx`. The idle reset here should own one named action that puts the slip back to the kiosk's
  start (no picks, an empty stake, the language), called both at start and on idle, rather than an effect
  whose order against children's effects matters.
- 2026-10-08 (from F3c): the slip store holds three slips; the idle reset calls `resetAll()` (every slip
  empty, Slip 1 on screen) along with the language.
- 2026-10-08 (plan gate): Get code replaces the kiosk's Book bet; after a code the kiosk starts over
  unless another slip has picks; the QR is drawn from `qrcode`'s matrix. See [F8cc/plan.md](F8cc/plan.md).
