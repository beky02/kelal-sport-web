"use client";

import { useTranslation } from "@/lib/i18n/use-translation";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { Board } from "@/features/sportsbook/components/Board";
import { BoardHeader } from "@/features/sportsbook/components/BoardHeader";
import { useBoardFilters } from "@/features/sportsbook/hooks/use-board-filters";
import { useSportsbookBoard } from "@/features/sportsbook/hooks/use-sportsbook-board";

/** One competition's fixtures, on their own page. */
export function CompetitionView({ competitionId }: { competitionId: string }) {
  const t = useTranslation();
  const { filters, set } = useBoardFilters();
  const { data } = useSportsbookBoard(false, competitionId);

  const competition = data?.[0]?.competition;
  const title = competition
    ? `${t.pick(competition.region.name)} · ${t.pick(competition.name)}`
    : t.t("sidebar.topCompetitions");

  return (
    <SportsbookShell>
      <BoardHeader
        title={title}
        live={false}
        filter={filters.filter}
        onFilterChange={(filter) => set({ filter })}
      />
      <Board live={false} competitionId={competitionId} />
    </SportsbookShell>
  );
}
