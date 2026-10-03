import { z } from "zod";
import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { mockRepository } from "@/lib/api/mock/repository";
import {
  paymentMethodSchema,
  paymentResultSchema,
  walletBalancesSchema,
} from "@/lib/api/schemas";
import type {
  PaymentMethod,
  PaymentResult,
  WalletBalances,
  WalletMode,
} from "../types";

/** The player's balances, as `/v1/wallet` states them (through `/api/wallet`). */
export const getWallet = (signal?: AbortSignal): Promise<WalletBalances> =>
  apiClient.get("/wallet", walletBalancesSchema, { signal });

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
