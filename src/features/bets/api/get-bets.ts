import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import {
  mockRepository,
  type BetList,
  type TransactionDay,
} from "@/lib/api/mock/repository";
import {
  betListSchema,
  betSchema,
  transactionDaysSchema,
} from "@/lib/api/schemas";
import type { Bet, BetsTab, TransactionKind } from "../types";

export async function getBets(
  tab: BetsTab,
  signal?: AbortSignal,
): Promise<BetList> {
  if (env.useMocks) {
    return assertContract(
      "/bets",
      betListSchema,
      await mockRepository.listBets(tab),
    );
  }
  return apiClient.get("/bets", betListSchema, { params: { tab }, signal });
}

export async function getBet(
  id: string,
  signal?: AbortSignal,
): Promise<Bet | null> {
  if (env.useMocks) {
    const bet = await mockRepository.getBet(id);
    return bet ? assertContract(`/bets/${id}`, betSchema, bet) : null;
  }
  return apiClient.get(`/bets/${id}`, betSchema, { signal });
}

/**
 * Buys a bet back.
 *
 * The amount is the server's: the client sends which bet and what share, never
 * a figure. A cash-out value moves with the match and the book is the only thing
 * that can price it.
 */
export async function cashOutBet(id: string, fraction: number): Promise<Bet> {
  if (env.useMocks) {
    return assertContract(
      `/bets/${id}/cash-out`,
      betSchema,
      await mockRepository.cashOut(id, fraction),
    );
  }
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
