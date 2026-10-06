"use client";

import { useBoard } from "@/features/events/hooks/use-board";
import { sportIdFromSlug } from "@/lib/api/mappers/catalogue";
import { useSportsbookChrome } from "../chrome";
import { useBoardFilters } from "./use-board-filters";

/**
 * The board query, derived from the URL and the user's preferences.
 *
 * Both the board and the sidebar's favourites need these fixtures. They each
 * call this rather than passing data down, which keeps them independent — and
 * because the arguments are derived the same way, they share one cache entry and
 * one request.
 */
export function useSportsbookBoard(live: boolean, competitionId?: string) {
  const { filters } = useBoardFilters();
  const dataSaver = useSportsbookChrome().useDataSaver();

  return useBoard(
    {
      sportId: sportIdFromSlug(filters.sport),
      competitionId,
      filter: filters.filter,
      date: filters.date,
      live: live || undefined,
    },
    dataSaver,
  );
}
