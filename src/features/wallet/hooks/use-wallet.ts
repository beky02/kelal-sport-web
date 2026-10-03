"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { transactionKeys, walletKeys } from "@/lib/query/keys";
import {
  createPayment,
  getPaymentMethods,
  getPaymentStatus,
  getWallet,
} from "../api/get-wallet";
import type { WalletMode } from "../types";

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
