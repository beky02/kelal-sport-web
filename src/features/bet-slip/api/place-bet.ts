import { z } from "zod";
import type { RuleSetJson } from "@golden/slipcalc";
import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { moneySchema, oddsSchema } from "@/lib/api/schemas";
import { calculateBetSlip } from "../lib/calculate";
import type { BetSelection, BetSlipMode } from "../types";

export interface PlaceBetRequest {
  mode: BetSlipMode;
  /** The total stake, a decimal string. */
  stake: string;
  systemK: number;
  selections: Array<{
    /** The contract's outcome ID. */
    outcomeId: string;
    /** The price the user agreed to, as the API sent it. The book re-checks it. */
    odds: string;
  }>;
}

/**
 * What the backend says happened.
 *
 * Every figure here is the server's, not the slip's: the slip shows slipcalc's
 * preview while the user builds a bet, and this replaces it. Amounts are
 * decimal strings (FD4).
 */
export const betReceiptSchema = z.object({
  ticketId: z.string(),
  placedAt: z.string(),
  mode: z.enum(["single", "multiple", "system"]),
  /**
   * What the ticket holds: the leg count on a multiple, otherwise the number
   * of separate bets placed (N singles, or C system combinations).
   */
  betCount: z.number().int().positive(),
  /** The accumulated price; null when the ticket is more than one line. */
  totalOdds: oddsSchema.nullable(),
  totalStake: moneySchema,
  stakeTax: moneySchema,
  winTax: moneySchema,
  payout: moneySchema,
});

export type BetReceipt = z.infer<typeof betReceiptSchema>;

/** `KS-260928-4417` */
function ticketId(now: Date): string {
  const stamp = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const serial = String(Math.floor(1000 + Math.random() * 9000));
  return `KS-${stamp}-${serial}`;
}

/**
 * Stands in for the betting engine until F5.
 *
 * Re-prices with slipcalc rather than trusting anything the client sent, and
 * refuses with the codes slipcalc and the engine use, so the UI's error paths
 * are exercised before there is a backend.
 */
async function placeBetAgainstMock(
  request: PlaceBetRequest,
  selections: readonly BetSelection[],
  rules: RuleSetJson,
): Promise<BetReceipt> {
  await new Promise((resolve) => setTimeout(resolve, 650));

  if (selections.length === 0) {
    throw new ApiError("Bet slip is empty", 422, "VALIDATION_FAILED");
  }

  const totals = calculateBetSlip({
    selections,
    mode: request.mode,
    stake: request.stake,
    systemK: request.systemK,
    rules,
    balance: null,
    oddsPolicy: "any",
  });

  if (totals.hasConflict) {
    throw new ApiError(
      "Selections from the same event cannot be combined",
      422,
      "BET_RELATED_SELECTIONS",
    );
  }
  if (totals.suspendedSelection) {
    throw new ApiError("A selection is suspended", 409, "BET_MARKET_SUSPENDED");
  }
  if (!totals.quote) {
    const problem = totals.problem ?? { code: "VALIDATION_FAILED" as const };
    throw new ApiError(
      "The bet was refused",
      422,
      problem.code,
      undefined,
      "stake" in problem
        ? [{ field: "stake", code: "LIMIT", limit: problem.stake }]
        : [],
    );
  }

  const q = totals.quote;
  const now = new Date();
  return {
    ticketId: ticketId(now),
    placedAt: now.toISOString(),
    mode: totals.mode,
    betCount: totals.mode === "multiple" ? totals.liveCount : q.lines,
    totalOdds: q.totalOdds,
    totalStake: q.totalStake,
    stakeTax: q.stakeTax,
    winTax: q.winTax,
    payout: q.netPayout,
  };
}

export async function placeBet(
  request: PlaceBetRequest,
  selections: readonly BetSelection[],
  rules: RuleSetJson,
): Promise<BetReceipt> {
  if (env.useMocks) {
    return assertContract(
      "/bets",
      betReceiptSchema,
      await placeBetAgainstMock(request, selections, rules),
    );
  }
  return apiClient.post("/bets", betReceiptSchema, request);
}
