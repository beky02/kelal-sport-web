---
id: F6
title: Wallet — balances, deposits with next_action, withdrawals, payout accounts, history
status: todo
depends_on: [F4]
contract_tags: [Wallet, Payments]
touches_money: true
touches_ui: true
---

# F6 — Wallet

## Goal

Deposit and withdrawal screens handle every status in the contract, for every provider, driven by the
API's `next_action` rather than per-provider code in the UI.

## Read first

- `../kelal backend/docs/design/components/c04-payments.md`, `c03-wallet-ledger.md` (what a player sees)
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
