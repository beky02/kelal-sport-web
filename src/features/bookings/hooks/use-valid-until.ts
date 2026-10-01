"use client";

import { useCallback } from "react";
import { formatDayMonth, formatWeekday, toEat } from "@/lib/i18n/dates";
import { formatKickoff } from "@/lib/i18n/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUiStore } from "@/stores/ui.store";

/**
 * A booking's expiry as a player reads it: "Valid until Sun 4 Oct, 16:00" —
 * East Africa Time, in the calendar and clock they chose (D7).
 */
export function useValidUntil(): (expiresAt: string) => string {
  const t = useTranslation();
  const clock = useUiStore((s) => s.clock);
  const calendar = useUiStore((s) => s.calendar);

  return useCallback(
    (expiresAt: string) => {
      const { date, time } = toEat(expiresAt);
      return t.t("booking.validUntil", {
        day: formatWeekday(date, t.lang),
        date: formatDayMonth(date, t.lang, calendar),
        time: formatKickoff(time, t.lang, clock),
      });
    },
    [t, clock, calendar],
  );
}
