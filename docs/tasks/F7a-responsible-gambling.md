---
id: F7a
title: Split from F7 — limits, breaks and self-exclusion on the account; RG refusals everywhere
status: verifying
depends_on: [F4, F6a]
contract_tags: [Responsible gambling, Me]
touches_money: true
touches_ui: true
---

# F7a — Responsible gambling

Split from [F7](F7-account-rg-inbox.md) (2026-10-03, before planning).

## Goal

A player's limits, breaks and self-exclusion live on the account, not in one browser: set on one device,
in force on every other, enforced by the API. The screens say what the API decided — a limit reached, a
break until a date — and offer the way on.

## Read first

- `docs/backend/design/components/c12-rg-aml.md` §3, §4, §8
- `docs/design/02-journeys.md` (Take a break or self-exclude), `05-errors-and-states.md` (the RG codes,
  the Deposit limit dialog), `04-slip-and-money.md` (Balances: daily deposit limit)
- `contracts/openapi.yaml`: `GET` / `PUT /v1/me/limits` (`RgLimit`, `RgLimitSet`, pending increases),
  `POST /v1/me/self-exclusion`, `/v1/me` `flags.excluded_until`
- Existing: `src/features/responsible-gaming/*` (limits are local state today), the slip's RG refusals
  (F5a), `src/features/wallet/components/WalletHome.tsx` (the deposit-limit card F6a removed)

## Scope

In:

- Deposit, loss, stake and session limits per day, week or month from `/v1/me/limits`; set or change them
  through `PUT` — a decrease applies at once, an increase is shown pending with the API's effective time.
- Take a break or self-exclude through `POST /v1/me/self-exclusion`, confirmed once in full sentences; the
  API revokes every session.
- The break from `/v1/me` (`flags.excluded_until`): the cool-off banner, the slip locked, deposits off —
  server state a reload can't end.
- `RG_LIMIT_REACHED`, `RG_COOLING_OFF` and `RG_SELF_EXCLUDED` handled wherever they appear, with the API's
  `detail` and View limits.
- The wallet's deposit-limit card back, from `/v1/me/limits`: used, amount, period, Manage.

Out: the reality check (F7b); AML.

## Acceptance criteria

- [ ] **AC-1** A limit set on one device is in force on another (it comes from `/v1/me/limits`).
- [ ] **AC-2** `RG_SELF_EXCLUDED` locks the slip and shows the end date.
- [ ] **AC-5** Raising a limit shows it pending with the API's effective time; lowering it applies at
      once (route and component tests; `pnpm ui` `responsible-gaming`).
- [ ] **AC-6** Taking a break asks once, sends `POST /v1/me/self-exclusion` and leaves the player signed
      out with the end date shown; a reload changes nothing (component test).
- [ ] **AC-7** The wallet's deposit-limit card shows the deposit limit's `used` and `amount` from
      `/v1/me/limits` (component test; `pnpm ui` `wallet`).

## Notes

- Limit amounts are money: compared and shown as the contract's strings (FD4).
