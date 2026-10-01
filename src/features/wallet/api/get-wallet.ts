import { z } from "zod";
import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { mockRepository } from "@/lib/api/mock/repository";
import {
  paymentMethodSchema,
  paymentResultSchema,
  walletSchema,
} from "@/lib/api/schemas";
import type {
  PaymentMethod,
  PaymentResult,
  WalletMode,
  WalletOverview,
} from "../types";

export async function getWallet(signal?: AbortSignal): Promise<WalletOverview> {
  if (env.useMocks) {
    return assertContract(
      "/wallet",
      walletSchema,
      await mockRepository.getWallet(),
    );
  }
  return apiClient.get("/wallet", walletSchema, { signal });
}

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
