# F6a — verification

Branch `task/F6-wallet`. Plan: `F6/plan.md` (approved 2026-10-03, interactive). F6a is the first of F6's
three parts; F6b and F6c verify on their own.

## Automated gate

| Check                  | Result  | Command / evidence                                         |
| ---------------------- | ------- | ---------------------------------------------------------- |
| Typecheck              | pending | `pnpm typecheck`                                           |
| Lint                   | pending | `pnpm lint`                                                |
| Format                 | pending | `pnpm format:check`                                        |
| Unit + component tests | pending | `pnpm test`                                                |
| Golden slip rows (D1)  | pending | `tests/unit/golden.test.ts`; `contracts/golden/` untouched |
| Generated types        | pending | `pnpm api:check`                                           |
| Contract drift         | pending | `contract-sync --check`                                    |
| Production build       | pending | `pnpm build`                                               |
| UI screens + e2e       | pending | `pnpm ui`                                                  |

## Acceptance criteria

| AC   | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-5 | PASS   | `wallet-mappers.test.ts` "maps the contract's wallet example without touching an amount", "keeps an absent debt empty, never zero"; `wallet-route.test.ts` "reads /v1/wallet with the player's token for this tenant, never cached (AC-5)", "answers 401 without a session and sends nothing upstream", "refreshes an expired token once and reads again", "ends a session the API no longer honours: 401, cookie cleared", "passes the API's Problem through with the contract's fields only"; `Wallet.test.tsx` "shows the cash balance exactly as the API sends it, and the bonus apart (AC-5)" (ETB 1,208.95; Bonus ETB 50.00 with its note; no pending or owed line for 0.00), "shows pending withdrawals and the amount owed only when above zero (AC-5)", "shows no owed line when the API doesn't say, rather than zero", "asks a guest to log in, and reads nothing", "says when the wallet couldn't load, and Try again reads it again", "asks for a deposit when the stake is above the cash balance, bonus aside (AC-5)" (cash 40.00 + bonus 500.00 against 50.00 → Deposit to continue; cash 50.00 → Place bet); `Session.test.tsx` "shows the balance and the profile to a player" (chip named "Wallet, balance ETB 1,208.95"); screens `wallet`, `wallet-held`, `wallet-guest` |
| AC-6 | PASS   | `wallet-mappers.test.ts` "maps the contract's history example: kinds, signed amounts, balance after, references", "passes the next page's cursor on", "keeps a movement with no reference, or half of one, without inventing the rest"; `wallet-route.test.ts` "forwards type, cursor and limit to /v1/wallet/transactions and answers nextCursor (AC-6)", "asks for the first page of everything with no filter, cursor or limit", nine "refuses … with 422 and sends nothing"; `Transactions.test.tsx` "groups movements by day in East Africa Time, newest first (AC-6)" (22:30 UTC on the 3rd under "Today · 4 Oct"), "shows each movement's kind, reference, time, signed amount and balance after (AC-6)", "names every kind the contract has…", "asks for the contract's type when a filter is chosen (AC-6)", "pages with next_cursor: Show more adds the next page under the same days, and goes on the last (AC-6)", the empty, failed, failed-more and guest states; `Wallet.test.tsx` "lists the latest movements under Recent activity, with date and time", "says when there is no activity yet, and when it couldn't load"; screens `transactions`, `transactions-more`, `transactions-empty`, `transactions-error`                                                            |

## Review findings

Pending.

## Gaps

Pending.
