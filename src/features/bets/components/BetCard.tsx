"use client";

import { memo } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/use-translation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import { features } from "@/config/features";
import { useDateTimeText } from "@/lib/i18n/use-date-time-text";
import { payoutView, PAYOUT_TONE } from "../lib/figures";
import { betKindLabel, kindOf, RESULT_KEY } from "../lib/labels";
import type { Bet } from "../types";
import { BetStatusBadge, LegDot } from "./BetStatusBadge";
import { CashOutPanel } from "./CashOutPanel";

/**
 * One ticket in the list.
 *
 * Reads top to bottom as a person would ask it: what state is it in, what did I
 * pick, what did it cost and what is it worth — every figure the API's own.
 * Tax is spelled out on a bet that won, once the API has decided it. Memoised:
 * a page of My bets arriving, or a refetch, leaves cards whose bet is the same
 * object alone.
 */
export const BetCard = memo(function BetCard({ bet }: { bet: Bet }) {
  const t = useTranslation();
  const when = useDateTimeText();
  const payout = payoutView(bet);

  return (
    <div className="bg-surface flex flex-col rounded-lg">
      <Link
        href={routes.bet(bet.id)}
        className="text-text font-body flex flex-col gap-2.5 p-3 no-underline"
      >
        <span className="flex w-full items-center gap-2">
          <BetStatusBadge status={bet.status} />
          <span className="min-w-0 flex-1 text-xs font-semibold">
            {betKindLabel(kindOf(bet), t)}
          </span>
          <span className="text-muted numeric text-[11px] whitespace-nowrap">
            {when(bet.placedAt)}
          </span>
        </span>

        <span className="flex w-full flex-col gap-1.5">
          {bet.legs.map((leg) => (
            <span
              key={leg.outcomeId}
              className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2"
            >
              <LegDot result={leg.result} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium">
                  {t.pick(leg.pick)}
                  <span className="text-muted font-normal">
                    {" · "}
                    {t.pick(leg.market)}
                  </span>
                </span>
                {/* Wraps rather than cuts: "counted at odds 1.00" is the point. */}
                <span className="text-muted text-[11px] break-words">
                  {t.pick(leg.match)} ·{" "}
                  {leg.result === "open"
                    ? when(leg.startTime)
                    : t.t(RESULT_KEY[leg.result])}
                </span>
              </span>
              <span
                className={cn(
                  "numeric font-bold",
                  leg.result === "void" ? "text-muted" : "text-text",
                )}
              >
                {t.odds(leg.odds)}
              </span>
            </span>
          ))}
        </span>

        <span className="border-divider numeric grid w-full grid-cols-[1fr_1fr_1.4fr] gap-2 border-t pt-2.5">
          <span className="flex flex-col">
            <span className="text-muted text-[11px]">{t.t("bets.stake")}</span>
            <span className="font-semibold">{t.money(bet.stake)}</span>
          </span>
          <span className="flex flex-col">
            <span className="text-muted text-[11px]">{t.t("bets.odds")}</span>
            <span className="font-semibold">
              {bet.totalOdds ? t.odds(bet.totalOdds) : "—"}
            </span>
          </span>
          <span className="flex flex-col items-end">
            <span className="text-muted text-[11px]">
              {t.t(payout.labelKey)}
            </span>
            <span className={cn("text-sm font-bold", PAYOUT_TONE[payout.tone])}>
              {payout.amount ? t.money(payout.amount) : "—"}
            </span>
          </span>
        </span>

        <span className="text-muted flex flex-wrap justify-between gap-x-3 text-[11px]">
          <span className="numeric">{bet.ticketId}</span>
          {bet.status === "won" && bet.winTax !== null && (
            <span className="numeric">
              {t.t("bets.taxWithheld", {
                winnings: t.money(bet.winTax),
                stake: t.money(bet.stakeTax),
              })}
            </span>
          )}
        </span>
      </Link>

      {/* Cash out is Release 2 (D8), and the contract has no quote yet. */}
      {features.cashOut && (
        <CashOutPanel bet={bet} quote={null} className="mx-3 mb-3" />
      )}
    </div>
  );
});
