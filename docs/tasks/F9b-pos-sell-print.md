---
id: F9b
title: Split from F9 — sell from a slip code, print the receipt
status: todo
depends_on: [F9a]
contract_tags: [Retail - cashier]
touches_money: true
touches_ui: true
---

# F9b — Sell and print

Built in **`kelalsport-ops`**, not this repo (FD1, 2026-10-05); this file moves there when F12 creates it.

Split from [F9](F9-pos.md) (2026-10-03, before planning).

## Goal

A cashier loads a customer's slip code at current odds, sells it for cash exactly once, and prints the
receipt silently on 80 mm or 58 mm paper; a reprint is marked COPY.

## Read first

- `docs/backend/design/components/c19-retail-network.md` §4.3, §8, §9.2, §13; `c18-client-apps.md` §5
- `contracts/openapi.yaml`: `GET /v1/retail/slip-codes/{code}`, `POST /v1/retail/tickets`
  (`Idempotency-Key`), `POST /v1/retail/tickets/{ticket_no}/reprint`,
  `GET /v1/retail/shifts/current/tickets`

## Scope

In: slip-code entry (F2 new sale, F9 sell), the repricing shown, sell with a key per intent, the receipt
(HTML and print CSS, 80 and 58 mm, Code 128 with the MAC), reprint, the shift's tickets; Sell disabled
offline.

## Acceptance criteria

- [ ] **AC-1** A receipt prints from Chrome on the dev machine (80 mm print CSS).
- [ ] **AC-3** (Sell) Sell is disabled offline.
- [ ] **AC-6** A sale sends one `Idempotency-Key` per intent, reused on a retry after no answer;
      `RETAIL_SLIP_CODE_EXPIRED` and `RETAIL_SLIP_CODE_CONSUMED` say so (route and component tests).
- [ ] **AC-2** (these operations) Every retail error code they can return has a clear message.
