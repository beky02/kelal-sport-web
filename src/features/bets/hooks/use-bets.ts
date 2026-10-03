"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { betKeys, transactionKeys, walletKeys } from "@/lib/query/keys";
import { cashOutBet, getBet, getBets, getTransactions } from "../api/get-bets";
import type { BetsTab, TransactionKind } from "../types";

/** Open bets change as matches run, so this is kept short-lived. */
const BETS_STALE_MS = 20_000;

/**
 * The player's bets under one tab, a page at a time (`next_cursor`).
 *
 * `enabled` is for a signed-in player only: a guest has no bets to read, and
 * asking would only bring back a 401. A refetch re-reads the loaded pages in
 * order from the first, each with the cursor the page before it gave.
 */
export function useBets(status: BetsTab, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: betKeys.list(status),
    queryFn: ({ pageParam, signal }) => getBets(status, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    staleTime: BETS_STALE_MS,
    enabled,
  });
}

/** One of the player's tickets; null when it isn't theirs. A player's only, as `useBets`. */
export function useBet(id: string, enabled: boolean) {
  return useQuery({
    queryKey: betKeys.detail(id),
    queryFn: ({ signal }) => getBet(id, signal),
    staleTime: BETS_STALE_MS,
    enabled: enabled && id.length > 0,
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
