# F6c — verification

## Review brief

- **Server** (`src/lib/server/withdrawals.ts`, `src/app/api/payout-accounts`, `payout-accounts/[id]`, `withdrawals`, `withdrawals/[id]`, `lib/api/mappers/withdrawals.ts`, `schemas.ts`, `patterns.ts`, `csrf.ts`): six calls on the F4 session. POSTs have `/api/bets`' gates (origin, CSRF header, JSON, 4 KiB strict body; the withdrawal's UUID `Idempotency-Key` forwarded, never made); DELETEs have origin and CSRF but no JSON (`assertSameOrigin({ json: false })`); ids checked before they reach an upstream path; an account only as the contract's `Phone`.
- **Browser** (`features/wallet/api/withdrawals.ts`, `hooks/use-withdrawals.ts`, `lib/withdrawal.ts`, `stores/withdrawal.store.ts`; `apiClient.delete`): one key per intent — the same on Try again after no answer (a 502 included), `/api/me` asked first, kept when the player leaves; wallet and history re-read on a 201, a cancel's 200 and any status change, never adjusted; reads every 10 s (60 s in review) while the screen is open; `paymentKeys` dropped with the player.
- **Screens** (`AccountStep`, `WithdrawFlow`, `WithdrawalStatus`, `WithdrawAlert`, `WalletView` `?withdrawal=`, `TransactionRow`, `AmountStep`, `ConfirmStep`, `FlowHeader`; `PaymentOutcome` and `PaymentNotice` moved out of the deposit screens unchanged): saved accounts with Save and Remove, a new number in full on confirm, every status, Cancel only while requested or in review, each refusal's fix, the history row's link. The withdrawal mock is deleted.
- **Risk**: the key's lifecycle (a second withdrawal after no answer); the cancel's answers (409, none); the money copy on every status; phone numbers as personal data; the new DELETE path through CSRF.
- **User's decisions (plan gate)**: the status, refusal and confirm copy as proposed; payout accounts added and removed in the flow's account step; contract request 010 written now.
- **Not done**: Confirm forfeit (BON-07, waits for request 008); a list of withdrawals (not in the contract); bank-account payouts; following a withdrawal outside its screen (SMS, push and inbox tell the player); fees, withholding tax and arrival times (not in the contract).

## Self-review

- **Money moves:** a withdrawal moves money only by the API's answer — a 201 (cash → pending
  withdrawals), a cancel's 200 (back to cash) and any status change a later read shows each invalidate
  `walletKeys.all` and `transactionKeys.all`; nothing is subtracted or patched in the browser
  (`Withdrawal` AC-4 ×2, `WithdrawalPolling`). Bets are untouched by a withdrawal. The only cache writes
  are the API's own answers: the 201 and the cancel's 200 seed the withdrawal's query, and a saved or
  removed payout account is put in or taken out of the list before it is read again (not money).
- **New values:** the confirm step's Account, its prompt and the amount step's "To" use the destination's
  label (a saved account's `account_masked`, a new number through `formatPhone`); the status rows use
  the withdrawal's own `account_masked`, `amount` and `id`; the ceiling and the offered amount use
  `balances.cash` as the wallet passes it; Withdraw {amount} is the API's `errors[].limit`.
- **Async tests:** every component test waits for what it asserts (`findBy…`, `waitFor`); one did not —
  "reads the balance again when it is too low…" read the amount step's ceiling right after the re-read
  was asked for, not answered — now it waits for the new balance on screen. The polling test advances a
  fake clock and flushes before each check.
- **Personal data:** payout accounts and withdrawals sit under `paymentKeys` (dropped by
  `forgetPlayer`); the flow, its store and the withdrawal screen are the player's alone ("drops the payout
  accounts and the withdrawal when another player signs in"). The route handlers log no account number.
- **Route handlers:** all six read the session (401, nothing sent); bodies, keys and ids are checked
  before anything goes upstream (422 / 400 / 404 tests); `no-store` asserted on GET, POST and DELETE
  answers; `Prefer` only under `next dev` (tested on the withdrawal POST) and never to the real API (all
  six); a DELETE needs the origin and CSRF checks but no JSON.
- **Screens:** every state has a screenshot: the account step's loaded, empty (the number field open),
  couldn't load (Try again), a new number and Remove's question; amount; confirm; no answer; each
  refusal; every status; Cancel's three answers; couldn't check (Try again); not found. Loading is a
  skeleton that keeps the layout, as on every screen; guest is `wallet-guest`.
- **Docs:** the plan's AC→tests names now match the code (five renamed, one test split in two, the extras
  listed); its Files list matches the diff (`deposit.test.ts` and `Wallet.test.tsx` needed no change,
  `auth/lib/phone.ts` noted); 01, 02, 04, 05 and 09, the translation notes, contract request 010 and the
  README status are current.
- **Found on the way:** the status screen in the flow is now keyed by the withdrawal's id, so another
  id can never show the last one's data while its own loads (`keepPreviousData` is for a change of
  language).

## Automated gate

| Check                   | Result | Command                                                                                        |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| Typecheck               | PASS   | `pnpm typecheck` (route types regenerated with `next typegen` for the four new route files)    |
| Lint                    | PASS   | `pnpm lint`                                                                                    |
| Format                  | PASS   | `pnpm format:check`                                                                            |
| Unit + component tests  | PASS   | `pnpm test` — 59 files, 1,283 tests                                                            |
| Generated API types     | PASS   | `pnpm api:check`                                                                               |
| Contract and docs drift | PASS   | `node scripts/contract-sync.mjs --check`                                                       |
| Build                   | PASS   | `pnpm build`                                                                                   |
| UI screens              | PASS   | `pnpm ui` — 470 passed, none on a retry; 27 new withdrawal screens and `wallet-held` looked at |

Final `pnpm verify` (at `72bdaf9`), summary:

```
 Test Files  59 passed (59)
      Tests  1283 passed (1283)
Generated API types match contracts/openapi.yaml.
contracts/ matches the backend.
docs/backend/ matches the backend.
✓ Compiled successfully in 2.9s
✓ Generating static pages using 11 workers (39/39) in 323ms
  470 passed (3.6m)
```

## Tests proven

Each new acceptance test was seen failing against the behaviour it guards, then restored.

- `withdrawals-mappers` "sends a saved account by its id and a new number as account, never both" —
  `toWithdrawalRequest` sending a saved account as `account` and a new number by id.
- `withdrawals-mappers` "leaves out an account on a method the contract added after this build" — the
  provider filter dropped.
- `withdrawals-mappers` "keeps the API's rejection reason as sent, and leaves what it didn't send empty"
  — `rejectionReason` always null.
- `withdrawals-route` "requests the withdrawal with the player's token and the browser's key (AC-8)",
  "forwards the browser's Idempotency-Key unchanged…", "sends the withdrawal again with the same key
  after refreshing…" — the route handler sending a fresh UUID instead of the browser's key.
- `withdrawals-route` "refuses a cancel from another site or without the CSRF header, but needs no JSON
  body" — `assertSameOrigin` dropped from `DELETE /api/withdrawals/[id]`; and, the other way, the
  DELETE demanding a JSON body (`{ json: false }` dropped: ten tests fail with 415).
- `withdrawals-route` "refuses an account that is not a mobile number…" and "refuses a body that is not
  a withdrawal…" — the `Phone` check removed from the schemas.
- `withdrawals-route` "answers 404 and sends nothing for a withdrawal id that can't be one" — the id
  check removed from the cancel.
- `withdrawal` "tells no answer from a final answer (AC-8)" — a 502 `PAY_PROVIDER_ERROR` treated as
  final (the deposit rule).
- `withdrawal` "names a review reason it knows, and never shows one it doesn't (AC-1)" — any reason
  passed through as a key.
- `withdrawal` "offers only an amount the method takes and the balance covers (AC-9)" — the cash
  ceiling dropped from `nearestAllowedAmount`.
- `withdrawal` "tells a cancel's answers apart…" — every 409 read as too late, whatever its code.
- `withdrawal` "knows which statuses are final and which can still be cancelled" — `approved` made
  cancellable.
- `WithdrawalPolling` "reads a withdrawal every 10 s until it is paid, and reads the balance again only
  when its status changes (AC-4)" — no re-read on a status change; and a re-read on every read.
- `WithdrawalPolling` "reads one in review once a minute, not every 10 s" — review on the 10 s beat.
- `WithdrawalPolling` "stops reading a withdrawal the API says isn't this player's" — a 404 that keeps
  polling.
- `WithdrawalPolling` "reads nothing while the tab is hidden…" — `refetchIntervalInBackground: true`.
- `Withdrawal` "shows each withdrawal status in words, with what to do next (AC-1): approved" — Cancel
  added to the approved screen. (Forcing `cancellable` to true alone changes nothing on screen: Cancel
  is only ever added to the requested and review actions, so the rule is guarded twice.)
- `Withdrawal` "…(AC-1): review" — the review reason's line dropped; every status case — the
  `?withdrawal=` id ignored (15 fail).
- `Withdrawal` "changes no balance until the server answers the withdrawal (AC-4)" and "shows the
  withdrawal that started after the player left…" — no re-read of the wallet after a 201.
- `Withdrawal` "changes no balance until the server answers the cancel (AC-4)" — no re-read after a
  cancel's 200.
- `Withdrawal` "sends the same Idempotency-Key on Try again after no answer…", "asks who is signed in
  before Try again…", "keeps the key when the player leaves after no answer…" — a new key on every
  confirm; the `/api/me` check before Try again dropped (two fail); no answer not kept in the store (four
  fail).
- `Withdrawal` "shows the withdrawal that started after the player left, instead of sending another
  (AC-8)" — `started()` not recording the accepted withdrawal.
- `Withdrawal` "offers Verify…", "explains a bonus still being wagered…", "offers the nearest allowed
  amount…", "reads the balance again when it is too low…", "says this withdrawal can't go through during
  a break, and offers help" — each fix made to do nothing (or only change the amount), and the wallet's
  re-read after `WALLET_INSUFFICIENT_FUNDS` dropped.
- `Withdrawal` "adds a number through /api/payout-accounts and chooses it (AC-10)" — Save not choosing
  the API's account; "removes a saved account…" — Remove sending nothing.
- `Withdrawal` "reads the status again when the API says it can no longer be cancelled (AC-10)" and
  "says it couldn't confirm a cancel that had no answer…" — no re-read after a refused or unanswered
  cancel.
- `Withdrawal` "withdraws to a new number, sent as account, and reads the accounts again (AC-10)" — a
  new number sent as a saved id; and the account list not marked stale after the 201.
- `Withdrawal` "drops the payout accounts and the withdrawal when another player signs in" — the
  accounts' key moved outside `paymentKeys`.
- `Transactions` "opens a withdrawal from its row in the history…" — the withdrawal row's link removed.
