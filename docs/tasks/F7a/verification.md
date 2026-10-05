# F7a — verification

## Review brief

Responsible gaming moves from the in-repo mock onto the contract (F7's first sub-task; `/task F7` ran F7a, confirmed with the user).

- **Contract sync first** (`5b11a4b`, additive: 400/404/422 on auth, `/v1/me` and wallet reads; nothing in the RG operations) — mechanical.
- **Routes**: `src/app/api/me/limits/route.ts` (GET, PUT), `src/app/api/me/self-exclusion/route.ts` (POST; clears the session cookie on 201); `src/lib/server/responsible-gambling.ts`, `src/lib/api/mappers/responsible-gambling.ts`, schemas in `src/lib/api/schemas.ts`, `apiClient.put`.
- **The break from `/api/me`** (`features/responsible-gaming/lib/break.ts`, `useBreak`): banner (`StatusBanners.tsx`), odds lock, the slip's `paused` (`calculate.ts`, `use-bet-slip.ts`, `SlipAlerts.tsx`, `PlaceBetButton.tsx`), deposits paused (`DepositFlow.tsx`, `DepositPaused.tsx`, `WalletHome.tsx`).
- **RG page and wallet card**: `ResponsibleGamingView.tsx`, `LimitsSection.tsx`, `LimitCard.tsx`, `BreakStarted.tsx`, `hooks/use-responsible-gaming.ts`, `lib/limits.ts`; `wallet/components/DepositLimitCard.tsx`; limits re-read after bets and deposits (`use-place-bet.ts`, `use-payments.ts`).
- **Removed**: the RG mock (status API, repository state, schema), the "This month" placeholder figures, the unreachable deposit-limit dialog, `SYSTEM.coolOff` and `depositLimit`.
- **Risk**: the self-exclusion (irreversible: asked once, one POST per Confirm, signed out after); the break read only from the server, never ended by a browser clock; the two new mutating routes' gates; limits as strings (`percentOf` is display only).
- **The user's decisions** (plan gate): Q1 the copy table (two untrue lines replaced), Q2 the deposit-limit dialog removed, Q3 contract request 011 written; plan approved — limits above zero, no Remove, no clock check, 5 years added, not split.
- **Not done**: Remove a limit, minutes used, a reset time (request 011); the reality check (F7b); deleting the mock folder (F7d).

## Automated gate

Run 1, after `56c9caf` (the dev server checked first: `/__nextjs_server_status` answers; `GET /api/me/limits`
without a session → 401, a cross-site `POST /api/me/self-exclusion` → 403, as their tests expect).

| Check                                           | Command                                  | Result                                                  |
| ----------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| Typecheck, lint, format, unit + component tests | `pnpm check`                             | PASS — 63 files, 1,373 tests                            |
| Generated types match the contract              | `pnpm api:check`                         | PASS                                                    |
| Contract and backend docs match the backend     | `node scripts/contract-sync.mjs --check` | PASS (synced in `5b11a4b`)                              |
| Production build                                | `pnpm build`                             | PASS — `/api/me/limits`, `/api/me/self-exclusion` built |
| Every screen, both widths, both languages       | `pnpm ui`                                | PASS — 521 passed, 1 flaky (Gaps)                       |

```
 Test Files  63 passed (63)
      Tests  1373 passed (1373)
Generated API types match contracts/openapi.yaml.
contracts/ matches the backend.
docs/backend/ matches the backend.
✓ Compiled successfully in 3.2s
  1 flaky
    tests/e2e/booking.spec.ts:40:5 › answers 404 for an unknown code, in the booking's words
  521 passed (5.2m)
```

## Tests proven

Each acceptance test, once green, was run against the behaviour broken once and seen to fail.

| Test                                                                                                                                                                                                                                          | What was broken                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `rg-mappers` "maps the contract's limits: the API's strings, the pending change with its effective time"                                                                                                                                      | `toLimit` dropped `used` (always null)                              |
| `rg-mappers` "sends a time limit in minutes alone, never with amount: null, which removes a limit"                                                                                                                                            | `toLimitSet` sent `amount: null` with a time limit                  |
| `rg-mappers` "takes a limit above zero in the contract's form, and nothing else"                                                                                                                                                              | `limitChangeSchema` took `0.00` (`>= 0`)                            |
| `money` "says how much of a limit is used as a whole percentage, for a bar only"                                                                                                                                                              | `percentOf` no longer capped at 100                                 |
| `rg-route` "answers 401 AUTH_TOKEN_EXPIRED without a session and sends nothing" (GET limits)                                                                                                                                                  | the GET read the account without a session check                    |
| `rg-route` "refuses a limit from another site, without the CSRF header, or not in JSON"                                                                                                                                                       | `PUT` skipped `assertSameOrigin`                                    |
| `rg-route` "starts a break with the player's session, answers 201 and clears the session cookie (AC-6)"                                                                                                                                       | the 201 kept the session cookie                                     |
| `rg-route` "keeps the session when the API refused the break: nothing started"                                                                                                                                                                | the cookie was cleared before the API answered                      |
| `rg-route` "reads the player's limits from /v1/me/limits with their session, never cached (AC-1)"                                                                                                                                             | `loadLimits` answered none of the account's limits                  |
| `rg-route` "sends a money limit as the contract's RgLimitSet and answers the API's limit (AC-5)"                                                                                                                                              | `changeLimit` dropped the change the API held back (`pending`)      |
| `rg-lib` "is never ended by this browser's clock: an end already past still counts until the API drops it"                                                                                                                                    | `breakOf` compared the end with `Date.now()`                        |
| `rg-lib` "has no end for a self-excluded player with no date: a permanent exclusion"                                                                                                                                                          | `breakOf` ignored `status: self_excluded`                           |
| `calculate` "pauses the slip during a break, ahead of every other action (AC-2)"; `PlaceBet` "a break /api/me reports pauses the slip before anything is placed (AC-2)", "a permanent self-exclusion pauses the slip with no end date (AC-2)" | `resolveCta` ignored `paused`                                       |
| `PlaceBet` "locks the slip and shows the end date when a bet comes back RG_SELF_EXCLUDED (AC-2)"; "says betting is paused during a break, until the end the API gives, once /api/me reports it (AC-7)"                                        | an RG refusal no longer read `/api/me` again                        |
| `PlaceBet` "locks the slip and shows the end date when a bet comes back RG_SELF_EXCLUDED (AC-2)" (one message)                                                                                                                                | the break refusal's alert shown beside the paused line              |
| `PlaceBet` "keeps Try again of a bet that had no answer during a break: it says whether that bet went through (AC-2)"                                                                                                                         | `paused` overrode Try again in `BetSlip`                            |
| `PlaceBet` "reads the limits again once a bet is placed: the stake limit's used has moved (F7a)"                                                                                                                                              | a ticket no longer invalidated `rgKeys.all`                         |
| `OddsButton` "locks an otherwise open price while /api/me reports a break"; "refuses the selection even if the click gets through"                                                                                                            | (new source) failed until `useOddsLocked` read `useBreak()`         |
| `ResponsibleGaming` "shows the break /api/me reports, with its end, and View limits"; "shows the end in the player's calendar and clock"                                                                                                      | the banner showed the API's raw time, not the dated end             |
| `Deposit` "pauses deposits during a break /api/me reports: the flow starts nothing, and the wallet's Deposit is off (F7a)"; "…once /api/me reports it (AC-9)"; "pauses deposits for a permanent self-exclusion"                               | the flow's paused screen skipped                                    |
| `Deposit` "pauses deposits during a break /api/me reports: …the wallet's Deposit is off (F7a)"                                                                                                                                                | the wallet's Deposit left on                                        |
| `Deposit` "reads the limits again when a deposit completes: the deposit limit's used has moved (F7a)"                                                                                                                                         | `moneyArrived` no longer invalidated `rgKeys.all`                   |
| `ResponsibleGaming` "shows the limits the account holds, and a limit set on another device after a reload (AC-1)"                                                                                                                             | `getLimits` kept its first answer in the browser                    |
| `ResponsibleGaming` "raising a limit shows it pending from the API's effective time (AC-5)"                                                                                                                                                   | the saved message ignored the API's `pending`                       |
| `ResponsibleGaming` "lowering a limit shows it in force at once (AC-5)"; "raising a limit…"                                                                                                                                                   | a save no longer read the limits again                              |
| `ResponsibleGaming` "asks once, sends one POST /v1/me/self-exclusion and leaves the player signed out with the end date; a reload changes nothing (AC-6)"                                                                                     | the break's 201 noted no logout (the "session ended" dialog showed) |
| `ResponsibleGaming` "asks once…"; "Go back sends nothing"; the two break-problem tests                                                                                                                                                        | Start break sent the break without asking                           |
| `ResponsibleGaming` "drops the limits when another player signs in"                                                                                                                                                                           | `forgetPlayer` kept `rgKeys.all`                                    |
| `ResponsibleGaming` "starts one break however quickly it is asked for twice"                                                                                                                                                                  | `useSelfExclude` lost its one-at-a-time guard                       |
| `Wallet` "shows the deposit limit's used and amount from /v1/me/limits, with Manage (AC-7)"                                                                                                                                                   | the card swapped `used` and `amount`                                |
| `Wallet` "lists each deposit limit the player has, day before week before month"                                                                                                                                                              | the card kept the API's order                                       |
| `Wallet` "says the deposit limit couldn't load, with Try again"                                                                                                                                                                               | a failed read was shown as no limit                                 |

## Self-review

- **Money moves:** a ticket and an unanswered bet now also re-read `rgKeys.all` (the stake limit's
  `used`), a completed deposit too (`moneyArrived`, the deposit limit's `used`); RG refusals already
  re-read `/api/me` and `rgKeys.all`. Nothing is patched: a limit save re-reads the limits, a break drops
  every cache. No money moves in F7a itself.
- **New values:** `used`/`amount` are each shown where they belong in `LimitCard` and
  `DepositLimitCard` (a swap fails `Wallet` AC-7); `pending.*` only in the pending line and the saved
  message; a break's end is `pause.until` (banner, slip, deposit flow, wallet) or the 201's `endsAt`
  (started screen) — always through `useLongDateTimeText`; `percentOf(used, amount)` in that order.
- **Async tests:** every RG/wallet assertion waits for its data: the limit regions render only with the
  limits (the wallet card's heading renders at once, so its tests `waitFor` the text); the AC-2 test waits
  for "Betting paused" before reading the alert; the deposit test waits on the live region's text.
- **Personal data:** limits under `rgKeys.limits()` (root `rgKeys.all`, dropped by `forgetPlayer`);
  "drops the limits when another player signs in" switches the player and sees the re-read; a started
  break drops every cache (asserted in AC-6's test).
- **Route handlers:** each of `GET`/`PUT /api/me/limits` and `POST /api/me/self-exclusion` reads the
  session for this tenant first (401 with nothing sent, tested), validates its body before upstream
  (422/413/415/403, tested), answers `no-store` (tested on all three) and forwards `Prefer` only under
  `next dev`, never to the real API (tested).
- **Screens:** every state has a screenshot — RG: limits (pending), saved, not saved, failed, guest,
  confirm, started, unconfirmed, break in force; wallet: card, no limit, card failed, break; deposit:
  paused, break revealed by a refusal; slip: locked after `RG_SELF_EXCLUDED`. Loading skeletons are not
  captured (the shots wait for the network), as in earlier tasks.
- **Docs:** the plan's Files and AC→tests names now match the code (updated after implementation);
  01, 02, 03, 04, 05 and 09 updated; translation notes list every composed Amharic string; README status
  `verifying`.

## Gaps

- **Flaky (passed on retry):** `tests/e2e/booking.spec.ts:40` "answers 404 for an unknown code, in the
  booking's words" — first error `browserType.launch: Timeout 180000ms exceeded` (Chrome did not start in
  time; the test never ran). Environmental, not F7a's code; F3b's screen.
- **Prism can't answer every RG case:** no RG refusal examples, `PUT` always answers the pending raise, no
  limit refusal — the screens answer those in the browser (`page.route`) and the component tests stub
  them, shapes from the contract's schemas (contract request 011).
- **Loading skeletons** are not screenshotted (the shots wait for the network), as in earlier tasks.
