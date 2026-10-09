"use client";

import { useId } from "react";
import { Gift } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { percentOf } from "@/lib/money";
import { useLongDateTimeText } from "@/lib/i18n/use-long-date-time-text";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useMyBonuses } from "../hooks/use-promotions";
import type { ActiveBonus, FreeBet } from "../types";

const RETRY =
  "bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold";

/**
 * The signed-in player's bonus in progress and free bets (AC-11), from
 * `/api/me/bonuses`: the API's figures only. The bar is display only
 * (`percentOf`, FD4); nothing is subtracted, so there is no "left to wager".
 */
export function MyBonusSection() {
  const t = useTranslation();
  const heading = useId();
  const bonuses = useMyBonuses(true);

  return (
    <section aria-labelledby={heading} className="px-4 pt-5">
      <h2 id={heading} className="label-caps text-muted">
        {t.t("promotions.yourBonus")}
      </h2>
      {bonuses.data ? (
        <>
          {bonuses.data.active ? (
            <ActiveBonusCard bonus={bonuses.data.active} />
          ) : (
            <div className="bg-raised mt-2 rounded-lg p-3.5">
              <p className="font-semibold">{t.t("promotions.noBonus")}</p>
              <p className="text-muted text-xs">
                {t.t("promotions.noBonusBody")}
              </p>
            </div>
          )}
          <FreeBets bets={bonuses.data.freeBets} />
        </>
      ) : bonuses.isError ? (
        <div className="bg-raised mt-2 flex min-h-14 items-center gap-3 rounded-lg px-3.5 py-2">
          <span className="flex-1">
            <span className="block text-sm font-semibold">
              {t.t("promotions.bonusFailedTitle")}
            </span>
            <span className="text-muted block text-xs">
              {t.t("promotions.loadFailedBody")}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void bonuses.refetch()}
            className={RETRY}
          >
            {t.t("common.retry")}
          </button>
        </div>
      ) : (
        // The card's own shape, so nothing jumps when it lands.
        <div className="bg-raised mt-2 flex flex-col gap-2.5 rounded-lg p-3.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-40" />
        </div>
      )}
    </section>
  );
}

function ActiveBonusCard({ bonus }: { bonus: ActiveBonus }) {
  const t = useTranslation();
  const when = useLongDateTimeText();
  const share = percentOf(bonus.wageringDone, bonus.wageringRequired);
  return (
    <div className="bg-raised mt-2 flex flex-col gap-2 rounded-lg p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 font-semibold break-words">
          {bonus.title ?? t.t("promotions.bonusUnnamed")}
        </span>
        <span className="numeric font-display shrink-0 text-lg">
          {t.money(bonus.amount)}
        </span>
      </div>
      {/* Recessed track, as the limits' bar: the figures below say it in words. */}
      <div className="bg-ground h-1.5 overflow-hidden rounded-full" aria-hidden>
        <div className="bg-accent h-full" style={{ width: `${share}%` }} />
      </div>
      <p className="numeric text-sm">
        {t.t("promotions.wagered", {
          done: t.money(bonus.wageringDone),
          required: t.money(bonus.wageringRequired),
        })}
      </p>
      <p className="text-muted numeric text-xs">
        {t.t("promotions.expires", { date: when(bonus.expiresAt) })}
      </p>
    </div>
  );
}

function FreeBets({ bets }: { bets: FreeBet[] }) {
  const t = useTranslation();
  const when = useLongDateTimeText();
  return (
    <>
      <h3 className="label-caps text-muted pt-4">
        {t.t("promotions.freeBets")}
      </h3>
      {bets.length === 0 ? (
        <p className="text-muted pt-1 text-sm">
          {t.t("promotions.noFreeBets")}
        </p>
      ) : (
        <ul aria-label={t.t("promotions.freeBets")} className="mt-1">
          {bets.map((bet) => (
            <li
              key={bet.id}
              className="border-divider flex items-start gap-3 border-b py-2.5 last:border-b-0"
            >
              <Gift
                size={20}
                strokeWidth={1.5}
                aria-hidden
                className="text-accent mt-0.5 shrink-0"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="numeric font-semibold">
                  {t.t("promotions.freeBetStake", {
                    stake: t.money(bet.stake),
                  })}
                </span>
                {/* Each condition the API set, as it set it; none it didn't. */}
                <span className="text-muted numeric text-xs">
                  {t.t("promotions.freeBetPicks", { n: bet.minLegs })}
                </span>
                {bet.minLegOdds && (
                  <span className="text-muted numeric text-xs">
                    {t.t("promotions.freeBetLegOdds", { odds: bet.minLegOdds })}
                  </span>
                )}
                {bet.minTotalOdds && (
                  <span className="text-muted numeric text-xs">
                    {t.t("promotions.freeBetTotalOdds", {
                      odds: bet.minTotalOdds,
                    })}
                  </span>
                )}
                <span className="text-muted numeric text-xs">
                  {t.t("promotions.expires", { date: when(bet.expiresAt) })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
