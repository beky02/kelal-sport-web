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
