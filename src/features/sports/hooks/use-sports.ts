"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { sportKeys } from "@/lib/query/keys";
import { getSports } from "../api/get-sports";

export function useSports() {
  return useQuery({
    queryKey: sportKeys.list(),
    queryFn: ({ signal }) => getSports(signal),
    staleTime: STALE_TIME.sports,
  });
}

/**
 * Everything in play across the book — the number on the Live link.
 *
 * The book's own count, summed, not a guess; shared so the desktop nav and the
 * phone tab bar cannot disagree.
 */
export function useLiveEventCount(): number {
  const { data: sports } = useSports();
  return sports?.reduce((total, s) => total + s.liveCount, 0) ?? 0;
}
