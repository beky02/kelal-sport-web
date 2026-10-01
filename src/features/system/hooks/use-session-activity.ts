"use client";

import { useQuery } from "@tanstack/react-query";
import { getSessionActivity } from "../api/get-session-activity";

/** Read fresh each time the reality check opens — a stale total is worse than none. */
export function useSessionActivity(enabled: boolean) {
  return useQuery({
    queryKey: ["session-activity"],
    queryFn: ({ signal }) => getSessionActivity(signal),
    enabled,
    staleTime: 0,
  });
}
