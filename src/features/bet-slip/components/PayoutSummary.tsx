"use client";

import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { BETTING } from "@/config/constants";
import type { BetSlipTotals } from "../lib/calculate";

/**
 * Stake in, return out — the two numbers people actually read.
 *
 * The return is the largest type in the slip because it is the answer to the
 * question they came with. When the per-ticket ceiling bites, that is said
 * plainly rather than left as a number that quietly stops growing.
 */
export function PayoutSummary({ totals }: { totals: BetSlipTotals }) {
  const t = useTranslation();

  const returnLabel =
    totals.mode === "system"
      ? t.t("betSlip.maxReturn")
      : t.t("betSlip.totalReturn");

  return (
    <>
      <p className="text-muted mx-4 mt-2 text-[11px] leading-[1.45] text-pretty">
        {t.t("betSlip.maxWin", { amount: t.money(BETTING.maxWinPerTicket) })}{" "}
        {t.t("betSlip.taxNote")}
      </p>

      <div className="bg-surface border-border numeric mx-4 mt-3 grid grid-cols-[auto_auto_minmax(0,1fr)] items-end gap-3 rounded-lg border p-3.5">
        <div className="flex flex-col gap-1">
          <span className="text-muted text-[11px]">
            {t.t("betSlip.youStake")}
          </span>
          <span className="text-base font-bold whitespace-nowrap">
            {t.money(totals.totalStake)}
          </span>
        </div>

        <ArrowRight
          size={18}
          strokeWidth={1.5}
          aria-hidden
          className="text-muted mb-0.5"
        />

        <div className="flex min-w-0 flex-col items-end gap-1">
          <span className="text-muted flex items-center gap-1.5 text-[11px]">
            {totals.capped && (
              <span className="bg-raised text-text rounded-full px-[7px] py-px text-[10px] font-bold">
                {t.t("betSlip.cappedAtMax")}
              </span>
            )}
            {returnLabel}
          </span>
          <span className="font-display text-[28px] leading-none whitespace-nowrap">
            {t.money(totals.payout)}
          </span>
        </div>
      </div>
    </>
  );
}
