"use client";

import { useQuery } from "@tanstack/react-query";
import { ODDS_REFRESH_MS, STALE_TIME } from "@/config/constants";
import { env } from "@/config/env";
import { eventKeys } from "@/lib/query/keys";
import type { EventFilters } from "@/features/events/types";
import { getBoard, getEvent } from "../api/get-board";

/** Poll for prices unless the realtime channel is delivering them. */
const refetchInterval = env.realtime === "off" ? ODDS_REFRESH_MS : false;

export function useBoard(filters: EventFilters, dataSaver: boolean) {
  return useQuery({
    queryKey: eventKeys.board(filters, dataSaver),
    queryFn: ({ signal }) => getBoard(filters, dataSaver, signal),
    staleTime: STALE_TIME.events,
    refetchInterval,
  });
}

/** One request carries the fixture and its whole book. */
export function useEvent(id: string, dataSaver: boolean) {
  return useQuery({
    queryKey: eventKeys.detail(id, dataSaver),
    queryFn: ({ signal }) => getEvent(id, dataSaver, signal),
    staleTime: STALE_TIME.eventDetail,
    refetchInterval,
    enabled: id.length > 0,
  });
}
