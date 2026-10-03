# F6b — verification

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
- **Docs:** the plan's Files and AC→tests names match the code (updated); 01, 02, 04, 05, 09, the
  translation notes and contract request 009 describe what was built.

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
