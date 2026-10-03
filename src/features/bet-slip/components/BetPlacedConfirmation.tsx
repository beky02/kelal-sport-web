"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Send } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Barcode } from "@/components/ui/Barcode";
import { Button } from "@/components/ui/Button";
import { routes } from "@/config/routes";
import { compareMoney } from "@/lib/money";
import { absoluteUrl, telegramShareUrl } from "@/lib/share";
import type { BetReceipt } from "../types";

/**
 * The ticket, as the engine issued it.
 *
 * Every figure comes from the API's `PlacedBet`, never from the slip that
 * produced it: if the book priced the bet differently from the preview — new
 * odds, a better price taken under the odds policy — this is where the player
 * finds out, and the two are never reconciled in the browser. There is no
 * winnings-tax line: the API decides that at settlement.
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
  const [copied, setCopied] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Focus lands on the result, so it is announced and the keyboard is there.
  useEffect(() => heading.current?.focus(), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(receipt.ticketId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the number is on screen either way.
    }
  };

  // A single-line bet has one price (the API's total odds); several lines —
  // singles, a system — are several bets, so their count is shown instead of
  // a product of odds that appears nowhere on the ticket.
  const typeLabel =
    receipt.betType === "multiple"
      ? t.t("betSlip.multipleLabel", { n: receipt.legCount })
      : receipt.betType === "system"
        ? t.t("betSlip.system")
        : t.t("betSlip.single");
  const typeValue =
    receipt.totalOdds !== null && receipt.lines === 1
      ? t.odds(receipt.totalOdds)
      : t.t("betSlip.betCount", { n: receipt.lines });

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-5">
      <div className="flex flex-col items-center gap-1.5 pt-2 pb-1 text-center">
        <span className="bg-win-bg text-win grid size-13 place-items-center rounded-full">
          <Check size={26} strokeWidth={2} aria-hidden />
        </span>
        <h3
          ref={heading}
          tabIndex={-1}
          className="font-display text-xl outline-none"
        >
          {t.t("betSlip.placed")}
        </h3>
      </div>

      {/* The ticket number is what the player reads out, types in to check
          the ticket, or shows at a shop — so it is big, with its barcode, as
          on the ticket in My bets. */}
      <div
        data-testid="ticket-code"
        className="bg-surface flex flex-col gap-2.5 rounded-lg p-3.5"
      >
        <span className="text-muted text-[11px]">{t.t("betSlip.ticket")}</span>
        <div className="font-display text-[26px] leading-none tracking-[0.08em] break-all">
          {receipt.ticketId}
        </div>
        <Barcode code={receipt.ticketId} label={t.t("betSlip.ticket")} />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={copy}
            className="bg-raised text-text font-body h-11 cursor-pointer rounded-md text-[13px] font-bold"
          >
            {t.t(copied ? "betSlip.copied" : "betSlip.copyCode")}
          </button>
          {/* The public ticket check (D7): anyone given the link sees its
              status, never who placed it. */}
          <a
            href={telegramShareUrl(
              absoluteUrl(routes.ticket(receipt.ticketId)),
              t.t("ticket.shareText", { ticket: receipt.ticketId }),
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-telegram font-body flex h-11 items-center justify-center gap-2 rounded-md text-[13px] font-bold text-white no-underline"
          >
            <Send size={15} strokeWidth={1.5} aria-hidden />
            {t.t("betSlip.shareTelegram")}
          </a>
        </div>
      </div>

      <div
        data-testid="ticket-figures"
        className="bg-surface numeric flex flex-col gap-[7px] rounded-lg p-3"
      >
        <div className="flex justify-between gap-3">
          <span className="text-muted">{typeLabel}</span>
          <span className="font-bold">{typeValue}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">{t.t("betSlip.stake")}</span>
          <span>{t.money(receipt.stake)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>{t.t("betSlip.stakeTax")}</span>
          <span className="font-bold">− {t.money(receipt.stakeTax)}</span>
        </div>
        {compareMoney(receipt.accaBonus, "0.00") > 0 && (
          <div className="flex justify-between gap-3">
            <span>{t.t("betSlip.accaBonus")}</span>
            <span className="font-bold">+ {t.money(receipt.accaBonus)}</span>
          </div>
        )}
        <div className="border-divider flex items-baseline justify-between gap-3 border-t pt-2">
          <span className="font-bold">{t.t("bets.potentialPayout")}</span>
          <span className="font-display text-xl">
            {t.money(receipt.potentialPayout)}
          </span>
        </div>
      </div>

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
