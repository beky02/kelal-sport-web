import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { API_ID_PATTERN } from "@/lib/api/patterns";
import {
  payoutAccountSchema,
  payoutAccountsSchema,
  withdrawalSchema,
} from "@/lib/api/schemas";
import type {
  PayoutAccount,
  PayoutAccountRequest,
  Withdrawal,
  WithdrawalRequest,
} from "../types";

/**
 * How long one attempt to request or cancel a withdrawal, or to save or
 * remove an account, may take — every request it makes — before the wallet
 * says it couldn't confirm it. Past this the player is offered Try again: the
 * same request, and for a withdrawal the same key, so a slow answer can never
 * become a second one.
 */
export const withdrawalDeadline = (): AbortSignal =>
  AbortSignal.timeout(30_000);

/**
 * An id this app will put in a path: only what one can be (`API_ID_PATTERN`).
 * An address can say anything (`?withdrawal=..` would resolve to `/api/`), so
 * anything else is not found here, and nothing is sent.
 */
function pathId(id: string): string {
  if (!API_ID_PATTERN.test(id)) {
    throw new ApiError("Not found", 404, "NOT_FOUND");
  }
  return encodeURIComponent(id);
}

/** The player's saved payout accounts (`/api/payout-accounts`). */
export const getPayoutAccounts = (
  signal?: AbortSignal,
): Promise<PayoutAccount[]> =>
  apiClient.get("/payout-accounts", payoutAccountsSchema, { signal });

/** Saves a payout account: a method and a mobile number in the contract's form. */
export const addPayoutAccount = (
  request: PayoutAccountRequest,
  deadline: AbortSignal,
): Promise<PayoutAccount> =>
  apiClient.post("/payout-accounts", payoutAccountSchema, request, {
    signal: deadline,
  });

/** Removes one of the player's payout accounts (204). */
export const removePayoutAccount = async (
  id: string,
  deadline: AbortSignal,
): Promise<undefined> =>
  apiClient.delete(`/payout-accounts/${pathId(id)}`, z.undefined(), {
    signal: deadline,
  });

/**
 * Requests a withdrawal through `/api/withdrawals` (C04).
 *
 * `idempotencyKey` is one per withdrawal intent (`useWithdrawalAttempt`): Try
 * again sends the same request with the same key, so the API answers with the
 * withdrawal it already accepted instead of a second one.
 */
export const createWithdrawal = (
  request: WithdrawalRequest,
  idempotencyKey: string,
  deadline: AbortSignal,
): Promise<Withdrawal> =>
  apiClient.post("/withdrawals", withdrawalSchema, request, {
    headers: { "Idempotency-Key": idempotencyKey },
    signal: deadline,
  });

/** One of the player's withdrawals, as the API states it now. */
export const getWithdrawal = async (
  id: string,
  signal?: AbortSignal,
): Promise<Withdrawal> =>
  apiClient.get(`/withdrawals/${pathId(id)}`, withdrawalSchema, { signal });

/** Cancels a withdrawal while it is `requested` or in `review`: the answer is the cancelled one. */
export const cancelWithdrawal = async (
  id: string,
  deadline: AbortSignal,
): Promise<Withdrawal> =>
  apiClient.delete(`/withdrawals/${pathId(id)}`, withdrawalSchema, {
    signal: deadline,
  });
