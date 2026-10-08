# F3c — plan

Plan gate: approved 2026-10-08 (mode: interactive). The user's answers: the phone bar counts the slip on
screen; the Amharic tab is "ትኬት {n}".

Mode: interactive. Branched from `task/F8cb-simple-slip` (not yet merged), on the user's
direction of 2026-10-08.

## Changed while implementing

- `SlipState` lives in the store file, beside `Placement` and `BookingIntent`, not in `types/index.ts`.
- `simulator.ts` is unchanged: it moves a price of a pick in the slip on screen, which is what a demo shows.
- The tabs also sit above a placed bet's ticket, so the other slips stay in reach (`BetSlip`).
- Each tab is named "Slip 1, 2 selections" (`betSlip.slipNAria`): the badge's number ran into the label
  ("Slip 12") otherwise.
- `startStake` also leaves a slip alone that already holds a stake (tests set one directly; in the app a
  stake comes only through actions that mark the slip started).
- Test harnesses (`terminal.tsx`, `BetSlip`, `PlaceBet`, `BookingFlow`) reset all three slips per test
  (`resetAll`).
- After review (Q1/M1, BLOCKER): another player's placing is forgotten per slip (`forgetOtherPlayers`),
  driven by every slip's owner; the player's own bets stay. The store remembers the minimum (`minStake`)
  and starts a slip at it when it first comes on screen, also after `resetAll` (M2, Q7). An update for
  no slip notifies nothing (Q4).

## Understanding

In Ethiopia people bet accumulators, so the slip drops Single and System and prices every slip as a
multiple (one pick is a single, because a multiple needs two). In their place the slip gets three tabs,
Slip 1 to 3, each a separate slip with its own picks, stake, figures, Book bet and (online) Place bet, so a
customer can build several bets and switch between them. A price shows as picked only for the slip on
screen, and a second pick from a match already in that slip replaces the first. The player's site and the
kiosk share the slip, so both change together. No figure changes: slipcalc prices whatever slip is on
screen.

## Spec conflicts and decisions

| #   | Question                                                                                                                           | Decision and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Single and System are in the contract (`bet_type`), D1 and the product docs.                                                       | **The UI offers neither** (the user's decision). The contract and D1 allow all three types and require none, so nothing conflicts above the product docs (lowest source). `BetModeTabs` goes from both slips; the store's mode is fixed to `multiple`; `calculateBetSlip` already makes one live pick a single.                                                                                                                                                                                                                          |
| 2   | A loaded code saved as singles or a system.                                                                                        | **Loaded as a multiple, and the notice says so.** `replaceSlip` keeps the code's picks and hint but not its type. The existing system note (`booking.sizesNoteMultiple`) already says a system can't be priced and the slip prices a multiple; a new `booking.singlesNote` says the same for singles ("This code was saved as singles; the slip prices it as one multiple.").                                                                                                                                                            |
| 3   | Two picks from one match.                                                                                                          | **A tap replaces the slip's pick from that match** (the user's decision), in its place in the list. Only a loaded code can still bring two legs of one match; then the conflict alert stays, without "Use Single" (its body loses "or switch to Single"; the key `betSlip.alerts.useSingle` goes).                                                                                                                                                                                                                                       |
| 4   | Where three slips live without rewriting every reader of the slip store (about 20 files read `selections`, `stake`, `placement`…). | **The active slip stays in the store's top-level fields; the other two are parked** (`parked: [SlipState, SlipState]`, `active: 0 \| 1 \| 2`). `switchSlip(n)` parks the current fields and unparks slip `n`. Every reader keeps reading the slip on screen, unchanged, and `index` (outcome → picked) is the active slip's, so a price shows as picked only for it. What crosses slips: realtime updates (decision 6), placing and booking answers (decision 5), `forgetPlacement` (every slip), counts for the tabs (`useSlipCounts`). |
| 5   | A booking or a bet answered after the customer switched slips.                                                                     | **Answers go to the slip that asked, found by its key**: `placementPlaced/Refused/Unanswered/SessionEnded(key)` and the booking receipt look in the active slip, then the parked ones, for the `sending` or `bookingIntent` with that key (a refusal's odds updates go to that slip's picks). So a code or a ticket stays with its slip. Each slip has its own `placement` and `bookingIntent`: one bet in flight per slip, and an unconfirmed bet in slip 1 doesn't stop slip 2 (another bet, the player's explicit choice).            |
| 6   | Realtime price moves and suspensions.                                                                                              | **Applied to every slip** (`applyOddsUpdate`, `applyEventSuspension` map the parked slips too). (The simulator is unchanged: it moves a pick of the slip on screen; see "Changed while implementing".)                                                                                                                                                                                                                                                                                                                                   |
| 7   | The starting stake (`useStartingStake`) when a fresh slip is opened.                                                               | **Each slip starts at the minimum once**: a per-slip `stakeStarted` flag replaces the `stake === ""` guard, set by the start, by any `setStake` and by a loaded hint. So a slip opened for the first time starts at the minimum, and one the customer cleared stays cleared when they come back to it.                                                                                                                                                                                                                                   |
| 8   | The tabs.                                                                                                                          | **`SlipTabs`** (new, shared): three buttons `Slip 1/2/3` (`aria-pressed`, as `Segmented`), each with its count badge (none at 0), at the top of the slip under its header, on both sites. New strings: `betSlip.slipN` ("Slip {n}" / "ትኬት {n}"), `betSlip.slipsAria` ("Slips"). The header's count, Clear all, the phone bar's count and the kiosk's bar count are the active slip's.                                                                                                                                                    |
| 9   | F8cc's idle reset.                                                                                                                 | Out of scope here; its note gains "reset all three slips and go back to Slip 1".                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Design

```
store: { ...active slip's fields, active, parked: [SlipState, SlipState] }
  switchSlip(n) · useSlipCounts() · toggleSelection (same match → replace)
  placement*/booking answers by key → the slip that asked
  applyOddsUpdate / applyEventSuspension → every slip
BetSlip (player) / KioskSlip:  BetSlipHeader · SlipTabs · alerts · notice · picks · stake · figures · buttons
```

- No contract operation changes; requests are the active slip's, as today (`bet_type` single or multiple).
- `features/bet-slip/types`: `SlipState` (selections, mode, stake, stakeStarted, systemK, oddsPolicy,
  bookingNotice, bookingIntent, placement).
- `use-bookings.ts`: the receipt is written to the slip holding that intent's key
  (`bookingReceived(key, receipt)`), not to whatever slip is on screen.
- `to-slip.ts`: the notice carries the code's own type (`savedAs`) for decision 2.
- Errors: unchanged; each is shown in the slip it belongs to.
- Flags: none.

## Files

| File                                                                                                      | Why                                                                                                                    |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/features/bet-slip/stores/bet-slip.store.ts`                                                          | Three slips (parked), `switchSlip`, counts, same-match replace, answers by key, realtime on every slip, `stakeStarted` |
| `src/features/bet-slip/types/index.ts`                                                                    | `SlipState`                                                                                                            |
| `src/features/bet-slip/components/SlipTabs.tsx` (new)                                                     | The tabs                                                                                                               |
| `src/features/bet-slip/components/BetSlip.tsx`, `src/features/terminal/components/kiosk/KioskSlip.tsx`    | Tabs in; `BetModeTabs` out                                                                                             |
| `src/features/bet-slip/components/BetModeTabs.tsx`                                                        | Deleted                                                                                                                |
| `src/features/bet-slip/hooks/use-starting-stake.ts`                                                       | Per-slip `stakeStarted`                                                                                                |
| `src/features/bet-slip/components/AlertList.tsx`                                                          | Conflict alert without "Use Single"                                                                                    |
| `src/features/bookings/hooks/use-bookings.ts`, `lib/to-slip.ts`, `components/BookingNotice.tsx`           | Receipt to its slip; the code's type and the singles note                                                              |
| ~~`src/lib/websocket/simulator.ts`~~ (unchanged)                                                          | "In the slip" reads every slip                                                                                         |
| `src/lib/i18n/messages/{en,am}.json`, `TRANSLATION-NOTES.md`                                              | Slip tabs, singles note, conflict body                                                                                 |
| `tests/unit/slip-store.test.ts`                                                                           | The store's slips, replace, answers by key, realtime                                                                   |
| `tests/component/BetSlip.test.tsx`, `PlaceBet.test.tsx`, `BookingFlow.test.tsx`, `TerminalKiosk.test.tsx` | Both sites on screen; tests of Single/System and of "Use Single" rewritten                                             |
| `tests/e2e/screens.spec.ts`, `terminal.spec.ts`                                                           | Screens with tabs: two slips, a switch, both sites                                                                     |
| `docs/design/04-slip-and-money.md`, `10-terminal.md`, `docs/tasks/F8cc-slip-code.md`                      | Design and the reset note                                                                                              |

## Acceptance criteria → tests

| AC   | Test                                                                                                                                                                                                                                               | How it proves it                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| AC-1 | `BetSlip.test.tsx` › "offers no Single or System: one pick is a single, two a multiple"; `TerminalKiosk.test.tsx` › same on the kiosk                                                                                                              | No such buttons; the payout is slipcalc's single, then multiple |
| AC-1 | `BookingFlow.test.tsx` › "loads a code saved as singles or a system as one multiple, and says so"                                                                                                                                                  | The notice's note; the request's `betType`                      |
| AC-2 | `slip-store.test.ts` › "replaces the slip's pick from the same match, in its place"; `TerminalKiosk.test.tsx` › "a second price of a match replaces its pick"                                                                                      | One pick of the match, the new one; no conflict alert           |
| AC-3 | `slip-store.test.ts` › "switches slips: each keeps its picks, stake and booking"; `TerminalKiosk.test.tsx` and `BetSlip.test.tsx` › "builds two slips and switches between them; prices show as picked for the slip on screen"                     | Tab counts, picks and stakes per slip, `aria-pressed` on prices |
| AC-4 | `slip-store.test.ts` › "an answer after a switch goes to the slip that asked"; `PlaceBet.test.tsx` › "places the slip on screen and keeps its ticket with it after a switch"; `BookingFlow.test.tsx` › "a code booked in slip 1 stays with slip 1" | Keys per slip; receipt and code where they belong               |
| AC-5 | `slip-store.test.ts` › "a price move or suspension reaches every slip"                                                                                                                                                                             | Parked slips updated                                            |
| —    | `golden.test.ts` unchanged; `pnpm ui`: `home-slip-*`, `home-slip-tabs-*`, `terminal-kiosk-slip-*`, `terminal-kiosk-slip-tabs-*`                                                                                                                    | Screens                                                         |

## Risks

- **Money:** a bet or code must never land in the wrong slip: answers are matched by key, and each slip
  keeps its own `Idempotency-Key`s (tests). Figures are slipcalc's for the slip on screen; nothing new is
  computed.
- **The player's placing flow** (unconfirmed, refused, Try again) moves into a per-slip state; the existing
  `PlaceBet.test.tsx` guards it, plus the switch tests.
- **Performance:** `index` stays the active slip's, so a price still re-renders only on its own flag; a
  switch re-renders the pressed prices once.
- **Accessibility:** tabs are buttons with `aria-pressed` and their counts in the name; the slip's heading
  stays.

## Out of scope

Persisting slips, renaming slips, more than three; F8cc's idle reset (noted there).

## Sub-tasks

None expected: about 1,200 changed lines, most of it tests.
