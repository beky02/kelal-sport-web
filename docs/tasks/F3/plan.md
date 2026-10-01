# F3 — plan

F3 is split (see **Sub-tasks**). This plan covers **F3a — slip calculator**; F3b (bookings) gets its own
plan when it starts.

## Understanding

The slip today prices bets with a float estimate (`calculate.ts`) and placeholder tax constants; it
differs from the backend in five known ways (stake tax per line, gross floored per line, acca bonus, cap
before tax, win tax on the whole base above a threshold). F3a replaces every slip and ticket figure with
the shared calculator `contracts/golden/ts/slipcalc.ts` (D1), fed with the tenant's `RuleSet` from
`GET /v1/config/public`. To do that honestly, money and odds stay the contract's decimal strings all the
way from the mapper to the formatter (FD4), with a small BigInt `lib/money.ts` for the few comparisons the
UI needs and a lint rule that stops float parsing of money from creeping back. The stake becomes the
**total** stake (D1.3, D7), with quick stakes that set it.

## Spec conflicts and decisions

| #   | Conflict / gap                                                                                                               | Decision                                                                                                                                                                        | Why                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Task scope (calculator + bookings + `/b`) vs. the ~1,500-line PR limit                                                       | Split into F3a (calculator, AC-1–5, 7, 8-money/lint) and F3b (bookings, AC-6, 8-route)                                                                                          | Two unrelated areas; the odds-as-strings change alone touches catalogue, realtime and bets                      |
| 2   | Existing UI: stake is _per bet_ in single/system; D1.3 + D7: stake entered is the **total**, `floor(stake/lines)` per line   | Stake is the total (`stake_is_per_line: false`); label "Total stake"; the slip shows `lines × stake per line`                                                                   | D1/D7 are above the built app                                                                                   |
| 3   | Existing chips **add** to the stake (`+100`); D7: quick stakes **set** the total                                             | Chips from `RuleSet.quick_stakes` set the stake; label without `+`                                                                                                              | D7                                                                                                              |
| 4   | C07 §4 caps after computing; D1.7 caps before tax                                                                            | D1.7 (slipcalc already does)                                                                                                                                                    | D1 is above C07                                                                                                 |
| 5   | FD4: odds are decimal strings in domain types; `Outcome.odds` is a `number` today                                            | `Outcome.odds`/`previousOdds` become decimal strings; formatters take strings; `t.odds` parses for display only                                                                 | FD4 + "Selections carry … the odds as the API's decimal string"                                                 |
| 6   | Realtime frames (local, Release 2, not in the contract) carry `odds` as a number, and a test asserts string odds are dropped | Frames carry decimal strings like every other wire; the test flips to "drops a frame whose odds arrived as a number"                                                            | AGENTS.md: "money and odds are decimal strings on the wire"; realtime is off (D8), no contract to conflict with |
| 7   | Slip identity `uid = eventId#type                                                                                            | line                                                                                                                                                                            | code`; the contract identifies a price by `outcome_id`                                                          | `uid` = `outcomeId`. The board button keys on `outcome.id`. Realtime still matches by event/market/line/code fields kept on the selection | Contract first; makes F3b's booking legs (which carry only `outcome_id`) light up their buttons |
| 8   | Single mode shows a per-row "Returns" figure; slipcalc has no per-line figure (win tax is per ticket)                        | Per-row return removed                                                                                                                                                          | CLAUDE.md: the slip shows what slipcalc computes, nothing else                                                  |
| 9   | slipcalc throws `BET_STAKE_TOO_HIGH` and `VALIDATION_FAILED` too, not only the three errors the task lists                   | Handled as well: too high offers "Set {max_stake}"; validation is a generic "can't price this slip"                                                                             | Errors carry their fix                                                                                          |
| 10  | Stake input is whole birr today; `Money` allows 2 decimals                                                                   | Keep whole-birr typing; quick stakes and fixes may set cents (`"0.05"` never arises from config values)                                                                         | Existing UI behaviour; not a money rule, just input                                                             |
| 11  | No rule set while `/api/config` loads or fails                                                                               | Figures show "—", Place is disabled; on failure an alert with Retry. Never fall back to constants                                                                               | Placeholder constants are what the task deletes                                                                 |
| 12  | `Wallet.balance` is still a `number` (F6) but the slip compares the stake to it                                              | `lib/money.fromLegacyAmount(n)` — deprecated bridge, removed in F6                                                                                                              | Wallet is F6's scope                                                                                            |
| 13  | Ticket breakdown (`features/bets`) recomputes with `settleBet`; mock bets are numbers                                        | `Bet.stake`, leg odds, cash-out amounts become strings; `settleBet` runs slipcalc with `settled` when no leg is open, else a preview. Bet type: one leg = single, else multiple | Task: `settleBet` calls the adapter; AC-3                                                                       |
| 14  | Cash-out share (`value × 0.25`) is float maths; cash out is Release 2 (off)                                                  | `lib/money.share(amount, num, den)` floored to the santim, display only, commented as such                                                                                      | AC-3; server decides the real amount                                                                            |
| 15  | `Transaction.amount` (wallet history shown in `features/bets`) is a number                                                   | Left for F6 — display only, no arithmetic                                                                                                                                       | Wallet history is F6                                                                                            |
| 16  | Warning/error copy (money copy) is not written anywhere                                                                      | Draft copy in en + am, Amharic flagged in `TRANSLATION-NOTES.md` for review                                                                                                     | Task explicitly asks for these messages; wording is reviewable, rules are not invented                          |
| 17  | `slipcalc.ts` uses TS parameter properties; Node's type stripping can't run it                                               | Imported through the bundler/Vitest only (`@golden/*` path alias); never executed by plain Node                                                                                 | Found while computing AC-7                                                                                      |

AC-7's D1 figure (computed with slipcalc, default rules): 1.62 × 3.05 × 1.38 = 6.818580; stake 100 →
stake tax 15.00, net 85.00; gross floor(85 × 6.81858) = 579.57; 3 legs ≥ 1.30 → 3 % of profit
(579.57 − 85.00 = 494.57) = floor(14.8371) = 14.83; 594.40 ≤ 1,000 so no win tax → **594.40**.

## Design

**Contract → loader → mapper → route → api → hook → components**

- `GET /v1/config/public` → `lib/server/public-config.ts` `loadPublicConfig(tenant)` (cached per tenant
  60 s, the operation's `Cache-Control`) → `lib/api/mappers/config.ts` `toBettingRules(cfg.betting)` →
  `src/app/api/config/route.ts` returns `PublicConfigView = { betting: BettingRules }` (F1/F2a extend it)
  → `features/config/api/get-config.ts` validated by `publicConfigSchema` → `features/config/hooks/use-public-config.ts`
  (`configKeys.public()`, staleTime 60 s).
- Domain: `BettingRules = { version: number; quickStakes: string[]; calc: RuleSetJson }` where `calc` is
  slipcalc's own input type (snake_case, strings) so nothing is renamed and renamed back.
- Slip adapter `features/bet-slip/lib/calculate.ts`:
  - `calculateBetSlip({ selections, mode, stake: string, systemK, rules: BettingRules | null, balance: string | null, acceptedUids, acceptAllOddsChanges })`
    → `BetSlipTotals` = UI fields (count, liveCount, mode, systemAvailable, systemK, conflicts,
    suspended, pendingOddsChanges, insufficientBalance) + `quote: SlipQuote | null` (slipcalc `Quote`,
    strings) + `problem: { code: SlipProblemCode; fix?: string } | null`.
  - `toSlip()` builds slipcalc's `Slip`: legs = live selections' `currentOdds`; `betType` = mode;
    `systemSizes` = `[systemK]` in system mode; stake = total.
  - Empty stake → no quote, no problem (nothing to say yet).
  - `settleBet(bet, rules)` → slipcalc with leg results mapped (`open/live→open, won→win, lost→lose, void→void`).
  - `combinations.ts`'s float `combinationProducts` deleted; `binomial` kept for the picker labels.
- `lib/money.ts`: `toSantim` (mirrors slipcalc's private parse), `fromSantim` (= slipcalc `money`),
  `compareMoney`, `addMoney`, `mulMoney(int)`, `maxMoney`, `share`, `compareOdds`, `normaliseMoney`,
  `fromLegacyAmount` (deprecated, F6).
- Store: `stake: string`, `setStake(string)`, `setQuickStake(amount)`; `addToStake` removed; selections
  carry `outcomeId`, string odds; odds moves compared with `compareOdds`.
- Formatters: `formatMoney(string | number)` formats strings by digit grouping (no float);
  `formatOdds(string | number)`; `formatRate("0.15") → "15%"`.
- Components: `StakeInput` (total stake, quick stakes from rules, lines × per-line hint),
  `TaxBreakdown`/`CalculationSteps` (lines from the quote and the rule set: stake tax with its rate,
  net stake, odds, gross, acca bonus, cap, each payout tax with rate and threshold, net payout),
  `PayoutSummary` (net payout, max payout from rules, capped badge), `SlipAlerts` (D1 warnings + errors
  - config failure), `PlaceBetButton` (disabled without a quote), `BetSelectionRow` (no per-row return),
    `BetModeTabs`, `BetPlacedConfirmation` and the mock `place-bet` (receipt in strings; mock refuses with
    slipcalc's codes).
- Errors / warnings handled (switch on code):
  - `BET_STAKE_TOO_LOW` → "Minimum stake is {amount}" + **Set {amount}** (`max(min_stake, lines × 0.01)`).
  - `BET_STAKE_TOO_HIGH` → "Maximum stake is {amount}" + **Set {amount}**.
  - `BET_TOO_MANY_LEGS` → "Up to {n} selections" (remove one; no auto-fix — the player chooses).
  - `BET_TOO_MANY_LINES` → "Too many combinations (max {n})" + **Use Multiple**.
  - `VALIDATION_FAILED` → "This slip can't be priced" (e.g. odds below 1.01).
  - `STAKE_REMAINDER_NOT_CHARGED` → "{amount} can't be split evenly; you'll be charged {charged}".
  - `ACCA_BONUS_CAPPED` → "Bonus capped at {amount}".
  - `MAX_PAYOUT_REACHED` → existing "Capped at max win" badge + "Max payout {amount} reached".
- i18n keys added under `betSlip.*`: `totalStake`, `linesTimesStake`, `accaBonus`, `taxAbove`,
  `netPayout`, `configFailed`, `retry`, `warnings.{remainder,bonusCapped,maxPayout}`,
  `errors.{stakeTooLow,stakeTooHigh,tooManyLegs,tooManyLines,cannotPrice}`; obsolete keys
  (`stakePerBet`, `stakePerCombination`, `winnings`, `returns`, `rejectedBody`) removed.
- Query keys: `configKeys = { all: ["config"], public: () => [...all, "public"] }`.
- Flags: none new. Cash out stays behind `features.cashOut`.
- ESLint (`eslint.config.mjs`): `no-restricted-syntax` on `src/**` and `tests/**`, except `lib/money.ts`,
  `lib/i18n/format.ts`: bans `parseFloat(…)`, and `Number(x)` / unary `+x` where `x` is an identifier or
  member named like money/odds (`/stake|odds|amount|payout|balance|price|tax|bonus|gross|net/i`).
  `tests/lint/fixtures/` is ignored by the normal lint run; `tests/unit/money-lint.test.ts` lints the
  fixture with ESLint's API and expects the rule to fire.

## Files

| File                                                                                                                                                                                           | Why                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `tsconfig.json`, `vitest.config.mts`                                                                                                                                                           | `@golden/*` → `contracts/golden/ts/*` alias                            |
| `eslint.config.mjs`                                                                                                                                                                            | FD4 money rule; ignore `tests/lint/fixtures`                           |
| `src/lib/money.ts` (new)                                                                                                                                                                       | BigInt santim helpers (FD4)                                            |
| `src/lib/server/public-config.ts` (new)                                                                                                                                                        | `loadPublicConfig`, cached per tenant                                  |
| `src/lib/api/mappers/config.ts` (new)                                                                                                                                                          | `RuleSet` → `BettingRules`                                             |
| `src/app/api/config/route.ts` (new)                                                                                                                                                            | `/api/config`                                                          |
| `src/features/config/{types.ts,api/get-config.ts,hooks/use-public-config.ts}` (new)                                                                                                            | browser side of config                                                 |
| `src/lib/api/schemas.ts`                                                                                                                                                                       | `publicConfigSchema`; outcome/bet schemas to decimal strings           |
| `src/lib/query/keys.ts`                                                                                                                                                                        | `configKeys`                                                           |
| `src/config/constants.ts`                                                                                                                                                                      | delete stake tax, win tax, cap, max stake, chips, default stake        |
| `src/features/bet-slip/lib/calculate.ts`                                                                                                                                                       | adapter over slipcalc; UI logic kept                                   |
| `src/features/bet-slip/lib/combinations.ts`                                                                                                                                                    | float products removed                                                 |
| `src/features/bet-slip/types/index.ts`                                                                                                                                                         | `outcomeId`, string odds                                               |
| `src/features/bet-slip/stores/bet-slip.store.ts`                                                                                                                                               | string stake, quick stake sets total, `compareOdds`                    |
| `src/features/bet-slip/hooks/use-bet-slip.ts`                                                                                                                                                  | rules from `usePublicConfig`                                           |
| `src/features/bet-slip/hooks/use-place-bet.ts`, `api/place-bet.ts`                                                                                                                             | strings in/out; mock refuses with slipcalc codes                       |
| `src/features/bet-slip/components/*.tsx` (BetSlip, StakeInput, TaxBreakdown, CalculationSteps, PayoutSummary, SlipAlerts, PlaceBetButton, BetSelectionRow, BetModeTabs, BetPlacedConfirmation) | render the quote, warnings, errors                                     |
| `src/features/markets/types/index.ts`                                                                                                                                                          | `Outcome.odds` decimal string                                          |
| `src/lib/api/mappers/catalogue.ts`                                                                                                                                                             | keep the contract odds string (validated, not parsed)                  |
| `src/features/odds/components/OddsButton.tsx`, `odds/lib/aria.ts`                                                                                                                              | key on `outcome.id`; string odds                                       |
| `src/lib/websocket/{messages,apply-updates,simulator,RealtimeProvider}.ts(x)`                                                                                                                  | string odds on the frame; `compareOdds` for movement                   |
| `src/lib/api/mock/repository.ts`, `mock/bets.ts`                                                                                                                                               | string odds/money in fixtures (catalogue parts only if still compiled) |
| `src/features/bets/{types/index.ts,lib/figures.ts,components/BetCard.tsx,BetTicket.tsx,CashOutPanel.tsx}`                                                                                      | strings; figures via `settleBet`                                       |
| `src/lib/i18n/{format.ts,use-translation.ts}`                                                                                                                                                  | string-aware formatters                                                |
| `src/lib/i18n/messages/{en,am}.json`, `TRANSLATION-NOTES.md`                                                                                                                                   | new keys                                                               |
| `tests/unit/golden.test.ts` (new)                                                                                                                                                              | all 366 rows                                                           |
| `tests/unit/money.test.ts` (new)                                                                                                                                                               | round trip vs. slipcalc                                                |
| `tests/unit/money-lint.test.ts`, `tests/lint/fixtures/parse-stake.ts` (new)                                                                                                                    | lint rule fires                                                        |
| `tests/unit/config-mappers.test.ts` (new)                                                                                                                                                      | mapper on the contract example                                         |
| `tests/unit/calculate.test.ts`                                                                                                                                                                 | rewritten on strings + rules; AC-7                                     |
| `tests/component/BetSlip.test.tsx`, `OddsButton.test.tsx`, `tests/component/render.tsx`                                                                                                        | rules in the query cache; AC-2/4/5                                     |
| `tests/unit/realtime.test.ts`, `catalogue-mappers.test.ts`                                                                                                                                     | string odds                                                            |
| `tests/e2e/screens.spec.ts`                                                                                                                                                                    | `home-slip` screen: three picks + calculation open                     |
| `docs/tasks/F3*.md`, `docs/tasks/README.md`                                                                                                                                                    | split, status                                                          |

## Acceptance criteria → tests

| AC      | Test                                                                                                            | How it proves it                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| AC-1    | `tests/unit/golden.test.ts` › `matches slips.csv row <case_id>` (one `it.each` per row) + `covers all 366 rows` | every row through `calculateQuote` (the adapter's slipcalc call); count asserted |
| AC-2    | `tests/component/BetSlip.test.tsx` › `shows the C07 worked example's net payout of 690.29`                      | five 1.50 picks, stake 100, default rules → text `690.29`                        |
| AC-3    | `grep -rnE "parseFloat                                                                                          | Number\(                                                                         | toFixed | Math\.(floor | round) | \*  | \+ " src/features/{bet-slip,bets}` reviewed in verification + lint rule + money-reviewer | no float maths on money |
| AC-4    | `BetSlip.test.tsx` › `quick stake 100 on a 2/3 system charges 99.99 and warns about the remainder`              | 3 picks, system 2/3, tap 100 → total `99.99`, remainder warning                  |
| AC-4    | `tests/unit/calculate.test.ts` › `sets the total stake, not the per-line stake, from a quick stake`             | store + adapter                                                                  |
| AC-5    | `BetSlip.test.tsx` › `follows the tenant's rule set: no_tax shows no tax lines and pays 681.85`                 | same slip, `no_tax` from `rules.json` in the query cache                         |
| AC-7    | `calculate.test.ts` › `prices the design's reference slip at D1's 594.40`                                       | arithmetic in the comment                                                        |
| AC-8m   | `tests/unit/money.test.ts` › `round-trips every money value in slips.csv through slipcalc's money()`            | every money column of every row                                                  |
| AC-8m   | `tests/unit/money-lint.test.ts` › `flags parseFloat(stake) outside lib/money`                                   | ESLint API on the fixture                                                        |
| —       | `config-mappers.test.ts` › `maps the contract's betting rule set unchanged into calc`                           | contract example                                                                 |
| —       | `calculate.test.ts` › one per error/warning code (offers the fix value)                                         | D1 errors                                                                        |
| —       | `realtime.test.ts` › `keeps untouched rows by reference` (existing) still green with string odds                | identity rule                                                                    |
| Screens | `pnpm ui` › `home-slip` (en/am, 375/1440)                                                                       | slip with figures, calculation, tax lines                                        |

## Risks

- **Money**: the adapter only arranges inputs; slipcalc is imported, not copied. Golden rows run through the
  same call path the slip uses. String odds compared with `compareOdds` so `"2.1"` vs `"2.10"` is no move.
  money-reviewer runs.
- **Wrong rules shown**: no fallback constants; without a rule set the slip shows no figures.
- **Security**: `/api/config` is public data; route handler adds `X-Tenant-Id` from the host as before.
- **Accessibility**: warnings use `role="status"`, errors `role="alert"`; fix buttons ≥ 44 px tall where new.
- **Performance**: slipcalc on BigInt is fast for ≤ 1,024 lines; the quote is memoised on its inputs.
  `/api/config` cached 60 s server-side and client-side.
- **Ripple of `Outcome.odds` → string**: realtime identity test and OddsButton memo tests guard re-renders.
- **Dead mock catalogue code** in `mock/repository.ts` may still type-check against `Outcome`; converted or
  removed only as far as typecheck requires (noted in verification).

## Out of scope

Bookings and `/b/[code]` (F3b); `POST /v1/slips/quote` (no screen needs a server quote); real placement,
`Idempotency-Key` and the 409 flow (F5); wallet amounts and transaction history as strings (F6);
multi-size system bets (Trixie, Yankee…) in the picker; per-line stake entry.

## Sub-tasks

- [F3a — slip calculator](../F3a-slip-calculator.md): this plan.
- [F3b — booking codes and `/b/[code]`](../F3b-bookings.md): AC-6, AC-8 (route); depends on F3a.

## Changes during implementation

- **Decision 10 revised**: the stake field accepts up to two decimals (`sanitiseStake`), because the fix
  buttons can set amounts like `9.24` (a santim per line). Quick stakes still show as whole numbers.
- **Files added beyond the list**: `src/features/bet-slip/lib/tax-lines.ts` (which taxes to show, shared
  by the slip and the ticket), `tests/golden.ts` (reads `contracts/golden/`), `tests/unit/bets-figures.test.ts`,
  `src/features/bets/components/TransactionRow.tsx` (transaction amounts became strings so the row needs
  no `Math.abs` — decision 15 reversed: cheaper than leaving a float in `features/bets`).
- **Mock fixture fix**: the void leg in `mock/bets.ts` was encoded as odds `1.00`, which slipcalc rejects
  (odds ≥ 1.01). A void leg keeps its price; the `void` result counts it as 1 (D1.5).
- **Mock wallet winnings** are a literal (`589.05`) pinned by a test that recomputes it with slipcalc,
  instead of being computed in the mock (the mock has no rule set).
- **Phone `home-slip` screen** has two picks: the contract's Real Madrid market is suspended and the
  phone board shows only 1X2.
- **Default stake kept**: a fresh slip starts at `"100"` (`BETTING.defaultStake`), as the built slip did.
  It is a UI convenience, not a commercial rule, and any amount is still checked against the tenant's
  limits. Listed for product to confirm (spec S4).
- **Cap row added** to the working when `quote.capped` (spec S5); tax note shown only when the tenant
  has a tax (S2); tax labels are whole templates (`betSlip.taxRate`, `betSlip.taxRateOver`) whose wording
  says the tax is on the whole win once over the threshold (S1, D1.8).
