"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getMe } from "@/features/auth/api/auth";
import { betKeys, rgKeys, sessionKeys, walletKeys } from "@/lib/query/keys";
import { placeBet, placementDeadline } from "../api/place-bet";
import {
  legUpdates,
  newIdempotencyKey,
  placementOutcome,
  refusalOf,
  samePrices,
} from "../lib/placement";
import { ownPlacement, useBetSlipStore } from "../stores/bet-slip.store";
import type { PlaceAttempt, PlaceIntent } from "../types";

/** One attempt on its way: for whom, and whether it is a Try again. */
interface Sending {
  attempt: PlaceAttempt;
  owner: string;
  again: boolean;
}

/** A Try again found someone else signed in now, or no one: nothing was sent. */
class NotTheirSession extends Error {}

/**
 * Places the slip for the signed-in player `owner`.
 *
 * Nothing is optimistic: a bet is money, so the slip waits for the engine and
 * shows the ticket it issues; the wallet and the bets are read again
 * afterwards rather than adjusted in the browser.
 *
 * One request, one `Idempotency-Key`. While a bet is unconfirmed — sent and
 * never answered — nothing places a different bet by accident: `place` sends
 * that bet again with its own key (Try again), and only `placeAsNew`, the
 * player's explicit choice, sends a different one.
 *
 * Every outcome is written to the slip store from the mutation's own
 * callbacks, which run even if the slip that asked has unmounted (a phone
 * sheet closed mid-request).
 */
export function usePlaceBet(owner: string | null) {
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: async ({ attempt, owner, again }: Sending) => {
      // One deadline for the whole attempt, whatever it asks: past it the
      // bet is unanswered, never stuck on "Placing…".
      const deadline = placementDeadline();
      if (again) {
        // Try again sends a bet that may no longer be on screen, so only for
        // the player it was placed for: another tab may have signed someone
        // else in since this one last read /api/me. Read directly, not
        // through the cache, so a read already in flight can't outlast the
        // deadline.
        const { player } = await getMe(deadline);
        if (player?.id !== owner) throw new NotTheirSession();
      }
      return placeBet(attempt.request, attempt.key, deadline);
    },
    onSuccess: (receipt, { attempt }) => {
      useBetSlipStore.getState().placementPlaced(attempt.key, receipt);
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
      void queryClient.invalidateQueries({ queryKey: betKeys.all });
    },
    onError: (error, { attempt: { request, key } }) => {
      const slip = useBetSlipStore.getState();
      if (error instanceof NotTheirSession) {
        // Nothing went. The slip follows /api/me, read again: a guest is
        // asked to log in, and another player is never shown this bet.
        slip.placementSessionEnded(key);
        void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
        return;
      }
      const outcome = placementOutcome(error);
      switch (outcome.kind) {
        case "unanswered":
          // The bet may exist. The wallet and bets are read again, so a stake
          // that did go shows in the balance and My bets; only Try again with
          // the same key settles it.
          slip.placementUnanswered(key);
          void queryClient.invalidateQueries({ queryKey: walletKeys.all });
          void queryClient.invalidateQueries({ queryKey: betKeys.all });
          return;
        case "session":
          // The session-ended dialog and Log in to bet take over from /api/me.
          slip.placementSessionEnded(key);
          void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
          return;
        case "refused": {
          const refusal = refusalOf(outcome.error);
          slip.placementRefused(key, refusal, legUpdates(refusal, request));
          if (refusal.code.startsWith("RG_")) {
            // A break or a limit is server state: the banners read it again.
            void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
            void queryClient.invalidateQueries({ queryKey: rgKeys.all });
          }
        }
      }
    },
  });

  const send = useCallback(
    (attempt: PlaceAttempt, again: boolean) => {
      if (!owner) return;
      useBetSlipStore.getState().placementSent(attempt, owner);
      mutate({ attempt, owner, again });
    },
    [owner, mutate],
  );

  /** Try again: the unconfirmed bet, its very request and its own key. */
  const retry = useCallback(() => {
    const { sending, unconfirmed } = ownPlacement(
      useBetSlipStore.getState().placement,
      owner,
    );
    if (!sending && unconfirmed) send(unconfirmed, true);
  }, [owner, send]);

  /** Place: a new intent with a new key — or Try again while one is unconfirmed. */
  const place = useCallback(
    (intent: PlaceIntent) => {
      const { sending, unconfirmed } = ownPlacement(
        useBetSlipStore.getState().placement,
        owner,
      );
      if (sending) return;
      if (unconfirmed) return retry();
      send({ ...intent, key: newIdempotencyKey() }, false);
    },
    [owner, retry, send],
  );

  /**
   * The player chose to place the slip on screen although an earlier bet is
   * unconfirmed: a new bet with a new key, while the earlier one stays
   * unconfirmed until a ticket comes back. Never that very bet at its very
   * prices: it goes as Try again, with its own key.
   */
  const placeAsNew = useCallback(
    (intent: PlaceIntent) => {
      const { sending, unconfirmed } = ownPlacement(
        useBetSlipStore.getState().placement,
        owner,
      );
      if (sending) return;
      if (unconfirmed && samePrices(intent.request, unconfirmed.request)) {
        return retry();
      }
      send({ ...intent, key: newIdempotencyKey() }, false);
    },
    [owner, retry, send],
  );

  return { place, retry, placeAsNew };
}
