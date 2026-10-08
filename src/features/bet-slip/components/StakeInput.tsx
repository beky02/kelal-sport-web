"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { useBetSlipStore } from "../stores/bet-slip.store";
import type { BetSlipTotals } from "../lib/calculate";

/** `"100.00"` → `"100"`: a round quick stake reads, and types, as a whole number. */
const plain = (amount: string) => amount.replace(/\.00$/, "");

/**
 * The total stake, and the quick ways to set it.
 *
 * Always the whole ticket (D1.3, D7): slipcalc splits it across the bets a
 * single or system places, and the line under the field says how — so nobody
 * stakes 6× what they meant to. Quick stakes are the tenant's and set the total
 * rather than adding to it.
 */
export function StakeInput({
  totals,
  quickStakes,
  balance,
}: {
  totals: BetSlipTotals;
  quickStakes: readonly string[];
  balance: string | null;
}) {
  const t = useTranslation();
  const stake = useBetSlipStore((s) => s.stake);
  const setStake = useBetSlipStore((s) => s.setStake);

  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      <div className="text-muted flex justify-between gap-2 text-[11px]">
        <span>{t.t("betSlip.totalStake")}</span>
        {balance !== null && (
          <span className="numeric">
            {t.t("betSlip.balance")} {t.money(balance)}
          </span>
        )}
      </div>

      <div className="bg-raised flex h-[46px] items-stretch overflow-hidden rounded-md">
        <span className="text-muted flex items-center px-3 font-bold">
          {t.t("header.currency")}
        </span>
        <input
          inputMode="decimal"
          aria-label={t.t("betSlip.totalStake")}
          value={stake}
          onChange={(event) => setStake(event.target.value)}
          className="font-body numeric text-text min-w-0 flex-1 border-0 bg-transparent px-1 text-[17px] font-bold outline-none"
        />
        <button
          type="button"
          aria-label={t.t("betSlip.clearStake")}
          onClick={() => setStake("")}
          className="text-muted hover:text-text font-body w-11 cursor-pointer bg-transparent font-bold"
        >
          C
        </button>
      </div>

      <StakeLines totals={totals} />
      <QuickStakes amounts={quickStakes} />
    </div>
  );
}

/**
 * How a total stake splits across the bets a single or system places
 * ("6 bets × ETB 16.66"), so nobody stakes 6× what they meant to. Shared with
 * the kiosk's keypad (F8cb).
 */
export function StakeLines({ totals }: { totals: BetSlipTotals }) {
  const t = useTranslation();
  const { quote } = totals;
  if (!quote || quote.lines <= 1) return null;
  return (
    <div className="text-muted numeric text-[11px]">
      {t.t("betSlip.linesTimesStake", {
        lines: quote.lines,
        amount: t.money(quote.stakePerLine),
      })}
    </div>
  );
}

/**
 * The rule set's quick stakes: each sets the total (D7) rather than adding
 * to it. Nothing when the rule set has none. Shared with the kiosk (F8cb).
 */
export function QuickStakes({ amounts }: { amounts: readonly string[] }) {
  const stake = useBetSlipStore((s) => s.stake);
  const setStake = useBetSlipStore((s) => s.setStake);
  if (amounts.length === 0) return null;
  return (
    <div
      className="grid gap-1.5"
      style={{
        gridTemplateColumns: `repeat(${Math.min(amounts.length, 4)}, minmax(0, 1fr))`,
      }}
    >
      {amounts.map((amount) => (
        <button
          key={amount}
          type="button"
          aria-pressed={plain(stake) === plain(amount)}
          onClick={() => setStake(plain(amount))}
          className="border-divider text-text font-body aria-pressed:border-accent h-11 cursor-pointer rounded-md border bg-transparent text-[13px] font-bold"
        >
          {plain(amount)}
        </button>
      ))}
    </div>
  );
}
