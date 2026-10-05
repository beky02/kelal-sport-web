"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const REALITY_CHECK_STORAGE_KEY = "kelal.reality-check";

interface RealityCheckState {
  /** Whose visit this is: another player signing in starts a new one. */
  playerId: string | null;
  /** When this tab first showed that player signed in (epoch ms). */
  startedAt: number | null;
  /** When the last check was answered; null before the first. */
  answeredAt: number | null;
  /** When the check on screen came due, for the time it reports. */
  shownAt: number | null;
  /** Starts a visit for this player, unless theirs is already running. */
  begin: (playerId: string, now: number) => void;
  /** Nobody is signed in: the visit is over. */
  end: () => void;
  shown: (now: number) => void;
  answer: (now: number) => void;
}

const NO_VISIT = {
  playerId: null,
  startedAt: null,
  answeredAt: null,
  shownAt: null,
};

/**
 * The reality check's visit (F7b): when it started and when a check was last
 * answered. The browser's own clock until the API owns the play session
 * (contract request 012), so it lives in `sessionStorage`: a reload neither
 * restarts it nor skips a check that came due, and it ends with the tab. It
 * holds times only — never anything about money.
 */
export const useRealityCheckStore = create<RealityCheckState>()(
  persist(
    (set, get) => ({
      ...NO_VISIT,
      begin: (playerId, now) => {
        if (get().playerId === playerId) return;
        set({ ...NO_VISIT, playerId, startedAt: now });
      },
      end: () => {
        if (get().playerId !== null) set(NO_VISIT);
      },
      shown: (shownAt) => set({ shownAt }),
      answer: (answeredAt) => set({ answeredAt, shownAt: null }),
    }),
    {
      name: REALITY_CHECK_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      version: 1,
      partialize: ({ playerId, startedAt, answeredAt, shownAt }) => ({
        playerId,
        startedAt,
        answeredAt,
        shownAt,
      }),
    },
  ),
);
