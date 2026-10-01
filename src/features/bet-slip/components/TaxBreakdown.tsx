"use client";

import { useState } from "react";
import type { RuleSetJson } from "@golden/slipcalc";
import { useTranslation } from "@/lib/i18n/use-translation";
import { compareMoney } from "@/lib/money";
import type { BetSlipTotals } from "../lib/calculate";
import { taxLabel, taxLines } from "../lib/tax-lines";
import { CalculationSteps } from "./CalculationSteps";

function Line({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

/**
 * What is withheld before the payout, with the full working one tap away.
 *
 * Which taxes appear, and at what rate, is the tenant's rule set; every amount
 * is slipcalc's. "—" until there is a quote to show.
 */
export function TaxBreakdown({
  totals,
  rules,
}: {
  totals: BetSlipTotals;
  rules: RuleSetJson;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const { quote } = totals;
  const amount = (value: string | null | undefined) =>
    value ? t.money(value) : "—";

  return (
    <div className="bg-surface border-border numeric mx-4 mt-3 flex flex-col gap-[7px] rounded-lg border p-3">
      {totals.mode === "multiple" && (
        <Line
          label={<span className="text-muted">{t.t("betSlip.totalOdds")}</span>}
          value={quote?.totalOdds ? t.odds(quote.totalOdds) : "—"}
        />
      )}

      {totals.mode === "system" && (
        <Line
          label={
            <span className="text-muted">{t.t("betSlip.combinations")}</span>
          }
          value={
            quote
              ? t.t("betSlip.linesTimesStake", {
                  lines: quote.lines,
                  amount: t.money(quote.stakePerLine),
                })
              : String(totals.lineCount)
          }
        />
      )}

      {taxLines(rules, quote).map((tax) => (
        <Line
          key={tax.code}
          label={
            <>
              {t.t(taxLabel(tax.code))}{" "}
              <span className="text-muted">
                · {t.percent(tax.rate)}
                {tax.threshold &&
                  ` ${t.t("betSlip.taxAbove", { amount: t.money(tax.threshold) })}`}
              </span>
            </>
          }
          value={`− ${amount(tax.amount)}`}
        />
      ))}

      {quote && compareMoney(quote.accaBonus, "0.00") > 0 && (
        <Line
          label={t.t("betSlip.accaBonus")}
          value={`+ ${t.money(quote.accaBonus)}`}
        />
      )}

      <button
        type="button"
        aria-expanded={open}
        disabled={!quote}
        onClick={() => setOpen(!open)}
        className="text-text font-body h-7 cursor-pointer self-start bg-transparent text-xs font-semibold underline underline-offset-[3px] disabled:cursor-default disabled:opacity-45"
      >
        {open ? t.t("betSlip.hideCalculation") : t.t("betSlip.howCalculated")}
      </button>

      {open && quote && (
        <CalculationSteps quote={quote} rules={rules} mode={totals.mode} />
      )}
    </div>
  );
}
