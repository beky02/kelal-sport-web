"use client";

import type { RuleSetJson } from "@golden/slipcalc";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { BetSlipTotals } from "../lib/calculate";
import { taxLines } from "../lib/tax-lines";

/**
 * What the slip could pay: one plain row, the largest figure on the slip
 * because it is the answer to the question people came with (the user's
 * review, 2026-10-08: no card, no "you stake" — the stake is in its field).
 * When the tenant's payout cap bites, that is said beside it rather than left
 * as a number that quietly stops growing. slipcalc's figure; "—" until there
 * is a quote. Under it, the cap per ticket and, where the tenant taxes
 * anything, that taxes are withheld.
 */
export function PayoutSummary({
  totals,
  rules,
}: {
  totals: BetSlipTotals;
  rules: RuleSetJson;
}) {
  const t = useTranslation();
  const { quote } = totals;

  return (
    <div className="mx-4 mt-2 flex flex-col gap-1.5">
      <div className="numeric flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
          {t.t("betSlip.potentialWin")}
          {quote?.capped && (
            <span className="bg-raised text-text rounded-full px-[7px] py-px text-[10px] font-bold">
              {t.t("betSlip.cappedAtMax")}
            </span>
          )}
        </span>
        <span
          data-testid="net-payout"
          className="font-display shrink-0 text-xl leading-none whitespace-nowrap"
        >
          {quote ? t.money(quote.netPayout) : "—"}
        </span>
      </div>
      <p className="text-muted text-[11px] leading-[1.45] text-pretty">
        {t.t("betSlip.maxWin", { amount: t.money(rules.max_payout) })}
        {/* Only where the tenant actually taxes something. */}
        {taxLines(rules, null).length > 0 && ` ${t.t("betSlip.taxNote")}`}
      </p>
    </div>
  );
}
