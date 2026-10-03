# F6b — verification

## Review brief

- **Server** (`src/lib/server/config.ts`, `payments.ts`, `src/app/api/payment-methods`, `deposits`, `deposits/[id]`, `lib/api/mappers/payments.ts`, `schemas.ts`): three route handlers on the F4 session; `POST /api/deposits` has `/api/bets`' gates (origin, CSRF header, JSON, 4 KiB strict body, UUID key forwarded, session) and builds `return_url` itself; a provider redirect reaches the browser only for an https host on `PAYMENT_REDIRECT_HOSTS` (exact names; none in production unless set).
- **Browser** (`features/wallet/api/payments.ts`, `hooks/use-payments.ts`, `lib/deposit.ts`, `lib/provider-redirect.ts`): one key per intent (`useDepositAttempt`; the same on Try again after no answer, `/api/me` asked first), polling every 3 s until final, wallet and history invalidated only on `completed`; `paymentKeys` dropped with the player; the resume pointer in `sessionStorage` (id + player id).
- **Screens** (`components/DepositFlow`, `DepositStatus`, `DepositAlert`, `MethodStep`, `AmountStep`, `ConfirmStep`, `WalletView`, `WithdrawFlow`): contract methods for both directions, every status, each refusal with its fix; withdrawals moved out unchanged on the mock (F6c).
- **Shared** (`lib/idempotency.ts`, `lib/money.ts` `sanitiseAmount`): moved from the slip, which now imports them.
- **Risk**: the redirect allow-list and `return_url` (open redirect); the key's lifecycle (a second deposit after no answer); the money copy on the status screens.
- **User's decisions (plan gate)**: the status copy as proposed, DEP-09 line included; a new key after `PAY_PROVIDER_ERROR`; contract request 009 written now (provider reference, examples, the 502's key).
- **Not done**: card payments; paying from another phone; withdrawals and payout accounts (F6c); the deposit-limit card and dialog figures (F7); brand logos (not in the contract).

## Self-review

- **Money moves:** a deposit moves money only when the API says `completed` — the step to it (a poll, a
  201 or a resumed read already completed) invalidates `walletKeys.all` and `transactionKeys.all`, once;
  `failed` and `expired` invalidate nothing; nothing is patched in the browser (`DepositPolling`,
  `Deposit` AC-4).
- **New values:** the status rows and "Money added" use the deposit's own `amount` and `method`; the
  confirm step, Try again and a refusal use the request on screen, which equals the attempt's (the alert
  shows only while it does); Deposit {amount} is the API's `errors[].limit`; the withdrawal ceiling is
  still `cash`.
- **Async tests:** every component test waits for the data it asserts on (methods by `findBy…`, the
  balance by `waitFor`, three pending reads before "nothing changed"); the polling test advances a fake
  clock and flushes before each check.
- **Personal data:** methods and deposits sit under `paymentKeys`, dropped by `forgetPlayer`; the flow is
  keyed by the player; the resume pointer is ignored for anyone else (`Deposit` "drops the payment
  methods…", "ignores a deposit remembered for another player").
- **Route handlers:** all three read the session (401 tests); the body, key and id are checked before
  anything goes upstream (422/400/404 tests, nothing sent); `no-store` asserted on each; `Prefer` only
  under `next dev` and never to the real API (`payments-route`).
- **Screens:** every state has a screenshot, including the two added in this review —
  `deposit-methods-empty` and `deposit-not-found`. Loading is a skeleton that keeps the layout, as on
  every screen; guest is `wallet-guest`.
- **Double press:** two Confirms in the same moment both saw `idle` and could start two deposits with two keys; `useDepositAttempt` now holds one attempt at a time behind a ref (test above, red first).
- **Docs:** the plan's Files and AC→tests names match the code (updated); 01, 02, 04, 05, 09, the
  translation notes and contract request 009 describe what was built.

## Automated gate

`pnpm verify` at `cf837af`, exit 0 (3.4 min of screens):

| Check                                               | Result        | Command / output                                                                 |
| --------------------------------------------------- | ------------- | -------------------------------------------------------------------------------- |
| Typecheck, lint, prettier, unit and component tests | PASS          | `pnpm check` — 54 files, 1,173 tests (1,174 after `a6894ef`, `pnpm check` again) |
| Generated types                                     | PASS          | `pnpm api:check` — "Generated API types match contracts/openapi.yaml."           |
| Contract drift                                      | PASS          | `contract-sync --check` — "contracts/ matches the backend."                      |
| Build                                               | PASS          | `pnpm build` — compiled, 37 pages                                                |
| UI screens (375 / 1440 px, en / am)                 | PASS, 2 flaky | `pnpm ui` — "336 passed (3.4m)", "2 flaky" (Gaps)                                |

Dev server checked first: `/__nextjs_server_status` 200; `/api/payment-methods` and `/api/deposits/abc`
401 as a guest, `POST /api/deposits` without a key 400; with a Prism login the three routes answered the
contract's examples (methods, a 201 redirect, a completed read).

## Tests proven

Each new acceptance test, once green, was run against the behaviour it guards broken once, and failed.

| Test                                                                                                                                                                                          | What was broken                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payments-mappers` "turns a redirect it may not follow into can't-continue-here, without the URL (AC-3)"                                                                                      | `toNextAction` returned every redirect without asking the allow-list                                                                                  |
| `server-config` "follows a provider page only on an allow-listed https host (AC-3)"                                                                                                           | `isAllowedProviderUrl` stopped checking the port                                                                                                      |
| `server-config` "allows no host in production unless one is listed, and the contract's example hosts in development"                                                                          | production fell back to the contract's example hosts                                                                                                  |
| `payments-route` "never hands the browser a redirect to a host not on the allow-list (AC-3)"; "keeps the allow-list on a read too…"                                                           | `allowedRedirect` allowed every host                                                                                                                  |
| `payments-route` "starts the deposit with … the browser's key …"; "forwards the browser's Idempotency-Key unchanged …"; "sends the deposit again with the same key after refreshing …" (AC-8) | the route handler sent a key it made (`crypto.randomUUID()`) instead of the browser's                                                                 |
| `payments-route` "builds the return address from the tenant's own host, never a forwarded one"                                                                                                | the return address was built from the request URL's origin                                                                                            |
| `DepositPolling` "polls a phone deposit every 3 s until it completes, then reads the balance and the history again (AC-2)"                                                                    | (1) `refetchInterval` returned `false`; (2) the completion no longer invalidated the wallet and history; (3) `shouldPoll` kept polling a final status |
| `deposit` "tells no answer from a final answer (AC-8)"                                                                                                                                        | `PAY_PROVIDER_ERROR` treated as no answer                                                                                                             |
| `deposit` "offers the API's own limit when an amount is out of range, else the method's on that side"                                                                                         | the API's `errors[].limit` ignored                                                                                                                    |
| `deposit` "compares a typed amount with the method's range as strings (AC-7)"                                                                                                                 | the maximum no longer checked                                                                                                                         |
| `Deposit` "lists the API's methods with their deposit limits; an unavailable one can't be chosen (AC-7)"                                                                                      | an unavailable tile no longer disabled (also failed: "marks a method the API says is unavailable…")                                                   |
| `Deposit` "won't continue with an amount outside the method's min–max (AC-7)"                                                                                                                 | the amount step's Continue ignored the range                                                                                                          |
| `Deposit` "sends the same Idempotency-Key on Try again after no answer, and a new one after an answer (AC-8)"                                                                                 | Try again (Confirm on an unanswered intent) sent a new key                                                                                            |
| `Deposit` "asks who is signed in before Try again, and sends nothing for someone else (AC-8)"                                                                                                 | the `/api/me` owner check skipped                                                                                                                     |
| `Deposit` "makes a new key when the amount changes after no answer, and after a refusal (AC-8)"                                                                                               | `sameDeposit` counted another amount as the same intent                                                                                               |
| `Deposit` "leaves for the provider's page only when the server allowed it (AC-3)"                                                                                                             | a 201 redirect not followed                                                                                                                           |
| `Deposit` "shows each deposit status in words, with what to do next (AC-1): failed"                                                                                                           | the API's `failure_reason` dropped from the failed screen                                                                                             |
| `Deposit` "changes no balance until the server says the deposit is complete (AC-4)"                                                                                                           | the balance re-read on any 201, before the deposit completed                                                                                          |
| `Deposit` "offers the nearest allowed amount when the amount is out of range, and sends it as a new deposit (AC-9)"                                                                           | Deposit {amount} only went back to the amount step                                                                                                    |
| `Deposit` "marks a method the API says is unavailable and asks for another (AC-9)"                                                                                                            | the methods not read again after `PAY_METHOD_UNAVAILABLE`                                                                                             |
| `Deposit` "resumes the pending deposit when the player comes back from the provider"; "forgets the deposit it came back for…"                                                                 | `?deposit=return` didn't resume                                                                                                                       |
| `Deposit` "drops the payment methods and the deposit when another player signs in"                                                                                                            | `forgetPlayer` stopped dropping `paymentKeys.all`                                                                                                     |
| `Deposit` "starts one deposit however quickly Confirm is pressed twice (AC-8)"                                                                                                                | written red first (two POSTs with two keys), then the in-flight guard in `useDepositAttempt`                                                          |

## Gaps

- **Flaky on the first try, passed on retry (`pnpm ui` at `cf837af`):** `auth.spec.ts` "a wrong password
  is refused in the API's own terms, not as an outage" — "Test timeout of 60000ms exceeded while setting
  up "context". Error: browser.newContext: Test ended." (Chrome couldn't open a context; F4a's test,
  untouched here). `screens · desktop · en · deposit-unconfirmed` — "locator.click: Test timeout of
  60000ms exceeded … waiting for getByRole('button', { name: /CBE Birr/ })": the snapshot shows the
  browser itself offline (`navigator.onLine` false, the offline banner) with `/api/me` unanswered, before
  the deposit flow began; the retry passed in 2.3 s, as did the other three runs of that screen.
- **Prism can't show** an initiated, failed or expired deposit, an `app_sdk` next action, or any deposit
  refusal: those screens are answered in the browser with shapes inferred from the contract's schema
  (contract request 009 asks for named examples). `deposit-completed` and `deposit-web` go through
  Prism end to end.
- **A real provider round trip** (leaving for telebirr's page and coming back) can't run locally: the
  redirect is a component test with `goToProvider` recorded, and the return is `deposit-web` with the
  `sessionStorage` pointer set by the test.
