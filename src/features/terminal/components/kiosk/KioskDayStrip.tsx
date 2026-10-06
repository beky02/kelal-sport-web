"use client";

import { useBoardFilters } from "@/features/sportsbook/hooks/use-board-filters";
import { addDays, formatDayMonth, formatWeekday } from "@/lib/i18n/dates";
import { useLocale } from "@/lib/i18n/locale";
import { useTodayEat } from "@/lib/i18n/use-today-eat";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";

/** Today and the five days after it, as on the player's board. */
const DAYS = 6;

/**
 * Which day the board shows (F8ca), East Africa Time: in the URL. Outlined,
 * never filled — a solid fill on this screen means a price or the chosen
 * sport.
 */
export function KioskDayStrip() {
  const t = useTranslation();
  const { calendar } = useLocale();
  const { filters, set } = useBoardFilters();
  const today = useTodayEat();
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, i));

  return (
    <div
      role="group"
      aria-label={t.t("terminal.kiosk.days")}
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
    >
      {dates.map((date) => {
        const active = date === filters.date;
        return (
          <button
            key={date}
            type="button"
            aria-pressed={active}
            onClick={() => set({ date })}
            className={cn(
              "bg-surface flex min-h-14 min-w-24 shrink-0 cursor-pointer flex-col items-center justify-center rounded-md border-2 px-3",
              active
                ? "border-text text-text"
                : "border-border text-muted hover:text-text",
            )}
          >
            <span className="text-sm font-semibold">
              {date === today
                ? t.t("board.filters.today")
                : formatWeekday(date, t.lang)}
            </span>
            <span className="numeric text-base font-bold">
              {formatDayMonth(date, t.lang, calendar)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
