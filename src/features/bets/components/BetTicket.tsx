"use client";

import Link from "next/link";
import { ChevronLeft, Send, Ticket, TriangleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Barcode } from "@/components/ui/Barcode";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { routes } from "@/config/routes";
import { features } from "@/config/features";
import { useSession } from "@/features/auth/hooks/use-session";
import { useDateTimeText } from "@/lib/i18n/use-date-time-text";
import { compareMoney } from "@/lib/money";
import { absoluteUrl, telegramShareUrl } from "@/lib/share";
import { cn } from "@/lib/utils/cn";
import { useBet } from "../hooks/use-bets";
import { payoutView, PAYOUT_TONE } from "../lib/figures";
import { betKindLabel, kindOf } from "../lib/labels";
import type { Bet } from "../types";
import { BetStatusBadge } from "./BetStatusBadge";
import { BetsGuest } from "./BetsGuest";
import { CashOutPanel } from "./CashOutPanel";
import { TicketLeg } from "./TicketLeg";

/**
 * A single ticket, in full.
 *
 * The record of the bet: its number, when it was placed, every leg with how it
 * finished, and the money as the API keeps it — stake, stake tax, bonus,
 * winnings tax, payout. Nothing is recomputed here: this is the page someone
 * opens when they want to check a figure, so every figure is the book's own.
 */
export function BetTicket({ id }: { id: string }) {
  const t = useTranslation();
  const session = useSession();
  const signedIn = !session.isLoading && !session.isGuest;
  const { data: bet, isPending, isError, refetch } = useBet(id, signedIn);

  let body: React.ReactNode;
  if (!session.isLoading && session.isGuest) {
    body = <BetsGuest />;
  } else if (isPending) {
    body = (
      <Card className="m-4 flex flex-col gap-3 p-3.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-[62px] w-full" />
      </Card>
    );
  } else if (isError) {
    body = (
      <StateMessage
        icon={<TriangleAlert size={24} strokeWidth={1.5} />}
        title={t.t("bets.ticketFailedTitle")}
        body={t.t("bets.ticketFailedBody")}
        action={{ label: t.t("common.retry"), onClick: () => void refetch() }}
      />
    );
  } else if (!bet) {
    body = (
      <StateMessage
        icon={<Ticket size={24} strokeWidth={1.5} />}
        title={t.t("bets.notFound")}
        body={t.t("bets.notFoundBody")}
        action={{ label: t.t("bets.backToBets"), href: routes.myBets }}
      />
    );
  } else {
    body = <TicketDetail bet={bet} />;
  }

  return (
    <>
      <div className="border-divider grid min-h-12 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b px-1">
        <Link
          href={routes.myBets}
          aria-label={t.t("bets.backToBets")}
          className="text-text grid size-11 place-items-center rounded-md no-underline"
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        </Link>
        <h2 className="font-display text-center text-[15px]">
          {t.t("bets.ticket")}
        </h2>
        <span />
      </div>
      {body}
    </>
  );
}

function TicketDetail({ bet }: { bet: Bet }) {
  const t = useTranslation();
  const when = useDateTimeText();
  const payout = payoutView(bet);
  const above = (amount: string | null): amount is string =>
    amount !== null && compareMoney(amount, "0.00") > 0;

  // D1's order, the API's figures only: no net stake or gross, which the
  // contract's ticket doesn't carry and the browser must not work out.
  const rows: Array<{ label: string; value: string; strong?: boolean }> = [
    ...(bet.totalOdds
      ? [
          {
            label: t.t("bets.totalOdds"),
            value: t.odds(bet.totalOdds),
            strong: true,
          },
        ]
      : []),
    { label: t.t("bets.stake"), value: t.money(bet.stake) },
    ...(above(bet.stakeBonus)
      ? [{ label: t.t("bets.stakeBonus"), value: t.money(bet.stakeBonus) }]
      : []),
    {
      label: t.t("bets.stakeTax"),
      value: `− ${t.money(bet.stakeTax)}`,
      strong: true,
    },
    ...(above(bet.accaBonus)
      ? [
          {
            label: t.t("betSlip.accaBonus"),
            value: `+ ${t.money(bet.accaBonus)}`,
          },
        ]
      : []),
    // Decided at settlement: there is none to show on an open bet.
    ...(bet.winTax !== null
      ? [
          {
            label: t.t("bets.winTax"),
            value: `− ${t.money(bet.winTax)}`,
            strong: true,
          },
        ]
      : []),
  ];

  return (
    <Card className="m-4 flex flex-col gap-3 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <BetStatusBadge status={bet.status} />
        <span className="text-muted text-[11px]">
          {betKindLabel(kindOf(bet), t)}
        </span>
      </div>

      <div>
        <div className="text-muted text-[11px]">{t.t("bets.ticketId")}</div>
        <div className="font-display text-[22px] leading-[1.1] tracking-[0.06em]">
          {bet.ticketId}
        </div>
        <div className="text-muted numeric text-[11px]">
          {t.t("bets.placedAt", { date: when(bet.placedAt) })}
        </div>
        {bet.settledAt && (
          <div className="text-muted numeric text-[11px]">
            {t.t("bets.settledAt", { date: when(bet.settledAt) })}
          </div>
        )}
      </div>

      <Barcode code={bet.ticketId} label={t.t("bets.ticket")} />

      <h3 className="font-display mt-1 text-sm">{t.t("bets.selections")}</h3>

      <ul className="border-divider flex flex-col border-t">
        {bet.legs.map((leg) => (
          <TicketLeg
            key={leg.outcomeId}
            leg={leg}
            kickoff={when(leg.startTime)}
          />
        ))}
      </ul>

      <div
        data-testid="ticket-figures"
        className="numeric flex flex-col gap-[7px]"
      >
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <span className={row.strong ? undefined : "text-muted"}>
              {row.label}
            </span>
            <span className={row.strong ? "font-semibold" : undefined}>
              {row.value}
            </span>
          </div>
        ))}

        <div className="bg-divider my-[3px] h-px" />

        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-[15px]">
            {t.t(payout.labelKey)}
          </span>
          <span
            className={cn("font-display text-2xl", PAYOUT_TONE[payout.tone])}
          >
            {payout.amount ? t.money(payout.amount) : "—"}
          </span>
        </div>
      </div>

      <a
        href={telegramShareUrl(
          absoluteUrl(routes.ticket(bet.ticketId)),
          t.t("ticket.shareText", { ticket: bet.ticketId }),
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-telegram font-body flex h-11 items-center justify-center gap-2 rounded-md text-[13px] font-bold text-white no-underline"
      >
        <Send size={16} strokeWidth={1.5} aria-hidden />
        {t.t("bets.shareTelegram")}
      </a>

      {/* Cash out is Release 2 (D8), and the contract has no quote yet. */}
      {features.cashOut && (
        <CashOutPanel bet={bet} quote={null} size="ticket" />
      )}
    </Card>
  );
}
