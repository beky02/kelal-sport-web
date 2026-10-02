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
   * The player asked to log out, so the guest state that follows is theirs:
   * `SessionWatcher` says nothing. A guest state without this flag means the
   * API stopped honouring the session, which is worth a word.
   */
  loggedOut: boolean;
  /**
   * Whether the browser believes it has a connection. Written by a single
   * watcher in the shell — every odds button reads it, and a listener pair per
   * button would be waste.
   */
  online: boolean;
  show: (overlay: OverlayKind) => void;
  dismiss: () => void;
  setOnline: (online: boolean) => void;
  noteLogout: () => void;
  clearLoggedOut: () => void;
}

export const useSystemStore = create<SystemState>()((set) => ({
  overlay: null,
  loggedOut: false,
  online: true,
  show: (overlay) => set({ overlay }),
  dismiss: () => set({ overlay: null }),
  setOnline: (online) => set({ online }),
  noteLogout: () => set({ loggedOut: true }),
  clearLoggedOut: () => set({ loggedOut: false }),
}));

export const useIsOnline = (): boolean => useSystemStore((s) => s.online);
