# contracts/golden/ — slip calculator test file

`slips.csv` is the shared definition of every stake, tax, bonus and payout number. The Python backend (C07), the Dart app and the TypeScript web apps must reproduce **every row exactly**. Any difference fails CI.

| File | What it is |
|---|---|
| `rules.json` | Named rule sets in the contract's `RuleSet` shape (money and rates as decimal strings) |
| `reference_slipcalc.py` | The executable definition of the rules (Engineering Decisions D1). Exact integer/fraction arithmetic |
| `generate.py` | Builds `slips.csv` from hand-picked edge cases + 300 seeded random cases |
| `slips.csv` | 366 rows: inputs → expected outputs, or the expected error code |
| `ts/slipcalc.ts` | TypeScript port (BigInt rationals, no floats). Copy into `client/web/packages/slipcalc/src/` |
| `ts/golden.test.ts` | Runs all rows through the TypeScript port: `npx tsx golden.test.ts` → `366 rows, 0 mismatches` |

## Columns

`case_id, rules, bet_type, system_sizes, stake, stake_is_per_line, leg_odds, leg_results, settled, expected_error, lines, stake_per_line, total_stake, stake_tax, net_stake, total_odds, gross_payout, acca_bonus, win_tax, stake_tax_refund, net_payout, capped, warnings`

- Lists (`system_sizes`, `leg_odds`, `leg_results`, `warnings`) are `;`-separated.
- `leg_results` are `open` for previews; `settled=true` rows use real results and must contain no `open` leg.
- Money is a decimal string with 2 decimals. `total_odds` is display-only (floored to 2 decimals; empty for multi-line bets).
- When `expected_error` is set, all output columns are empty.

## Changing the rules

1. Edit `reference_slipcalc.py` (and the Engineering Decisions tab), or add a rule set to `rules.json`.
2. `python3 generate.py` and review the diff of `slips.csv` line by line: every changed row is a changed payout.
3. Update the Python, Dart and TypeScript calculators until all three pass.
4. CI runs `python3 generate.py --check` so the CSV can never drift from the reference.
