---
id: F10d
title: Split from F10 — finance and the four-eyes approvals queue
status: todo
depends_on: [F10b]
contract_tags: [Admin]
touches_money: true
touches_ui: true
---

# F10d — Finance and approvals

Built in **`kelalsport-ops`**, not this repo (FD1, 2026-10-05); this file moves there when F12 creates it.

Split from [F10](F10-agent-backoffice.md) (2026-10-03, before planning). The approvals queue built here
also decides the requests F10e, F10f and F10g create.

## Goal

Finance staff work the withdrawal queue, request manual wallet adjustments and decide the four-eyes
approvals queue — never their own request — and read reconciliation breaks and the finance and regulator
reports.

## Read first

- `docs/backend/design/components/c15-back-office-trading.md` §5 (Finance); `c03-wallet-ledger.md` §9;
  `c04-payments.md`; `c13-reporting-audit.md`
- `contracts/openapi.yaml`: `/v1/admin/withdrawals` and their decision, `POST /v1/admin/adjustments`,
  `GET /v1/admin/approvals`, `POST /v1/admin/approvals/{id}/decision` (`APPROVAL_SELF_NOT_ALLOWED`),
  `GET /v1/admin/reconciliation/breaks`, `GET /v1/admin/reports/{type}`

## Acceptance criteria

- [ ] **AC-1** A withdrawal is approved or rejected from the queue with a reason.
- [ ] **AC-2** An adjustment request lands in the approvals queue, and its requester can't approve it
      (`APPROVAL_SELF_NOT_ALLOWED`).
- [ ] **AC-3** Reports download in the format asked for (CSV, XLSX or PDF by `Accept`).
