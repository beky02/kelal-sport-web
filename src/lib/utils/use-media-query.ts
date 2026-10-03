"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The sportsbook's right-hand column (slip, My bets) shows from 1280 px; below
 * that it stays in the page, hidden by CSS, and the slip is a sheet.
 */
export const ASIDE_QUERY = "(min-width: 1280px)";

/**
 * Whether a media query matches, kept in step with the window. False on the
 * server and where `matchMedia` is missing, so nothing that waits on it runs
 * before the browser has said.
 */
export function useMediaQuery(query: string): boolean {
  // The same function while the query is the same, so the listener isn't
  // taken off and put back on every render.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches,
    () => false,
  );
}
