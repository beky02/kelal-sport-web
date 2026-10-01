"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { eventKeys } from "@/lib/query/keys";
import { getBoard, getEvent, type EventFilters } from "../api/get-board";

export function useBoard(filters: EventFilters, dataSaver: boolean) {
  return useQuery({
    queryKey: eventKeys.board(filters, dataSaver),
    queryFn: ({ signal }) => getBoard(filters, dataSaver, signal),
    // Short, because kickoff times and scores move. Prices themselves are
    // patched into this cache by the realtime channel, not refetched.
    staleTime: STALE_TIME.events,
  });
}

export function useEvent(id: string, dataSaver: boolean) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: ({ signal }) => getEvent(id, dataSaver, signal),
    staleTime: STALE_TIME.eventDetail,
    enabled: id.length > 0,
  });
}
