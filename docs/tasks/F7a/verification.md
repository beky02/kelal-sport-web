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

## Acceptance criteria

| AC                                                                                 | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 A limit set on one device is in force on another                              | MET    | `rg-route` "reads the player's limits from /v1/me/limits with their session, never cached (AC-1)" ✓; `ResponsibleGaming` "shows the limits the account holds, and a limit set on another device after a reload (AC-1)" ✓ (a fresh page shows 750.00 set elsewhere; two reads); "drops the limits when another player signs in" ✓; screens `responsible-gaming-*`                                                                                                           |
| AC-2 `RG_SELF_EXCLUDED` locks the slip and shows the end date                      | MET    | `PlaceBet` "locks the slip and shows the end date when a bet comes back RG_SELF_EXCLUDED (AC-2)" ✓ (Betting paused, "until 10 Oct 2026, 18:00", one message, nothing more sent); "a break /api/me reports pauses the slip before anything is placed (AC-2)" ✓; `calculate` "pauses the slip during a break…" ✓; screens `home-slip-break`, `home-slip-excluded`                                                                                                            |
| AC-5 Raising pending with the API's time; lowering at once                         | MET    | `rg-route` "sends a money limit as the contract's RgLimitSet and answers the API's limit (AC-5)" ✓; `ResponsibleGaming` "raising a limit shows it pending from the API's effective time (AC-5)" ✓, "lowering a limit shows it in force at once (AC-5)" ✓; screens `responsible-gaming` (pending), `-raised`, `-saved`                                                                                                                                                      |
| AC-6 A break asked once, POSTed, signed out with the end; a reload changes nothing | MET    | `rg-route` "starts a break with the player's session, answers 201 and clears the session cookie (AC-6)" ✓; `ResponsibleGaming` "asks once, sends one POST /v1/me/self-exclusion and leaves the player signed out with the end date; a reload changes nothing (AC-6)" ✓ (opens on Go back since round 1), "starts one break however quickly it is asked for twice" ✓; screens `-confirm`, `-confirm-break`, `-confirm-permanent`, `-started`, `-excluded-started`, `-break` |
| AC-7 The wallet's card shows the deposit limit's `used` and `amount`               | MET    | `Wallet` "shows the deposit limit's used and amount from /v1/me/limits, with Manage (AC-7)" ✓ and its three siblings; screens `wallet`, `wallet-no-limit`, `wallet-limit-failed`                                                                                                                                                                                                                                                                                           |

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

## Review findings

Round 1 (five reviewers, after `9f5f518`). No BLOCKER. Fixes in `a56374d`.

| ID     | Reviewer | Severity | Summary                                                                                                                                      | Decision                                                                                                                                                                                                                                        |
| ------ | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1     | quality  | MAJOR    | The break's question opened with focus on Confirm: a stray Enter could self-exclude for good                                                 | Fixed in `a56374d` — `SystemDialog` `initialFocus="quiet"` opens on Go back                                                                                                                                                                     |
| M1     | money    | MINOR    | During a break the paused deposit screen hid an unanswered deposit's Try again (the slip keeps its own)                                      | Fixed in `a56374d` — the confirm step stays for that deposit's Try again, same key                                                                                                                                                              |
| S1, U3 | spec, ui | MINOR    | The scope gives the RG codes "View limits"; the break refusals and the slip's paused line had none (on a phone the slip covers the banner's) | Fixed in `a56374d` — View limits on the slip's and the deposit's break refusals and on the paused line; a withdrawal's keeps Help (F6c, the user's)                                                                                             |
| S2     | spec     | MINOR    | The plan's Files named files that didn't change (`Session.test.tsx`, the parent F7)                                                          | Fixed — `Session.test.tsx` dropped; the parent F7's criteria are ticked at close (Phase 4)                                                                                                                                                      |
| SEC1   | security | MINOR    | No `frame-ancestors` / `X-Frame-Options`: the irreversible self-exclusion can be clickjacked (old WebViews, same-site origins)               | Follow-up — `next.config.ts` is outside this task and the item is F3b's SEC6; 09-security now says the headers aren't sent yet; a separate task is offered                                                                                      |
| SEC2   | security | MINOR    | The session cookie was cleared only after the 201 was mapped: an unreadable yes left a dead session                                          | Fixed in `a56374d` — cleared as soon as the API says yes, before mapping                                                                                                                                                                        |
| Q2     | quality  | MINOR    | Switching period while saving reset the mutation: its answer was lost                                                                        | Fixed in `a56374d` — the period switch waits while a save is on its way                                                                                                                                                                         |
| Q3     | quality  | MINOR    | After a save Save became `disabled` (focus lost) and the answer's live region mounted with its text; the paused deposit screen too           | Fixed in `a56374d` — Save stays focusable (`aria-disabled`), the status region is rendered empty from the start; the paused deposit screen takes focus                                                                                          |
| Q4     | quality  | MINOR    | Refusals showed `error.message`, which for an answer that isn't a Problem is this app's technical string; `errors[].limit` not offered       | Fixed in `a56374d` — such an answer gets "Something went wrong. Try again in a moment."; offering `errors[].limit` **rejected**: the contract defines no limit-refusal codes or what `errors[]` carries for them (contract request 011, item 6) |
| Q5     | quality  | MINOR    | Every odds button re-rendered on a failed or refreshed `/api/me` read (`useSession` tracks `isError`)                                        | Fixed in `a56374d` — `useBreak` selects the break from the shared `sessionQuery`                                                                                                                                                                |
| Q6     | quality  | MINOR    | The wallet card copied the RG card's bar, used line and pending line; `exclusionOutcome` misplaced; `useLimits(true)` only                   | Fixed in `a56374d` — `LimitLines.tsx` shared; `exclusionOutcome` in `lib/break.ts`; `useLimits()`                                                                                                                                               |
| Q7     | quality  | MINOR    | The calendar test asserted fragments; a `dblClick` claimed to test the guard                                                                 | Fixed in `a56374d` — the full Amharic string (10 Oct 2026 is Meskerem 30, not Tikimt 1 as the comment said); a single click (the guard has its own test)                                                                                        |
| Q8     | quality  | MINOR    | The limit field had no focus ring                                                                                                            | Fixed in `a56374d` — `focus-within:` outline on its wrapper                                                                                                                                                                                     |
| U1     | ui       | MINOR    | The wallet card's heading was 12 px condensed, weaker than its own labels                                                                    | Fixed in `a56374d` — 15 px display, as "Recent activity"                                                                                                                                                                                        |
| U2     | ui       | MINOR    | Several states had no screenshot (the permanent exclusion, a refused break, a pending raise, a save without an answer, two questions)        | Fixed in `a56374d` — eight screens added                                                                                                                                                                                                        |

Notes (no decision needed):

- Quality: a second question could be asked and dropped while a break was on its way — fixed with Q1 (both buttons wait), test "won't ask the other question while a break is on its way".
- Quality: a break that started without an answer ends as a guest with "Your session has ended" — by design (decision 8: the browser can't know it started); logging in again shows the break.
- Security: a time limit is sent with no `amount` key; contract request 011 now asks the backend not to read a missing `amount` as `null`.
- Security: this app's own refusal titles ("Not a limit", "Not from this site") are English; the page never sends what they refuse.
- Money: the comment said the bar turns red "past 90%" while the code is `>= 90` — now "from 90%" (`LimitLines.tsx`).
- UI: `deposit-break` ends on the same screen as `deposit-paused` (the refusal hands over once `/api/me` reports the break) — intended.
- UI: 11 px text and the English "ELS LICENSED" badge on older screens are outside F7a.

### Round 1 fixes — test runs

Each fix's test was written first and seen failing (`pnpm vitest run …`, before `a56374d`), then passing after it:

| Test                                                                                                                                                                                                                         | Before the fix                                                                                  | After |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----- |
| `ResponsibleGaming` "asks once… (AC-6)", "a permanent self-exclusion says so…" (Go back focused)                                                                                                                             | ✗ Confirm had focus                                                                             | ✓     |
| `ResponsibleGaming` "won't ask the other question while a break is on its way"                                                                                                                                               | ✗ the other dialog opened                                                                       | ✓     |
| `ResponsibleGaming` "keeps the period while a save is on its way (Q2)"                                                                                                                                                       | ✗ Daily stayed enabled                                                                          | ✓     |
| `ResponsibleGaming` "keeps focus on Save, and says the save in a region that was already there (Q3)"; "won't save a limit of nothing or zero"                                                                                | ✗ no region before the save; Save `disabled`                                                    | ✓     |
| `ResponsibleGaming` "says a limit wasn't saved…" / "says a break didn't start in its own words when the answer isn't a Problem (Q4)"                                                                                         | ✗ "PUT /me/limits failed with 422" shown                                                        | ✓     |
| `ResponsibleGaming` "shows where the keyboard is in a limit field (Q8)"                                                                                                                                                      | ✗ no `focus-within` outline                                                                     | ✓     |
| `ResponsibleGaming` "shows the end in the player's calendar and clock" (strengthened)                                                                                                                                        | passed already; fails against the Ethiopian day off by one, which the old fragments let through | ✓     |
| `OddsButton` "re-renders a price only when the break changes, not when a read of /api/me fails (Q5)"                                                                                                                         | ✗ 2 renders, expected 1                                                                         | ✓     |
| `Deposit` "keeps Try again of a deposit that had no answer during a break: the same key (M1)"                                                                                                                                | ✗ the paused screen hid it                                                                      | ✓     |
| `Deposit` "pauses deposits during a break…" (heading focused)                                                                                                                                                                | ✗ no focus                                                                                      | ✓     |
| `PlaceBet` "says betting is paused for a self-exclusion, and offers View limits (AC-7, F7a)", "…once /api/me reports it (AC-7)", "a break /api/me reports pauses the slip…" (View limits); `refusals` / `deposit` unit tests | ✗ no button / `fix: null`                                                                       | ✓     |
| `rg-route` "clears the session cookie once the API has started the break, even when its answer can't be read (SEC2)"                                                                                                         | ✗ no `Set-Cookie`                                                                               | ✓     |

After the fixes: `pnpm check` PASS (63 files, 1,383 tests); `pnpm ui --grep "responsible-gaming|wallet|deposit-paused|deposit-break|home-slip-break|home-slip-excluded|home-slip-limit-reached"` PASS (113), the new screens looked at.

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
- **Framing headers (SEC1):** not sent until the follow-up lands; SameSite=Lax is the only guard against a
  framed `/responsible-gaming` meanwhile.
