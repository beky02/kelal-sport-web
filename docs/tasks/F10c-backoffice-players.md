---
id: F10c
title: Split from F10 — players and compliance in the back office
status: todo
depends_on: [F10b]
contract_tags: [Admin]
touches_money: true
touches_ui: true
---

# F10c — Players and compliance

Split from [F10](F10-agent-backoffice.md) (2026-10-03, before planning).

## Goal

Staff find a player and see the 360 — profile, KYC, balances, limits, flags, transactions, bets, notes —
change their status, and decide KYC cases and AML alerts.

## Read first

- `docs/backend/design/components/c15-back-office-trading.md` §5 (Players, Compliance); `c02-kyc.md`;
  `c12-rg-aml.md` §5
- `contracts/openapi.yaml`: `/v1/admin/players`, `/players/{id}`, `/players/{id}/transactions`,
  `/players/{id}/status`, `/players/{id}/notes`, `/v1/admin/kyc/cases` and their decision,
  `/v1/admin/aml/alerts` and their decision

## Acceptance criteria

- [ ] **AC-1** Search by phone, name, ID or player ID; the 360 shows the API's balances and limits as the
      contract's strings.
- [ ] **AC-2** Suspending, closing or reopening a player needs a reason and shows in the audit log.
- [ ] **AC-3** KYC cases and AML alerts are decided from their queues with the API's reasons.
