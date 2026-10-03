---
id: F10f
title: Split from F10 — marketing and tenant settings in the back office
status: todo
depends_on: [F10b, F10d]
contract_tags: [Admin]
touches_money: true
touches_ui: true
---

# F10f — Marketing and settings

Split from [F10](F10-agent-backoffice.md) (2026-10-03, before planning).

## Goal

Marketing manages bonus rules (versioned, with a dry run), promo codes, banners, pages and campaigns;
admins edit the tenant configuration as versioned drafts with a diff and activate them under four-eyes.

## Read first

- `docs/backend/design/components/c15-back-office-trading.md` §5 (Marketing, Settings); `c11-bonuses.md`;
  `c14-notifications.md`; `c16-config-tenancy.md`
- `contracts/openapi.yaml`: `/v1/admin/bonus-rules` (`GET`, `POST`, `PATCH`, dry run),
  `/v1/admin/promo-codes` (`GET`, `POST`, `PATCH`, `DELETE`), `/v1/admin/cms/banners`,
  `/v1/admin/cms/pages`, `POST /v1/admin/campaigns`, `/v1/admin/config` and its versions and activation

## Acceptance criteria

- [ ] **AC-1** A configuration draft shows the API's diff and validation errors before activation; the
      betting, payments and responsible-gambling sections need a second approver.
- [ ] **AC-2** Changing a bonus rule creates a new version, and the dry run lists who would qualify.
- [ ] **AC-3** Promo codes are disabled, never deleted.
