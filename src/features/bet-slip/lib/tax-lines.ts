import type { RuleSetJson } from "@golden/slipcalc";
import type { Translator } from "@/lib/i18n/use-translation";
import { compareMoney } from "@/lib/money";
import type { SlipQuote } from "./calculate";

/** One tax the player pays, as the rule set names it and slipcalc charged it. */
export interface TaxLine {
  code: string;
  /** `"0.15"` */
  rate: string;
  /** Applies only above this amount; null when it applies from the first santim. */
  threshold: string | null;
  /** slipcalc's figure; `"0.00"` when the tax did not apply (under its threshold). */
  amount: string | null;
  /** Taken from the stake before the odds, or from the payout after them. */
  stage: "stake" | "payout";
}

/**
 * The taxes to show, in the rule set's order. Operator-borne levies are not the
 * player's money and are left out (D1.8). Amounts are slipcalc's, never
 * recomputed; null when there is no quote yet.
 */
export function taxLines(
  rules: RuleSetJson,
  quote: SlipQuote | null,
): TaxLine[] {
  return rules.taxes
    .filter((t) => t.deduct_from !== "operator")
    .map((t) => ({
      code: t.code,
      rate: t.rate,
      threshold:
        t.threshold && compareMoney(t.threshold, "0.00") > 0
          ? t.threshold
          : null,
      amount: quote ? (quote.taxes[t.code] ?? "0.00") : null,
      stage: t.deduct_from === "stake" ? "stake" : "payout",
    }));
}

/** The message key naming a tax, by the contract's `TaxRule.code`. */
export const TAX_LABEL = {
  STAKE_TAX: "betSlip.stakeTax",
  WIN_TAX: "betSlip.winTax",
  WITHHOLDING: "betSlip.withholdingTax",
  LEVY: "betSlip.levy",
} as const;

export const taxLabel = (code: string) =>
  // A code the app has no name for is called just "Tax", never mislabelled.
  TAX_LABEL[code as keyof typeof TAX_LABEL] ?? "betSlip.tax";

/**
 * "Winnings tax · 15% of the whole win once it’s over ETB 1,000.00": one
 * message per shape, so each language orders its own words. The threshold
 * wording matters — D1.8 taxes the whole base, not the part above it.
 */
export function taxLineLabel(t: Translator, tax: TaxLine): string {
  const values = { tax: t.t(taxLabel(tax.code)), rate: t.percent(tax.rate) };
  if (!tax.threshold) return t.t("betSlip.taxRate", values);
  const amount = t.money(tax.threshold);
  return tax.stage === "stake"
    ? t.t("betSlip.taxRateStakeOver", { ...values, amount })
    : t.t("betSlip.taxRateOver", { ...values, amount });
}
