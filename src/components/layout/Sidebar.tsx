"use client";

import { useBoardFilters } from "@/features/sportsbook/hooks/use-board-filters";
import { CountriesCard } from "./CountriesCard";
import { FavouritesCard } from "./FavouritesCard";
import { SportsCard } from "./SportsCard";
import { TopCompetitionsCard } from "./TopCompetitionsCard";

/** The navigation column: what to bet on, and the licence that permits it. */
export function Sidebar({ live }: { live: boolean }) {
  const { filters, set } = useBoardFilters();

  return (
    <div className="flex flex-col gap-3">
      <FavouritesCard live={live} />
      <TopCompetitionsCard />
      <SportsCard
        activeSlug={filters.sport}
        live={live}
        onSelect={(sport) => set({ sport })}
      />
      <CountriesCard />
    </div>
  );
}
