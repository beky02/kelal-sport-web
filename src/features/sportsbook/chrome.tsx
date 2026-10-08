"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { ODDS_REFRESH_MS } from "@/config/constants";
import { env } from "@/config/env";
import { routes } from "@/config/routes";

/** What a sportsbook page's frame takes: the board's phone sub-header, and whether it is the live board. */
export interface SportsbookShellProps {
  live?: boolean;
  /** Full-bleed chrome under the app bar on a phone only (the sport tabs). */
  phoneSubheader?: React.ReactNode;
  children: React.ReactNode;
}

/** A favourite: whether it is pinned, and how to pin or unpin it. */
export type Pin = readonly [pinned: boolean, toggle: () => void];

/**
 * Where the sportsbook's pages and components meet the site they run on (F8ca).
 *
 * The board, the league and match pages, the sidebar's lists and the search
 * are the same on the player's site and the shop kiosk; what is around them is
 * not. The player has preferences (favourites, data saver, open countries), a
 * session that can lock prices (a break), a realtime channel and its own
 * frame. The kiosk has none of them, and must not load the code that does
 * (FD1, `scripts/check-host-split.mjs`). So each of those comes from here, and
 * each site provides its own.
 *
 * The value is static — hooks and components, never state — so providing it
 * re-renders nothing, and each hook subscribes exactly as narrowly as before:
 * one price moving or one favourite pinned still re-renders one button.
 */
export interface SportsbookChrome {
  /** The frame around a sportsbook page: header, sidebar, slip. */
  Shell: React.ComponentType<SportsbookShellProps>;
  /** The realtime topics a page wants while it is open (Release 2). */
  useRealtimeTopics: (topics: string[]) => void;
  /**
   * How often the board and a match's book read their prices again, or
   * `false` where the realtime channel delivers them (D5) — or where no one is
   * looking: an idle shop kiosk (F8cc, C18 §5).
   */
  usePricePollMs: () => number | false;
  /** Data saver: no crests or flags. */
  useDataSaver: () => boolean;
  /** Prices locked for a reason outside the market (offline, a break). */
  useOddsLocked: () => boolean;
  /** What a price tap does besides selecting it (show the slip). */
  useAfterPick: () => () => void;
  /** Pinning matches and competitions, where there are favourites. */
  favourites: {
    useEvent: (id: string) => Pin;
    useCompetition: (id: string) => Pin;
  } | null;
  /** Opens the leagues list where it is a drawer (a phone); null where there is none. */
  useOpenLeagues: () => (() => void) | null;
  /** Which countries are open in the sidebar's list. */
  useExpandedCountries: () => readonly [
    Record<string, boolean>,
    (code: string) => void,
  ];
  /** Where a page's links go on this site. */
  links: {
    home: string;
    event: (id: string) => string;
    competition: (id: string) => string;
  };
}

function Bare({ children }: SportsbookShellProps) {
  return <>{children}</>;
}

const noop = () => undefined;

/** Countries opened and closed in this screen's own state. */
function useLocalCountries() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = useCallback(
    (code: string) => setOpen((now) => ({ ...now, [code]: !now[code] })),
    [],
  );
  return [open, toggle] as const;
}

/** Poll for prices unless the realtime channel is delivering them (D5). */
export const POLL_UNLESS_REALTIME: number | false =
  env.realtime === "off" ? ODDS_REFRESH_MS : false;

/**
 * Nothing around the content, nothing locked, no favourites, the player's
 * addresses: the base a site's chrome builds on (the kiosk's spreads it). Never
 * a default — a page with no site's chrome above it is an error, not an
 * unlocked board (review Q3).
 */
export const BARE_CHROME: SportsbookChrome = {
  Shell: Bare,
  useRealtimeTopics: noop,
  usePricePollMs: () => POLL_UNLESS_REALTIME,
  useDataSaver: () => false,
  useOddsLocked: () => false,
  useAfterPick: () => noop,
  favourites: null,
  useOpenLeagues: () => null,
  useExpandedCountries: useLocalCountries,
  links: {
    home: routes.home,
    event: routes.event,
    competition: routes.competition,
  },
};

const ChromeContext = createContext<SportsbookChrome | null>(null);

/** Provided once per site, with a value made once (a module constant). */
export const SportsbookChromeProvider = ChromeContext.Provider;

/**
 * The site's chrome. Without one above it, this throws: falling back to a
 * bare one would quietly drop the player's price lock (a break, offline),
 * which is safety state (review Q3).
 */
export function useSportsbookChrome(): SportsbookChrome {
  const chrome = useContext(ChromeContext);
  if (!chrome) {
    throw new Error(
      "No SportsbookChrome above this component: mount the site's (PlayerSportsbookChrome, or the kiosk's)",
    );
  }
  return chrome;
}
