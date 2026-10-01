"use client";

import Link from "next/link";
import { ChevronLeft, Send, Ticket } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Barcode } from "@/components/ui/Barcode";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { BETTING } from "@/config/constants";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import { useBet } from "../hooks/use-bets";
import { betFigures, payoutView, PAYOUT_TONE } from "../lib/figures";
import { BetStatusBadge, LegDot } from "./BetStatusBadge";
import { features } from "@/config/features";
import { CashOutPanel } from "./CashOutPanel";

/**
 * A single ticket, in full.
 *
 * The record of the bet: its id, when it was placed, every leg with how it
 * finished, and the whole money trail from stake through both taxes to the
 * payout. Nothing is summarised away, because this is the page someone opens when
 * they want to check a figure they disagree with.
 */
export function BetTicket({ id }: { id: string }) {
  const t = useTranslation();
  const { data: bet, isPending } = useBet(id);

  if (isPending) {
    return (
      <Card className="m-4 flex flex-col gap-3 p-3.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-[62px] w-full" />
      </Card>
    );
  }

  if (!bet) {
    return (
      <Card>
        <StateMessage
          icon={<Ticket size={24} strokeWidth={1.5} />}
          title={t.t("bets.notFound")}
          body={t.t("bets.notFoundBody")}
        />
      </Card>
    );
  }

  const figures = betFigures(bet);
  const payout = payoutView(bet, figures);

  const rows: Array<{ label: string; value: string; strong?: boolean }> = [
    { label: t.t("bets.totalOdds"), value: t.odds(figures.odds), strong: true },
    { label: t.t("bets.stake"), value: t.money(bet.stake) },
    {
      label: `${t.t("bets.stakeTax")} · ${t.percent(BETTING.stakeTaxRate)}`,
      value: `− ${t.money(figures.stakeTax)}`,
      strong: true,
    },
    { label: t.t("bets.netStake"), value: t.money(figures.netStake) },
    {
      label: bet.status === "won" ? t.t("bets.win") : t.t("bets.potentialWin"),
      value: t.money(figures.grossReturn),
    },
    {
      label: `${t.t("bets.winTax")} · ${t.percent(BETTING.winTaxRate)}`,
      value: `− ${t.money(bet.status === "lost" ? 0 : figures.winTax)}`,
      strong: true,
    },
  ];

  return (
    <>
      <div className="border-divider grid min-h-12 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b px-1">
        <Link
          href={routes.myBets}
          aria-label={t.t("event.backToBoard")}
          className="text-text grid size-11 place-items-center rounded-md no-underline"
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden />
        </Link>
        <div className="font-display text-center text-[15px]">
          {t.t("bets.ticket")}
        </div>
        <span />
      </div>

      <Card className="m-4 flex flex-col gap-3 p-3.5">
        <div className="flex items-center justify-between">
          <BetStatusBadge bet={bet} />
          <span className="text-muted text-[11px]">
            {bet.legs.length > 1
              ? t.t("bets.multiple", { n: bet.legs.length })
              : t.t("bets.single")}
          </span>
        </div>

        <div>
          <div className="text-muted text-[11px]">{t.t("bets.ticketId")}</div>
          <div className="font-display text-[22px] leading-[1.1] tracking-[0.06em]">
            {bet.id}
          </div>
          <div className="text-muted text-[11px]">
            {t.t("bets.placed")} {t.pick(bet.placedAt)}
          </div>
        </div>

        <Barcode code={bet.id} label={t.t("bets.ticket")} />

        <div className="font-display mt-1 text-sm">
          {t.t("bets.selections")}
        </div>

        <div className="border-divider flex flex-col border-t">
          {bet.legs.map((leg, index) => (
            <div
              key={`${leg.pick.en}-${index}`}
              className="border-divider grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2.5 border-b py-2.5"
            >
              <LegDot status={leg.status} />
              <div className="min-w-0">
                <div className="text-muted text-[11px]">
                  {t.pick(leg.market)}
                </div>
                <div className="font-semibold">{t.pick(leg.pick)}</div>
                <div className="text-muted text-[11px]">
                  {t.pick(leg.match)} ·{" "}
                  {leg.status === "void"
                    ? t.t("bets.voidLeg")
                    : t.pick(leg.result)}
                </div>
              </div>
              <span
                className={cn(
                  "numeric font-bold",
                  leg.status === "void" ? "text-muted" : "text-text",
                )}
              >
                {t.odds(leg.odds)}
              </span>
            </div>
          ))}
        </div>

        <div className="numeric flex flex-col gap-[7px]">
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

          <div className="flex items-baseline justify-between">
            <span className="font-display text-[15px]">
              {t.t(payout.labelKey as "bets.netPayout")}
            </span>
            <span
              className={cn("font-display text-2xl", PAYOUT_TONE[payout.tone])}
            >
              {t.money(payout.amount)}
            </span>
          </div>
        </div>

        <button
          type="button"
          style={{ background: "#229ed9" }}
          className="font-body flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md text-[13px] font-bold text-white"
        >
          <Send size={16} strokeWidth={1.5} aria-hidden />
          {t.t("bets.shareTelegram")}
        </button>

        {/* Cash out is Release 2 (D8). */}
        {features.cashOut && <CashOutPanel bet={bet} size="ticket" />}
      </Card>
    </>
  );
}
