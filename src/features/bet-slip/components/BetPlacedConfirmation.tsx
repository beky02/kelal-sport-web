"use client";

import { Check, Send } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Button } from "@/components/ui/Button";
import type { BetReceipt } from "../api/place-bet";

/**
 * The ticket, as the engine returned it.
 *
 * Every figure comes from the receipt rather than from the slip that produced
 * it: if the book priced the bet differently from the estimate, this is where
 * the user finds out, and the two should never be reconciled in the browser.
 */
export function BetPlacedConfirmation({
  receipt,
  onKeepSelections,
  onDone,
}: {
  receipt: BetReceipt;
  onKeepSelections: () => void;
  onDone: () => void;
}) {
  const t = useTranslation();

  // A multiple has one accumulated price. Singles and systems are several
  // separate bets, so quoting a product of their odds would be a number that
  // appears nowhere on the ticket — show what was actually placed instead.
  const combined = receipt.mode === "multiple";
  const typeLabel = combined
    ? t.t("betSlip.multipleLabel", { n: receipt.betCount })
    : receipt.mode === "system"
      ? t.t("betSlip.system")
      : t.t("betSlip.single");

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-5">
      <div className="flex flex-col items-center gap-1.5 pt-2 pb-1 text-center">
        <span className="bg-win-bg text-win grid size-13 place-items-center rounded-full">
          <Check size={26} strokeWidth={2} aria-hidden />
        </span>
        <span className="font-display text-xl">{t.t("betSlip.placed")}</span>
        <span className="text-muted text-xs">
          {t.t("betSlip.ticket")}{" "}
          <b className="text-text tracking-[0.04em]">{receipt.ticketId}</b>
        </span>
      </div>

      <div className="bg-surface numeric flex flex-col gap-[7px] rounded-lg p-3">
        <div className="flex justify-between">
          <span className="text-muted">{typeLabel}</span>
          <span className="font-bold">
            {combined
              ? t.odds(receipt.totalOdds)
              : `${receipt.betCount} ${t.t("betSlip.bets")}`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">{t.t("betSlip.stake")}</span>
          <span>{t.money(receipt.totalStake)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t.t("betSlip.stakeTax")}</span>
          <span className="font-bold">− {t.money(receipt.stakeTax)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t.t("betSlip.winTax")}</span>
          <span className="font-bold">− {t.money(receipt.winTax)}</span>
        </div>
        <div className="border-divider flex items-baseline justify-between border-t pt-2">
          <span className="font-bold">{t.t("betSlip.totalReturn")}</span>
          <span className="font-display text-xl">
            {t.money(receipt.payout)}
          </span>
        </div>
      </div>

      {/* Telegram is how tickets get shared in this market, so it is a first
          class action rather than hidden behind a generic share sheet. */}
      <button
        type="button"
        className="font-body flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold text-white"
        style={{ background: "#229ed9" }}
      >
        <Send size={17} strokeWidth={1.5} aria-hidden />
        {t.t("betSlip.shareTelegram")}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={onKeepSelections}>
          {t.t("betSlip.keepSelections")}
        </Button>
        <Button size="lg" onClick={onDone}>
          {t.t("betSlip.done")}
        </Button>
      </div>
    </div>
  );
}
