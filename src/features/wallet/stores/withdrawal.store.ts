"use client";

import { create } from "zustand";
import type { WithdrawalRequest } from "../types";

/** One withdrawal intent: what was asked, its `Idempotency-Key`, and for whom. */
export interface WithdrawalAttempt {
  request: WithdrawalRequest;
  key: string;
  owner: string;
  /**
   * The account as the confirm step showed it — masked as the API gave it, or
   * the new number in full — so the step can show it again on Try again.
   */
  accountLabel: string;
}

/**
 * The player's withdrawal intents as this page knows them, kept outside the
 * withdraw flow — which unmounts whenever the player leaves it (Cancel, Back,
 * another page) — because what they say must outlive it (as
 * `deposit.store.ts`):
 *
 * - a withdrawal on its way has one attempt at a time, wherever it was sent;
 * - one that had no answer keeps its key, so confirming the same method,
 *   account and amount again is Try again, never a second withdrawal;
 * - one the API accepted while no flow was on screen is shown when the
 *   player comes back to Withdraw, instead of their asking for another.
 *
 * Memory only: a reload starts afresh, and the withdrawal is found again from
 * its row in the history. The player's alone: everything here is for
 * `owner`, and nothing to anyone else signed in on the same phone.
 */
export interface WithdrawalIntents {
  /** Whose these are; null before anyone has withdrawn on this page. */
  owner: string | null;
  /** On its way. */
  sending: WithdrawalAttempt | null;
  /**
   * Sent and never answered in a way that settles it — no response, a 5xx,
   * a rate limit, a refused Try again. It may exist, so it stays until a
   * withdrawal comes back for its key, or the player changes the method,
   * account or amount.
   */
  unanswered: WithdrawalAttempt | null;
  /** Accepted while no flow was there to show it: shown when the player comes back. */
  unseen: string | null;
}

const NOBODY: WithdrawalIntents = {
  owner: null,
  sending: null,
  unanswered: null,
  unseen: null,
};

/** The intents if they are this player's; nothing for anyone else or a guest. */
export const ownWithdrawalIntents = (
  intents: WithdrawalIntents,
  player: string | null,
): WithdrawalIntents =>
  player !== null && intents.owner === player ? intents : NOBODY;

interface WithdrawalStore {
  intents: WithdrawalIntents;
  /**
   * An attempt goes. False — and nothing goes — while another of this
   * player's is on its way. Another request than the unanswered one is
   * another intent: the unanswered one is let go.
   */
  sent: (attempt: WithdrawalAttempt) => boolean;
  /** The API accepted `key` as withdrawal `id`. */
  started: (key: string, id: string) => void;
  /** No answer settled `key`: it may exist. */
  unanswered: (key: string) => void;
  /**
   * The API refused `key`. A first try is over; a Try again's refusal says
   * nothing about the first try, which stays unanswered.
   */
  refused: (key: string, retried: boolean) => void;
  /** Nothing went for `key` (no session, or someone else signed in). */
  dropped: (key: string) => void;
  /** The player has seen the withdrawal accepted while they were away. */
  seen: (id: string) => void;
}

export const useWithdrawalStore = create<WithdrawalStore>()((set, get) => {
  /** Applies `change` when `key` is the attempt on its way. */
  const answer = (
    key: string,
    change: (intents: WithdrawalIntents) => Partial<WithdrawalIntents>,
  ) => {
    const { intents } = get();
    if (intents.sending?.key !== key) return;
    set({ intents: { ...intents, sending: null, ...change(intents) } });
  };

  return {
    intents: NOBODY,

    sent: (attempt) => {
      const mine = ownWithdrawalIntents(get().intents, attempt.owner);
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

    started: (key, id) =>
      answer(key, (intents) => ({
        unanswered: intents.unanswered?.key === key ? null : intents.unanswered,
        unseen: id,
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

    seen: (id) => {
      const { intents } = get();
      if (intents.unseen === id) set({ intents: { ...intents, unseen: null } });
    },
  };
});

/** A fresh page's store, for tests. */
export const resetWithdrawalStore = (): void =>
  useWithdrawalStore.setState({ intents: NOBODY });
