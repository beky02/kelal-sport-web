"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { betKeys, transactionKeys, walletKeys } from "@/lib/query/keys";
import { cashOutBet, getBet, getBets, getTransactions } from "../api/get-bets";
import type { BetsTab, TransactionKind } from "../types";

/** Open bets change as matches run, so this is kept short-lived. */
export function useBets(tab: BetsTab) {
  return useQuery({
    queryKey: betKeys.list(tab),
    queryFn: ({ signal }) => getBets(tab, signal),
    staleTime: 20_000,
  });
}

export function useBet(id: string) {
  return useQuery({
    queryKey: betKeys.detail(id),
    queryFn: ({ signal }) => getBet(id, signal),
    staleTime: 20_000,
    enabled: id.length > 0,
  });
}

export function useTransactions(kind: TransactionKind | "all") {
  return useQuery({
    queryKey: transactionKeys.list(kind),
    queryFn: ({ signal }) => getTransactions(kind, signal),
    staleTime: 60_000,
  });
}

/**
 * Cashes a bet out.
 *
 * Nothing optimistic: this moves money, so the UI waits for the server's answer
 * and then refetches the bets, the wallet and the transactions rather than
 * patching any of them by hand.
 */
export function useCashOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fraction }: { id: string; fraction: number }) =>
      cashOutBet(id, fraction),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: betKeys.all });
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
