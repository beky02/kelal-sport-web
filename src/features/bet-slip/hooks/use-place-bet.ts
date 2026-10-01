"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { walletKeys } from "@/lib/query/keys";
import { useBetSlipStore } from "../stores/bet-slip.store";
import { placeBet, type BetReceipt } from "../api/place-bet";

/**
 * Places the slip.
 *
 * Nothing is optimistic here. A bet is money: the UI waits for the engine's
 * answer and shows the ticket it returns. Only the balance is invalidated
 * afterwards, so the next read comes from the server rather than from arithmetic
 * done in the browser.
 */
export function usePlaceBet(onPlaced: (receipt: BetReceipt) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { selections, mode, stake, systemK } = useBetSlipStore.getState();
      return placeBet(
        {
          mode,
          stake,
          systemK,
          selections: selections.map((s) => ({
            eventId: s.eventId,
            marketId: s.marketId,
            outcomeCode: s.outcomeCode,
            odds: s.currentOdds,
          })),
        },
        selections,
      );
    },
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
      onPlaced(receipt);
    },
  });
}
