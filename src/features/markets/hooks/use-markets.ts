"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { marketKeys } from "@/lib/query/keys";
import { getMarkets } from "../api/get-markets";

export function useMarkets(eventId: string) {
  return useQuery({
    queryKey: marketKeys.byEvent(eventId),
    queryFn: ({ signal }) => getMarkets(eventId, signal),
    staleTime: STALE_TIME.eventDetail,
    enabled: eventId.length > 0,
  });
}
