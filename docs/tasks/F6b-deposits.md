---
id: F6b
title: Split from F6 — methods and limits, deposits driven by next_action, every deposit status
status: verifying
depends_on: [F6a]
contract_tags: [Payments]
touches_money: true
touches_ui: true
---

# F6b — Deposits

Split from [F6](F6-wallet.md) (2026-10-03): money in. Builds on [F6a](F6a-balances-history.md)'s
balances; withdrawals are [F6c](F6c-withdrawals.md).

## Goal

A player deposits with any method the API offers, and the screen follows the API's `next_action` —
a redirect to the provider's page or "approve it on your phone" — rather than per-provider code. Every
deposit status has its own screen, the balance changes only once the server says the money arrived, and
a dropped connection never starts a second deposit.

## Read first

- `docs/decisions.md` **FD4**
- `docs/backend/design/components/c04-payments.md` §6–§10 (API, state machine, pollers, timeouts)
- `contracts/openapi.yaml`: `GET /v1/payment-methods` (`PaymentMethod`, `AmountRange`, `available`),
  `POST /v1/deposits` (`DepositRequest`, `Idempotency-Key`, examples `redirect`, `ussd_push`; 403, 422,
  502, 503), `GET /v1/deposits/{id}` (`completed`, `pending`; "poll every 3 s while pending"),
  `NextAction`, `DepositStatus`
- `docs/design/02-journeys.md` J1 step 8, `05-errors-and-states.md` (Wallet), `09-security.md`
  (Redirects)
- Existing: `src/features/wallet/*` after F6a, `src/lib/api/mock/wallet.ts`, `src/lib/server/csrf.ts`,
  `body.ts`, F5a's `POST /api/bets` (the key per intent)

## Scope

In:

- Methods and their deposit limits from `/v1/payment-methods`; a method the API marks unavailable can't
  be chosen; the amount is a decimal string validated against the method's `min`/`max` through
  `lib/money.ts` before submit.
- `POST /api/deposits` (same-origin, CSRF header, JSON, a capped body, a strict schema, the session; the
  browser's `Idempotency-Key` forwarded, never made) and `GET /api/deposits/{id}`.
- `next_action`: `redirect` → navigate only to an allow-listed provider host (https); `ussd_push` →
  "check your phone" with the API's message, polling `/v1/deposits/{id}` every 3 s until a final status;
  `app_sdk` → not possible on the web, choose another method. Coming back from the provider resumes the
  pending deposit.
- Every `DepositStatus` (`initiated`, `pending`, `completed`, `failed`, `expired`) has a screen state;
  `failed` and `expired` offer Retry (a new intent) and Choose another; `completed` re-reads the balance
  and the history.
- Refusals: `PAY_METHOD_UNAVAILABLE`, `PAY_AMOUNT_OUT_OF_RANGE`, `PAY_PROVIDER_ERROR`, `RG_LIMIT_REACHED`,
  `RG_SELF_EXCLUDED` / `RG_COOLING_OFF`, `KYC_REQUIRED`, `REAL_MONEY_DISABLED`; no answer → Try again with
  the same key.

Out: card payments; withdrawals (F6c); the deposit-limit card (F7).

## Acceptance criteria

From F6:

- [ ] **AC-1** (deposits) Each `DepositStatus` has a screen state (`pnpm ui` screenshots).
- [ ] **AC-2** `ussd_push` polls until `completed` and then refreshes the balance (hook test).
- [ ] **AC-3** A `redirect` to a host not on the allow-list is refused (unit test).
- [ ] **AC-4** (deposits) No balance changes before the server confirms (component test).
- [ ] **AC-7** (deposits) Methods and limits from `/v1/payment-methods`; an amount outside `min`–`max`
      or an unavailable method cannot be submitted.
- [ ] **AC-8** (deposits) One `Idempotency-Key` per deposit intent: the same key on a retry after no
      answer, a new one after a final answer.
- [ ] **AC-9** (deposits) Each deposit refusal in scope says what happened and offers its fix.

## Notes

Found while planning F6 (2026-10-03), for this task's plan to settle:

- Prism has no `initiated`, `failed` or `expired` deposit and no Problem example for the `PAY_*` codes:
  screens answered in the browser, as F5a did; a contract request for named examples may help.
- DEP-08 asks for the provider reference on the status screens; `Deposit` has no provider reference
  (only our `id`).
- Where the redirect allow-list lives (server config, exact https hosts, fail closed in production).
