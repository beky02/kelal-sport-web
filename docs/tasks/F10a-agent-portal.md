---
id: F10a
title: Split from F10 — agent portal
status: todo
depends_on: [F8a]
contract_tags: [Agent portal]
touches_money: true
touches_ui: true
---

# F10a — Agent portal

Split from [F10](F10-agent-backoffice.md) (2026-10-03, before planning).

## Goal

Agents sign in with phone, password and an SMS code, see their shops with today's figures, add staff and
terminals, record cash collected or float given, and read their weekly commission statements. An agent is
the brand's own (a brand agent) or a partner; both use the same portal, and there is one agent level
(FD6).

## Read first

- `docs/decisions.md` **FD6**; [backend proposal 001](../backend-proposals/001-platform-and-retail-hierarchy.md)
  §2–§3 (brand agents; Q2 and Q7 are open); [contract request 013](../contract-requests/013-platform-and-retail-chain.md)
- `docs/backend/design/components/c19-retail-network.md` §3, §4.7, §4.8, §9.3; `c18-client-apps.md` §5
- `contracts/openapi.yaml`: the `Agent portal` operations (`/v1/agent/auth/login`, `/verify`,
  `/refresh`, `/v1/agent/shops`, `/shops/{code}`, `/shops/{code}/staff`, `/shops/{code}/terminals`,
  `/v1/agent/settlements`, `/v1/agent/statements`, `/v1/agent/staff/{id}/reset-pin`)

## Acceptance criteria

- [ ] **AC-1** Login takes phone and password, then the SMS code; the tokens live in an httpOnly cookie
      as the player app's do (a Playwright check finds no token in storage JavaScript can read).
- [ ] **AC-2** Shops come from `/v1/agent/shops` with the API's figures for today; a shop's staff,
      terminals and recent shifts from `/v1/agent/shops/{code}`.
- [ ] **AC-3** A cash collection or float is recorded with one `Idempotency-Key` per intent and shows in
      the list only once the server has answered.
- [ ] **AC-4** Weekly commission statements show the API's figures.
- [ ] **AC-5** The portal shows the signed-in agent's own shops only: no sub-agents, subtrees or roll-ups
      (FD6); a brand agent sees the same screens as a partner (component test).
