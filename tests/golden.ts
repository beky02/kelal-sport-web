/**
 * `contracts/golden/` — the slip spec (D1): named rule sets and 366 rows of
 * inputs → expected figures. Read as-is; never edited to make a test pass.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuleSetJson } from "@golden/slipcalc";

const dir = resolve(process.cwd(), "contracts/golden");

export const GOLDEN_RULES = JSON.parse(
  readFileSync(resolve(dir, "rules.json"), "utf8"),
) as Record<string, RuleSetJson & { rules_version: number }>;

export type GoldenRow = Record<string, string>;

const [header, ...lines] = readFileSync(resolve(dir, "slips.csv"), "utf8")
  .trim()
  .split("\n");
const columns = header.split(",");

/** Every row of `slips.csv`, keyed by column name. No field contains a comma. */
export const GOLDEN_ROWS: GoldenRow[] = lines.map((line) =>
  Object.fromEntries(line.split(",").map((v, i) => [columns[i], v])),
);

/** `a;b;c` → `["a", "b", "c"]`; empty → `[]`. */
export const list = (value: string): string[] =>
  value ? value.split(";") : [];

/** Columns holding a decimal-string amount of money. */
export const MONEY_COLUMNS = [
  "stake",
  "stake_per_line",
  "total_stake",
  "stake_tax",
  "net_stake",
  "gross_payout",
  "acca_bonus",
  "win_tax",
  "stake_tax_refund",
  "net_payout",
] as const;
