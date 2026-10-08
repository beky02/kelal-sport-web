"use client";

import { create } from "zustand";
import type { Lang } from "@/types/common";
import type { SlipCodeReceipt, TerminalConfigView } from "../types";

/**
 * A slip asked to be a code (F8cc): its `Idempotency-Key`, made the first time
 * and sent again on every retry, and — once the API answers — its code.
 */
export interface SlipCodeIntent {
  key: string;
  receipt: SlipCodeReceipt | null;
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
 * - each slip's Book bet, by the slip's request: its `Idempotency-Key`,
 *   reused on a retry of the same slip, and its code once made — so Booked
 *   opens the same code again, as the player's Book bet does;
 * - when Book bet may go again after the terminal's limit (a 429): the
 *   terminal's, so it outlasts a start over.
 */
interface KioskState {
  /** What the customer tapped, or null for the kiosk's first language. */
  chosen: Lang | null;
  choose: (lang: Lang) => void;

  idle: boolean;
  setIdle: (idle: boolean) => void;
  round: number;

  /** Each slip's Book bet, by its request's signature. */
  codes: Record<string, SlipCodeIntent>;
  /** A new Book bet of the slip with this signature, with its key. */
  askCode: (signature: string, key: string) => void;
  /** The API made a code: to the slip whose Book bet had this key. */
  codeReceived: (key: string, receipt: SlipCodeReceipt) => void;
  /** This PC's clock when Book bet may go again, or null. */
  codesPausedUntil: number | null;
  pauseCodes: (until: number | null) => void;

  /**
   * The kiosk's part of starting over for the next customer: its first
   * language, no slip's code, a new round of the page, and `idle` as said.
   * The wait after a 429 stays: it is the terminal's.
   */
  startOver: (idle: boolean) => void;
}

export const useKioskStore = create<KioskState>()((set) => ({
  chosen: null,
  choose: (chosen) => set({ chosen }),

  idle: false,
  setIdle: (idle) => set({ idle }),
  round: 0,

  codes: {},
  askCode: (signature, key) =>
    set((state) => ({
      codes: { ...state.codes, [signature]: { key, receipt: null } },
    })),
  codeReceived: (key, receipt) =>
    set((state) => {
      const signature = Object.keys(state.codes).find(
        (s) => state.codes[s].key === key,
      );
      return signature
        ? { codes: { ...state.codes, [signature]: { key, receipt } } }
        : {};
    }),
  codesPausedUntil: null,
  pauseCodes: (codesPausedUntil) => set({ codesPausedUntil }),

  startOver: (idle) =>
    set((state) => ({
      chosen: null,
      idle,
      round: state.round + 1,
      codes: {},
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
