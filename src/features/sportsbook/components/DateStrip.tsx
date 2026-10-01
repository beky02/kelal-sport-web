"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import {
  addDays,
  formatDayMonth,
  formatWeekday,
  todayEat,
} from "@/lib/i18n/dates";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils/cn";

/** Today and the five days after it — the pre-match window worth browsing. */
const DAYS = 6;

/**
 * The day picker.
 *
 * Outlined, never filled: on this board a solid fill means a price, so the
 * active day is marked by a brighter border instead.
 */
export function DateStrip({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const t = useTranslation();
  const calendar = useUiStore((s) => s.calendar);
  const today = todayEat();
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(today, i));

  return (
    <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 md:mx-0 md:px-0">
      {dates.map((date) => {
        const weekday =
          date === today
            ? t.t("board.filters.today")
            : formatWeekday(date, t.lang);
        const day = formatDayMonth(date, t.lang, calendar);
        const active = date === value;

        return (
          <button
            key={date}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(date)}
            className={cn(
              "bg-surface font-body flex h-10 min-w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-md border px-2.5 leading-[1.2]",
              active
                ? "border-text text-text"
                : "border-border text-muted hover:text-text",
            )}
          >
            <span className="text-[10px] font-semibold opacity-80">
              {weekday}
            </span>
            <span className="text-xs font-bold">{day}</span>
          </button>
        );
      })}
    </div>
  );
}
