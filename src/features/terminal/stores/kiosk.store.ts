"use client";

import { create } from "zustand";
import type { Lang } from "@/types/common";
import type { SlipCodeReceipt, TerminalConfigView } from "../types";

/** A slip code on screen (F8cc): what the API made, from which slip, and when it arrived. */
export interface ShownCode {
  receipt: SlipCodeReceipt;
  /** The slip it was made from: 0, 1 or 2. */
  slip: number;
  /** This PC's clock when it arrived: the screen is timed from then. */
  at: number;
}

/**
 * The kiosk's client state (F8ca, F8cc), never persisted — a kiosk keeps no
 * preferences, and what one customer did is not the next one's:
 *
 * - the language a customer tapped, if any — the first language is worked
 *   out where it is needed (`kioskLanguage`), never copied here;
 * - whether the kiosk is idle (no touch for its idle time), when prices
 *   aren't polled (C18 §5);
 * - the page's `round`: a new one re-makes every part of the page, so
 *   nothing a customer typed or opened outlasts them (`startOver`);
 * - Get code's intent — the request and its `Idempotency-Key`, reused on a
 *   retry of the same slip — and the code on screen;
 * - when Get code may go again after the terminal's limit (a 429): the
 *   terminal's, so it outlasts a start over.
 */
interface KioskState {
  /** What the customer tapped, or null for the kiosk's first language. */
  chosen: Lang | null;
  choose: (lang: Lang) => void;
  /** Back to the kiosk's first language. */
  reset: () => void;

  idle: boolean;
  setIdle: (idle: boolean) => void;
  round: number;

  codeIntent: { signature: string; key: string } | null;
  setCodeIntent: (intent: { signature: string; key: string } | null) => void;
  shownCode: ShownCode | null;
  showCode: (shown: ShownCode) => void;
  closeCode: () => void;
  /** This PC's clock when Get code may go again, or null. */
  codesPausedUntil: number | null;
  pauseCodes: (until: number | null) => void;

  /**
   * The kiosk's part of starting over for the next customer: its first
   * language, no intent and no code on screen, a new round of the page, and
   * `idle` as said. The wait after a 429 stays: it is the terminal's.
   */
  startOver: (idle: boolean) => void;
}

export const useKioskStore = create<KioskState>()((set) => ({
  chosen: null,
  choose: (chosen) => set({ chosen }),
  reset: () => set({ chosen: null }),

  idle: false,
  setIdle: (idle) => set({ idle }),
  round: 0,

  codeIntent: null,
  setCodeIntent: (codeIntent) => set({ codeIntent }),
  shownCode: null,
  showCode: (shownCode) => set({ shownCode }),
  closeCode: () => set({ shownCode: null }),
  codesPausedUntil: null,
  pauseCodes: (codesPausedUntil) => set({ codesPausedUntil }),

  startOver: (idle) =>
    set((state) => ({
      chosen: null,
      idle,
      round: state.round + 1,
      codeIntent: null,
      shownCode: null,
    })),
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
