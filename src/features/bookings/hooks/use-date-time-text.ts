"use client";

import { useCallback } from "react";
import { formatShortDate, toEat } from "@/lib/i18n/dates";
import { formatKickoff } from "@/lib/i18n/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUiStore } from "@/stores/ui.store";

/** A kickoff as a board row shows it: `04/10 · 17:00`, East Africa Time (D7). */
export function useDateTimeText(): (iso: string) => string {
  const t = useTranslation();
  const clock = useUiStore((s) => s.clock);
  const calendar = useUiStore((s) => s.calendar);
  return useCallback(
    (iso: string) => {
      const { date, time } = toEat(iso);
      return `${formatShortDate(date, calendar)} · ${formatKickoff(time, t.lang, clock)}`;
    },
    [t, clock, calendar],
  );
}
