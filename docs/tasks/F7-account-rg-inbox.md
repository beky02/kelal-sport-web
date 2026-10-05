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

Split (2026-10-03, before planning) into [F7a — responsible gambling](F7a-responsible-gambling.md) (AC-1,
AC-2, AC-5–AC-7), [F7b — account and reality check](F7b-account-reality-check.md) (AC-8–AC-10),
[F7c — promotions and inbox](F7c-promotions-inbox.md) (AC-11–AC-13) and
[F7d — content pages and the mocks' removal](F7d-content-mocks.md) (AC-3, AC-4): one reviewable PR each.
F7 is done when all four are. F7a is done (2026-10-05): AC-1, AC-2, AC-5, AC-6, AC-7 ticked below.

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

- [x] **AC-1** A limit set on one device is in force on another (it comes from `/v1/me/limits`).
- [x] **AC-2** `RG_SELF_EXCLUDED` locks the slip and shows the end date.
- [ ] **AC-3** `src/lib/api/mock/` no longer exists and `pnpm verify` passes.
- [ ] **AC-4** Content pages render from `/v1/pages/{slug}`.

Added at the split (2026-10-03) so every scope item has an observable criterion:

- [x] **AC-5** Raising a limit shows it pending with the API's effective time; lowering it applies at once.
- [x] **AC-6** Taking a break asks once, sends `POST /v1/me/self-exclusion` and leaves the player signed
      out with the end date shown; a reload changes nothing.
- [x] **AC-7** The wallet's deposit-limit card shows the deposit limit's `used` and `amount` from
      `/v1/me/limits`.
- [ ] **AC-8** Language and marketing consent saved through `PATCH /v1/me` survive a reload and another
      device.
- [ ] **AC-9** Active devices come from `/v1/me/sessions`; signing another out calls
      `DELETE /v1/me/sessions/{id}`.
- [ ] **AC-10** The reality check opens every `rg.reality_check_minutes` of play with the API's figures
      only.
- [ ] **AC-11** Offers, the active bonus's wagering progress and free bets show the API's figures.
- [ ] **AC-12** A promo code is redeemed with one `Idempotency-Key` per intent; `PROMO_INVALID` and
      `PROMO_ALREADY_USED` say so.
- [ ] **AC-13** The inbox, its unread badge and marking read come from the inbox operations.

## Notes

- **The wallet's deposit-limit card** (2026-10-03, F6a decision 4; now [F7a](F7a-responsible-gambling.md), AC-7): F6a removed the card and the deposit
  amount step's "left under today's limit", which read placeholder figures from the wallet mock. Bring
  them back here from `/v1/me/limits` — the deposit limit's `amount`, `used` and `period`, with Manage
  linking to Responsible gaming (`docs/design/04-slip-and-money.md`, Balances).
