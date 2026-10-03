"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import { useDateTimeText } from "@/lib/i18n/use-date-time-text";
import { BetStatusBadge } from "@/features/bets/components/BetStatusBadge";
import { TicketLeg } from "@/features/bets/components/TicketLeg";
import { PAYOUT_TONE } from "@/features/bets/lib/figures";
import { betKindLabel } from "@/features/bets/lib/labels";
import { ticketPayout } from "../lib/figures";
import type { TicketCheck } from "../types";

/**
 * A ticket as anyone holding its number may see it (`/t/{ticket}`): its
 * status, when it was placed and settled, every leg with its odds and result,
 * the stake and the payout. No owner — the API sends none. Rendered on the
 * server, so it reads the same without JavaScript (C18 §9).
 */
export function TicketCheckView({ ticket }: { ticket: TicketCheck }) {
  const t = useTranslation();
  const when = useDateTimeText();
  const payout = ticketPayout(ticket);
  const kind = betKindLabel(
    { betType: ticket.betType, legCount: ticket.legs.length },
    t,
  );

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
          // A ticket's legs never move: their order is the key.
          <TicketLeg key={index} leg={leg} />
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
