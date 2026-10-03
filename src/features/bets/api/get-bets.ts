import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { betPageSchema, betSchema } from "@/lib/api/schemas";
import type { Bet, BetPage, BetsTab } from "../types";

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
 * another player's bet with 404 `NOT_FOUND`, which is a state of the screen,
 * not a fault. A 404 without that code (an edge, a mock) is a fault.
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
    if (error instanceof ApiError && error.code === "NOT_FOUND") return null;
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
