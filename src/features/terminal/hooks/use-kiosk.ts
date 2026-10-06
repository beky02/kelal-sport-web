"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ODDS_REFRESH_MS, STALE_TIME } from "@/config/constants";
import { ApiError } from "@/lib/api/errors";
import { useLocale } from "@/lib/i18n/locale";
import { terminalKeys } from "@/lib/query/keys";
import { getKioskBoard, getKioskSports, getTerminalConfig } from "../api/kiosk";
import { STATUS_INTERVAL_MS } from "../lib/calls";
import { kioskLanguage, useKioskStore } from "../stores/kiosk.store";
import type { KioskBoardFilters, TerminalConfigView } from "../types";

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
 * The kiosk's reads ask in its language (`Accept-Language`, for Problem
 * titles), read when they are made; it is not in their keys, because what
 * they return — names in both languages — doesn't depend on it.
 */

/**
 * The tenant's shop switch and languages. Read again as often as the status
 * while shop betting is on, so switching it off reaches the kiosk as a
 * revocation does; every minute while it is off (the config's own cache), so
 * the kiosk comes back by itself.
 */
export function useTerminalConfig() {
  // Read above the kiosk's locale, which needs this config: the language is
  // worked out from the choice and the config already held.
  const queryClient = useQueryClient();
  const chosen = useKioskStore((s) => s.chosen);
  const query = useQuery({
    queryKey: terminalKeys.config(),
    queryFn: ({ signal }) =>
      getTerminalConfig(
        kioskLanguage(
          chosen,
          queryClient.getQueryData<TerminalConfigView>(terminalKeys.config()) ??
            null,
        ),
        signal,
      ),
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

/**
 * The sport tabs. A failed read is tried again every 30 s, as well as on a
 * tap: a kiosk is never reloaded, and without its tabs it would be stuck on
 * one sport all day (review Q1).
 */
export function useKioskSports() {
  const { lang } = useLocale();
  const query = useQuery({
    queryKey: terminalKeys.sports(),
    queryFn: ({ signal }) => getKioskSports(lang, signal),
    staleTime: STALE_TIME.sports,
    refetchInterval: (current) =>
      current.state.status === "error" ? ODDS_REFRESH_MS : false,
  });
  useStatusOnRefusal(query.error);
  return query;
}

/** The board for a sport and a day; prices polled as on the player's (D5). */
export function useKioskBoard(filters: KioskBoardFilters) {
  const { lang } = useLocale();
  const query = useQuery({
    queryKey: terminalKeys.board(filters),
    queryFn: ({ signal }) => getKioskBoard(filters, lang, signal),
    staleTime: STALE_TIME.events,
    refetchInterval: ODDS_REFRESH_MS,
  });
  useStatusOnRefusal(query.error);
  return query;
}
