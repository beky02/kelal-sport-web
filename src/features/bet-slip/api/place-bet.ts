import { z } from "zod";
import { env } from "@/config/env";
import { BETTING } from "@/config/constants";
import { apiClient, assertContract } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { calculateBetSlip } from "../lib/calculate";
import type { BetSelection, BetSlipMode } from "../types";

export interface PlaceBetRequest {
  mode: BetSlipMode;
  stake: number;
  systemK: number;
  selections: Array<{
    eventId: string;
    marketId: string;
    outcomeCode: string;
    /** The price the user agreed to. The book re-checks it. */
    odds: number;
  }>;
}

/**
 * What the backend says happened.
 *
 * Every figure here is the server's, not the slip's: the slip shows an estimate
 * while the user builds a bet, and this replaces it. Ethiopian withholding, the
 * per-ticket cap and the odds themselves are all re-derived server-side.
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
  /** The accumulated price. Only meaningful on a multiple. */
  totalOdds: z.number(),
  totalStake: z.number(),
  stakeTax: z.number(),
  winTax: z.number(),
  payout: z.number(),
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
 * Stands in for the betting engine.
 *
 * Deliberately re-runs the maths rather than trusting anything the client sent,
 * and refuses the same cases the real engine would. Keeping those refusals here
 * means the UI's error paths are exercised long before there is a backend.
 */
async function placeBetAgainstMock(
  request: PlaceBetRequest,
  selections: readonly BetSelection[],
): Promise<BetReceipt> {
  await new Promise((resolve) => setTimeout(resolve, 650));

  if (selections.length === 0) {
    throw new ApiError("Bet slip is empty", 422, "empty_slip");
  }

  const totals = calculateBetSlip({
    selections,
    mode: request.mode,
    stake: request.stake,
    systemK: request.systemK,
    rates: {
      stakeTax: BETTING.stakeTaxRate,
      winTax: BETTING.winTaxRate,
      maxWinPerTicket: BETTING.maxWinPerTicket,
    },
    balance: null,
    acceptedUids: new Set(selections.map((s) => s.uid)),
    acceptAllOddsChanges: true,
  });

  if (totals.hasConflict) {
    throw new ApiError(
      "Selections from the same event cannot be combined",
      422,
      "same_event_conflict",
    );
  }
  if (totals.suspendedSelection) {
    throw new ApiError("A selection is suspended", 409, "selection_suspended");
  }
  if (request.stake <= 0) {
    throw new ApiError("Stake must be greater than zero", 422, "invalid_stake");
  }
  // The book caps what it will take on one selection. The client shows a limit
  // as a hint; this is the rule.
  if (request.stake > BETTING.maxStakePerSelection) {
    throw new ApiError(
      `Max stake per selection is ${BETTING.maxStakePerSelection}`,
      422,
      "stake_too_high",
      { maxStake: BETTING.maxStakePerSelection },
    );
  }

  const now = new Date();
  return {
    ticketId: ticketId(now),
    placedAt: now.toISOString(),
    mode: totals.mode,
    betCount:
      totals.mode === "multiple"
        ? totals.liveCount
        : Math.max(1, totals.combinationCount),
    totalOdds: totals.totalOdds,
    totalStake: totals.totalStake,
    stakeTax: totals.stakeTax,
    winTax: totals.winTax,
    payout: totals.payout,
  };
}

export async function placeBet(
  request: PlaceBetRequest,
  selections: readonly BetSelection[],
): Promise<BetReceipt> {
  if (env.useMocks) {
    return assertContract(
      "/bets",
      betReceiptSchema,
      await placeBetAgainstMock(request, selections),
    );
  }
  return apiClient.post("/bets", betReceiptSchema, request);
}
