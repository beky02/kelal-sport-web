"use client";

import { create } from "zustand";
import type { Lang } from "@/types/common";
import type { TerminalConfigView } from "../types";

/**
 * The language a customer tapped on the kiosk (F8ca), if any: client state,
 * never persisted — a kiosk keeps no preferences, and what one customer chose
 * is not the next one's (F8cc puts it back on idle). The first language is
 * worked out where it is needed (`kioskLanguage`), never copied here.
 */
interface KioskState {
  /** What the customer tapped, or null for the kiosk's first language. */
  chosen: Lang | null;
  choose: (lang: Lang) => void;
  /** Back to the kiosk's first language. */
  reset: () => void;
}

export const useKioskStore = create<KioskState>()((set) => ({
  chosen: null,
  choose: (chosen) => set({ chosen }),
  reset: () => set({ chosen: null }),
}));

/** The kiosk's first language, wherever the tenant offers it (the user's decision, F8ca rework 2). */
const FIRST: Lang = "en";

/**
 * The language the kiosk speaks: the customer's choice while the tenant still
 * offers it, else English if it does, else the tenant's default — and English
 * before there is a config (as F8b's screens and calls are). The one place
 * this rule lives: the screen and every call follow it.
 */
export function kioskLanguage(
  chosen: Lang | null,
  config: TerminalConfigView | null,
): Lang {
  if (!config) return chosen ?? FIRST;
  if (chosen && config.languages.includes(chosen)) return chosen;
  return config.languages.includes(FIRST) ? FIRST : config.defaultLanguage;
}
