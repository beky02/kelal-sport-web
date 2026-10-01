"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { configKeys, walletKeys } from "@/lib/query/keys";
import { ApiError } from "@/lib/api/errors";
import type { PublicConfigView } from "@/features/config/types";
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
      const config = queryClient.getQueryData<PublicConfigView>(
        configKeys.public(),
      );
      // The button is disabled without a rule set; this is the backstop.
      if (!config) {
        throw new ApiError("Betting rules not loaded", 0, "network");
      }
      return placeBet(
        {
          mode,
          stake,
          systemK,
          selections: selections.map((s) => ({
            outcomeId: s.outcomeId,
            odds: s.currentOdds,
          })),
        },
        selections,
        config.betting.calc,
      );
    },
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
      onPlaced(receipt);
    },
  });
}
