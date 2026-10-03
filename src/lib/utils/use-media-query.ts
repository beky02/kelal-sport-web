"use client";

import { useSyncExternalStore } from "react";

/**
 * The sportsbook's right-hand column (slip, My bets) shows from 1280 px; below
 * that it stays in the page, hidden by CSS, and the slip is a sheet.
 */
export const ASIDE_QUERY = "(min-width: 1280px)";

const subscribe = (query: string) => (onChange: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(query);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};

/**
 * Whether a media query matches, kept in step with the window. False on the
 * server and where `matchMedia` is missing, so nothing that waits on it runs
 * before the browser has said.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches,
    () => false,
  );
}
