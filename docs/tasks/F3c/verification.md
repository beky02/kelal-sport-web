# F3c — verification

## Review brief

- **What changed** (`git diff task/F8cb-simple-slip...HEAD`; the contract-sync commit aside): the slip
  store holds three slips — the one on screen in its own fields, two parked (`slips`, `active`,
  `switchSlip`, `resetAll`, `useSlipCounts`); answers to placing and booking go to the slip that asked by
  key (`inSlipWhere`), realtime to every slip (`inEverySlip`); a tap replaces a match's pick;
  `startStake` once per slip (`bet-slip.store.ts`, `use-starting-stake.ts`, `use-bookings.ts`).
- **UI:** `SlipTabs` (new) replaces `BetModeTabs` (deleted) on both sites (`BetSlip`, `KioskSlip`), also
  above a placed ticket; the conflict alert loses "Use Single"; the booking notice says a system or
  singles code is priced as one multiple (`BookingNotice`, `to-slip.ts`). Strings in en/am.
- **Risk:** money — a ticket, refusal or code must land in the slip that asked; the player's placing flow
  now per slip; the shared store everywhere.
- **The user decided:** multiple only; three separate slips; same-match replaces; both sites; the phone
  bar counts the slip on screen; "ትኬት {n}".
- **Not done:** persisting slips, renaming, more than three; F8cc's idle reset (noted there). The full
  `pnpm verify` screen suite (652) was not run (the user: "the test should be fast"); the 101 slip screens
  were.

## Automated gate

| Check                                   | Result | Command                                                                                                     |
| --------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format, unit/component | PASS   | `pnpm check` (1,641 tests)                                                                                  |
| Generated types, contract drift         | PASS   | `pnpm api:check`; `contract-sync.mjs --check` (after a sync)                                                |
| Build, host split                       | PASS   | `pnpm build`; `scripts/check-host-split.mjs`                                                                |
| Slip screens, both sites                | PASS   | `pnpm ui --grep "home-slip\|booking\|kiosk-slip\|kiosk-picks\|kiosk-booking"`: 101, none on retry (1.6 min) |
| Golden rows                             | PASS   | `golden.test.ts`, unchanged                                                                                 |

One earlier run of the slip screens failed `home-slip-placed` (phone, am) on a slow run (4.5 min) with its
retry failing in 7 ms; it passed alone twice and in the next full slip run.

## Tests proven

Each broken in the store and seen to fail, then restored:

- A tap adding beside the match's pick: the four AC-2 tests (store, player slip, booking, kiosk).
- `switchSlip` doing nothing: nine tests (the store's slips, answers, realtime and starting stake; the
  player's tabs; a code and a ticket staying with Slip 1; the kiosk's slips).
- Answers landing on the slip on screen: the store's two AC-4 tests and two placing tests.
- Realtime reaching only the slip on screen: the store's AC-5 test and `forgetPlacement` across slips.
- A loaded code keeping its type: the store's AC-1 test and two booking tests.
- The picked index not following the slip on screen: the store's and the kiosk's AC-3 tests.

## Acceptance criteria

| AC   | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | PASS   | `BetSlip.test.tsx` › "offers no Single or System: one pick is a single, two a multiple (F3c AC-1)"; `TerminalKiosk.test.tsx` › "offers no Single or System (AC-1)"; `BookingFlow.test.tsx` › "loads a code saved as a system as one multiple, and says so (F3c AC-1)", › "loads a code saved as singles as one multiple, and says so (F3c AC-1)"; `slip-store.test.ts` › "prices every slip as one bet…" |
| AC-2 | PASS   | `slip-store.test.ts` › "replaces the slip's pick from the same match, in its place (AC-2)"; `BetSlip.test.tsx` › "replaces a match's pick when another price of it is tapped…"; `BookingFlow.test.tsx` › "books the second pick of a match in place of the first…"; `TerminalKiosk.test.tsx` › "replaces a match's pick with another price of it (AC-2)"                                                 |
| AC-3 | PASS   | `slip-store.test.ts` › "switches slips…"; `BetSlip.test.tsx` › "keeps three slips…"; `TerminalKiosk.test.tsx` › "keeps three slips: taps go into the one on screen, and only its prices show as picked (AC-3)". Screens `home-slip-tabs-*`, `terminal-kiosk-slip-tabs-*`                                                                                                                                 |
| AC-4 | PASS   | `slip-store.test.ts` › "sends a ticket, a refusal or no answer to the slip that asked, after a switch (AC-4)", › "sends a booked code to the slip that asked…"; `PlaceBet.test.tsx` › "places the slip on screen, and keeps its ticket with it…"; `BookingFlow.test.tsx` › "keeps a code booked in Slip 1 with Slip 1 (F3c AC-4)"                                                                        |
| AC-5 | PASS   | `slip-store.test.ts` › "moves or suspends a pick in every slip that holds it (AC-5)"                                                                                                                                                                                                                                                                                                                     |

## Review findings

Panel (round 1): spec FAIL (2 MAJOR), quality FAIL (1 BLOCKER), money FAIL (1 MAJOR, the same bug), UI
PASS. Fixed in `51c6655` and the review-fix commit below; the quality reviewer re-checked Q1 alone: RESOLVED (its two MINOR notes: the Slip 2 assertion now checks the store; `forgetPlacement` documented as the full reset).

| ID     | Reviewer                    | Severity | Summary                                                                                                                                                                        | Decision                                                                                                                                                                                                                                                                                                                                   |
| ------ | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1     | quality, money (M1)         | BLOCKER  | Another player's placing was forgotten only when its slip came on screen, and then every slip was wiped — the new player's own bet on its way or unconfirmed (its key) with it | Fixed: `forgetOtherPlayers(playerId)` resets only slips owned by someone else, driven by every slip's owner. Store test › "forgets only another player's placing…" and `PlaceBet` › "keeps this player's ticket when they open a slip holding another player's unanswered bet…" fail with the old effect / with every slip wiped, pass now |
| S1     | spec, quality (Q8), UI (U1) | MAJOR    | The tab screens and translation notes weren't committed                                                                                                                        | Fixed in `51c6655`                                                                                                                                                                                                                                                                                                                         |
| S2     | spec                        | MAJOR    | No test of one `Idempotency-Key` per slip                                                                                                                                      | Fixed: `PlaceBet` › "keeps an Idempotency-Key per slip…" (Slip 2 places with a new key; Slip 1's Try again resends its own); fails with placing shared across slips                                                                                                                                                                        |
| Q2     | quality                     | MAJOR    | The AC-4 component tests switched only after the answer                                                                                                                        | Fixed: `PlaceBet` › "puts a ticket that arrives while another slip is on screen…" and `BookingFlow` › "puts a code that arrives while another slip is on screen…" hold the answer; the booking one fails with the code written to the slip on screen                                                                                       |
| M2     | money (and quality Q7)      | MINOR    | `resetAll` left Slip 1 without the minimum; the start was an effect keyed on the slip on screen                                                                                | Fixed: the store keeps `minStake` and starts a slip in `switchSlip`/`resetAll`; › "starts Slip 1 at the minimum again after a reset" fails without                                                                                                                                                                                         |
| Q4     | quality                     | MINOR    | An update for a price no slip holds still notified every subscriber                                                                                                            | Fixed; › "changes nothing for a price or match no slip holds" fails without                                                                                                                                                                                                                                                                |
| Q9     | quality                     | MINOR    | Refusal and realtime tests didn't cover a slip on screen holding the same pick                                                                                                 | Fixed in those tests                                                                                                                                                                                                                                                                                                                       |
| S3     | spec                        | MINOR    | A system code with one leg left said "priced as one multiple"                                                                                                                  | Fixed: only with more than one leg added                                                                                                                                                                                                                                                                                                   |
| S4     | spec                        | MINOR    | Plan still said the simulator changes                                                                                                                                          | Fixed in the plan                                                                                                                                                                                                                                                                                                                          |
| U2     | UI                          | MINOR    | The pressed tab's cue was weak                                                                                                                                                 | Fixed: an accent ring as well as the border                                                                                                                                                                                                                                                                                                |
| U3     | UI                          | MINOR    | ትኬት names three things in Amharic                                                                                                                                              | Noted in TRANSLATION-NOTES for the reviewer (the user chose the word)                                                                                                                                                                                                                                                                      |
| S5, Q5 | spec, quality               | MINOR    | `mode`/`systemK`, `setMode`/`setSystemK` and the "Use multiple" fix are dormant                                                                                                | Follow-up: removing them reaches calculate, the alerts and many tests; harmless meanwhile                                                                                                                                                                                                                                                  |
| Q6     | quality                     | MINOR    | `startStake`'s `stake !== ""` guard exists for tests                                                                                                                           | Kept: in the app it is equivalent (a stake comes only with the started flag); it also protects any future direct setter                                                                                                                                                                                                                    |
| Q3, M3 | quality, money              | MINOR    | One booking mutation's error/pending shared across slips; a code for a slip cleared mid-request is dropped                                                                     | Follow-up (listed in Gaps); bookings move no money                                                                                                                                                                                                                                                                                         |

## Gaps

- The full screen suite (652) was not run on this branch; the 101 slip screens were.
- Two bookings in flight from two slips share one `useCreateBooking` mutation's pending flag, so Book bet
  shows busy in the other slip until the first answers; each answer still lands in its own slip.
- Flaky (after the review fixes): `booking.spec.ts` › "redirects a lowercase code to the canonical path"
  timed out once (1.1 min) and passed on retry; a URL redirect, not a slip screen.
