"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { betKeys, rgKeys, sessionKeys, walletKeys } from "@/lib/query/keys";
import { placeBet } from "../api/place-bet";
import {
  legUpdates,
  newIdempotencyKey,
  placementOutcome,
  refusalOf,
} from "../lib/placement";
import { ownPlacement, useBetSlipStore } from "../stores/bet-slip.store";
import type { PlaceAttempt, PlaceBetRequest } from "../types";

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
    mutationFn: ({ request, key }: PlaceAttempt) => placeBet(request, key),
    onSuccess: (receipt, { key }) => {
      useBetSlipStore.getState().placementPlaced(key, receipt);
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
      void queryClient.invalidateQueries({ queryKey: betKeys.all });
    },
    onError: (error, { request, key }) => {
      const slip = useBetSlipStore.getState();
      const outcome = placementOutcome(error);
      switch (outcome.kind) {
        case "unanswered":
          // The bet may exist. The wallet and bets are read again; until My
          // bets (F5b) and the wallet (F6) come from the API, they cannot
          // settle it — Try again with the same key can.
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
    (attempt: PlaceAttempt, options?: { asNew?: boolean }) => {
      if (!owner) return;
      useBetSlipStore.getState().placementSent(attempt, owner, options);
      mutate(attempt);
    },
    [owner, mutate],
  );

  /** Try again: the unconfirmed bet, its very request and its own key. */
  const retry = useCallback(() => {
    const { sending, unconfirmed } = ownPlacement(
      useBetSlipStore.getState().placement,
      owner,
    );
    if (!sending && unconfirmed) send(unconfirmed);
  }, [owner, send]);

  /** Place: a new intent with a new key — or Try again while one is unconfirmed. */
  const place = useCallback(
    (request: PlaceBetRequest) => {
      const { sending, unconfirmed } = ownPlacement(
        useBetSlipStore.getState().placement,
        owner,
      );
      if (sending) return;
      if (unconfirmed) return retry();
      send({ request, key: newIdempotencyKey() });
    },
    [owner, retry, send],
  );

  /**
   * The player chose to place this slip although an earlier bet is
   * unconfirmed: a new bet with a new key, and the earlier one is no longer
   * tracked.
   */
  const placeAsNew = useCallback(
    (request: PlaceBetRequest) => {
      if (ownPlacement(useBetSlipStore.getState().placement, owner).sending) {
        return;
      }
      send({ request, key: newIdempotencyKey() }, { asNew: true });
    },
    [owner, send],
  );

  return { place, retry, placeAsNew };
}
