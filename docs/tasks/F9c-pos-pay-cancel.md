---
id: F9c
title: Split from F9 — scan a ticket, pay it, cancel it
status: todo
depends_on: [F9b]
contract_tags: [Retail - cashier]
touches_money: true
touches_ui: true
---

# F9c — Scan, pay and cancel

Built in **`kelalsport-ops`**, not this repo (FD1, 2026-10-05); this file moves there when F12 creates it.

Split from [F9](F9-pos.md) (2026-10-03, before planning).

## Goal

A cashier scans a ticket, pays a winner exactly once — asking for ID or head-office approval where the
rules say — and cancels within the window with the stake refunded in cash.

## Read first

- `docs/backend/design/components/c19-retail-network.md` §4.4, §4.5, §12, §14
- `contracts/openapi.yaml`: `GET /v1/retail/tickets/{ticket_no}`, `POST /v1/retail/tickets/{ticket_no}/payout`,
  `POST /v1/retail/tickets/{ticket_no}/cancel`

## Scope

In: scanner input (ticket number and MAC); the ticket's status; payout (ID above the threshold, the daily
cap, not payable at this shop, already paid, waiting for head office); cancel (the window, the cancel
limit, a manager); Pay and Cancel disabled offline.

## Acceptance criteria

- [ ] **AC-3** (Pay, Cancel) Pay and Cancel are disabled offline.
- [ ] **AC-7** A payout goes once per intent and a paid ticket can't be paid again; a cancel outside the
      window or over the limit says why (route and component tests).
- [ ] **AC-2** (these operations) Every retail error code they can return has a clear message.
