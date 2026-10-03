"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { transactionKeys, walletKeys } from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import {
  createPayment,
  getPaymentMethods,
  getPaymentStatus,
  getWallet,
  getWalletHistory,
} from "../api/get-wallet";
import type { HistoryFilter, WalletMode } from "../types";

/** How many movements the wallet's recent activity shows. */
const RECENT_COUNT = 5;

/**
 * How long the paged history is fresh. Longer than the balance's: a stale
 * infinite query re-reads every page it has loaded, one after another, and
 * this browser's own money moves invalidate it at once anyway.
 */
const HISTORY_STALE_MS = 60_000;

/**
 * The player's balances, as the API states them. Server-owned: the header,
 * the wallet and the slip's warning about an unaffordable stake read this one
 * query, but the backend is what actually refuses a bet. Never adjusted in the
 * browser — anything that moves money invalidates it instead. A signed-in
 * player's only (`enabled`): a guest has no wallet to read.
 */
export function useWallet(enabled: boolean) {
  return useQuery({
    queryKey: walletKeys.balance(),
    queryFn: ({ signal }) => getWallet(signal),
    staleTime: STALE_TIME.wallet,
    enabled,
  });
}

/**
 * The wallet history under one filter, a page at a time (`next_cursor`).
 *
 * Anything that moves money in this browser — placing, cashing out, a payment
 * — invalidates it with the balance, so the two tell the same story; between
 * those it is re-read at most once a minute. A signed-in player's only
 * (`enabled`). A refetch re-reads the loaded pages in order from the first,
 * each with the cursor the page before it gave.
 */
export function useWalletHistory(filter: HistoryFilter, enabled: boolean) {
  const lang = useUiStore((s) => s.lang);
  return useInfiniteQuery({
    queryKey: transactionKeys.list(filter, lang),
    queryFn: ({ pageParam, signal }) =>
      getWalletHistory(
        {
          type: filter === "all" ? null : filter,
          cursor: pageParam,
          limit: null,
        },
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    staleTime: HISTORY_STALE_MS,
    enabled,
  });
}

/**
 * The wallet's recent activity: the latest few movements, its own small read,
 * never the history's pages — refetching those re-reads every page loaded.
 * Fresh as long as the balance above it is, so the two agree.
 */
export function useRecentTransactions(enabled: boolean) {
  const lang = useUiStore((s) => s.lang);
  return useQuery({
    queryKey: transactionKeys.recent(lang),
    queryFn: ({ signal }) =>
      getWalletHistory(
        { type: null, cursor: null, limit: RECENT_COUNT },
        signal,
      ),
    staleTime: STALE_TIME.wallet,
    enabled,
  });
}

export function usePaymentMethods(mode: WalletMode) {
  return useQuery({
    queryKey: [...walletKeys.all, "methods", mode],
    queryFn: ({ signal }) => getPaymentMethods(mode, signal),
    staleTime: 10 * 60_000,
  });
}

/** Starts a payment. Never optimistic — this moves money. */
export function useCreatePayment() {
  return useMutation({
    mutationFn: ({
      mode,
      methodId,
      amount,
    }: {
      mode: WalletMode;
      methodId: string;
      amount: number;
    }) => createPayment(mode, methodId, amount),
  });
}

/**
 * Polls a pending payment until the provider decides.
 *
 * The user is looking at a "waiting for approval" screen while they authorise it
 * on their handset, so this keeps asking rather than making them press a button
 * to find out. Stops the moment it is no longer pending, and invalidates the
 * balance and the transaction list so both come from the server afterwards.
 */
export function usePaymentStatus(reference: string | null, enabled: boolean) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [...walletKeys.all, "payment", reference],
    queryFn: async ({ signal }) => {
      const status = await getPaymentStatus(reference!, signal);
      if (status !== "pending") {
        void queryClient.invalidateQueries({ queryKey: walletKeys.balance() });
        void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      }
      return status;
    },
    enabled: enabled && reference !== null,
    refetchInterval: (query) =>
      query.state.data === "pending" || query.state.data === undefined
        ? 2000
        : false,
  });
}
