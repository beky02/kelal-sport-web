---
id: F10b
title: Split from F10 — back office shell, staff sign-in, dashboard, audit, staff and roles
status: todo
depends_on: [F8a]
contract_tags: [Admin]
touches_money: false
touches_ui: true
---

# F10b — Back office shell

Split from [F10](F10-agent-backoffice.md) (2026-10-03, before planning). The back office waits for the
admin APIs (B10); F10c–F10g build on this shell.

## Goal

Operator staff sign in with email, password and TOTP to a Refine back office that shows only what their
roles allow; today's dashboard, the audit log, and staff and roles management.

## Read first

- `docs/backend/design/components/c15-back-office-trading.md` §3, §5, §7; `c13-reporting-audit.md` (audit);
  `c18-client-apps.md` §3
- `contracts/openapi.yaml`: `POST /v1/admin/auth/login`, `/totp`, `GET /v1/admin/dashboard`,
  `GET /v1/admin/audit-log`, `/v1/admin/staff` (`GET`, `POST`, `PATCH`), `/v1/admin/roles` (`GET`, `POST`)

## Acceptance criteria

- [ ] **AC-1** Sign-in is email and password, then TOTP; a staff user sees only the sections their roles'
      permissions allow.
- [ ] **AC-2** The dashboard shows the API's counters for today.
- [ ] **AC-3** The audit log searches by actor, action, target and time.
- [ ] **AC-4** Staff and roles can be created and changed; a disabled staff user can't sign in.
