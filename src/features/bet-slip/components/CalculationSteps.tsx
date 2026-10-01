"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { BETTING } from "@/config/constants";
import { cn } from "@/lib/utils/cn";
import type { BetSlipTotals } from "../lib/calculate";

/**
 * The payout, worked out line by line.
 *
 * Two taxes and a per-ticket cap stand between a stake and a payout; a user who
 * cannot see where the money went has to take the final figure on trust. Each
 * line carries its operator so the arithmetic can be followed by eye.
 */
export function CalculationSteps({ totals }: { totals: BetSlipTotals }) {
  const t = useTranslation();

  const oddsLabel =
    totals.mode === "multiple"
      ? t.t("betSlip.totalOdds")
      : totals.mode === "system"
        ? t.t("betSlip.oddsAcross", { n: totals.combinationCount })
        : t.t("betSlip.oddsEach");

  const returnLabel =
    totals.mode === "system"
      ? t.t("betSlip.maxReturn")
      : t.t("betSlip.totalReturn");

  const rows: Array<[operator: string, label: string, value: string]> = [
    ["", t.t("betSlip.stake"), t.money(totals.totalStake)],
    [
      "−",
      `${t.t("betSlip.stakeTax")} · ${t.percent(BETTING.stakeTaxRate)}`,
      t.money(totals.stakeTax),
    ],
    ["=", t.t("betSlip.netStake"), t.money(totals.netStake)],
    [
      "×",
      oddsLabel,
      totals.mode === "multiple" ? t.odds(totals.totalOdds) : "",
    ],
    ["=", t.t("betSlip.grossReturn"), t.money(totals.grossReturn)],
    [
      "",
      t.t("betSlip.winnings"),
      t.money(Math.max(0, totals.grossReturn - totals.totalStake)),
    ],
    [
      "−",
      `${t.t("betSlip.winTax")} · ${t.percent(BETTING.winTaxRate)}`,
      t.money(totals.winTax),
    ],
    ["=", returnLabel, t.money(totals.payout)],
  ];

  return (
    <div className="bg-ground flex flex-col gap-1.5 rounded-md px-3 py-2.5 text-xs">
      {rows.map(([operator, label, value], index) => {
        const last = index === rows.length - 1;
        // Rules under the two subtotals and the final figure.
        const subtotal = index === 2 || index === 4;

        return (
          <div
            key={label}
            className={cn(
              "flex justify-between gap-3",
              (last || subtotal) && "border-divider border-t pt-1.5",
              last && "font-bold",
            )}
          >
            <span className="flex min-w-0 gap-2">
              <span className="text-muted w-2.5 shrink-0 font-bold">
                {operator}
              </span>
              <span>{label}</span>
            </span>
            <span
              className={cn(
                "whitespace-nowrap",
                last || subtotal ? "font-bold" : "font-medium",
              )}
            >
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
