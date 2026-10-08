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

(After the panel.)

## Gaps

- The full screen suite (652) was not run on this branch; the 101 slip screens were.
- Two bookings in flight from two slips share one `useCreateBooking` mutation's pending flag, so Book bet
  shows busy in the other slip until the first answers; each answer still lands in its own slip.
