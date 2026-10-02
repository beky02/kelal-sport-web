"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { betKeys, rgKeys, sessionKeys, walletKeys } from "@/lib/query/keys";
import { placeBet } from "../api/place-bet";
import {
  keyFor,
  legUpdates,
  placementOutcome,
  refusalOf,
} from "../lib/placement";
import { useBetSlipStore } from "../stores/bet-slip.store";
import type { PlaceBetRequest } from "../types";

interface Attempt {
  request: PlaceBetRequest;
  key: string;
}

/**
 * Places the slip.
 *
 * Nothing is optimistic: a bet is money, so the slip waits for the engine and
 * shows the ticket it issues; the wallet and the bets are read again
 * afterwards rather than adjusted in the browser.
 *
 * Every outcome is written to the slip store from the mutation's own
 * callbacks, which run even if the slip that asked has unmounted (a phone
 * sheet closed mid-request): the ticket, the refusal or the key to try again
 * with is there when the slip next opens.
 */
export function usePlaceBet() {
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: ({ request, key }: Attempt) => placeBet(request, key),
    onSuccess: (receipt) => {
      useBetSlipStore.getState().placementPlaced(receipt);
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
      void queryClient.invalidateQueries({ queryKey: betKeys.all });
    },
    onError: (error, { request }) => {
      const slip = useBetSlipStore.getState();
      switch (placementOutcome(error)) {
        case "unanswered":
          // The bet may exist: keep its key, and read the wallet and the
          // bets again, which say whether it went through.
          slip.placementUnanswered();
          void queryClient.invalidateQueries({ queryKey: walletKeys.all });
          void queryClient.invalidateQueries({ queryKey: betKeys.all });
          return;
        case "session":
          // The session-ended dialog and Log in to bet take over from /api/me.
          slip.placementRefused(null);
          void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
          return;
        case "refused": {
          if (!(error instanceof ApiError)) return;
          const refusal = refusalOf(error);
          slip.placementRefused(refusal, legUpdates(refusal, request));
          if (refusal.code.startsWith("RG_")) {
            // A break or a limit is server state: the banners read it again.
            void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
            void queryClient.invalidateQueries({ queryKey: rgKeys.all });
          }
        }
      }
    },
  });

  /** Place this request: a new intent, unless it is the one owed an answer. */
  const place = useCallback(
    (request: PlaceBetRequest) => {
      const slip = useBetSlipStore.getState();
      if (slip.placement.attempt?.status === "sending") return;
      const attempt = {
        request,
        key: keyFor(slip.placement.attempt, request),
      };
      slip.placementSent(attempt);
      mutate(attempt);
    },
    [mutate],
  );

  /** Try again: the very request that had no answer, with its own key. */
  const retry = useCallback(() => {
    const slip = useBetSlipStore.getState();
    const { attempt } = slip.placement;
    if (attempt?.status !== "unanswered") return;
    slip.placementSent(attempt);
    mutate({ request: attempt.request, key: attempt.key });
  }, [mutate]);

  return { place, retry };
}
