"use client";

import { useQuery } from "@tanstack/react-query";
import { ODDS_REFRESH_MS, STALE_TIME } from "@/config/constants";
import { sportKeys } from "@/lib/query/keys";
import { getSports } from "../api/get-sports";

/**
 * The book's sports. A failed read is tried again every 30 s until it lands:
 * a shop kiosk is never reloaded, and without its sports it would be stuck on
 * one all day (F8ca review Q1); a player's tab is no worse for it.
 */
export function useSports() {
  return useQuery({
    queryKey: sportKeys.list(),
    queryFn: ({ signal }) => getSports(signal),
    staleTime: STALE_TIME.sports,
    refetchInterval: (query) =>
      query.state.status === "error" ? ODDS_REFRESH_MS : false,
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
