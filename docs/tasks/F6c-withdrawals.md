---
id: F6c
title: Split from F6 — withdrawals with payout accounts, every withdrawal status, cancel
status: planned
depends_on: [F6b]
contract_tags: [Payments]
touches_money: true
touches_ui: true
---

# F6c — Withdrawals

Split from [F6](F6-wallet.md) (2026-10-03): money out. Builds on [F6a](F6a-balances-history.md)'s
balances and [F6b](F6b-deposits.md)'s methods and amount step.

## Goal

A verified player withdraws to a saved payout account or a new number, sees what the API decided —
paid out, sent for review and why, rejected and why — and can cancel while the withdrawal is still
cancellable. The balance moves only when the server says so, and a dropped connection never requests a
second withdrawal.

## Read first

- `docs/decisions.md` **FD4**
- `docs/backend/design/components/c04-payments.md` §5–§8 (payout accounts, the withdrawal state machine,
  the rules chain), `c11-bonuses.md` (BON-07), `c03-wallet-ledger.md` §6 (`WITHDRAW_LOCK`,
  `WITHDRAW_RELEASE`)
- `contracts/openapi.yaml`: `GET`/`POST /v1/me/payout-accounts`, `DELETE /v1/me/payout-accounts/{id}`,
  `POST /v1/withdrawals` (`WithdrawalRequest`, examples `processing`, `review`), `GET` /
  `DELETE /v1/withdrawals/{id}` (409 `PAY_WITHDRAWAL_NOT_CANCELLABLE`), `WithdrawalStatus`
- `docs/design/02-journeys.md` J3, `03-session-and-account.md` (KYC states, `can_withdraw`),
  `05-errors-and-states.md` (Wallet)
- Existing: `src/features/wallet/*` after F6b

## Scope

In:

- Payout accounts listed, added (`provider`, `account_ref`) and removed.
- Withdraw: a method with a `withdrawal` range, a saved account (`payout_account_id`) or a new number
  (`account`), an amount validated against the range and the cash balance as strings; `POST /api/withdrawals`
  with the browser's `Idempotency-Key`.
- Every `WithdrawalStatus` (`requested`, `review` with `review_reason`, `approved`, `processing`, `paid`,
  `failed`, `rejected` with `rejection_reason`, `cancelled`) has a screen state; a withdrawal can be found
  again from its row in the history (its `payment` reference).
- Cancel while `requested` or `review` (`DELETE /api/withdrawals/{id}`); `PAY_WITHDRAWAL_NOT_CANCELLABLE`
  re-reads the status; the money back in cash is the API's balance.
- Refusals: `KYC_REQUIRED` (Verify), `PAY_ACTIVE_BONUS_WAGERING` (BON-07), `PAY_AMOUNT_OUT_OF_RANGE`,
  `WALLET_INSUFFICIENT_FUNDS`, `RG_SELF_EXCLUDED`, `REAL_MONEY_DISABLED`; no answer → Try again with the
  same key.

## Acceptance criteria

From F6:

- [ ] **AC-1** (withdrawals) Each `WithdrawalStatus` has a screen state (`pnpm ui` screenshots).
- [ ] **AC-4** (withdrawals) No balance changes before the server confirms (component test).
- [ ] **AC-8** (withdrawals) One `Idempotency-Key` per withdrawal intent: the same key on a retry after
      no answer, a new one after a final answer.
- [ ] **AC-9** (withdrawals) Each withdrawal refusal in scope says what happened and offers its fix.
- [ ] **AC-10** Payout accounts are listed, added and removed through `/v1/me/payout-accounts`; a
      withdrawal goes to a saved account or a new number; Cancel is offered only while `requested` or
      `review`.

## Notes

Found while planning F6 (2026-10-03), for this task's plan to settle:

- **BON-07** asks the player to confirm a forfeit when withdrawing with an active bonus
  (`docs/design/05`: "Confirm forfeit, or keep wagering"). The contract has no way to say it: no flag on
  `WithdrawalRequest`, no forfeit operation. [Contract request 008](../contract-requests/008-withdrawal-bonus-forfeit.md)
  (written in F6a) asks for an optional `forfeit_bonus` on `POST /v1/withdrawals`; a Confirm button
  waits for it.
- `apiClient` has no `DELETE` yet (cancel, remove an account).
- Prism has only `processing`, `review` and `paid` withdrawals: the other statuses are answered in the
  browser for `pnpm ui`.
