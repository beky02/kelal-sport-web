"use client";

import { create } from "zustand";
import type { DepositRequest } from "../types";

/** One deposit intent: what was asked, its `Idempotency-Key`, and for whom. */
export interface DepositAttempt {
  request: DepositRequest;
  key: string;
  owner: string;
}

/**
 * The player's deposits as this page knows them, kept outside the deposit
 * flow — which unmounts whenever the player leaves it (Cancel, Back, another
 * page) — because what they say must outlive it:
 *
 * - a deposit on its way has one attempt at a time, wherever it was started;
 * - one that had no answer keeps its key, so confirming the same method and
 *   amount again is Try again, never a second deposit;
 * - one that started while no flow was on screen is shown when the player
 *   comes back to Deposit, instead of their starting another;
 * - one that started and isn't finished is still followed after its screen
 *   closes, so the balance moves when the API says it arrived.
 *
 * Memory only, like the slip's placement: a reload starts afresh (the
 * provider's return finds its deposit through `provider-redirect.ts`). The
 * player's alone: everything here is for `owner`, and is nothing to anyone
 * else signed in on the same phone.
 */
export interface DepositIntents {
  /** Whose these are; null before anyone has deposited on this page. */
  owner: string | null;
  /** On its way. */
  sending: DepositAttempt | null;
  /**
   * Sent and never answered in a way that settles it — no response, a 5xx,
   * a rate limit, a refused Try again. It may exist, so it stays until a
   * deposit comes back for its key, or the player chooses another method or
   * amount.
   */
  unanswered: DepositAttempt | null;
  /** Started while no flow was there to show it: shown when the player comes back. */
  unseen: string | null;
  /** Started and not finished: read until the API decides. */
  following: readonly string[];
}

const NOBODY: DepositIntents = {
  owner: null,
  sending: null,
  unanswered: null,
  unseen: null,
  following: [],
};

/** The deposits if they are this player's; nothing for anyone else or a guest. */
export const ownIntents = (
  intents: DepositIntents,
  player: string | null,
): DepositIntents =>
  player !== null && intents.owner === player ? intents : NOBODY;

interface DepositStore {
  intents: DepositIntents;
  /**
   * An attempt goes. False — and nothing goes — while another of this
   * player's is on its way. A different method or amount than the unanswered
   * one is another intent: the unanswered one is let go.
   */
  sent: (attempt: DepositAttempt) => boolean;
  /** The API started a deposit for `key`; followed while it isn't final. */
  started: (key: string, id: string, follow: boolean) => void;
  /** No answer settled `key`: it may exist. */
  unanswered: (key: string) => void;
  /**
   * The API refused `key`. A first try is over; a Try again's refusal says
   * nothing about the first try, which stays unanswered.
   */
  refused: (key: string, retried: boolean) => void;
  /** Nothing went for `key` (no session, or someone else signed in). */
  dropped: (key: string) => void;
  /** Follows a deposit found another way (the provider's return). */
  follow: (owner: string, id: string) => void;
  /** The player has seen the deposit that started while they were away. */
  seen: (id: string) => void;
  /** The API decided: nothing more to read. */
  finished: (id: string) => void;
}

export const useDepositStore = create<DepositStore>()((set, get) => {
  /** Applies `change` when `key` is the attempt on its way. */
  const answer = (
    key: string,
    change: (intents: DepositIntents) => Partial<DepositIntents>,
  ) => {
    const { intents } = get();
    if (intents.sending?.key !== key) return;
    set({ intents: { ...intents, sending: null, ...change(intents) } });
  };

  return {
    intents: NOBODY,

    sent: (attempt) => {
      const mine = ownIntents(get().intents, attempt.owner);
      if (mine.sending) return false;
      const base =
        mine.owner === null ? { ...NOBODY, owner: attempt.owner } : mine;
      set({
        intents: {
          ...base,
          sending: attempt,
          unanswered:
            base.unanswered?.key === attempt.key ? base.unanswered : null,
        },
      });
      return true;
    },

    started: (key, id, follow) =>
      answer(key, (intents) => ({
        unanswered: intents.unanswered?.key === key ? null : intents.unanswered,
        unseen: id,
        following:
          follow && !intents.following.includes(id)
            ? [...intents.following, id]
            : intents.following,
      })),

    unanswered: (key) =>
      answer(key, (intents) => ({ unanswered: intents.sending })),

    refused: (key, retried) =>
      answer(key, (intents) => ({
        unanswered:
          !retried && intents.unanswered?.key === key
            ? null
            : intents.unanswered,
      })),

    dropped: (key) => answer(key, () => ({})),

    follow: (owner, id) => {
      const { intents } = get();
      const base = intents.owner === owner ? intents : { ...NOBODY, owner };
      if (base === intents && intents.following.includes(id)) return;
      set({
        intents: {
          ...base,
          following: base.following.includes(id)
            ? base.following
            : [...base.following, id],
        },
      });
    },

    seen: (id) => {
      const { intents } = get();
      if (intents.unseen === id) set({ intents: { ...intents, unseen: null } });
    },

    finished: (id) => {
      const { intents } = get();
      if (!intents.following.includes(id)) return;
      set({
        intents: {
          ...intents,
          following: intents.following.filter((other) => other !== id),
        },
      });
    },
  };
});

/** A fresh page's store, for tests. */
export const resetDepositStore = (): void =>
  useDepositStore.setState({ intents: NOBODY });
