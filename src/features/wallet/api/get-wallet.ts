import { z } from "zod";
import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { mockRepository } from "@/lib/api/mock/repository";
import {
  paymentMethodSchema,
  paymentResultSchema,
  walletBalancesSchema,
  walletTxnPageSchema,
} from "@/lib/api/schemas";
import type {
  PaymentMethod,
  PaymentResult,
  WalletBalances,
  WalletMode,
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

// Methods and payments stay on the mock until F6b (deposits) and F6c
// (withdrawals) move them to `/v1/payment-methods`, `/v1/deposits` and
// `/v1/withdrawals`.

const methodsSchema = z.array(paymentMethodSchema);

export async function getPaymentMethods(
  mode: WalletMode,
  signal?: AbortSignal,
): Promise<PaymentMethod[]> {
  if (env.useMocks) {
    return assertContract(
      "/wallet/methods",
      methodsSchema,
      await mockRepository.listPaymentMethods(mode),
    );
  }
  return apiClient.get("/wallet/methods", methodsSchema, {
    params: { mode },
    signal,
  });
}

/**
 * Starts a payment.
 *
 * Returns pending: a mobile-money deposit is not money until the customer
 * approves the prompt on their handset. Nothing here may assume it succeeded.
 */
export async function createPayment(
  mode: WalletMode,
  methodId: string,
  amount: number,
): Promise<PaymentResult> {
  if (env.useMocks) {
    return assertContract(
      "/wallet/payments",
      paymentResultSchema,
      await mockRepository.createPayment(mode, methodId, amount),
    );
  }
  return apiClient.post("/wallet/payments", paymentResultSchema, {
    mode,
    methodId,
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
