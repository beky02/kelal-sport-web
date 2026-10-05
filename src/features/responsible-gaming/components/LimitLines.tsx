"use client";

import type { MessageKey } from "@/lib/i18n";
import { useTranslation, type Translator } from "@/lib/i18n/use-translation";
import { percentOf } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import type { LimitPeriod, PendingLimit } from "../types";

/**
 * How a limit reads, wherever it is shown — the responsible-gaming page and
 * the wallet's card say the same limit the same way.
 */

/** "Daily", "Weekly", "Monthly". */
export const PERIOD_LABEL: Record<LimitPeriod, MessageKey> = {
  day: "rg.daily",
  week: "rg.weekly",
  month: "rg.monthly",
};

const USED_LINE: Record<LimitPeriod, MessageKey> = {
  day: "rg.usedDay",
  week: "rg.usedWeek",
  month: "rg.usedMonth",
};

/** A limit's value as the API states it: money, or minutes; null for neither. */
export function valueText(
  limit: { amount: string | null; minutes: number | null },
  t: Translator,
): string | null {
  if (limit.amount !== null) return t.money(limit.amount);
  if (limit.minutes !== null) return t.t("rg.minutes", { n: limit.minutes });
  return null;
}

/** A change the API holds back, and when it applies — its time, never ours. */
export function pendingText(
  pending: PendingLimit,
  t: Translator,
  when: (iso: string) => string,
): string {
  const value = valueText(pending, t);
  const date = when(pending.effectiveFrom);
  return value === null
    ? t.t("rg.pendingRemoved", { date })
    : t.t("rg.pendingChange", { value, date });
}

/**
 * How much of a limit the current period has used, as the API counts it: the
 * API's two figures, and a bar that turns red from 90% rather than at 100% —
 * a limit is a warning system, and saying so only once it is hit defeats it.
 * The bar is display only (`percentOf`).
 */
export function UsedBar({
  used,
  amount,
  period,
}: {
  used: string;
  amount: string;
  period: LimitPeriod;
}) {
  const t = useTranslation();
  const share = percentOf(used, amount);
  return (
    <div className="flex flex-col gap-1.5">
      {/* Recessed track: the fill is accent, and a track the same colour as
          the card it sits in would leave the bar floating. */}
      <div className="bg-ground h-1.5 overflow-hidden rounded-full" aria-hidden>
        <div
          className={cn("h-full", share >= 90 ? "bg-loss" : "bg-accent")}
          style={{ width: `${share}%` }}
        />
      </div>
      <p className="text-muted numeric text-xs">
        {t.t(USED_LINE[period], {
          used: t.money(used),
          limit: t.money(amount),
        })}
      </p>
    </div>
  );
}
