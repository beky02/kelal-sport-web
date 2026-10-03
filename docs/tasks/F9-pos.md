---
id: F9
title: Cashier POS app
status: todo
depends_on: [F8a]
contract_tags: [Retail - cashier]
touches_money: true
touches_ui: true
---

# F9 — Cashier POS

Split (2026-10-03, before planning) into [F9a — POS device, login and shift](F9a-pos-device-shift.md)
(AC-4, AC-5), [F9b — sell and print](F9b-pos-sell-print.md) (AC-1, AC-3 for Sell, AC-6) and
[F9c — scan, pay and cancel](F9c-pos-pay-cancel.md) (AC-3 for Pay and Cancel, AC-7); AC-2 is shared, each
part covering the error codes its operations return. Selling needs an open shift, so the shift comes
first. F9 is done when all three are.

## Goal

The counter app: log in, open a shift, sell from a slip code, print the receipt, scan and pay, cancel,
cash in and out, close the shift with a Z report.

## Read first

- `docs/decisions.md` **FD1** — this app is `apps/<name>` in the workspace F8a creates, built on its
  shared packages.
- `docs/backend/design/components/c19-retail-network.md`, `c18-client-apps.md` §5 (receipt
  printing, keyboard shortcuts, scanner input)
- `contracts/openapi.yaml`: the `Retail - cashier` operations (`/v1/retail/auth/*`, `/shifts/*`,
  `/slip-codes/{code}`, `/tickets/*`, `/settlements/*`)

## Acceptance criteria

- [ ] **AC-1** A receipt prints from Chrome on the dev machine (80 mm print CSS).
- [ ] **AC-2** Every retail error code in the contract has a clear message.
- [ ] **AC-3** Sell, Pay and Cancel are disabled offline.

Added at the split (2026-10-03):

- [ ] **AC-4** A shift opens with counted cash, shows the API's running totals, records cash in and out
      and closes with a Z report.
- [ ] **AC-5** Only an activated POS device can log in, and the device, PIN and shift refusals say what
      to do.
- [ ] **AC-6** A sale sends one `Idempotency-Key` per intent, reused on a retry after no answer.
- [ ] **AC-7** A payout goes once per intent and a paid ticket can't be paid again; a cancel outside the
      window or over the limit says why.
