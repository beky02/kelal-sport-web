import { z } from "zod";
import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { mockRepository } from "@/lib/api/mock/repository";
import {
  paymentResultSchema,
  walletBalancesSchema,
  walletTxnPageSchema,
} from "@/lib/api/schemas";
import type {
  PaymentMethodCode,
  PaymentResult,
  WalletBalances,
  WalletTxnPage,
  WalletTxnType,
} from "../types";

/** The player's balances, as `/v1/wallet` states them (through `/api/wallet`). */
export const getWallet = (signal?: AbortSignal): Promise<WalletBalances> =>
  apiClient.get("/wallet", walletBalancesSchema, { signal });

/**
 * One page of the wallet history (`/v1/wallet/transactions`, through
 * `/api/wallet/transactions`): one of the contract's types or all of them,
 * after the previous page's cursor, `limit` movements or the API's default.
 */
export const getWalletHistory = (
  query: {
    type: WalletTxnType | null;
    cursor: string | null;
    limit: number | null;
  },
  signal?: AbortSignal,
): Promise<WalletTxnPage> =>
  apiClient.get("/wallet/transactions", walletTxnPageSchema, {
    params: {
      type: query.type ?? undefined,
      cursor: query.cursor ?? undefined,
      limit: query.limit ?? undefined,
    },
    signal,
  });

// Withdrawals stay on the mock until F6c moves them to `/v1/withdrawals`.

/**
 * Starts a withdrawal.
 *
 * Returns pending: nothing here may assume it succeeded.
 */
export async function createWithdrawal(
  method: PaymentMethodCode,
  amount: string,
): Promise<PaymentResult> {
  if (env.useMocks) {
    return assertContract(
      "/wallet/withdrawals",
      paymentResultSchema,
      await mockRepository.createWithdrawal(method, amount),
    );
  }
  return apiClient.post("/wallet/payments", paymentResultSchema, {
    mode: "withdraw",
    method,
    amount,
  });
}

const statusSchema = z.object({
  status: z.enum(["pending", "success", "failed"]),
});

export async function getPaymentStatus(
  reference: string,
  signal?: AbortSignal,
): Promise<PaymentResult["status"]> {
  if (env.useMocks) {
    return mockRepository.getPaymentStatus(reference);
  }
  const { status } = await apiClient.get(
    `/wallet/payments/${reference}`,
    statusSchema,
    { signal },
  );
  return status;
}
