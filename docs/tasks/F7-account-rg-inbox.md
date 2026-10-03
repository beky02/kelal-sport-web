---
id: F7
title: Account, limits, self-exclusion, reality check, promotions, inbox; delete the mocks
status: todo
depends_on: [F4]
contract_tags: [Me, Responsible gambling, Promotions, Inbox]
touches_money: false
touches_ui: true
---

# F7 — Account, responsible gambling, promotions, inbox

## Goal

The remaining screens move to the contract and the mock repository is deleted: limits and self-exclusion
live on the account (not in the browser), the reality check uses the server's session data, and
promotions and the inbox are real.

## Read first

- `docs/backend/design/components/c12-rg-aml.md`, `c11-bonuses.md`, `c14-notifications.md`
- `contracts/openapi.yaml`: `GET`/`PATCH /v1/me`, `/v1/me/sessions`, `GET`/`PUT /v1/me/limits`,
  `POST /v1/me/self-exclusion`, `/v1/promotions`, `/v1/me/bonuses`, `POST /v1/promo-codes/redeem`,
  `/v1/inbox`, `/v1/inbox/unread-count`, `POST /v1/inbox/read`, `/v1/config/public` (`rg`:
  `reality_check_minutes`), `/v1/pages/{slug}`
- Existing: `src/features/responsible-gaming/*`, `src/features/system/*` (session activity),
  `src/features/profile/*`, `src/lib/api/mock/*`

## Scope

In:

- Deposit/loss/stake limits and cool-off from `/v1/me/limits` (`RG_LIMIT_REACHED`, `RG_COOLING_OFF`,
  `RG_SELF_EXCLUDED` handled everywhere they can appear).
- Reality check every `rg.reality_check_minutes` from `/v1/me/sessions`. If staked/won totals are needed
  and the contract has none, raise a `/contract-request` — don't compute them in the browser.
- Promotions, bonuses, promo-code redeem (`Idempotency-Key`), inbox with unread count.
- `/terms`, `/privacy`, `/help` from `/v1/pages/{slug}` (replacing `PhasePlaceholder`).
- Delete `src/lib/api/mock/` and `NEXT_PUBLIC_USE_MOCKS`; port `tests/unit/realtime.test.ts` fixtures to
  contract examples.

## Acceptance criteria

- [ ] **AC-1** A limit set on one device is in force on another (it comes from `/v1/me/limits`).
- [ ] **AC-2** `RG_SELF_EXCLUDED` locks the slip and shows the end date.
- [ ] **AC-3** `src/lib/api/mock/` no longer exists and `pnpm verify` passes.
- [ ] **AC-4** Content pages render from `/v1/pages/{slug}`.

## Notes

- **The wallet's deposit-limit card** (2026-10-03, F6a decision 4): F6a removed the card and the deposit
  amount step's "left under today's limit", which read placeholder figures from the wallet mock. Bring
  them back here from `/v1/me/limits` — the deposit limit's `amount`, `used` and `period`, with Manage
  linking to Responsible gaming (`docs/design/04-slip-and-money.md`, Balances).
