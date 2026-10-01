# F3a — verification

Branch `task/F3-slip-calculator`. F3 was split; this covers **F3a** (slip calculator). F3b (bookings,
AC-6 and the route half of AC-8) is not started.

## Automated gate

| Check                                                                    | Result                     | Command                                  |
| ------------------------------------------------------------------------ | -------------------------- | ---------------------------------------- |
| Typecheck, lint (incl. FD4 money rule), Prettier, unit + component tests | PASS — 14 files, 524 tests | `pnpm check`                             |
| Generated types match the contract                                       | PASS                       | `pnpm api:check`                         |
| Contract copy matches the backend                                        | PASS                       | `node scripts/contract-sync.mjs --check` |
| Production build                                                         | PASS                       | `pnpm build`                             |
| UI screens (375 / 1440 px, en / am), incl. new `home-slip`               | PASS — 48                  | `pnpm ui`                                |

Final `pnpm verify` (after review fixes, commit `7571f67`):

```
 Test Files  14 passed (14)
      Tests  524 passed (524)
contracts/ matches the backend.
✓ Compiled successfully
  48 passed (32.5s)
exit 0
```

## Acceptance criteria

| AC      | Status | Evidence                                                                                                                                                                                                                                |
| ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1    | PASS   | `tests/unit/golden.test.ts`: "covers all 366 rows" + one `matches slips.csv row <case_id>` per row — 367 passed, 0 skipped, through `priceSlip` (the slip's own call)                                                                   |
| AC-2    | PASS   | `BetSlip.test.tsx` › "shows the C07 worked example's net payout of 690.29" (+ bonus 44.83)                                                                                                                                              |
| AC-3    | PASS   | `grep -rnE "parseFloat\|Number\(\|toFixed\|Math\." src/features/{bet-slip,bets}` → only counts (system size, grid columns, mock ticket serial); FD4 lint rule active; money-reviewer confirmed                                          |
| AC-4    | PASS   | `BetSlip.test.tsx` › "quick stake 100 on a 2/3 system charges 99.99 and warns about the remainder"; "sets the total rather than adding to it"; `calculate.test.ts` › "sets the total stake, not the per-line stake, from a quick stake" |
| AC-5    | PASS   | `BetSlip.test.tsx` › "follows the tenant's rule set: no_tax shows no tax lines and pays 681.85"                                                                                                                                         |
| AC-7    | PASS   | `calculate.test.ts` › "prices the design's reference slip at D1's 594.40" (arithmetic in the comment; was 507.64)                                                                                                                       |
| AC-8m   | PASS   | `money.test.ts` › "round-trips every money value in slips.csv through slipcalc's money()" (> 3,000 values); `money-lint.test.ts` › rule fires on 8 spellings incl. `parseFloat(stake)`                                                  |
| Screens | PASS   | `test-results/ui/home-slip-{en,am}-{phone,desktop}.png`, `my-bets-*.png` reviewed (figures 4.09 / 85.00 / 348.07 agree with slipcalc)                                                                                                   |

## Review findings

Reviewers: spec-verifier (PASS), security-reviewer (PASS), quality-reviewer (FAIL → round 2),
money-reviewer (FAIL → round 2), ui-checker (PASS).

| Id           | Reviewer               | Severity              | Summary                                                                                        | Decision                                                                                                                                    |
| ------------ | ---------------------- | --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 / Q1      | money / quality        | BLOCKER / MAJOR       | "Set 5.00" fix on multi-line slips charges 4.98 and is refused again                           | Fixed in `da89489` — offer `roundUpToMultiple(max(min, lines×0.01), lines)`; tests for 3 singles and 2/3 system                             |
| M2 / Q2 / S6 | money / quality / spec | MAJOR / MAJOR / MINOR | Tickets recomputed with today's rules and an inferred bet type instead of the server's figures | Follow-up (F5): out of scope — bets are mocks, and the task requires `settleBet` through the adapter. Recorded in `F5-place-bet-my-bets.md` |
| Q3           | quality                | MAJOR                 | My bets shows "—" with no explanation when the rules fail                                      | Fixed in `7571f67` — `RulesUnavailable` notice + Retry on My bets and the ticket; test                                                      |
| M3 / Q5 / S3 | money / quality / spec | MAJOR / MINOR / MINOR | `formatOdds` rounds 3-decimal odds through a float                                             | Fixed in `7571f67` — floored from the string; `format.test.ts`                                                                              |
| M4           | money                  | MAJOR                 | Cash-out remainder is a linear share of the payout (wrong around the win-tax threshold)        | Fixed in `7571f67` — remaining stake priced by slipcalc; server quote is an F5/Release 2 follow-up                                          |
| S1           | spec                   | MINOR                 | "15% above ETB 1,000.00" suggests only the excess is taxed (D1.8 taxes the whole win)          | Fixed — "of the whole win once it’s over {amount}"; Amharic flagged in TRANSLATION-NOTES                                                    |
| Q4           | quality                | MINOR                 | Tax labels concatenated from fragments; ticket lacked the threshold                            | Fixed — `betSlip.taxRate` / `taxRateOver` via shared `taxLineLabel`                                                                         |
| Q6           | quality                | MINOR                 | Bonus assertion not exact                                                                      | Fixed — scoped to the calculation block                                                                                                     |
| Q7           | quality                | MINOR                 | Touch targets < 44 px                                                                          | Quick-stake chips fixed (`h-11`); row Accept and "How is this calculated?" → follow-up (layout change)                                      |
| Q8 / Q9      | quality                | MINOR                 | Missing-rules error looks like a network error; refusals show the English title                | Fixed — `RULES_UNAVAILABLE` code; refusals translated by `code`                                                                             |
| Q10          | quality                | MINOR                 | `lib/api/mock` imports from a feature                                                          | Fixed — `CASH_OUT_SHARES` in `config/constants.ts`                                                                                          |
| M5           | money                  | MINOR                 | Lint rule bypassable (`?.`, `as`, `!`, computed, template, `parseInt`)                         | Fixed — fixture covers 8 spellings                                                                                                          |
| M6           | money                  | MINOR                 | `fromLegacyAmount` rounds the float balance                                                    | Follow-up (F6), documented bridge                                                                                                           |
| M7           | money                  | MINOR                 | Unknown tax codes labelled "Winnings tax"                                                      | Fixed — labelled "Tax"                                                                                                                      |
| M8           | money                  | MINOR                 | No stake-tax refund row; ticket tax rows lacked the threshold                                  | Fixed                                                                                                                                       |
| M9 / SEC2    | money / security       | MINOR                 | Real placement has no `Idempotency-Key`, non-contract shapes                                   | Follow-up (F5)                                                                                                                              |
| M10          | money                  | MINOR                 | Prettier failing on two test files                                                             | Not reproducible at HEAD — `pnpm check` passes                                                                                              |
| S2           | spec                   | MINOR                 | Tax note shown under a no-tax rule set                                                         | Fixed                                                                                                                                       |
| S4           | spec                   | MINOR                 | `defaultStake` kept though the plan said delete                                                | Recorded in plan (UI convenience, for product to confirm)                                                                                   |
| S5           | spec                   | MINOR                 | No cap row in the working                                                                      | Fixed                                                                                                                                       |
| S7           | spec                   | MINOR                 | F5 depends on the split F3                                                                     | Fixed — F5 depends on F3a, F3b, F4                                                                                                          |
| SEC1         | security               | MINOR                 | `X-Forwarded-Host` trusted without a trusted-proxy setting (pre-existing `respond()`)          | Follow-up before F4 (authenticated handlers)                                                                                                |
| U1           | ui                     | MINOR                 | "ETB / 1,000.00" split across lines                                                            | Fixed — non-breaking space in `formatMoney`                                                                                                 |
| U2           | ui                     | MINOR                 | Phone screenshot doesn't reach the payout/CTA (sheet scrolls)                                  | Follow-up — add a scrolled `home-slip-cta` state                                                                                            |
| U3           | ui                     | MINOR                 | Next dev indicator captured over content                                                       | Follow-up — disable `devIndicators` for the UI run                                                                                          |
| U4           | ui                     | MINOR                 | Ticket card stake without currency (pre-existing)                                              | Fixed — `t.money`                                                                                                                           |
| U5 / U6      | ui                     | MINOR                 | Header balance format; "Transactions" pill padding (pre-existing)                              | Follow-up (F6 / design)                                                                                                                     |

## Gaps

- **Real config backend not exercised**: `/api/config` is verified against Prism's contract example only
  (`Config` is not in `API_REAL_TAGS`). Risk: a real tenant's rule set with a tax code or field the UI
  hasn't seen; mitigated by the Zod schema on `/api/config` and the neutral "Tax" label.
- **Real placement not exercised**: still the in-browser mock until F5; its refusals now use slipcalc's
  codes.
- **Amharic copy** for the new money messages is composed, not authored — listed in
  `TRANSLATION-NOTES.md` for native and money review before launch.
- **Diff size**: about 3,700 changed lines (≈1,100 tests) even after the split. The odds-as-strings change
  had to land with the calculator.

### Round 2 (quality and money re-review of `da89489`, `7571f67`)

Both confirmed every fix and found no new BLOCKER or MAJOR. Money: "fit to merge".

| Id        | Reviewer        | Severity | Summary                                                            | Decision                                                                               |
| --------- | --------------- | -------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Q7        | quality         | MINOR    | Accept / "How is this calculated?" follow-up not recorded anywhere | Recorded in `F3a-slip-calculator.md` Notes                                             |
| Q9b       | quality         | MINOR    | Too-many-legs/lines refusals mapped to "price isn't valid"         | Fixed — generic translated body                                                        |
| N1q / N2m | quality / money | MINOR    | Threshold wording says "win" for a stake-based tax                 | Fixed — `betSlip.taxRateStakeOver`, chosen by stage                                    |
| N2q       | quality         | MINOR    | `taxRateOver` Amharic not listed for review                        | Fixed — TRANSLATION-NOTES                                                              |
| N1m       | money           | MINOR    | Cash-out remainder priced void legs at their odds                  | Fixed — uses `LEG_RESULT` like `betFigures`; sub-minimum remainder → F5 (server quote) |
| M1b       | money           | MINOR    | "Minimum total stake is 5.01" while the tenant minimum is 5.00     | Fixed — "The smallest stake this slip accepts is {amount}."                            |
| M5b       | money           | MINOR    | Lint misses `Number(bet?.stake ?? "0")` and a template around `?.` | Follow-up — no code uses them; extend with the next lint change                        |
