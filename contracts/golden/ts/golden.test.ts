/** Runs every row of ../slips.csv through slipcalc.ts. Run: npx tsx golden.test.ts (or adapt to Vitest). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { quote, SlipError, type RuleSetJson, type LegResult, type BetType } from "./slipcalc";

const dir = join(__dirname, "..");
const rules: Record<string, RuleSetJson> = JSON.parse(readFileSync(join(dir, "rules.json"), "utf8"));
const [header, ...lines] = readFileSync(join(dir, "slips.csv"), "utf8").trim().split("\n");
const cols = header.split(",");
let failures = 0;

for (const line of lines) {
  const r = Object.fromEntries(line.split(",").map((v, i) => [cols[i], v]));
  const list = (s: string) => (s ? s.split(";") : []);
  const slip = {
    betType: r.bet_type as BetType,
    legs: list(r.leg_odds).map((odds, i) => ({ odds, result: list(r.leg_results)[i] as LegResult })),
    stake: r.stake, systemSizes: list(r.system_sizes).map(Number), stakeIsPerLine: r.stake_is_per_line === "true",
  };
  let got: Record<string, string>;
  try {
    const qt = quote(slip, rules[r.rules], r.settled === "true");
    got = {
      expected_error: "", lines: String(qt.lines), stake_per_line: qt.stakePerLine, total_stake: qt.totalStake, stake_tax: qt.stakeTax,
      net_stake: qt.netStake, total_odds: qt.totalOdds ?? "", gross_payout: qt.grossPayout, acca_bonus: qt.accaBonus, win_tax: qt.winTax,
      stake_tax_refund: qt.stakeTaxRefund, net_payout: qt.netPayout, capped: String(qt.capped), warnings: qt.warnings.join(";"),
    };
  } catch (e) {
    if (!(e instanceof SlipError)) throw e;
    got = { expected_error: e.code };
  }
  for (const [k, v] of Object.entries(got)) {
    if (r[k] !== v) { failures++; console.error(`${r.case_id}: ${k} expected ${r[k]} got ${v}`); }
  }
}
console.log(`${lines.length} rows, ${failures} mismatches`);
process.exit(failures ? 1 : 0);
