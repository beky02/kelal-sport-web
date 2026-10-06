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

Built in **`kelalsport-ops`**, not this repo (FD1, 2026-10-05); this file moves there when F12 creates it.

Split from [F10](F10-agent-backoffice.md) (2026-10-03, before planning).

## Goal

A brand's staff manage its agents and their shops, terminals and POS devices, retail staff and commission
plans; decide big-win payout approvals; and see retail tickets, shifts and the retail dashboard. The
network follows the Phase 1 chain (FD6): every shop has an agent — the brand's own shops sit under a brand
agent — and there are no master agents.

## Read first

- `docs/decisions.md` **FD6**; [backend proposal 001](../backend-proposals/001-platform-and-retail-hierarchy.md)
  §3; [contract request 013](../contract-requests/013-platform-and-retail-chain.md) (`Agent.kind`,
  `Shop.agent_id` required, the error answers)
- `docs/backend/design/components/c15-back-office-trading.md` (Retail screens);
  `c19-retail-network.md` §3, §6, §9.3, §12
- `contracts/openapi.yaml`: the `Admin - retail` operations

## Acceptance criteria

- [ ] **AC-1** Creating a terminal or a POS device shows its one-time activation code once.
- [ ] **AC-2** Payout approvals are decided from their queue; a shop's limit change goes to the four-eyes
      queue (F10d).
- [ ] **AC-3** Retail tickets search by number, shop, cashier, date or status, with their full history.
- [ ] **AC-4** A shop is created under an agent chosen first; no master agent and no shop without an agent
      can be created (FD6). Once contract request 013 lands, an agent is created as brand or partner and
      listed with it (component and route tests).
