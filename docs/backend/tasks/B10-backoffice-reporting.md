---
id: B10
title: C15 admin APIs with audit and approvals; C13 reporting to FileSink (milestone M4)
status: todo
depends_on: [B7, B8, B9]
components: [C15, C13]
contract_tags: [Admin]
touches_money: true
---

# B10 — Back office APIs and regulator reporting

## Goal
The back office (Refine, in the web repo) has the admin APIs it needs, every staff action is audited,
money-moving actions need four-eyes approval, and reportable events reach the regulator `FileSink`.

## Read first
- `docs/design/components/c15-back-office-trading.md`, `c13-reporting-audit.md`
- `docs/engineering-decisions.md` D3 (staff tokens, permissions), D8 (scope)
- `contracts/openapi.yaml`, tag `Admin`

## Scope
Plan must split this. In: staff auth and roles/permissions (colon style, e.g. `retail:read`), audit log on
every admin write, approvals (four-eyes) for adjustments, payouts and config activation, admin endpoints in
the contract, `apps/reporter` with `FileSink`, daily summaries, reconciliation break listing.

## Acceptance criteria
- [ ] **AC-1** Every admin write creates an audit row with actor, before/after and request id (test per endpoint family).
- [ ] **AC-2** Approvals: requester cannot approve; approval executes exactly once (idempotent decision).
- [ ] **AC-3** Every endpoint checks its permission; a test enumerates admin routes and asserts a 403 without the permission.
- [ ] **AC-4** Reportable events land in the FileSink as JSON lines and are marked acknowledged; daily summary totals equal ledger totals for the day.
- [ ] **AC-5** `make conformance` passes for `Admin`.
