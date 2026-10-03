import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { mockRepository, type TransactionDay } from "@/lib/api/mock/repository";
import {
  betPageSchema,
  betSchema,
  transactionDaysSchema,
} from "@/lib/api/schemas";
import type { Bet, BetPage, BetsTab, TransactionKind } from "../types";

/** One page of the player's bets; `cursor` is the previous page's `nextCursor`. */
export const getBets = (
  status: BetsTab,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<BetPage> =>
  apiClient.get("/bets", betPageSchema, {
    params: { status, cursor: cursor ?? undefined },
    signal,
  });

/**
 * One of the player's tickets, or null when it isn't theirs: the API answers
 * another player's bet with 404, which is a state of the screen, not a fault.
 */
export async function getBet(
  id: string,
  signal?: AbortSignal,
): Promise<Bet | null> {
  try {
    return await apiClient.get(`/bets/${encodeURIComponent(id)}`, betSchema, {
      signal,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Buys a bet back (Release 2, behind `features.cashOut`).
 *
 * The amount is the server's: the client sends which bet and what share, never
 * a figure. The contract has no cash-out operation yet, so nothing answers
 * this; the panel that calls it has no quote to offer until it does.
 */
export async function cashOutBet(id: string, fraction: number): Promise<Bet> {
  return apiClient.post(`/bets/${id}/cash-out`, betSchema, { fraction });
}

export async function getTransactions(
  kind: TransactionKind | "all",
  signal?: AbortSignal,
): Promise<TransactionDay[]> {
  if (env.useMocks) {
    return assertContract(
      "/transactions",
      transactionDaysSchema,
      await mockRepository.listTransactions(kind),
    );
  }
  return apiClient.get("/transactions", transactionDaysSchema, {
    params: { kind },
    signal,
  });
}
