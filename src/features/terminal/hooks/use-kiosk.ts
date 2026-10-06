"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ODDS_REFRESH_MS, STALE_TIME } from "@/config/constants";
import { ApiError } from "@/lib/api/errors";
import { terminalKeys } from "@/lib/query/keys";
import { getKioskBoard, getKioskSports, getTerminalConfig } from "../api/kiosk";
import { STATUS_INTERVAL_MS } from "../lib/calls";
import type { KioskBoardFilters } from "../types";

/**
 * A kiosk read refused because this PC is no longer an activated terminal
 * (our route's 401): the status is read again, and says what it is now —
 * lapsed, switched off — so the kiosk never sits on a refusal it can't fix.
 */
function useStatusOnRefusal(error: Error | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      void queryClient.invalidateQueries({ queryKey: terminalKeys.status() });
    }
  }, [error, queryClient]);
}

/**
 * The tenant's shop switch and languages. Read again as often as the status
 * while shop betting is on, so switching it off reaches the kiosk as a
 * revocation does; every minute while it is off (the config's own cache), so
 * the kiosk comes back by itself.
 */
export function useTerminalConfig() {
  const query = useQuery({
    queryKey: terminalKeys.config(),
    queryFn: ({ signal }) => getTerminalConfig(signal),
    staleTime: STALE_TIME.config,
    refetchInterval: (current) =>
      current.state.data?.retail === false
        ? STALE_TIME.config
        : STATUS_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
  useStatusOnRefusal(query.error);
  return query;
}

/** The sport tabs. */
export function useKioskSports() {
  const query = useQuery({
    queryKey: terminalKeys.sports(),
    queryFn: ({ signal }) => getKioskSports(signal),
    staleTime: STALE_TIME.sports,
  });
  useStatusOnRefusal(query.error);
  return query;
}

/** The board for a sport and a day; prices polled as on the player's (D5). */
export function useKioskBoard(filters: KioskBoardFilters) {
  const query = useQuery({
    queryKey: terminalKeys.board(filters),
    queryFn: ({ signal }) => getKioskBoard(filters, signal),
    staleTime: STALE_TIME.events,
    refetchInterval: ODDS_REFRESH_MS,
  });
  useStatusOnRefusal(query.error);
  return query;
}
