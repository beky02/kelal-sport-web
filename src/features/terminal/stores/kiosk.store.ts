"use client";

import { create } from "zustand";
import type { Lang } from "@/types/common";

/**
 * The kiosk's language (F8ca): the customer's choice, else the tenant's
 * default (FD2). Never persisted: a kiosk keeps no preferences, and what one
 * customer chose is not the next one's (F8cc puts it back on idle).
 *
 * The default arrives with the config; until then — and on the screens shown
 * before it (activation, closed, offline) — it is Amharic, `demo`'s default,
 * as F8b's calls went out.
 */
interface KioskState {
  /** What the customer tapped, or null for the tenant's default. */
  chosen: Lang | null;
  /** The tenant's `default_language`, once the config has said it. */
  fallback: Lang;
  choose: (lang: Lang) => void;
  setFallback: (lang: Lang) => void;
  /** Back to the tenant's default. */
  reset: () => void;
}

export const useKioskStore = create<KioskState>()((set) => ({
  chosen: null,
  fallback: "am",
  choose: (chosen) => set({ chosen }),
  setFallback: (fallback) => set({ fallback }),
  reset: () => set({ chosen: null }),
}));

/** The language the kiosk speaks now: chosen, else the tenant's default. */
export const selectKioskLanguage = (state: KioskState): Lang =>
  state.chosen ?? state.fallback;

/** The same, outside React: what the terminal's calls ask in. */
export const kioskLanguage = (): Lang =>
  selectKioskLanguage(useKioskStore.getState());
