# F7a — verification

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
