"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { SportTabs } from "@/features/sports/components/SportTabs";
import { useSports } from "@/features/sports/hooks/use-sports";
import { useRealtimeTopics } from "@/lib/websocket/RealtimeProvider";
import { topics } from "@/lib/websocket/messages";
import { Board } from "./Board";
import { BoardHeader } from "./BoardHeader";
import { DateStrip } from "./DateStrip";
import { useBoardFilters } from "../hooks/use-board-filters";

/**
 * The sportsbook page.
 *
 * Composition only: the heading, the day picker, the board. Each piece fetches
 * or derives what it needs, so this file stays readable as the page grows.
 */
export function SportsbookView({ live = false }: { live?: boolean }) {
  const t = useTranslation();
  const { filters, set } = useBoardFilters();
  const { data: sports } = useSports();

  const sportId = filters.sport === "football" ? "soccer" : filters.sport;
  useRealtimeTopics([live ? topics.live(sportId) : topics.sport(sportId)]);

  const sport = sports?.find((s) => s.slug === filters.sport);
  const title = live
    ? t.t("board.liveNow")
    : sport
      ? t.pick(sport.name)
      : t.t("sidebar.sports");

  return (
    <SportsbookShell
      live={live}
      phoneSubheader={
        <SportTabs
          activeSlug={filters.sport}
          live={live}
          onSelect={(sport) => set({ sport })}
        />
      }
    >
      <BoardHeader
        title={title}
        live={live}
        filter={filters.filter}
        onFilterChange={(filter) => set({ filter })}
      />
      {!live && (
        <DateStrip value={filters.date} onChange={(date) => set({ date })} />
      )}
      <Board live={live} />
    </SportsbookShell>
  );
}
