"use client";

import { create } from "zustand";
import { newIdempotencyKey } from "@/lib/idempotency";

/**
 * One promo-code intent: a code, for one player, with its `Idempotency-Key`.
 * `sending` while a try is on its way; `unanswered` once it had no answer —
 * it may have gone through, so the same code goes again with the same key.
 */
export interface PromoIntent {
  owner: string;
  code: string;
  key: string;
  state: "sending" | "unanswered";
}

/** A try to send: the intent's code and key, and whether it repeats one with no answer. */
export interface PromoTry {
  code: string;
  key: string;
  owner: string;
  again: boolean;
}

interface PromoState {
  /** The open intent, or null when every try has been answered. */
  intent: PromoIntent | null;
  /**
   * A try of `code` for `owner`: the open intent's key when it is this very
   * code, for this player, with no answer (Try again); otherwise a new intent
   * with a new key. Null while a try is on its way — one at a time, however
   * quickly Redeem is pressed.
   */
  send: (owner: string, code: string) => PromoTry | null;
  /** The try with `key` had no answer: its intent stays open. */
  unanswered: (key: string) => void;
  /** The try with `key` was answered — granted or refused — or dropped: its intent ends. */
  answered: (key: string) => void;
}

/**
 * The open promo-code intent, kept outside the form — which unmounts when the
 * player leaves the page — so a code with no answer is still Try again when
 * they come back. Memory only: a reload starts afresh, and the API's
 * one-per-player rule (C11 §4) answers a code sent again under a new key.
 */
export const usePromoStore = create<PromoState>()((set, get) => ({
  intent: null,
  send: (owner, code) => {
    const open = get().intent;
    if (open?.state === "sending") return null;
    const again =
      open !== null &&
      open.state === "unanswered" &&
      open.owner === owner &&
      open.code === code;
    const key = again ? open.key : newIdempotencyKey();
    set({ intent: { owner, code, key, state: "sending" } });
    return { owner, code, key, again };
  },
  unanswered: (key) =>
    set((s) =>
      s.intent?.key === key
        ? { intent: { ...s.intent, state: "unanswered" } }
        : s,
    ),
  answered: (key) => set((s) => (s.intent?.key === key ? { intent: null } : s)),
}));
