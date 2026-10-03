import { apiClient } from "@/lib/api/client";
import { depositSchema, paymentMethodsSchema } from "@/lib/api/schemas";
import type { Deposit, DepositRequest, PaymentMethod } from "../types";

/**
 * How long one attempt to start a deposit may take — every request it makes —
 * before the wallet says it couldn't confirm it. Past this the player is
 * offered Try again, which sends the same request with the same key, so a
 * slow answer can never become a second deposit.
 */
export const depositDeadline = (): AbortSignal => AbortSignal.timeout(30_000);

/** The methods offered to this player, with their limits (`/api/payment-methods`). */
export const getPaymentMethods = (
  signal?: AbortSignal,
): Promise<PaymentMethod[]> =>
  apiClient.get("/payment-methods", paymentMethodsSchema, { signal });

/**
 * Starts a deposit through `/api/deposits` (C04).
 *
 * `idempotencyKey` is one per deposit intent (`useDepositAttempt`): Try again
 * sends the same request with the same key, so the API answers with the
 * deposit it already started instead of starting a second. The answer says
 * what the player does next (`nextAction`).
 */
export const createDeposit = (
  request: DepositRequest,
  idempotencyKey: string,
  deadline: AbortSignal,
): Promise<Deposit> =>
  apiClient.post("/deposits", depositSchema, request, {
    headers: { "Idempotency-Key": idempotencyKey },
    signal: deadline,
  });

/** One of the player's deposits, as the API states it now. */
export const getDeposit = (
  id: string,
  signal?: AbortSignal,
): Promise<Deposit> =>
  apiClient.get(`/deposits/${encodeURIComponent(id)}`, depositSchema, {
    signal,
  });
