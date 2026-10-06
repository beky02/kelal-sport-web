"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { useSportsbookChrome } from "@/features/sportsbook/chrome";
import { eventKeys } from "@/lib/query/keys";
import type { EventFilters } from "@/features/events/types";
import { getBoard, getEvent } from "../api/get-board";

/**
 * The board. Its prices are read again as the site says (`pricePollMs`): on
 * the player's, unless the realtime channel delivers them; on the shop kiosk,
 * always (F8ca review M1).
 */
export function useBoard(filters: EventFilters, dataSaver: boolean) {
  const refetchInterval = useSportsbookChrome().pricePollMs;
  return useQuery({
    queryKey: eventKeys.board(filters, dataSaver),
    queryFn: ({ signal }) => getBoard(filters, dataSaver, signal),
    staleTime: STALE_TIME.events,
    refetchInterval,
  });
}

/** One request carries the fixture and its whole book. */
export function useEvent(id: string, dataSaver: boolean) {
  const refetchInterval = useSportsbookChrome().pricePollMs;
  return useQuery({
    queryKey: eventKeys.detail(id, dataSaver),
    queryFn: ({ signal }) => getEvent(id, dataSaver, signal),
    staleTime: STALE_TIME.eventDetail,
    refetchInterval,
    enabled: id.length > 0,
  });
}
