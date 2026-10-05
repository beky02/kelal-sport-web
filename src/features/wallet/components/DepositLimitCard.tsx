"use client";

import { useId } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { routes } from "@/config/routes";
import { useLimits } from "@/features/responsible-gaming/hooks/use-responsible-gaming";
import {
  LIMIT_PERIODS,
  type LimitPeriod,
} from "@/features/responsible-gaming/types";
import type { MessageKey } from "@/lib/i18n";
import { useDateTimeText } from "@/lib/i18n/use-date-time-text";
import { useTranslation } from "@/lib/i18n/use-translation";
import { percentOf } from "@/lib/money";
import { cn } from "@/lib/utils/cn";

const PERIOD: Record<LimitPeriod, MessageKey> = {
  day: "rg.daily",
  week: "rg.weekly",
  month: "rg.monthly",
};

const USED: Record<LimitPeriod, MessageKey> = {
  day: "rg.usedDay",
  week: "rg.usedWeek",
  month: "rg.usedMonth",
};

/**
 * The player's deposit limits, from the account (AC-7): for each — a day, a
 * week, a month — what the current period has used of it and any change the
 * API holds back, exactly as `/v1/me/limits` states them. Nothing is worked
 * out here: no "left", which would be a sum the API doesn't make (and a
 * lowered limit can sit below what is already used). Manage leads to where a
 * limit is set; a limit the player set is not an obstacle to hide.
 */
export function DepositLimitCard() {
  const t = useTranslation();
  const when = useDateTimeText();
  const titleId = useId();
  // The wallet is only shown to a signed-in player.
  const limits = useLimits(true);

  const deposits = limits.data
    ? LIMIT_PERIODS.flatMap((period) =>
        limits.data.filter(
          (limit) =>
            limit.type === "deposit" &&
            limit.period === period &&
            limit.amount !== null,
        ),
      )
    : null;

  return (
    <section
      aria-labelledby={titleId}
      className="bg-surface mx-4 mt-3.5 flex flex-col gap-2.5 rounded-md p-3"
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <h3 id={titleId} className="font-semibold">
          {t.t("rg.depositLimit")}
        </h3>
        {deposits !== null && deposits.length > 0 && (
          <Link
            href={routes.responsibleGaming}
            // A 44 px target that doesn't push the heading row apart.
            className="text-accent -my-3 inline-flex min-h-11 items-center px-1 font-semibold"
          >
            {t.t("wallet.manage")}
          </Link>
        )}
      </div>

      {limits.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-2.5 w-48" />
        </div>
      ) : deposits === null ? (
        <div className="flex items-center gap-2.5">
          <CircleAlert
            size={17}
            strokeWidth={1.5}
            aria-hidden
            className="text-loss shrink-0"
          />
          <p className="min-w-0 flex-1 text-xs">
            {t.t("wallet.depositLimitFailed")}
          </p>
          <button
            type="button"
            onClick={() => void limits.refetch()}
            className="bg-raised text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
          >
            {t.t("common.retry")}
          </button>
        </div>
      ) : deposits.length === 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted text-xs">{t.t("wallet.noDepositLimit")}</p>
          <Link
            href={routes.responsibleGaming}
            className="text-accent -my-3 inline-flex min-h-11 shrink-0 items-center px-1 text-xs font-semibold"
          >
            {t.t("wallet.setLimit")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {deposits.map((limit) => {
            const amount = limit.amount!;
            const share =
              limit.used !== null ? percentOf(limit.used, amount) : 0;
            return (
              <li key={limit.period} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold">
                  {t.t(PERIOD[limit.period])}
                </span>
                {limit.used !== null ? (
                  <>
                    {/* Recessed track: the fill is accent, and a track the
                        same colour as the card would leave the bar floating. */}
                    <div
                      className="bg-ground h-1.5 overflow-hidden rounded-full"
                      aria-hidden
                    >
                      <div
                        className={cn(
                          "h-full",
                          share >= 90 ? "bg-loss" : "bg-accent",
                        )}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="text-muted numeric text-[11px]">
                      {t.t(USED[limit.period], {
                        used: t.money(limit.used),
                        limit: t.money(amount),
                      })}
                    </span>
                  </>
                ) : (
                  <span className="numeric text-[11px]">
                    {t.t("rg.limitValue", { value: t.money(amount) })}
                  </span>
                )}
                {limit.pending && (
                  <span className="text-muted numeric text-[11px]">
                    {limit.pending.amount !== null
                      ? t.t("rg.pendingChange", {
                          value: t.money(limit.pending.amount),
                          date: when(limit.pending.effectiveFrom),
                        })
                      : t.t("rg.pendingRemoved", {
                          date: when(limit.pending.effectiveFrom),
                        })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
