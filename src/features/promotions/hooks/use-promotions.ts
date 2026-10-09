"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe } from "@/features/auth/api/auth";
import {
  bonusKeys,
  promotionKeys,
  rgKeys,
  sessionKeys,
  transactionKeys,
  walletKeys,
} from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import {
  getMyBonuses,
  getPromotions,
  redeemDeadline,
  redeemPromoCode,
} from "../api/promotions";
import {
  redeemNotice,
  redeemOutcome,
  type RedeemAnswer,
  type RedeemNotice,
} from "../lib/redeem";
import { usePromoStore, type PromoTry } from "../stores/promo.store";

/** Offers change when the operator edits them: a few minutes is fresh enough. */
const OFFERS_STALE_MS = 5 * 60_000;

/** Wagering moves only when a bet settles (C11 §5); read again on focus and after a code. */
const BONUS_STALE_MS = 60_000;

/** The tenant's offers, in the UI's language: their texts are the API's. Anyone's. */
export function usePromotions() {
  const lang = useUiStore((s) => s.lang);
  return useQuery({
    queryKey: promotionKeys.offers(lang),
    queryFn: ({ signal }) => getPromotions(signal),
    staleTime: OFFERS_STALE_MS,
  });
}

/**
 * The player's bonus in progress and free bets. A signed-in player's only:
 * the page renders what reads it only for one.
 */
export function useMyBonuses() {
  return useQuery({
    queryKey: bonusKeys.mine(),
    queryFn: ({ signal }) => getMyBonuses(signal),
    staleTime: BONUS_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

export type { RedeemAnswer };

/** What the form does when a refusal lands, while it is on screen. */
export interface RedeemCallbacks {
  /** Refused, with what it offers. */
  onRefused?: (notice: RedeemNotice) => void;
}

/** A Try again found someone else signed in now, or no one: nothing was sent. */
class NotTheirSession extends Error {}

/**
 * Redeems promo codes for the signed-in player `owner` (AC-12).
 *
 * Nothing is optimistic: a code's reward is the server's, so the bonus, the
 * wallet and the history are read again once the API has answered, never
 * changed here. One intent, one `Idempotency-Key` (`promo.store.ts`): while
 * a code is unanswered, redeeming it again — or Try again — sends it with
 * its key, so a dropped connection never uses it twice. A Try again first
 * asks `/api/me` who is signed in, within the try's 30 s, and sends nothing
 * for anyone else.
 *
 * What an answer means — and the answer itself — is recorded by the mutation
 * in `promo.store.ts`, which runs whether or not the form is on screen; only
 * what the form does with its field (empty it, focus it) waits for the form.
 */
export function useRedeemPromoCode(owner: string | null) {
  const queryClient = useQueryClient();
  const intent = usePromoStore((s) => s.intent);
  const mine = intent !== null && intent.owner === owner ? intent : null;
  const last = usePromoStore((s) => s.last);
  const answer = last !== null && last.owner === owner ? last.answer : null;

  /** A code's reward is the server's: the bonus, the wallet and the history are read again. */
  const rewardMayHaveMoved = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: bonusKeys.all });
    void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  }, [queryClient]);

  const { mutate } = useMutation({
    mutationFn: async (attempt: PromoTry) => {
      // One deadline for the whole try, whatever it asks.
      const deadline = redeemDeadline();
      if (attempt.again) {
        const { player } = await getMe(deadline);
        if (player?.id !== attempt.owner) throw new NotTheirSession();
      }
      return redeemPromoCode(attempt.code, attempt.key, deadline);
    },
    onSuccess: (result, attempt) => {
      usePromoStore.getState().answered(attempt.key, {
        owner: attempt.owner,
        answer: { kind: "answered", result },
      });
      rewardMayHaveMoved();
    },
    onError: (error, attempt) => {
      const store = usePromoStore.getState();
      if (error instanceof NotTheirSession) {
        // Nothing went. The page follows /api/me, read again.
        store.answered(attempt.key);
        void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
        return;
      }
      const outcome = redeemOutcome(error);
      if (outcome.kind === "unanswered") {
        store.unanswered(attempt.key);
        // It may have gone through: show what the server holds now.
        rewardMayHaveMoved();
        return;
      }
      if (outcome.kind === "session") {
        store.answered(attempt.key);
        void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
        return;
      }
      store.answered(attempt.key, {
        owner: attempt.owner,
        answer: {
          kind: "refused",
          code: attempt.code,
          notice: redeemNotice(outcome.error),
        },
      });
      if (outcome.error.code.startsWith("RG_")) {
        // A break or a limit is server state: read it again.
        void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
        void queryClient.invalidateQueries({ queryKey: rgKeys.all });
      }
    },
  });

  /**
   * Redeem what was typed, trimmed: a new intent with a new key — or, while
   * this very code is unanswered, Try again with its key.
   */
  const redeem = useCallback(
    (typed: string, callbacks: RedeemCallbacks = {}) => {
      const code = typed.trim();
      if (!owner || code === "") return;
      // One on its way at a time: read from the store, not the render, so
      // two presses in the same moment can't both go.
      const attempt = usePromoStore.getState().send(owner, code);
      if (!attempt) return;
      mutate(attempt, {
        // The mutation has recorded the answer by now; this is only what the
        // form on screen does with it.
        onSettled: () => {
          const { last } = usePromoStore.getState();
          if (last?.owner === attempt.owner && last.answer.kind === "refused") {
            callbacks.onRefused?.(last.answer.notice);
          }
        },
      });
    },
    [owner, mutate],
  );

  /** The player moved on from an answer: it no longer applies. */
  const dismiss = useCallback(() => usePromoStore.getState().dismiss(), []);

  return {
    /** The code of this player's open intent — on its way or unanswered — or null. */
    open: mine?.code ?? null,
    sending: mine?.state === "sending",
    /** The code that had no answer, for Try again; null when there is none. */
    unanswered: mine?.state === "unanswered" ? mine.code : null,
    answer,
    redeem,
    dismiss,
  };
}
