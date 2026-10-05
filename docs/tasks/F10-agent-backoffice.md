---
id: F10
title: Agent portal, then back office (Refine)
status: todo
depends_on: [F8a]
contract_tags: [Agent portal, Admin, Admin - retail]
touches_money: true
touches_ui: true
---

# F10 — Agent portal and back office

Split (2026-10-03, before planning) into [F10a — agent portal](F10a-agent-portal.md) and the back office in
six parts following C15 §5's areas: [F10b — shell, sign-in, dashboard, audit, staff and roles](F10b-backoffice-shell.md),
[F10c — players and compliance](F10c-backoffice-players.md), [F10d — finance and approvals](F10d-backoffice-finance.md),
[F10e — trading and settlement](F10e-backoffice-trading.md), [F10f — marketing and settings](F10f-backoffice-marketing-settings.md)
and [F10g — retail administration](F10g-backoffice-retail.md). One reviewable PR each; the back office
waits for the admin APIs (B10). F10 is done when all seven are.

## Goal

Agents manage their shops, staff, terminals and settlements; then an internal back office on Refine once
the admin APIs exist (B10). Both work within one brand and the Phase 1 chain (FD6): every shop has an
agent (a brand agent for the brand's own shops, or a partner agent), and there are no master agents. The
platform console above the brands is F11, not part of F10.

## Read first

- `docs/decisions.md` **FD1** — this app is `apps/<name>` in the workspace F8a creates, built on its
  shared packages; **FD6** — the Phase 1 chain, and
  [backend proposal 001](../backend-proposals/001-platform-and-retail-hierarchy.md).
- `docs/backend/design/components/c15-back-office-trading.md`, `c19-retail-network.md` §agents
- `contracts/openapi.yaml`: `Agent portal`, `Admin`, `Admin - retail` operations

## Acceptance criteria

Each part carries its own criteria (F10a–F10g).
