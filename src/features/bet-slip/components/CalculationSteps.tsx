"use client";

import type { RuleSetJson } from "@golden/slipcalc";
import { useTranslation } from "@/lib/i18n/use-translation";
import { compareMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import type { SlipQuote } from "../lib/calculate";
import { taxLineLabel, taxLines } from "../lib/tax-lines";
import type { BetSlipMode } from "../types";

interface Row {
  operator: string;
  label: string;
  value: string;
  /** A subtotal or the final figure: ruled off and bold. */
  total?: boolean;
}

/**
 * The payout, worked out line by line, in D1's order: stake tax per line, net
 * stake, odds, gross, accumulator bonus, the cap, payout taxes.
 *
 * A user who cannot see where the money went has to take the final figure on
 * trust. Each row carries its operator so the arithmetic can be followed by
 * eye — but every figure is slipcalc's, never recomputed here.
 */
export function CalculationSteps({
  quote,
  rules,
  mode,
}: {
  quote: SlipQuote;
  rules: RuleSetJson;
  mode: BetSlipMode;
}) {
  const t = useTranslation();
  const taxes = taxLines(rules, quote);

  const oddsLabel =
    mode === "multiple"
      ? t.t("betSlip.totalOdds")
      : mode === "system"
        ? t.t("betSlip.oddsAcross", { n: quote.lines })
        : t.t("betSlip.oddsEach");

  const rows: Row[] = [
    {
      operator: "",
      label: t.t("betSlip.stake"),
      value: t.money(quote.totalStake),
    },
    ...taxes
      .filter((tax) => tax.stage === "stake")
      .map((tax) => ({
        operator: "−",
        label: taxLineLabel(t, tax),
        value: t.money(tax.amount ?? "0.00"),
      })),
    {
      operator: "=",
      label: t.t("betSlip.netStake"),
      value: t.money(quote.netStake),
      total: true,
    },
    {
      operator: "×",
      label: oddsLabel,
      value: quote.totalOdds ? t.odds(quote.totalOdds) : "",
    },
    {
      operator: "=",
      label: t.t("betSlip.grossReturn"),
      value: t.money(quote.grossPayout),
      total: true,
    },
    ...(compareMoney(quote.accaBonus, "0.00") > 0
      ? [
          {
            operator: "+",
            label: t.t("betSlip.accaBonus"),
            value: t.money(quote.accaBonus),
          },
        ]
      : []),
    // The cap cuts the bonus, then gross, before any payout tax (D1.7).
    ...(quote.capped
      ? [
          {
            operator: "≤",
            label: t.t("betSlip.cappedAtMax"),
            value: t.money(rules.max_payout),
          },
        ]
      : []),
    ...taxes
      .filter((tax) => tax.stage === "payout")
      .map((tax) => ({
        operator: "−",
        label: taxLineLabel(t, tax),
        value: t.money(tax.amount ?? "0.00"),
      })),
    {
      operator: "=",
      label:
        mode === "system"
          ? t.t("betSlip.maxReturn")
          : t.t("betSlip.totalReturn"),
      value: t.money(quote.netPayout),
      total: true,
    },
  ];

  return (
    <div
      data-testid="calculation-steps"
      className="bg-ground flex flex-col gap-1.5 rounded-md px-3 py-2.5 text-xs"
    >
      {rows.map((row, index) => {
        const last = index === rows.length - 1;
        return (
          <div
            key={row.label}
            className={cn(
              "flex justify-between gap-3",
              row.total && "border-divider border-t pt-1.5",
              last && "font-bold",
            )}
          >
            <span className="flex min-w-0 gap-2">
              <span className="text-muted w-2.5 shrink-0 font-bold">
                {row.operator}
              </span>
              <span>{row.label}</span>
            </span>
            <span
              className={cn(
                // The label wraps; the amount never shrinks out of the row.
                "shrink-0 whitespace-nowrap",
                row.total ? "font-bold" : "font-medium",
              )}
            >
              {row.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
