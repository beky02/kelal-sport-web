---
id: F10e
title: Split from F10 — trading, risk and settlement in the back office
status: todo
depends_on: [F10b, F10d]
contract_tags: [Admin]
touches_money: true
touches_ui: true
---

# F10e — Trading and settlement

Built in **`kelalsport-ops`**, not this repo (FD1, 2026-10-05); this file moves there when F12 creates it.

Split from [F10](F10-agent-backoffice.md) (2026-10-03, before planning).

## Goal

Traders watch liability by fixture, suspend and reopen markets, set risk limits, search bets with their
settlement history, and request manual settlements that a second trader approves.

## Read first

- `docs/backend/design/components/c15-back-office-trading.md` §5 (Trading, Settlement), §6;
  `c08-bet-placement-risk.md`
- `contracts/openapi.yaml`: `GET /v1/admin/risk/liability` (polled every 5 s), `/v1/admin/risk/limits`
  (`GET`, `PUT`), `/v1/admin/markets/{id}/suspend`, `/reopen`, `/v1/admin/bets`, `/v1/admin/bets/{id}`,
  `POST /v1/admin/settlements/manual`, `GET /v1/admin/feed/health`

## Acceptance criteria

- [ ] **AC-1** The liability board re-reads every 5 s while visible, stops while hidden, and sorts by
      exposure.
- [ ] **AC-2** Suspending or reopening a market shows the API's answer, never an optimistic one.
- [ ] **AC-3** A manual settle, void or resettle request needs a second trader, through the approvals
      queue (F10d).
