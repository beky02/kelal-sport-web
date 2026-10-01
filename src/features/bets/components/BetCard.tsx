"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/use-translation";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";
import { usePublicConfig } from "@/features/config/hooks/use-public-config";
import { betFigures, payoutView, PAYOUT_TONE } from "../lib/figures";
import type { Bet } from "../types";
import { BetStatusBadge, LegDot } from "./BetStatusBadge";
import { features } from "@/config/features";
import { CashOutPanel } from "./CashOutPanel";

/**
 * One ticket in the list.
 *
 * Reads top to bottom as a person would ask it: what state is it in, what did I
 * pick, what did it cost and what is it worth. Tax is only spelled out on a bet
 * that won, because that is the only time money was actually withheld.
 */
export function BetCard({ bet }: { bet: Bet }) {
  const t = useTranslation();
  const rules = usePublicConfig().data?.betting.calc ?? null;
  const figures = betFigures(bet, rules);
  const payout = payoutView(bet, figures);

  return (
    <div className="bg-surface flex flex-col rounded-lg">
      <Link
        href={routes.bet(bet.id)}
        className="text-text font-body flex flex-col gap-2.5 p-3 no-underline"
      >
        <span className="flex w-full items-center gap-2">
          <BetStatusBadge bet={bet} />
          <span className="flex-1 text-xs font-semibold">
            {bet.legs.length > 1
              ? t.t("bets.multiple", { n: bet.legs.length })
              : t.t("bets.single")}
          </span>
          <span className="text-muted text-[11px]">{t.pick(bet.placedAt)}</span>
        </span>

        <span className="flex w-full flex-col gap-1.5">
          {bet.legs.map((leg, index) => (
            <span
              key={`${leg.pick.en}-${index}`}
              className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2"
            >
              <LegDot status={leg.status} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium">
                  {t.pick(leg.pick)}
                </span>
                <span className="text-muted truncate text-[11px]">
                  {t.pick(leg.match)}
                </span>
                {leg.status === "void" && (
                  <span className="text-muted text-[11px] font-bold">
                    {t.t("bets.voidLeg")}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "numeric font-bold",
                  leg.status === "void" ? "text-muted" : "text-text",
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
            <span className="font-semibold">{t.number(bet.stake)}</span>
          </span>
          <span className="flex flex-col">
            <span className="text-muted text-[11px]">{t.t("bets.odds")}</span>
            <span className="font-semibold">
              {figures?.totalOdds ? t.odds(figures.totalOdds) : "—"}
            </span>
          </span>
          <span className="flex flex-col items-end">
            <span className="text-muted text-[11px]">
              {t.t(payout.labelKey as "bets.netPayout")}
            </span>
            <span className={cn("text-sm font-bold", PAYOUT_TONE[payout.tone])}>
              {payout.amount ? t.money(payout.amount) : "—"}
            </span>
          </span>
        </span>

        {bet.status === "won" && figures && (
          <span className="text-muted numeric text-[11px]">
            {t.t("bets.taxWithheld", {
              winnings: t.money(figures.winTax),
              stake: t.money(figures.stakeTax),
            })}
          </span>
        )}
      </Link>

      {features.cashOut && bet.status === "open" && (
        <div className="px-3 pb-3">
          <CashOutPanel bet={bet} />
        </div>
      )}
    </div>
  );
}
