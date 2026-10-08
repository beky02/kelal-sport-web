# F8cb — plan

Plan gate: approved 2026-10-08 (mode: interactive) — plan approved as written. The user's answers: a
tenant without `retail_betting` says **"Ask the shop staff what this slip pays."** (decision 9); the
kiosk's stake **starts empty** (decision 4); a loaded code's **stake hint becomes the stake**, under the
shop's limits (decision 5).

Mode: interactive. Before planning, `pnpm contract:sync --check` found the contract
behind the backend (additive error responses on bookings and the ticket check); synced on the user's
go-ahead as this branch's first commit (`aa30414`). `pnpm check` passed on main (1,610 tests).

## Understanding

The kiosk's slip (F8ca) lists picks, books them as a code and loads codes, but shows no stake and no
figure. F8cb prices it: the tenant's shop rule set (`retail_betting`, D1.12) comes with the kiosk's config,
and the slip shows the player's modes (single, multiple, system), the player's figures (`SlipSummary`,
`PayoutSummary`: total odds, bonus, the payout, no tax lines), computed only by slipcalc on the retail
rules, and slipcalc's own refusals with their fixes as a tap. The customer types an optional stake on an
on-screen keypad rather than a text field. The online rule set never reaches the kiosk; a tenant without
`retail_betting` shows the picks without a figure. Nothing is placed: no balance, no login, no Place.

## Spec conflicts and decisions

| #   | Question                                                                                                                                                                       | Decision and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which rule set prices the kiosk's slip.                                                                                                                                        | **`retail_betting` only** (D1.12, C19 §4.2; the user's decision of 2026-10-07: one brand-level shop rule set, no per-shop lookup). `toTerminalConfigView` maps it with the player's `toBettingRules` into `TerminalConfigView.rules`; the view still has no `betting`, so nothing on the kiosk can reach the online set. No `retail_betting` → `rules: null`.                                                                                                                                                                                                                                                   |
| 2   | Where the slip's odds come from after a tap (F8ca review M2).                                                                                                                  | **The odds at the tap, or a loaded code's current odds; slipcalc prices `currentOdds`.** That is the player's slip in Release 1 too: with realtime off (D8) nothing moves a pick's price after the tap (`applyOddsUpdate` is realtime's). C19 §4.3 and §14 put re-pricing at the counter: the POS loads the code re-priced from the catalogue and shows old and new odds, and the engine's price counts (D1). So the kiosk's figures are a preview at the slip's odds. A pick whose match has started stays until removed (a gap, as on the player's site).                                                     |
| 3   | How the kiosk accepts a moved price before pricing (it passes `pending={false}`).                                                                                              | **It doesn't ask.** The scope says "no odds-change consent"; the kiosk places nothing. A code's moved leg keeps showing old → new (`BetSelectionRow` shows a move whatever `pending` is), and the figures use the new price (`calculateBetSlip` with `oddsPolicy: "any"`, so nothing is pending).                                                                                                                                                                                                                                                                                                               |
| 4   | Where the kiosk's stake starts. The store's default is the player's `BETTING.defaultStake` (`"100"`).                                                                          | **Empty** (the user's answer at the gate). C19 §4.2: the customer "optionally types a stake hint". A preset would go out as a hint on every code the customer never typed, and a keypad would append to it ("1005"). The kiosk sets the shared store's stake to `""` when it comes up (`Kiosk`); F8cc's idle reset will do the same. With no stake the slip shows "—" for the figures and Book bet saves the picks alone (AC-b1).                                                                                                                                                                               |
| 5   | Whether the shop honours a loaded code's `stake_hint` (`replaceSlip` puts it in `stake`).                                                                                      | **Yes** (the user's answer at the gate), as on the player's site. The retail limits then apply: the contract's hint (50.00) passes; one under the shop's minimum is refused by slipcalc with "Set 10.00" as a tap. With no retail rules the hint is neither shown nor sent.                                                                                                                                                                                                                                                                                                                                     |
| 6   | `BookingNotice`'s `priced` (F8ca passed `null`).                                                                                                                               | **The slip's bet** (`mode`, `systemK`, `liveCount` from `calculateBetSlip`), as the player's slip passes it, so a system code's sizes note shows when the kiosk prices another size. `null` again only without retail rules.                                                                                                                                                                                                                                                                                                                                                                                    |
| 7   | The player's `SlipAlerts` calls `useBreak` (`/api/me`) and carries placing's alerts, none of which exist on a kiosk.                                                           | **Split the slip's own alerts out** so both sites share their copy and fixes: `AlertList` (the markup and its buttons) and builders for the conflict (Use singles), a suspended pick (Remove it), slipcalc's problems (too low / too high with the amount as a tap, too many legs, too many lines → Use multiple, can't price) and D1's warnings (remainder not charged, bonus capped, max payout). `SlipAlerts` composes them in today's order with its placing alerts, unchanged; the kiosk composes only them. The player's slip tests guard the move.                                                       |
| 8   | The stake control. The player's `StakeInput` is a text input (`inputMode="decimal"`), which on a touch kiosk opens the OS keyboard.                                            | **`KioskStake`**: the player's field row, but the amount is an `<output>` (no text box), then the keypad — 1–9, `.`, 0, ⌫ (delete) in a 3 × 4 grid — with the row's C to clear, as the player's has. Every key goes through the store's `setStake` (`sanitiseAmount`): digits, one point, two decimals, no leading zeros, the player's rules exactly. Then the player's "N bets × X" line and quick stakes (`rules.quickStakes`; the contract's retail set has none, so none show), split out of `StakeInput` as `StakeLines` and `QuickStakes`. Keys are 44 px (the player's sizes, the user's F8ca decision). |
| 9   | A tenant without `retail_betting` (copy about money, the task's gate question).                                                                                                | **The picks, the mode tabs, Book bet and Load code; no stake, no figure, no alert** — and one line, the user's wording at the gate: "Ask the shop staff what this slip pays." (`ይህ ትኬት ምን ያህል እንደሚከፍል የሱቁን ሠራተኞች ይጠይቁ።`).                                                                                                                                                                                                                                                                                                                                                                                       |
| 10  | Book bet now carries a stake. Its refusal `BET_STAKE_TOO_LOW/HIGH` comes with `fixStake`, which the kiosk's `BookBet` ignores today (its message would show a raw `{amount}`). | **As the player's guest slip:** the stake typed goes as the code's hint when slipcalc accepts it (`bookingRequestFrom`, unchanged); a refusal's message takes the amount and offers it as a tap. Book bet stays on the player's `POST /v1/bookings` until F8cc's slip codes.                                                                                                                                                                                                                                                                                                                                    |
| 11  | The slip column gets taller (tabs, keypad, figures). The aside is `sticky` with `overflow-hidden`, so its foot (Book bet) could sit below the screen until the board ends.     | **Needed (seen in the screenshots)**: the kiosk's aside scrolls on its own (`max-h` of the viewport under the header, `overflow-y-auto`) in `KioskShell`; the player's is unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                            |

Sources agree otherwise. Nothing here needs a contract change.

## Design

```
GET /api/terminal/config ─ loadTerminalConfigView ─ toTerminalConfigView(PublicConfig)
                              { retail, bookingCodes, languages, defaultLanguage,
                                rules: retail_betting ? toBettingRules(retail_betting) : null }
useTerminalConfig().data.rules ─▶ KioskSlip
  calculateBetSlip({ selections, mode, stake, systemK, rules: rules?.calc ?? null, balance: null, oddsPolicy: "any" })
  BetSlipHeader · BetModeTabs · KioskSlipAlerts · BookingNotice(priced) · picks
  rules ? KioskStake · SlipSummary · PayoutSummary(rules.calc) : the no-rules line
  BookBet (stake typed → hint; refusal → fix) · LoadBookingCode
```

- **Contract operation:** `getPublicConfig`, already read (anonymously, cached 60 s per tenant). No new
  call, route or query key; `terminalKeys.config()` now carries `rules`.
- **Domain:** `TerminalConfigView.rules: BettingRules | null` (the player's type).
- **Schemas:** `bettingRulesSchema` (with `oddsPolicySchema` and the decimal pattern) moves from
  `schemas.ts` to `lib/api/rules-schema.ts`, re-exported by `schemas.ts` as `moneySchema` is, so the kiosk
  imports it without the player's schema module (F8b review Q3). `terminalConfigSchema` gains
  `rules: bettingRulesSchema.nullable()`.
- **Components:**
  - `features/bet-slip/components/AlertList.tsx` (new): the `SlipAlert` shape, `AlertList`, `AlertButton`
    (moved from `SlipAlerts`), and the builders `conflictAlert`, `suspendedAlert`, `problemAlert`,
    `warningAlerts` (moved; `suspendedAlert` takes the refusal's flavour, which the kiosk never has).
  - `SlipAlerts` composes them as today; `StakeInput` composes `StakeLines` and `QuickStakes` (exported).
  - `features/terminal/components/kiosk/KioskStake.tsx` (new): the display, the keypad, the lines and
    quick stakes.
  - `KioskSlip`: priced as above; `KioskSlipAlerts` inside it (conflict, suspended, problem, warnings);
    `BookBet` takes the stake and the fix.
  - `Kiosk`: the stake starts empty when the kiosk comes up (decision 4).
- **Errors handled:** slipcalc's `BET_STAKE_TOO_LOW` / `BET_STAKE_TOO_HIGH` (the amount as a tap),
  `BET_TOO_MANY_LEGS`, `BET_TOO_MANY_LINES` (Use multiple), `VALIDATION_FAILED`; the booking's
  `BET_STAKE_TOO_LOW/HIGH` with `errors[].limit` (the amount as a tap), the rest as today.
- **i18n (new, both catalogues, composed Amharic in `TRANSLATION-NOTES.md`):** `terminal.kiosk.keypad`
  ("Stake keypad"), `terminal.kiosk.keyPoint` ("Decimal point"), `terminal.kiosk.keyDelete` ("Delete last
  digit"), `terminal.kiosk.noRules` ("Ask the shop staff what this slip pays."). Everything else is the player's.
- **Feature flags:** none.

## Files

| File                                                                                 | Why                                                                                                                         |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/api/mappers/config.ts`                                                      | `toTerminalConfigView` maps `retail_betting` into `rules`                                                                   |
| `src/features/terminal/types.ts`                                                     | `TerminalConfigView.rules`                                                                                                  |
| `src/lib/api/rules-schema.ts` (new), `src/lib/api/schemas.ts`                        | The rules schema, importable by the kiosk; re-exported                                                                      |
| `src/lib/api/terminal-schemas.ts`                                                    | `rules` in `terminalConfigSchema`                                                                                           |
| `src/features/bet-slip/components/AlertList.tsx` (new), `SlipAlerts.tsx`             | The slip's own alerts and their markup, shared (decision 7)                                                                 |
| `src/features/bet-slip/components/StakeInput.tsx`                                    | `StakeLines`, `QuickStakes` exported (decision 8)                                                                           |
| `src/features/terminal/components/kiosk/KioskStake.tsx` (new)                        | The stake on a keypad                                                                                                       |
| `src/features/terminal/components/kiosk/KioskSlip.tsx`                               | The priced slip, the no-rules state, Book bet with a stake                                                                  |
| `src/features/terminal/components/kiosk/Kiosk.tsx`                                   | The stake starts empty                                                                                                      |
| `src/features/terminal/components/kiosk/KioskShell.tsx`                              | The slip column scrolls on its own (decision 11: needed; the priced slip is ~1,060 px at 1440 × 900)                        |
| `src/lib/i18n/messages/{en,am}.json`, `src/lib/i18n/messages/TRANSLATION-NOTES.md`   | Four strings                                                                                                                |
| `tests/unit/terminal-mappers.test.ts`, `tests/unit/terminal-route.test.ts`           | Rules from `retail_betting`, never `betting`; the route's answer                                                            |
| `tests/component/TerminalKiosk.test.tsx`                                             | AC-3, AC-b1, AC-b2 on screen; the F8ca tests the priced slip changes (the code's stake hint)                                |
| `tests/e2e/terminal.spec.ts`                                                         | `kiosk-slip`, `kiosk-slip-too-low`, `kiosk-slip-no-rules` × en/am × phone/desktop                                           |
| `tests/component/terminal.tsx` (added while implementing)                            | `boardOf(items)`: a board of the contract's matches, for AC-3's three-leg multiple (Real Madrid v Barcelona's 1X2 reopened) |
| `tests/unit/kiosk-language.test.ts` (added while implementing)                       | Its config fixture gains `rules: null`                                                                                      |
| `docs/design/10-terminal.md`, `docs/design/04-slip-and-money.md`                     | The kiosk's slip; the retail rule set                                                                                       |
| `docs/tasks/F8cb-kiosk-slip.md`, `README.md`, `F8cb/plan.md`, `F8cb/verification.md` | Status and evidence                                                                                                         |

## Acceptance criteria → tests

| AC    | Test                                                                                                                                    | How it proves it                                                                                                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-3  | `terminal-mappers.test.ts` › "takes the kiosk's rules from retail_betting, never the online betting (F8cb AC-3)"                        | `rules` equals `toBettingRules(retail_betting)` and differs from the online set (min 10.00 vs 5.00, empty bonus table); the schema accepts it                               |
| AC-3  | `terminal-route.test.ts` › "reads the kiosk's config for a terminal: retail, the languages, the default, the shop's rules (AC-3, AC-4)" | The route's answer carries the retail rules from the contract's example                                                                                                     |
| AC-3  | `TerminalKiosk.test.tsx` › "refuses a stake under the shop's minimum — 10.00, not the online 5.00 — and offers it as a tap (F8cb AC-3)" | 5 typed on the keypad → "Stake too low" with ETB 10.00 and "Set 10.00"; the tap sets it and the alert goes; 5.00 would pass online                                          |
| AC-3  | › "prices a multiple with the shop's rules: no accumulator bonus, and slipcalc's payout to the santim (F8cb AC-3)"                      | Three picks, stake typed: the payout is `quote(slip, retail)`'s, which the test checks differs from `quote(slip, online)` (3 % bonus); no bonus line; total odds slipcalc's |
| AC-3  | `pnpm ui`: `terminal-kiosk-slip-{am,en}-{phone,desktop}`, `terminal-kiosk-slip-too-low-…`                                               | Screens                                                                                                                                                                     |
| AC-b1 | › "types the stake on the keypad: digits, one point, two decimals at most, delete and clear, with no text box (F8cb AC-b1)"             | Key sequences against the display (`0`,`1`,`2`,`.`,`3`,`4`,`5` → `12.34`; ⌫; C); no textbox named Total stake                                                               |
| AC-b1 | › "starts with no stake and works without one: the figures wait, and Book bet saves the picks alone (F8cb AC-b1)"                       | Empty display after the kiosk comes up (whatever the store held), "—" for the payout, Book bet's body `stake: null`                                                         |
| AC-b1 | › "books the stake typed as the code's hint, and offers the server's stake when it refuses it"                                          | Body `stake: "50.00"`; a 422 `BET_STAKE_TOO_HIGH` with `errors[].limit` → its message with the amount and a tap that sets it                                                |
| AC-b1 | › "loads a code's picks … at the server's prices, and says what couldn't come" (F8ca's, updated)                                        | The code's stake hint (50.00) is now the stake, priced with the shop's rules                                                                                                |
| AC-b2 | › "shows no balance, no log in and no place button — only Book bet (F8cb AC-b2)"                                                        | None of Balance, Log in to bet, Place bet; no `/api/me`, `/api/wallet` or `/api/config` call                                                                                |
| AC-b2 | › "shows the picks without any figure when the tenant has no shop rule set, never the online one's (F8cb AC-b2)"                        | Config `rules: null`: picks, the gate's line, no keypad, no ETB/ብር, no total odds; Book bet sends no stake even after a code's hint                                         |
| AC-b2 | `terminal-mappers.test.ts` › "has no rules without retail_betting, even with betting (F8cb AC-b2)"                                      | `rules: null`                                                                                                                                                               |
| AC-b2 | `pnpm ui`: `terminal-kiosk-slip-no-rules-{am,en}-{phone,desktop}`                                                                       | Screen                                                                                                                                                                      |
| —     | `BetSlip.test.tsx`, `PlaceBet.test.tsx` (unchanged), `pnpm ui` player slip screens                                                      | The split of `SlipAlerts` and `StakeInput` changes nothing on the player's slip                                                                                             |
| —     | `golden.test.ts` (unchanged), `check-host-split.mjs`                                                                                    | slipcalc untouched; the kiosk still loads nothing of the player's layout or stores                                                                                          |

## Risks

- **Money.** Every figure is `calculateBetSlip` → slipcalc on `rules.calc` from `retail_betting`; the kiosk
  has no path to `betting` (the view lacks it; a test proves the figures are retail's where the two differ).
  The stake stays a string through `sanitiseAmount`; no arithmetic is added. Nothing is placed. Book bet
  sends the typed stake only when slipcalc accepts it. A preview at the tapped odds (decision 2): the POS
  re-prices at sale.
- **The player's slip.** `SlipAlerts` and `StakeInput` are split, not changed: same alerts, order, copy and
  markup. Guarded by the player's slip and placing tests and screens.
- **Host split.** The kiosk imports more bet-slip components (`BetModeTabs`, `SlipSummary`,
  `PayoutSummary`, `AlertList`, `StakeLines`, `QuickStakes`); none reads `ui.store`, the session or
  `/api/me` (`SlipAlerts` stays player-only). `check-host-split.mjs` runs in `pnpm verify`.
- **Accessibility.** Keys are buttons with names (digits, "Decimal point", "Delete last digit", "Clear
  stake"), in a named group; the amount is an `<output>` labelled "Total stake", so changes are announced;
  44 px targets; alerts keep their roles.
- **Security.** No new route, input or upstream call; the config route's answer grows by the public rule
  set.
- **Performance.** One memoised `calculateBetSlip` per slip change, as the player's.

## Out of scope

- Slip codes (Get code), the QR, the idle reset back to an empty stake, the rate limit (F8cc).
- Moving a pick's odds after the tap, or dropping a pick whose match has started (shared with the player's
  Release 1 slip; the POS re-prices, C19 §4.3).
- Signed catalogue reads (request 015, part 1 answered for the web).
- Any change to slipcalc, the golden files or the contract.

## Sub-tasks

None: about 700–900 changed lines, half tests, one area (the kiosk's slip).
