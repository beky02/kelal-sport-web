"use client";

import { useCallback } from "react";
import { formatLongDate, toEat } from "@/lib/i18n/dates";
import { formatKickoff } from "@/lib/i18n/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useLocale } from "@/lib/i18n/locale";

/**
 * A moment far enough off to need its year — when a break or a self-exclusion
 * ends: `10 Oct 2026, 18:00`, East Africa Time, in the locale's calendar and
 * clock (D7).
 */
export function useLongDateTimeText(): (iso: string) => string {
  const t = useTranslation();
  const { clock, calendar } = useLocale();
  return useCallback(
    (iso: string) => {
      const { date, time } = toEat(iso);
      return t.t("common.dateAtTime", {
        date: formatLongDate(date, t.lang, calendar),
        time: formatKickoff(time, t.lang, clock),
      });
    },
    [t, clock, calendar],
  );
}
