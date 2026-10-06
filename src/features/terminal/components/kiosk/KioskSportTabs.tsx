"use client";

import { SportIcon } from "@/components/ui/SportIcon";
import { useBoardFilters } from "@/features/sportsbook/hooks/use-board-filters";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import { useKioskSports } from "../../hooks/use-kiosk";

/**
 * Which sport the board shows (F8ca): in the URL, as on the player's board.
 * Tabs that couldn't be read say so, with Try again — and are read again by
 * themselves (`useKioskSports`).
 */
export function KioskSportTabs() {
  const t = useTranslation();
  const { filters, set } = useBoardFilters();
  const sports = useKioskSports();

  return (
    <nav aria-label={t.t("nav.sports")}>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {sports.data ? (
          sports.data.map((sport) => {
            const active = sport.slug === filters.sport;
            return (
              <button
                key={sport.id}
                type="button"
                aria-pressed={active}
                onClick={() => set({ sport: sport.slug })}
                className={cn(
                  "flex min-h-14 shrink-0 cursor-pointer items-center gap-2 rounded-md border px-5 text-base font-bold",
                  active
                    ? "bg-accent border-accent text-on-accent"
                    : "bg-surface border-border text-text hover:brightness-125",
                )}
              >
                <SportIcon paths={sport.iconPaths} size={22} />
                {t.pick(sport.name)}
              </button>
            );
          })
        ) : sports.isError ? (
          <div className="flex min-h-14 items-center gap-3">
            <span className="text-muted text-base">
              {t.t("terminal.kiosk.sportsFailed")}
            </span>
            <button
              type="button"
              onClick={() => void sports.refetch()}
              disabled={sports.isFetching}
              className="bg-raised border-divider text-text min-h-12 shrink-0 cursor-pointer rounded-md border px-4 text-base font-bold hover:brightness-125 disabled:cursor-wait disabled:opacity-60"
            >
              {t.t("common.retry")}
            </button>
          </div>
        ) : (
          Array.from({ length: 3 }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="bg-surface h-14 w-36 shrink-0 animate-pulse rounded-md"
            />
          ))
        )}
      </div>
    </nav>
  );
}
