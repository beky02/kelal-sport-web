# F8cb — verification

## Rework 3 — nothing booked under the minimum; said at the field (2026-10-08)

- **Built** (both sites): an empty or zero stake is `BET_STAKE_TOO_LOW`, so nothing is priced or booked
  under the minimum; the stake field is red with "Minimum stake {amount}" below it; slipcalc's too-low
  alert is gone (the engine's 422 keeps its alert).
- **Tests proven:** with an empty stake no longer under the minimum, › "prices nothing for an empty or zero
  stake…", › "can't book under the minimum…" and the kiosk's › "starts the stake at the shop's minimum, and
  books nothing under it…" fail; with too low an alert again, the player's › "says the minimum at the stake
  field…" and the kiosk's › "says the shop's minimum at the stake field…" fail. A guard first added to
  `bookingRequestFrom` changed no test when removed: the existing "any problem stops the booking" already
  covered it, so it went.
- **Gate (fast):** `pnpm check` 1,622 pass; `pnpm ui --grep "home-slip|booking|kiosk-slip|kiosk-picks|kiosk-booking"`
  93 pass, none on retry (1.5 min). Looked at `terminal-kiosk-slip-too-low-en-desktop` and `-am-phone`.

## Rework 2 — min and max, the starting stake (2026-10-08)

- **The user decided** (asked, being rules about money): the same limits on both sites by configuring
  `retail_betting` like `betting` (no code); the stake starts at the rule set's minimum on both sites.
- **Built:** `useStartingStake` (sets the minimum when the rules arrive, only on an untouched stake), on the
  player's slip (`useBetSlip`) and the kiosk (`Kiosk`); the store starts with no stake; `BETTING.defaultStake`
  removed.
- **Tests proven:** `BetSlip.test.tsx` › "starts the stake at the tenant's minimum once the rules arrive,
  and keeps a stake already there…" and `TerminalKiosk.test.tsx` › "starts the stake at the shop's minimum,
  and works without one once it is cleared…" both fail with the hook never setting the minimum; the
  first also fails (with "offers the minimum when the stake is too low") with the hook overwriting a stake
  already there.
- **Screens:** `pnpm ui --grep terminal`: 80 pass (2 only on retry; then 3 runs of the slip and offline
  screens with no retries, 16/16 each). `terminal-kiosk-picks-am-desktop`: 10 ብር, 14.34 ብር.
- **Gate (fast, at the user's request "the test should be fast"):** `pnpm check` 1,621 pass (33 s); the
  contract drift check passes; `pnpm ui --grep "home-slip|booking|kiosk-slip|kiosk-picks|kiosk-booking"`:
  93 pass, none on retry (1.5 min). `home-slip-en-phone`: ETB 5, ETB 15.49. The full `pnpm verify` (652
  screens, 7–13 min) was not re-run after this rework; its last full pass was at `b766e01`, and the run
  after the first rework stopped only on wallet screens that then passed on their own (156/156).

## Rework — the user's review (2026-10-08)

- **What the user asked:** "lets remove this i think it is too much" (the on-screen keypad). The stake is
  now the player's stake field (`StakeInput`, no balance) on the kiosk; `KioskStake.tsx` and its three
  strings are gone, and `StakeInput.tsx` is main's again. Plan: "Rework".
- **Tests:** the F8cb kiosk tests type into the field. › "types the stake in the player's stake field:
  digits, one point, two decimals at most, and clear; no keypad (F8cb AC-b1, the user's review)" and the
  seven others that type a stake failed against the keypad build (8 failing: no text box) and pass after.
  The U4 test went with the keypad. `TerminalKiosk.test.tsx`: 44 pass.
- **Screens:** `pnpm ui --grep "kiosk-slip|kiosk-picks|kiosk-booking-code"`: 20 pass, Book bet still in
  view (U1). Looked at `terminal-kiosk-slip-en-desktop` (the whole slip fits at 1440 × 900 now) and
  `terminal-kiosk-slip-too-low-am-phone`.
- **Not re-reviewed by the panel:** the change removes a component and reuses the player's tested field;
  the gate below is the evidence.

## Review brief

- **Config** (`mappers/config.ts`, `terminal/types.ts`, `terminal-schemas.ts`, new `rules-schema.ts`):
  `TerminalConfigView.rules` from `retail_betting` only, null without it. `aa30414` is a contract sync.
- **Shared slip parts, moved not changed:** `AlertList.tsx` (alert markup and builders out of
  `SlipAlerts.tsx`); `StakeLines`, `QuickStakes` out of `StakeInput.tsx`.
- **Kiosk:** `KioskSlip` priced (modes, alerts, `KioskStake` keypad, summaries, Book bet with the stake
  and the server's fix); `Kiosk` starts the stake empty; `KioskShell`'s slip column scrolls. Four strings.
- **Risk:** money (slipcalc on `retail_betting` only; the hint sent only when accepted, never without
  rules); the player's slip through the split; the host split.
- **The user decided (gate):** the no-rules line, an empty start, a code's hint as the stake; the sync.
- **Not done:** Get code, idle reset, 429 (F8cc); moving odds after the tap; signed reads (015).

## Automated gate

Final run, 2026-10-08, at `b766e01` (after the review fixes), against the running `next dev` (simulated
board) and Prism on :4010. `pnpm verify` exit 0:

```
 Test Files  80 passed (80)
      Tests  1621 passed (1621)
Generated API types match contracts/openapi.yaml.
contracts/ matches the backend.
docs/backend/ matches the backend.
Host split holds: 19 player routes load no module or chunk of (terminal); 3 terminal route(s) load no module of (player) nor a chunk holding one (.next/server/app, 68 manifests).
  2 flaky
  650 passed (8.6m)
```

Two passed only on retry, both the player's login flows, not this task's screens (under Gaps). The run
before the review fixes, at `20281f6`, passed all 652 with none on retry.

| Check                                   | Result | Command                                      |
| --------------------------------------- | ------ | -------------------------------------------- |
| Typecheck, lint, format, unit/component | PASS   | `pnpm check` (1,621 tests)                   |
| Generated types                         | PASS   | `pnpm api:check`                             |
| Contract drift                          | PASS   | `node scripts/contract-sync.mjs --check`     |
| Build, host split                       | PASS   | `pnpm build`, `scripts/check-host-split.mjs` |
| Screens                                 | PASS   | `pnpm ui` (652; 2 flaky, Gaps)               |
| Golden rows                             | PASS   | `tests/unit/golden.test.ts`, unchanged       |

The runs before `20281f6`:

1. `ticket-check-failed` (F5b's screen) failed in all four: the contract synced in `aa30414` gives
   `checkTicket` a 503, and the screen allowed only the 404 an older Prism answered. Two Prisms answer
   `localhost:4010` here — this repo's `pnpm mock` on 127.0.0.1 (the synced contract: 503) and the
   backend's Docker one on ::1 (loaded before the backend's change: 404) — so the screen now accepts
   either log (`c78aa42`). One flaky: `auth.spec.ts` › "refuses a cross-origin POST…" timed out in its
   `afterEach` (`browser.newContext: Test ended`), then passed.
2. The drift check: the backend had added `429` to `placeBet` since. Synced (`20281f6`), on the user's
   standing answer at Phase 0 ("sync on the task branch").

## Acceptance criteria

Every test named here passes in the final `pnpm verify`.

| AC    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-3  | PASS   | `terminal-mappers.test.ts` › "takes the kiosk's rules from retail_betting, never the online betting (F8cb AC-3)"; `terminal-route.test.ts` › "reads the kiosk's config for a terminal: retail, the languages, the default, the shop's rules (AC-3, AC-4)"; `TerminalKiosk.test.tsx` › "refuses a stake under the shop's minimum — 10.00, not the online 5.00 — and offers it as a tap (F8cb AC-3)"; › "prices a multiple with the shop's rules: no accumulator bonus, and slipcalc's payout to the santim (F8cb AC-3)" (three legs at 1.95, 2.10, 2.45: the payout is slipcalc's on `retail_betting`, which differs from the online one by its 3 % bonus). Screens: `terminal-kiosk-slip-{am,en}-{phone,desktop}` (104.65 for 50 on 1.52 × 1.62), `terminal-kiosk-slip-too-low-…` |
| AC-b1 | PASS   | › "types the stake on the keypad: digits, one point, two decimals at most, delete and clear, with no text box (F8cb AC-b1)"; › "starts with no stake and works without one: the figures wait, and Book bet saves the picks alone (F8cb AC-b1)"; › "books the stake typed as the code's hint, and offers the server's stake when it refuses it (F8cb AC-b1)"; F8ca's › "loads a code's picks into the slip through the terminal…" (the hint 50.00 as the stake, priced). Screens: `terminal-kiosk-slip-…`                                                                                                                                                                                                                                                                          |
| AC-b2 | PASS   | › "shows no balance, no log in and no place button — only Book bet (F8cb AC-b2)" (every call is to `/api/terminal/`); › "shows the picks without any figure when the tenant has no shop rule set, never the online one's (F8cb AC-b2)"; `terminal-mappers.test.ts` › "has no rules without retail_betting, even with betting (F8cb AC-b2)". Screens: `terminal-kiosk-slip-no-rules-{am,en}-{phone,desktop}`                                                                                                                                                                                                                                                                                                                                                                       |
| —     | PASS   | The player's slip after the split: `BetSlip.test.tsx`, `PlaceBet.test.tsx`, `BookingFlow.test.tsx`, `ResponsibleGaming.test.tsx` unchanged (143 tests), and the player's screens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Self-review

- **Money moves:** none. Book bet creates a booking (no balance, history or bets to invalidate), as in
  F8ca; nothing is placed and nothing is patched in the browser.
- **New values:** `rules` is read only in `KioskSlip`: `rules.calc` → `calculateBetSlip`,
  `PayoutSummary` and the warnings; `rules.quickStakes` → `KioskStake`. The stake priced, shown and sent is
  one value whenever there are rules (`stake = rules ? typed : ""`), and nothing is shown or sent without
  them (test). The booking refusal's `fixStake` goes to `setStake` and its message's `{amount}`.
- **Async tests:** each kiosk test taps a price only once the board is up (`homeWin()` resolves after the
  config and board answer), so the rules are there before the keypad is looked for; the refusal test
  waits for the alert (`findByRole`), the booking tests for the dialog.
- **Personal data:** none; no player, no query of a player's.
- **Route handlers:** none changed; `/api/terminal/config` answers the public rule set too (route test).
- **Screens:** priced, too low and no shop rules, each in en/am × phone/desktop; the slip's empty and
  loading states are F8ca's (`terminal-kiosk-board-*`, `terminal-kiosk-config-loading-*`), now with the
  priced slip's parts. Looked at: `kiosk-slip-{am,en}-{phone,desktop}`, `kiosk-slip-too-low-am-phone`,
  `kiosk-slip-no-rules-{en-desktop,am-phone}` (Amharic readable at 12 px, no uppercase, nothing
  overflowing at 375 px).
- **Docs:** the plan's Files list (two test files and `KioskShell` added while implementing) and AC → test
  names match the code; 10-terminal and 04-slip-and-money updated; translation notes; README status.

## Tests proven

Each new acceptance test, once green, was run against a deliberate break and seen to fail; then the
break was undone.

- `terminal-mappers.test.ts` › "takes the kiosk's rules from retail_betting, never the online betting
  (F8cb AC-3)" — the mapper given `config.betting`: fails (with the contract-shape test).
- › "has no rules without retail_betting, even with betting (F8cb AC-b2)" — the mapper falling back to
  `config.retail_betting ?? config.betting`: fails.
- `TerminalKiosk.test.tsx` › "types the stake on the keypad…" (replaced in the rework by › "types the
  stake in the player's stake field…", which failed against the keypad build) — Delete clearing the whole
  stake: failed.
- › "starts with no stake and works without one: the figures wait, and Book bet saves the picks alone
  (F8cb AC-b1)" — `Kiosk` no longer starting the stake empty: fails (the player's 100 shows).
- › "refuses a stake under the shop's minimum — 10.00, not the online 5.00 — and offers it as a tap (F8cb
  AC-3)" and › "prices a multiple with the shop's rules: no accumulator bonus, and slipcalc's payout to
  the santim (F8cb AC-3)" — the kiosk's rules mapped from `betting`: both fail.
- › "books the stake typed as the code's hint, and offers the server's stake when it refuses it (F8cb
  AC-b1)" — `BookBet` ignoring the refusal's `fixStake`: fails.
- › "shows no balance, no log in and no place button — only Book bet (F8cb AC-b2)" — "Balance" added
  beside the stake's label: fails.
- › "shows the picks without any figure when the tenant has no shop rule set, never the online one's
  (F8cb AC-b2)" — the typed stake (a loaded code's hint) priced and sent without rules: fails.
- › "loads a code's picks into the slip through the terminal, at the server's prices, and says what
  couldn't come" (F8ca's, updated for the hint) — the kiosk never pricing the stake: fails.

## Review findings

Panel (round 1): spec-verifier PASS, money-reviewer PASS, quality-reviewer PASS, ui-checker FAIL (one
MAJOR). No BLOCKER, so no reviewer was run again. Fixes in `21d0b80`.

| ID  | Reviewer                     | Severity | Summary                                                                                                         | Decision                                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | ui-checker                   | MAJOR    | At 1440 × 900 the keypad pushes Book bet below the slip column's edge, with no sign the column scrolls          | Fixed: the payout and Book bet are a footer pinned to the foot of the column and the sheet. `terminal.spec.ts` › kiosk-slip, kiosk-slip-too-low and kiosk-picks now assert the payout and Book bet `toBeInViewport({ ratio: 1 })`: at least 10 of the 12 failed before the fix (both widths; the list was cut there), all 12 pass after |
| U2  | ui-checker                   | MINOR    | The clear "C" and the "." key don't read as keys on a touch screen                                              | Superseded by the user's rework: the keypad is gone (the player's field, with its own label and C)                                                                                                                                                                                                                                      |
| U3  | ui-checker                   | MINOR    | The stake's label is 11 px, under the 12 px floor for Amharic                                                   | Superseded by the user's rework: the keypad is gone (the player's field, with its own label and C)                                                                                                                                                                                                                                      |
| U4  | ui-checker                   | MINOR    | A code's hint shows "50.00", a typed stake "50"                                                                 | Superseded by the user's rework: the keypad is gone (the player's field, with its own label and C)                                                                                                                                                                                                                                      |
| U5  | ui-checker                   | MINOR    | One pick shows "Multiple" selected with a total odds row                                                        | Follow-up: the slip store's and `BetModeTabs`' behaviour, shared with the player's slip; not changed here                                                                                                                                                                                                                               |
| U6  | ui-checker                   | MINOR    | The no-rules line is small muted text, easy to miss                                                             | Fixed: an info notice (`AlertList`, icon, `role="status"`); › "shows the picks without any figure…" failed before, passes after                                                                                                                                                                                                         |
| S1  | spec-verifier                | MINOR    | Plan decision 9 says "no alert", but the picks' own alerts (conflict, suspended) still show without rules       | Fixed in the plan: "no money alert"; the picks' alerts carry no amount and stay                                                                                                                                                                                                                                                         |
| S2  | spec-verifier                | MINOR    | No kiosk test for the shop's quick stakes                                                                       | Fixed: › "offers the shop's quick stakes when its rule set has them…"; fails with `quickStakes={[]}`                                                                                                                                                                                                                                    |
| M1  | money-reviewer               | MINOR    | The money tests compare with slipcalc's own output, not fixed figures                                           | Fixed: 20.72, 16.57, 852.78 (875.81 online) and 89.25 pinned, as the reviewer worked them by hand; with the mapper dropping `taxes`, the oracle checks still pass and the pinned ones fail (4 tests)                                                                                                                                    |
| M2  | money-reviewer, quality (Q3) | MINOR    | The stake is emptied in a mount effect, after the first render and after children's effects                     | Follow-up to F8cc: its idle reset needs a named "start the kiosk's slip" action; that action replaces this effect. Today nothing renders the stake before it runs (no picks at start)                                                                                                                                                   |
| Q1  | quality-reviewer             | MINOR    | `KioskSlipAlerts` read the raw store stake, not the gated one                                                   | Fixed: the gated stake is a prop; no store subscription. No behaviour change (the no-rules test guards the invariant)                                                                                                                                                                                                                   |
| Q2  | quality-reviewer             | MINOR    | The booking refusal with its fix is copied from the player's `BetSlip`; the alerts' order is hand-written twice | Follow-up: a shared `BookingRefusal` (and a `slipOwnAlerts` builder) means editing the player's `BetSlip`, outside this task                                                                                                                                                                                                            |
| Q4  | quality-reviewer             | MINOR    | `ticket-check-failed` accepts 503 or 404 because two Prisms answer `localhost:4010`                             | Rejected for this branch: the fix is pointing the dev server at one Prism, which is in `.env.local` (not to be read or edited here). Listed under Gaps for the user: stop one Prism                                                                                                                                                     |
| Q5  | quality-reviewer             | MINOR    | `max-h-[calc(100dvh-84px)]` repeats the header offset as a magic number                                         | Fixed: a comment ties 84 to the 68 it sticks at (+16)                                                                                                                                                                                                                                                                                   |

Notes, no decision needed:

- Book bet still posts to the player's `POST /v1/bookings`, so a refusal's `limit` could be an online one;
  slipcalc re-checks it on the shop's rules. F8cc's slip codes settle it (spec, money).
- C19 §11's "a shop can only lower the maximum" doesn't apply under the user's decision of 2026-10-07 (one
  brand-level shop rule set); the counter enforces any shop limit (money).
- The kiosk's sidebar names in English under Amharic are the catalogue's data, from F8ca (ui).

## Gaps

- **A pick's odds are those at the tap** (plan decision 2), as on the player's Release 1 slip; a pick
  whose match has started stays until removed. The counter re-prices the code at sale (C19 §4.3, §14).
- **Book bet goes to the player's `POST /v1/bookings`** until F8cc's slip codes; its stake hint may be
  checked by the server against the online limits, which in the contract are no stricter than the shop's.
- **Two Prisms on :4010** here (the backend's Docker one, loaded before the backend's latest contract, and
  this repo's `pnpm mock`); `localhost` reaches either. Only `ticket-check-failed` asked for something
  they answer differently. Stopping one of them would make runs repeatable.
- **One unit run failed once and wasn't captured**: the first `pnpm check` after the `placeBet` sync
  (`20281f6`) had one failing test; 13 runs after it (10 `pnpm test`, 3 `pnpm check`) and the final
  `pnpm verify` passed. Most likely a cold transform cache after `schema.d.ts` was regenerated; the test
  isn't known.
- **Flaky (first gate run):** `auth.spec.ts` › "refuses a cross-origin POST, and one without the CSRF
  header (AC-4)" — "Test timeout of 60000ms exceeded while running "afterEach" hook" (`browser.newContext:
Test ended`), then passed on retry; not this task's screen.
- **The dev server's board was the simulated one** for the kiosk screenshots; the component tests use the
  contract's examples.
- **Flaky (final gate run), both passed on retry:** `auth.spec.ts` › "logs in through the dialog and
  leaves no token in the browser (AC-3)" — `getByRole('link', { name: /balance/i })` not found; and ›
  "logging in on another device takes the language saved on the account (F7b AC-8)" — `<html lang>` was
  "en", expected "am". Player login flows on a slow run (8.6 min against 7.0), untouched by this branch.
