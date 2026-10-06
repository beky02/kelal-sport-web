"use client";

import { useEvent } from "@/features/events/hooks/use-board";
import { useSportsbookChrome } from "@/features/sportsbook/chrome";

/**
 * A fixture's markets and the groups they fall into.
 *
 * Read from the same query as the event header — `/v1/events/{id}` returns
 * both — so the page makes one request, not two.
 */
export function useMarkets(eventId: string) {
  const dataSaver = useSportsbookChrome().useDataSaver();
  const query = useEvent(eventId, dataSaver);
  return {
    ...query,
    data: query.data?.markets,
    groups: query.data?.groups ?? [],
  };
}
