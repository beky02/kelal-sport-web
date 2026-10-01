"use client";

import { create } from "zustand";

/**
 * Interruptions the product can show over the page.
 *
 * `age` and `maintenance` take the whole screen — there is nothing useful to do
 * behind them. `reality`, `session` and `limit` are dialogs over a page the user
 * can return to, and the bet slip survives all of them.
 */
export type OverlayKind =
  "age" | "maintenance" | "reality" | "session" | "limit";

interface SystemState {
  overlay: OverlayKind | null;
  /**
   * Whether the browser believes it has a connection. Written by a single
   * watcher in the shell — every odds button reads it, and a listener pair per
   * button would be waste.
   */
  online: boolean;
  show: (overlay: OverlayKind) => void;
  dismiss: () => void;
  setOnline: (online: boolean) => void;
}

export const useSystemStore = create<SystemState>()((set) => ({
  overlay: null,
  online: true,
  show: (overlay) => set({ overlay }),
  dismiss: () => set({ overlay: null }),
  setOnline: (online) => set({ online }),
}));

export const useIsOnline = (): boolean => useSystemStore((s) => s.online);
