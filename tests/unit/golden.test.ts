import { describe, expect, it } from "vitest";
import type { BetType, LegResult } from "@golden/slipcalc";
import { priceSlip } from "@/features/bet-slip/lib/calculate";
import { GOLDEN_ROWS, GOLDEN_RULES, list, type GoldenRow } from "../golden";

/**
 * D1: every row of `contracts/golden/slips.csv` through the same call the slip
 * makes. One test per row, so a mismatch names its case.
 */
function figures(row: GoldenRow): Record<string, string> {
  const result = priceSlip(
    {
      betType: row.bet_type as BetType,
      legs: list(row.leg_odds).map((odds, i) => ({
        odds,
        result: list(row.leg_results)[i] as LegResult,
      })),
      stake: row.stake,
      systemSizes: list(row.system_sizes).map((size) => parseInt(size, 10)),
      stakeIsPerLine: row.stake_is_per_line === "true",
    },
    GOLDEN_RULES[row.rules],
    row.settled === "true",
  );
  if (!result.ok) return { expected_error: result.code };
  const q = result.quote;
  return {
    expected_error: "",
    lines: String(q.lines),
    stake_per_line: q.stakePerLine,
    total_stake: q.totalStake,
    stake_tax: q.stakeTax,
    net_stake: q.netStake,
    total_odds: q.totalOdds ?? "",
    gross_payout: q.grossPayout,
    acca_bonus: q.accaBonus,
    win_tax: q.winTax,
    stake_tax_refund: q.stakeTaxRefund,
    net_payout: q.netPayout,
    capped: String(q.capped),
    warnings: q.warnings.join(";"),
  };
}

describe("golden slips (D1)", () => {
  it("covers all 366 rows", () => {
    expect(GOLDEN_ROWS).toHaveLength(366);
  });

  it.each(GOLDEN_ROWS.map((row) => [row.case_id, row] as const))(
    "matches slips.csv row %s",
    (_, row) => {
      const got = figures(row);
      const want = Object.fromEntries(
        Object.keys(got).map((column) => [column, row[column]]),
      );
      expect(got).toEqual(want);
    },
  );
});
