"use client";

import { useCallback } from "react";
import { SportsbookShell } from "@/components/layout/SportsbookShell";
import { routes } from "@/config/routes";
import {
  POLL_UNLESS_REALTIME,
  SportsbookChromeProvider,
  type Pin,
  type SportsbookChrome,
} from "@/features/sportsbook/chrome";
import { useOddsLocked } from "@/features/system/hooks/use-odds-locked";
import { useRealtimeTopics } from "@/lib/websocket/RealtimeProvider";
import { useUiStore } from "@/stores/ui.store";

function useFavouriteEvent(id: string): Pin {
  const pinned = useUiStore((s) => s.favouriteEvents[id] === true);
  const toggle = useUiStore((s) => s.toggleFavouriteEvent);
  return [pinned, useCallback(() => toggle(id), [toggle, id])];
}

function useFavouriteCompetition(id: string): Pin {
  const pinned = useUiStore((s) => s.favouriteCompetitions[id] === true);
  const toggle = useUiStore((s) => s.toggleFavouriteCompetition);
  return [pinned, useCallback(() => toggle(id), [toggle, id])];
}

function useShowSlip(): () => void {
  const show = useUiStore((s) => s.setAsidePanel);
  return useCallback(() => show("slip"), [show]);
}

function useOpenLeagues(): () => void {
  const open = useUiStore((s) => s.setSidebarOpen);
  return useCallback(() => open(true), [open]);
}

function useExpandedCountries() {
  const expanded = useUiStore((s) => s.expandedCountries);
  const toggle = useUiStore((s) => s.toggleCountry);
  return [expanded, toggle] as const;
}

/**
 * The player's site around the sportsbook (`features/sportsbook/chrome.tsx`):
 * its frame, its realtime channel, and the preferences and session the
 * player's store and `/api/me` hold — as every component read them before.
 */
const PLAYER_CHROME: SportsbookChrome = {
  Shell: SportsbookShell,
  useRealtimeTopics,
  pricePollMs: POLL_UNLESS_REALTIME,
  useDataSaver: () => useUiStore((s) => s.dataSaver),
  useOddsLocked,
  useAfterPick: useShowSlip,
  favourites: {
    useEvent: useFavouriteEvent,
    useCompetition: useFavouriteCompetition,
  },
  useOpenLeagues,
  useExpandedCountries,
  links: {
    home: routes.home,
    event: routes.event,
    competition: routes.competition,
  },
};

/** Mounted by the player's providers, and by `tests/component/render.tsx`. */
export function PlayerSportsbookChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SportsbookChromeProvider value={PLAYER_CHROME}>
      {children}
    </SportsbookChromeProvider>
  );
}
