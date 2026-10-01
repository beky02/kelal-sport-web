"use client";

import { useState } from "react";
import { CircleAlert, Loader2, Lock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import { useCashOut } from "../hooks/use-bets";
import { betFigures, CASH_OUT_FRACTIONS } from "../lib/figures";
import type { Bet } from "../types";

/**
 * Buying a bet back.
 *
 * Always asks first, and says the amount and that it cannot be undone — a
 * one-tap cash-out on a bet that was about to come in is the kind of mistake
 * people never forgive. The share buttons let someone take part of it and leave
 * the rest running, and the copy states what the remainder would still pay.
 */
export function CashOutPanel({
  bet,
  size = "card",
}: {
  bet: Bet;
  size?: "card" | "ticket";
}) {
  const t = useTranslation();
  const [asking, setAsking] = useState(false);
  const [fractionIndex, setFractionIndex] = useState(
    CASH_OUT_FRACTIONS.length - 1,
  );
  const cashOut = useCashOut();

  if (bet.status !== "open") return null;

  if (bet.cashOutBlocked || bet.cashOutValue === null) {
    return (
      <div className="bg-raised text-muted flex h-11 items-center gap-2 rounded-md px-3 text-xs font-semibold">
        <Lock size={14} strokeWidth={1.5} aria-hidden />
        {t.t("bets.cashOutUnavailable")}
      </div>
    );
  }

  const fraction = CASH_OUT_FRACTIONS[fractionIndex];
  const amount = bet.cashOutValue * fraction;
  const figures = betFigures(bet);
  const buttonHeight = size === "ticket" ? "h-12" : "h-11";

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={cn(
          "bg-raised text-text font-body flex w-full cursor-pointer items-center justify-between rounded-md px-3 text-sm font-bold",
          buttonHeight,
        )}
      >
        <span>{t.t("bets.cashOut")}</span>
        <span className="numeric">{t.money(bet.cashOutValue)}</span>
      </button>
    );
  }

  return (
    <div className="border-accent flex flex-col gap-2 rounded-md border p-2.5">
      <span className="text-[13px] font-semibold">
        {t.t("bets.cashOutConfirm", { amount: t.money(amount) })}
      </span>

      {size === "card" && (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {CASH_OUT_FRACTIONS.map((value, index) => {
              const on = index === fractionIndex;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFractionIndex(index)}
                  className={cn(
                    "font-body h-9 cursor-pointer rounded-lg border bg-transparent text-xs font-bold",
                    on
                      ? "border-accent text-accent"
                      : "border-divider text-text",
                  )}
                >
                  {t.t(
                    value === 1
                      ? "bets.partAll"
                      : value === 0.5
                        ? "bets.part50"
                        : "bets.part25",
                  )}
                </button>
              );
            })}
          </div>

          <span className="text-muted text-[11px]">
            {fraction === 1
              ? t.t("bets.cashOutAll")
              : t.t("bets.cashOutRest", {
                  amount: t.money(figures.payout * (1 - fraction)),
                })}
          </span>
        </>
      )}

      {cashOut.isError && (
        <span
          role="alert"
          className="text-loss flex items-center gap-1.5 text-[11px] font-bold"
        >
          <CircleAlert size={12} strokeWidth={2} aria-hidden />
          {t.t("bets.cashOutFailed")}
        </span>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAsking(false)}
          className={cn(
            "bg-raised text-text font-body cursor-pointer rounded-md text-sm font-bold",
            buttonHeight,
          )}
        >
          {t.t("bets.keepBet")}
        </button>
        <button
          type="button"
          disabled={cashOut.isPending}
          onClick={() => cashOut.mutate({ id: bet.id, fraction })}
          className={cn(
            "bg-accent text-on-accent font-body flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold disabled:opacity-60",
            buttonHeight,
          )}
        >
          {cashOut.isPending && (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          )}
          {t.t("bets.confirm")}
        </button>
      </div>
    </div>
  );
}
