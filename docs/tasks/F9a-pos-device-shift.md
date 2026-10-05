---
id: F9a
title: Split from F9 — POS device, staff login, shifts and cash
status: todo
depends_on: [F8a]
contract_tags: [Retail - cashier]
touches_money: true
touches_ui: true
---

# F9a — POS device, login and shift

Split from [F9](F9-pos.md) (2026-10-03, before planning): selling needs an open shift, so the shift comes
first.

## Goal

The counter PC is activated once; a cashier or shop manager logs in with a PIN from that device only (the
shop manager is the contract's `shop_manager` role; whether it stays in Phase 1 is open, FD6 and
proposal 001 Q3); a shift opens with the counted cash, shows its running totals, records cash in and out, and closes with a
count by denomination and a Z report.

## Read first

- `docs/backend/design/components/c19-retail-network.md` §3, §4.6, §4.7, §9.2, §12; `c01-identity-auth.md`
  (Retail principals); `c18-client-apps.md` §5 (keyboard shortcuts)
- `contracts/openapi.yaml`: `POST /v1/retail/pos-devices/activate`, `POST /v1/retail/auth/login`,
  `/logout`, `POST /v1/retail/shifts`, `GET /v1/retail/shifts/current`,
  `POST /v1/retail/shifts/{id}/cash-movements`, `POST /v1/retail/shifts/{id}/close`,
  `GET /v1/retail/settlements/pending`, `POST /v1/retail/settlements/{id}/confirm`,
  `POST /v1/retail/staff/{id}/reset-pin`

## Scope

In: the POS app's shell (`apps/pos`), keyboard-first, the connection state always visible; device
activation; staff login and logout; shift open, running totals, cash movements (a manager PIN above the
threshold), close with the Z report; the shop manager confirms or disputes a cash collection and resets a
cashier's PIN.

Out: selling and printing (F9b); scan, pay and cancel (F9c).

## Acceptance criteria

- [ ] **AC-4** A shift opens with counted cash, shows the API's running totals, records cash in and out
      (a manager PIN above the threshold) and closes with a Z report (component tests; `pnpm ui`).
- [ ] **AC-5** Only an activated POS device can log in; `RETAIL_DEVICE_NOT_ALLOWED`, `RETAIL_PIN_LOCKED`,
      `RETAIL_SHIFT_ALREADY_OPEN` and `RETAIL_SHIFT_NOT_OPEN` each say what to do (component tests).
- [ ] **AC-2** (these operations) Every retail error code they can return has a clear message.
