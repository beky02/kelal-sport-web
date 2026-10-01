"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { BETTING } from "@/config/constants";
import { useBetSlipStore } from "../stores/bet-slip.store";
import type { BetSlipMode } from "../types";

/**
 * The stake, and the quick ways to change it.
 *
 * The label says what the number means, because it differs by mode: in a
 * multiple it is the whole ticket, in singles it is charged per pick, in a
 * system per combination. Getting that wrong is how someone stakes 6× what they
 * meant to.
 */
export function StakeInput({
  mode,
  balance,
}: {
  mode: BetSlipMode;
  balance: number | null;
}) {
  const t = useTranslation();
  const stake = useBetSlipStore((s) => s.stake);
  const setStake = useBetSlipStore((s) => s.setStake);
  const addToStake = useBetSlipStore((s) => s.addToStake);

  const label =
    mode === "single"
      ? t.t("betSlip.stakePerBet")
      : mode === "system"
        ? t.t("betSlip.stakePerCombination")
        : t.t("betSlip.stake");

  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      <div className="text-muted flex justify-between text-[11px]">
        <span>{label}</span>
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
          inputMode="numeric"
          aria-label={t.t("betSlip.stake")}
          value={stake === 0 ? "" : String(stake)}
          onChange={(event) =>
            setStake(Number(event.target.value.replace(/\D/g, "") || 0))
          }
          className="font-body numeric text-text min-w-0 flex-1 border-0 bg-transparent px-1 text-[17px] font-bold outline-none"
        />
        <button
          type="button"
          aria-label={t.t("betSlip.clearStake")}
          onClick={() => setStake(0)}
          className="text-muted hover:text-text font-body w-11 cursor-pointer bg-transparent font-bold"
        >
          C
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {BETTING.stakeChips.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => addToStake(amount)}
            className="border-divider text-text font-body h-10 cursor-pointer rounded-md border bg-transparent text-[13px] font-bold"
          >
            +{amount}
          </button>
        ))}
      </div>
    </div>
  );
}
