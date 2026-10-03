---
id: F6
title: Wallet — balances, deposits with next_action, withdrawals, payout accounts, history
status: in_progress
depends_on: [F4]
contract_tags: [Wallet, Payments]
touches_money: true
touches_ui: true
---

# F6 — Wallet

Split (2026-10-03) into [F6a — balances and history](F6a-balances-history.md) (AC-5, AC-6),
[F6b — deposits](F6b-deposits.md) (AC-1 and AC-4 for deposits, AC-2, AC-3, AC-7, AC-8 and AC-9 for
deposits) and [F6c — withdrawals](F6c-withdrawals.md) (AC-1 and AC-4 for withdrawals, AC-8 and AC-9 for
withdrawals, AC-10), as F3, F4 and F5 were: one reviewable PR each. F6 is done when all three are. Plan
for F6a: `F6/plan.md`.

## Goal

Deposit and withdrawal screens handle every status in the contract, for every provider, driven by the
API's `next_action` rather than per-provider code in the UI.

## Read first

- `docs/decisions.md` **FD4** (limits and balances compared through `lib/money.ts`, never floats)
- `docs/backend/design/components/c04-payments.md`, `c03-wallet-ledger.md` (what a player sees)
- `contracts/openapi.yaml`: `GET /v1/wallet`, `/v1/wallet/transactions`, `/v1/payment-methods`,
  `/v1/me/payout-accounts` (GET/POST/DELETE), `POST /v1/deposits` (examples `redirect`, `ussd_push`),
  `GET /v1/deposits/{id}` (`completed`, `pending`), `POST /v1/withdrawals` (`processing`, `review`),
  `GET` / `DELETE /v1/withdrawals/{id}`
- Existing: `src/features/wallet/*`, `src/lib/api/mock/wallet.ts`

## Scope

In:

- Balances (cash, bonus, withdrawable) from `/v1/wallet`; history from `/v1/wallet/transactions`.
- Methods and their limits from `/v1/payment-methods`; amounts validated against them before submit.
- Deposit: `redirect` → navigate to an allow-listed provider host; `ussd_push` → "check your phone"
  with polling of `/v1/deposits/{id}` until a final status; `expired` and `failed` with retry.
- Withdrawal with payout accounts; `review` status explained; cancel while cancellable
  (`PAY_WITHDRAWAL_NOT_CANCELLABLE`); `PAY_ACTIVE_BONUS_WAGERING`.
- `Idempotency-Key` per intent on both POSTs.

Out: card payments.

## Acceptance criteria

- [ ] **AC-1** Each `DepositStatus` and `WithdrawalStatus` has a screen state (`pnpm ui` screenshots).
- [ ] **AC-2** `ussd_push` polls until `completed` and then refreshes the balance (hook test).
- [ ] **AC-3** A `redirect` to a host not on the allow-list is refused (unit test).
- [ ] **AC-4** No balance changes before the server confirms (component test).

Added at the split (2026-10-03) so every scope item above has an observable criterion:

- [ ] **AC-5** Balances come from `/v1/wallet` as the contract's decimal strings: the header chip, the
      wallet and the slip's balance check use `cash` exactly as sent; bonus, pending withdrawals
      (`locked`) and anything owed (`debt`) are shown, each only when above zero; nothing about a
      balance is computed in the browser.
- [ ] **AC-6** History comes from `/v1/wallet/transactions`: movements grouped by day in East Africa
      Time, newest first, each with its kind, reference, time, signed amount and balance after; a
      filter asks for the contract's `type`; Show more follows `next_cursor`.
- [ ] **AC-7** Methods and their limits come from `/v1/payment-methods`: an amount outside the method's
      `min`–`max` (compared as strings through `lib/money.ts`, FD4) cannot be submitted, and a method the
      API marks unavailable cannot be chosen.
- [ ] **AC-8** Each deposit and withdrawal intent sends one `Idempotency-Key`: a retry after no answer
      sends the same key; a new deposit or withdrawal after a final answer sends a new one (request-log
      test).
- [ ] **AC-9** Each refusal in scope says what happened and offers its fix: `PAY_METHOD_UNAVAILABLE`,
      `PAY_AMOUNT_OUT_OF_RANGE`, `PAY_PROVIDER_ERROR`, `RG_LIMIT_REACHED`, `KYC_REQUIRED`,
      `PAY_WITHDRAWAL_NOT_CANCELLABLE`, `PAY_ACTIVE_BONUS_WAGERING`, `REAL_MONEY_DISABLED`.
- [ ] **AC-10** Payout accounts are listed, added and removed through `/v1/me/payout-accounts`; a
      withdrawal goes to a saved account or a new number; Cancel is offered only while the withdrawal
      is `requested` or `review`.
