---
id: F10g
title: Split from F10 — retail administration in the back office
status: todo
depends_on: [F10b, F10d]
contract_tags: [Admin - retail]
touches_money: true
touches_ui: true
---

# F10g — Retail administration

Split from [F10](F10-agent-backoffice.md) (2026-10-03, before planning).

## Goal

Operator staff manage agents and shops, terminals and POS devices, retail staff and commission plans;
decide big-win payout approvals; and see retail tickets, shifts and the retail dashboard.

## Read first

- `docs/backend/design/components/c15-back-office-trading.md` (Retail screens);
  `c19-retail-network.md` §3, §6, §9.3, §12
- `contracts/openapi.yaml`: the `Admin - retail` operations

## Acceptance criteria

- [ ] **AC-1** Creating a terminal or a POS device shows its one-time activation code once.
- [ ] **AC-2** Payout approvals are decided from their queue; a shop's limit change goes to the four-eyes
      queue (F10d).
- [ ] **AC-3** Retail tickets search by number, shop, cashier, date or status, with their full history.
