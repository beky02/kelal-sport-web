---
id: F7b
title: Split from F7 — profile preferences on the account, active devices, the reality check from the server
status: verifying
depends_on: [F4]
contract_tags: [Me, Config]
touches_money: true
touches_ui: true
---

# F7b — Account and reality check

Split from [F7](F7-account-rg-inbox.md) (2026-10-03, before planning).

## Goal

The profile's language and marketing choice are saved on the account; a player sees the devices signed
in and can sign one out; the reality check comes every `rg.reality_check_minutes` of play with figures
from the API, never worked out in the browser.

## Read first

- `docs/backend/design/components/c01-identity-auth.md` §6 (sessions, REG-10), `c12-rg-aml.md` §4
- `docs/design/02-journeys.md` (Reality check), `03-session-and-account.md` (Profile data)
- `contracts/openapi.yaml`: `PATCH /v1/me` (`MePatch`), `GET /v1/me/sessions`,
  `DELETE /v1/me/sessions/{id}`, `/v1/config/public` `rg`, `/v1/me` `flags.reality_check_minutes`
- Existing: `src/features/profile/*`, `src/features/system/*` (the session-activity mock and the dialog)

## Scope

In:

- Language and marketing consent through `PATCH /v1/me` (the language also follows FD2's URL rule).
- Active devices from `/v1/me/sessions`, the current one marked; sign another device out.
- The reality check on the tenant's or the player's interval, with the API's figures. If the contract has
  no staked and won totals for the session, a `/contract-request` comes first — never a computation.

Out: password change (no operation); push registration (`/v1/devices`, the app's).

## Acceptance criteria

- [ ] **AC-8** Language and marketing consent saved through `PATCH /v1/me` survive a reload and another
      device (route and component tests).
- [ ] **AC-9** Active devices come from `/v1/me/sessions` with the current one marked; signing another
      out calls `DELETE /v1/me/sessions/{id}` and removes it (component test; `pnpm ui` `profile`).
- [ ] **AC-10** The reality check opens every `rg.reality_check_minutes` of play with the API's figures
      only; Keep playing, Take a break, My limits (hook test with fake timers; `pnpm ui`).
