---
id: F6a
title: Split from F6 — balances and history from the contract, money as strings
status: done
depends_on: [F4]
contract_tags: [Wallet]
touches_money: true
touches_ui: true
---

# F6a — Balances and history

Split from [F6](F6-wallet.md) (2026-10-03): the wallet's reads. Deposits are
[F6b](F6b-deposits.md) and withdrawals [F6c](F6c-withdrawals.md), which build on this.

## Goal

A signed-in player sees their real balances — the cash they bet with and can withdraw, bonus money,
pending withdrawals and anything owed — exactly as the API states them, in the header, the wallet and
the slip's balance check; and their real history, day by day, from the ledger. Every wallet amount
becomes the contract's decimal string, so the last float bridge in the app (`fromLegacyAmount`) goes.

## Read first

- `docs/decisions.md` **FD4** (amounts are strings; compared through `lib/money.ts`)
- `docs/backend/design/components/c03-wallet-ledger.md` §4 (chart of accounts: what `cash`, `bonus`,
  `locked` and `debt` mean), §7 (player API)
- `contracts/openapi.yaml`: `GET /v1/wallet` (`Wallet`), `GET /v1/wallet/transactions` (`WalletTxn`,
  `type` filter, `Limit`, `Cursor`, `NextCursor`)
- `docs/design/01-screens.md` (Wallet, Transactions), `04-slip-and-money.md` (Balances),
  `06-language-and-format.md` (money, signed figures, dates)
- Existing: `src/features/wallet/*`, `src/features/bets/components/TransactionsList.tsx`,
  `TransactionRow.tsx`, `src/components/layout/AppHeader.tsx` (balance chip),
  `src/features/bet-slip/hooks/use-bet-slip.ts` (balance check), `src/lib/api/mock/wallet.ts`,
  `mock/transactions.ts`

## Scope

In:

- `GET /api/wallet` and `GET /api/wallet/transactions` route handlers on the session; mappers tested
  against the contract's examples.
- Balances as strings everywhere they are shown or compared: header chip, wallet card, the slip's
  balance check, the withdraw amount step's ceiling.
- History: day headings in East Africa Time (calendar preference), kind and reference, time, signed
  amount, balance after; filter by the contract's `type`; Show more by `next_cursor`; the wallet's
  recent activity; loading, empty, error and guest states.
- The wallet and transactions mocks go; the deposit and withdrawal flow keeps its mock until F6b/F6c.

Out: payment methods, deposits (F6b); payout accounts, withdrawals (F6c); deposit limits
(`/v1/me/limits`, F7); bonus wagering details (`/v1/me/bonuses`, F7).

## Acceptance criteria

- [x] **AC-5** Balances come from `/v1/wallet` as the contract's decimal strings: the header chip, the
      wallet and the slip's balance check use `cash` exactly as sent; bonus, pending withdrawals
      (`locked`) and anything owed (`debt`) are shown, each only when above zero; nothing about a
      balance is computed in the browser.
- [x] **AC-6** History comes from `/v1/wallet/transactions`: movements grouped by day in East Africa
      Time, newest first, each with its kind, reference, time, signed amount and balance after; a
      filter asks for the contract's `type`; Show more follows `next_cursor`.

## Verification

- `pnpm verify` passes
- `pnpm ui`: `wallet`, `wallet-held`, `wallet-guest`, `transactions`, `transactions-more`,
  `transactions-empty`, `transactions-error`

## Notes

Plan: `docs/tasks/F6/plan.md`. Done 2026-10-03: evidence and every review finding in
`docs/tasks/F6/verification.md`.
