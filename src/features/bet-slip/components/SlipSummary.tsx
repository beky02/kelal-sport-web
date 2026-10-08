"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { compareMoney } from "@/lib/money";
import type { BetSlipTotals } from "../lib/calculate";

function Line({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="min-w-0">{label}</span>
      {/* Never squeezed: `* { min-width: 0 }` would let a long label push the
          amount out of the card. The label wraps instead. */}
      <span className="shrink-0 font-bold whitespace-nowrap">{value}</span>
    </div>
  );
}

/**
 * The slip's odds before the payout: total odds for a multiple, the lines for
 * a system, and an accumulator bonus when there is one. No stake-tax or
 * winnings-tax line and no working (the user's decision, 2026-10-07): the
 * slip shows what the player gets (`PayoutSummary`), and the placed ticket
 * itemises the taxes (SRS HIS-02).
 */
export function SlipSummary({ totals }: { totals: BetSlipTotals }) {
  const t = useTranslation();
  const { quote } = totals;
  const bonus = quote && compareMoney(quote.accaBonus, "0.00") > 0;
  if (totals.mode === "single" && !bonus) return null;

  return (
    // Plain rows, no card (the user's review, 2026-10-08).
    <div className="numeric mx-4 mt-3 flex flex-col gap-1.5 text-sm">
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

      {bonus && (
        <Line
          label={t.t("betSlip.accaBonus")}
          value={`+ ${t.money(quote.accaBonus)}`}
        />
      )}
    </div>
  );
}
