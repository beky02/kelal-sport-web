"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { BETTING } from "@/config/constants";
import type { BetSlipTotals } from "../lib/calculate";
import { CalculationSteps } from "./CalculationSteps";

function Line({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

/** What is withheld before the payout, with the full working one tap away. */
export function TaxBreakdown({ totals }: { totals: BetSlipTotals }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-surface border-border numeric mx-4 mt-3 flex flex-col gap-[7px] rounded-lg border p-3">
      {totals.mode === "multiple" && (
        <Line
          label={<span className="text-muted">{t.t("betSlip.totalOdds")}</span>}
          value={t.odds(totals.totalOdds)}
        />
      )}

      {totals.mode === "system" && (
        <Line
          label={
            <span className="text-muted">{t.t("betSlip.combinations")}</span>
          }
          value={`${totals.combinationCount} × ${t.money(totals.stakePerBet)}`}
        />
      )}

      <Line
        label={
          <>
            {t.t("betSlip.stakeTax")}{" "}
            <span className="text-muted">
              · {t.percent(BETTING.stakeTaxRate)}
            </span>
          </>
        }
        value={`− ${t.money(totals.stakeTax)}`}
      />
      <Line
        label={
          <>
            {t.t("betSlip.winTax")}{" "}
            <span className="text-muted">
              · {t.percent(BETTING.winTaxRate)}
            </span>
          </>
        }
        value={`− ${t.money(totals.winTax)}`}
      />

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="text-text font-body h-7 cursor-pointer self-start bg-transparent text-xs font-semibold underline underline-offset-[3px]"
      >
        {open ? t.t("betSlip.hideCalculation") : t.t("betSlip.howCalculated")}
      </button>

      {open && <CalculationSteps totals={totals} />}
    </div>
  );
}
