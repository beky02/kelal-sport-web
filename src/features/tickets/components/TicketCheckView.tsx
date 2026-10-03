"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import { useDateTimeText } from "@/features/bookings/hooks/use-date-time-text";
import {
  BetStatusBadge,
  LegDot,
} from "@/features/bets/components/BetStatusBadge";
import { PAYOUT_TONE, type PayoutTone } from "@/features/bets/lib/figures";
import { RESULT_KEY } from "@/features/bets/lib/labels";
import type { MessageKey } from "@/lib/i18n";
import type { TicketCheck } from "../types";

/**
 * The payout line, when the API gives one: "Cashed out" for a ticket taken
 * early, "Payout" for every other status — the API's figure, labelled no more
 * than the contract describes it.
 */
function payoutLine(
  ticket: TicketCheck,
): { labelKey: MessageKey; amount: string; tone: PayoutTone } | null {
  if (ticket.payout === null) return null;
  const tone: PayoutTone =
    ticket.status === "won" || ticket.status === "paid"
      ? "win"
      : ticket.status === "lost"
        ? "loss"
        : "plain";
  return {
    labelKey:
      ticket.status === "cashed_out" ? "bets.cashedAmount" : "bets.payout",
    amount: ticket.payout,
    tone,
  };
}

/**
 * A ticket as anyone holding its number may see it (`/t/{ticket}`): its
 * status, when it was placed and settled, every leg with its odds and result,
 * the stake and the payout. No owner — the API sends none. Rendered on the
 * server, so it reads the same without JavaScript (C18 §9).
 */
export function TicketCheckView({ ticket }: { ticket: TicketCheck }) {
  const t = useTranslation();
  const when = useDateTimeText();
  const payout = payoutLine(ticket);
  const n = ticket.legs.length;
  const kind =
    ticket.betType === "multiple"
      ? t.t("betSlip.multipleLabel", { n })
      : ticket.betType === "system"
        ? t.t("betSlip.system")
        : n > 1
          ? t.t("betSlip.singlesLabel", { n })
          : t.t("betSlip.single");

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span data-testid="ticket-status">
          <BetStatusBadge status={ticket.status} />
        </span>
        <span className="text-muted text-[11px]">{kind}</span>
      </div>

      <div>
        <h1 className="font-display text-[22px] leading-[1.15]">
          {t.t("ticket.pageTitle", { ticket: ticket.ticketId })}
        </h1>
        <div className="text-muted numeric text-[11px]">
          {t.t("bets.placedAt", { date: when(ticket.placedAt) })}
        </div>
        {ticket.settledAt && (
          <div className="text-muted numeric text-[11px]">
            {t.t("bets.settledAt", { date: when(ticket.settledAt) })}
          </div>
        )}
      </div>

      <h2 className="font-display mt-1 text-sm">{t.t("bets.selections")}</h2>

      <ul className="border-divider flex flex-col border-t">
        {ticket.legs.map((leg, index) => (
          <li
            // A ticket's legs never move: their order is the key.
            key={index}
            className="border-divider grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2.5 border-b py-2.5"
          >
            <LegDot result={leg.result} />
            <div className="min-w-0">
              <div className="text-muted text-[11px]">{t.pick(leg.market)}</div>
              <div className="font-semibold">{t.pick(leg.pick)}</div>
              <div className="text-muted text-[11px]">
                {t.pick(leg.match)} · {t.t(RESULT_KEY[leg.result])}
              </div>
            </div>
            <span
              className={cn(
                "numeric font-bold",
                leg.result === "void" ? "text-muted" : "text-text",
              )}
            >
              {t.odds(leg.odds)}
            </span>
          </li>
        ))}
      </ul>

      <div
        data-testid="ticket-figures"
        className="numeric flex flex-col gap-[7px]"
      >
        <div className="flex justify-between gap-3">
          <span className="text-muted">{t.t("bets.stake")}</span>
          <span>{t.money(ticket.stake)}</span>
        </div>
        {payout && (
          <>
            <div className="bg-divider my-[3px] h-px" />
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[15px]">
                {t.t(payout.labelKey)}
              </span>
              <span
                className={cn(
                  "font-display text-2xl",
                  PAYOUT_TONE[payout.tone],
                )}
              >
                {t.money(payout.amount)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
