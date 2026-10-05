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

### After review round 1 (at `d3c58d1`) — stopped at the user's request

The full `pnpm verify` was not completed after the review fixes: the machine was under heavy load from
other work (another session's backend Python process, a virtual machine, three other Claude Code
sessions, the Claude app at 183% CPU, ~75 MB of free memory), and the user asked to stop the review and
close the task. What did run on this code:

| Check                   | Result  | Evidence                                                                                                                                                                                                                                                |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`            | PASS    | Typecheck, lint, format and 1,293 tests, on a quiet machine just before `d3c58d1` was committed (that commit changed only strings checked by the suite and docs; the suite passed with them)                                                            |
| `pnpm api:check`        | PASS    | "Generated API types match contracts/openapi.yaml."                                                                                                                                                                                                     |
| Contract and docs drift | PASS    | "contracts/ matches the backend." / "docs/backend/ matches the backend."                                                                                                                                                                                |
| `pnpm build`            | PASS    | "✓ Compiled successfully", 39/39 static pages                                                                                                                                                                                                           |
| `pnpm ui`               | PARTIAL | Stopped at 428 of 470: 425 passed first time; 3 `auth.spec.ts` tests (F4a's, untouched here) passed only on their retry (flaky, below); 42 not run. The withdrawal and deposit screens the fixes touched passed in their own runs before (124, then 12) |
| `pnpm verify` (whole)   | NOT RUN | Two attempts at `d3c58d1` failed at `pnpm test` with timeouts under the load (Gaps); not retried — stopped at the user's request                                                                                                                        |

## Acceptance criteria

| AC    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | MET    | `Withdrawal.test.tsx` "shows each withdrawal status in words, with what to do next (AC-1)" — eight cases, PASS; "never shows a review reason it has no words for", PASS; `withdrawal.test.ts` "names a review reason it knows, and never shows one it doesn't (AC-1)", PASS; `pnpm ui` `withdrawal-requested`, `-review`, `-approved`, `-processing`, `-paid`, `-failed`, `-rejected`, `-cancelled` (32 PNGs, looked at)                                              |
| AC-4  | MET    | "changes no balance until the server answers the withdrawal (AC-4)" — the chip shows the API's 650.00, never 708.95; "…answers the cancel (AC-4)" — the API's 3,100.00, never 3,208.95; `WithdrawalPolling` "reads a withdrawal every 10 s until it is paid, and reads the balance again only when its status changes (AC-4)"; round 1: "reads the balance again when a withdrawal had no answer…" (M2), "…first seen in another language" (M3) — all PASS            |
| AC-8  | MET    | "sends the same Idempotency-Key on Try again after no answer, and a new one after an answer (AC-8)" (drop, timeout, 502 → one key; a new key after), "makes a new key when the account or the amount changes…", "asks who is signed in before Try again…", "keeps the key when the player leaves…", "shows the withdrawal that started after the player left…", "says a refused Try again didn't go through, and keeps its key (S2)"; route and unit tests — all PASS |
| AC-9  | MET    | One component test per code in scope (Verify, Keep wagering, Withdraw {amount} with a new key, Change amount with the fresh balance, Help, nothing for real money); `withdrawal.test.ts` "says what each withdrawal refusal means and offers its fix (AC-9)"; route "passes the API's refusals through…: 403, 422, 503 (AC-9)"; `pnpm ui` `withdraw-unconfirmed`, `-kyc`, `-bonus`, `-out-of-range`, `-insufficient`, `-break`, `-real-money` — PASS                  |
| AC-10 | MET    | Accounts listed, added (`POST`, chosen, focused) and removed (asked first, `DELETE`); withdrawals to a saved id and a new number as `account`; Cancel only while requested or in review (`DELETE`, CSRF header, no key; 409 and no answer re-read); the history row's link; the address both ways (Q1); route tests for all six calls; `pnpm ui` account and cancel screens — PASS                                                                                    |

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

Review round 1 (each test red before its fix, green after; `9d1a491` and `d3c58d1`):

- `Withdrawal` "follows the address both ways: a withdrawal the wallet opened closes on Back (Q1)" — red:
  the screen stayed on the withdrawal when the address lost it, and Done replaced instead of going Back.
- `Withdrawal` "offers Cancel only while…", "reads the status again when … no longer be cancelled",
  "says it couldn't confirm a cancel…", "adds a number…" — red on `toHaveFocus()` (Q2): focus fell to
  the page when the answer took the button away.
- `Withdrawal` "sends nothing for an address that can't name a withdrawal… (SEC1)" — red: `..` and `.`
  asked `/api/` and `/api/withdrawals/`.
- `Withdrawal` "never puts an account saved for one player into the next player's list (SEC2)" — red:
  the first player's account showed in the next player's step.
- `Withdrawal` "keeps the cancel's answer when a read was already on its way (Q3)" — red: the late read
  put "requested" back over "cancelled".
- `Withdrawal` "reads the balance again when a change is first seen in another language (M3)", "reads the
  balance again when a withdrawal had no answer… (M2)", "says nothing is too late when the read says it is
  already cancelled (M4)", "leaves the account out when the API didn't name it…", "shows each line of a
  notice once, an empty one never… (Q4)", and the Q5 role and description assertions — each red first.
- `Withdrawal` "says this withdrawal can't go through during a break, and offers help" — red until the
  button read Help (S1).
- `Withdrawal` "says a refused Try again didn't go through, and keeps its key (S2)" — passed at once (the
  behaviour was right, the coverage missing); fails when `refused()` drops the unanswered intent on a Try
  again's no.
- `Withdrawal` "changes no balance until the server answers the cancel (AC-4)", strengthened (M5) — fails
  when the cancel adds the amount to the cached balance instead of reading it again.
- `Withdrawal` "withdraws to a saved account by its id (AC-10)", title assertion (U2) — fails with the
  flow's status step titled Withdraw.
- `Withdrawal` "shows each withdrawal status… (AC-1): requested / processing / paid" — red on the old
  lines, green with the copy the user chose for M1.

## Review findings

Panel: spec-verifier (PASS: S1, S2), quality-reviewer (FAIL: Q1, Q2 MAJOR), money-reviewer (FAIL: M1
MAJOR), security-reviewer (PASS: SEC1, SEC2), ui-checker (PASS: U1–U3). No BLOCKER, so no re-review: each
fix has a test that failed before it and passes with it (above), or a re-taken screenshot.

| Id        | Reviewer       | Severity | Summary                                                                                                 | Decision                                                                                                                                                                                         |
| --------- | -------------- | -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1        | quality        | MAJOR    | Back didn't close a withdrawal opened from recent activity; leaving left the wallet twice in history    | Fixed in `9d1a491`: the screen is the address's (`?withdrawal=`), both ways; Done/Back is `router.back()` when the wallet put the id there, else `replace`. Test above                           |
| Q2        | quality        | MAJOR    | Focus lost after Cancel's answer and after Save                                                         | Fixed in `9d1a491`: the heading after a cancel's 200 or 409, the notice's Try again after no answer (held, busy, during its retry), the new account's radio after Save. Tests above              |
| M1        | money          | MAJOR    | requested, processing and paid lines claimed the amount received                                        | Fixed in `d3c58d1` — the user's decision: the lines name the withdrawal ("Your withdrawal was paid to {account}"); contract request 010 asks what `amount` is (item 8)                           |
| S1        | spec           | MINOR    | The break refusal's fix read "Contact support", not the approved "Help"                                 | Fixed: `withdraw.help` (Help / እገዛ)                                                                                                                                                              |
| S2        | spec; quality  | MINOR    | No test that a refused Try again keeps its key                                                          | Fixed: test added, proven against the bug                                                                                                                                                        |
| SEC1      | security       | MINOR    | `?withdrawal=..` resolved to `/api/` in the browser                                                     | Fixed: ids checked in the browser before any path (`pathId`), not found otherwise, nothing sent                                                                                                  |
| SEC2      | security       | MINOR    | Save's answer written into the list without checking who is signed in                                   | Fixed: the owner rides with the request; written only while it is still theirs                                                                                                                   |
| Q3 (= M3) | quality; money | MINOR    | A read in flight could put the old status over a cancel's 200; status changes tracked per language only | Fixed: `cancelQueries` before the answer, other languages' copies dropped, changes compared with the latest copy in any language                                                                 |
| Q4        | quality        | MINOR    | Notice lines keyed by text; an empty detail rendered                                                    | Fixed: keyed by place, empty lines dropped (deposits too)                                                                                                                                        |
| Q5        | quality        | MINOR    | Remove buttons inside a radiogroup; the hint not tied to the field                                      | Fixed: a named `group`; `aria-describedby` = the hint (and the problem when invalid)                                                                                                             |
| Q6        | quality        | MINOR    | Withdrawal screens reuse `deposit.backToWallet`, `deposit.provider`, `deposit.changeAmount`             | Follow-up: moving them to `wallet.*` rewrites F6b's `DepositFlow` and `MethodStep`, which this task doesn't touch                                                                                |
| U1        | ui             | MINOR    | Remove looked like a label                                                                              | Fixed: a raised button (re-taken: `withdraw-accounts`, `-number`, `-remove`)                                                                                                                     |
| U2        | ui             | MINOR    | The flow's status step titled "Withdraw"                                                                | Fixed for withdrawals ("Withdrawal", as from the history); the deposit flow's "Deposit" over its status is a follow-up (F6b's file)                                                              |
| U3        | ui             | MINOR    | "Too late to cancel" under the rows, pointing back up                                                   | Fixed: notices sit over the status they point to (re-taken: `withdrawal-not-cancellable`, `-cancel-unconfirmed`)                                                                                 |
| M2        | money          | MINOR    | No answer didn't re-read the balance, though an accepted withdrawal locks its amount at once            | Fixed: no answer re-reads the wallet and the history                                                                                                                                             |
| M4        | money          | MINOR    | "Too late to cancel" over a read that says it was cancelled (another tab)                               | Fixed: no too-late notice over a cancelled withdrawal                                                                                                                                            |
| M5        | money          | MINOR    | The cancel test's API figure equalled the browser-side sum                                              | Fixed: 3,100.00, and 3,208.95 never appears                                                                                                                                                      |
| M6        | money          | MINOR    | The unanswered intent is memory only: a reload makes a new key                                          | Follow-up: plan decision 6, as F6b's deposits; keeping it across a reload means `sessionStorage` (a phone number in the browser for a new number) and changes both flows — for the user to weigh |

Notes (no decision):

- The approved confirm line "You can cancel while it's being checked" is conditional, and true by the
  contract: Cancel is offered exactly while `requested` or in `review` (money).
- `Withdrawal.amount`'s meaning (asked, or paid) is now contract request 010's item 8 (money).
- The PhoneInput's 9 px "ET" prefix with tracking is F4's shared field, unchanged here (ui).
- No `pnpm ui` screen captures a loading skeleton — the repo's convention, not a gap opened here (ui).
- The bonus refusal's line and the API's detail ("Withdrawing now forfeits…") read as if a forfeit were
  offered; Confirm forfeit waits for contract request 008, Keep wagering is the only fix (ui, money).
- `withdrawal.ts`'s comment that a refused Try again "never offers a new withdrawal of the same amount"
  stands: a different amount (Withdraw {nearest}) is a new intent the player chooses (money).

## Gaps

- **Prism can't show** a requested, approved, failed, rejected or cancelled withdrawal, a cancel worth
  showing (its answer is generated from the schema: `"id": "string"`, `requested`), any withdrawal
  refusal, or an empty or failing account list: those screens are answered in the browser with shapes from
  the contract's schema (contract request 010 asks for named examples). `withdrawal-processing`,
  `withdrawal-review`, `withdrawal-paid` and the account step go through Prism end to end.
- **A real payout** (the provider paying a number) can't run locally; the statuses after `processing` are
  the API's to set.
- **Flaky**: none in the first gate — its 470 UI tests passed on the first try.
- **The final gate under load** (at `d3c58d1`): the first run failed at `pnpm test` with the machine's load
  average at ~55 (a Chrome renderer at 100%, Finder, a virtual machine and two other Claude Code
  sessions — none of them this task's): six tests timed out, files taking 36–50 s instead of ~1 s —
  `Withdrawal` "lists the player's saved accounts for the chosen method (AC-10)" ("Unable to find
  role="button" and name `/telebirr/`" within `findByRole`'s 1 s), `PlaceBet` "forgets a refusal once the
  slip changes" and four `RegisterFlow` tests ("Test timed out in 5000ms"). A `pnpm test` at load ~38 took
  101 s instead of ~9 s and timed out five others (`RegisterFlow` ×3, `Withdrawal` AC-8 ×2). The same
  suite passed whole three times on a quiet machine this session (1,293 tests). A third attempt, started
  with the load steady under 8, timed out again as the load climbed back to ~58; one with four workers
  timed out five tests. The test stage was not retried after that: the user stopped the review.
- **Flaky (UI, after review round 1)**: `auth.spec.ts` "logging out clears the session and the account
  pages close again (AC-8)", "sends a visitor without a session from the wallet to log in, and back
  afterwards", "logs in through the dialog and leaves no token in the browser (AC-3)" — each failed at
  ~20 s on its first try under the load and passed on the retry (6–8 s); the first error was not printed,
  as the run was stopped before Playwright's summary. F4a's tests, untouched by this task.
- **Not verified after review round 1**: 42 of the 470 UI tests (the run was stopped), and a single
  whole `pnpm verify` on the final commit.
- **Follow-ups**: Q6 (shared strings to `wallet.*`), M6 (an unanswered intent across a reload), the deposit
  flow's status title (U2's twin).
