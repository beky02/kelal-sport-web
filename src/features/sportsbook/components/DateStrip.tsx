"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { DATES } from "@/lib/api/mock/fixtures";
import { cn } from "@/lib/utils/cn";

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

  return (
    <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 md:mx-0 md:px-0">
      {DATES.map((date) => {
        const [weekday, day] = date.label[t.lang];
        const active = date.iso === value;

        return (
          <button
            key={date.iso}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(date.iso)}
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
