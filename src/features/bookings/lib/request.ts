import {
  stakeToPrice,
  type BetSlipTotals,
} from "@/features/bet-slip/lib/calculate";
import type { BetSelection } from "@/features/bet-slip/types";
import { normaliseMoney } from "@/lib/money";
import type { BookingRequest } from "../types";

/**
 * The slip as a booking request, or null when it can't be booked: nothing
 * live, two picks from one match, or more legs or lines than the rules allow.
 *
 * The stake is the total as typed — the hint the loader starts from. Under
 * the minimum (none, zero or too low) the slip can't be booked (the user's
 * decision, 2026-10-08); over the maximum the stake is left out, so the picks
 * can still be saved.
 */
export function bookingRequestFrom({
  selections,
  totals,
  stake,
}: {
  selections: readonly BetSelection[];
  totals: BetSlipTotals;
  stake: string;
}): BookingRequest | null {
  const live = selections.filter((s) => !s.suspended);
  if (live.length === 0 || totals.hasConflict) return null;

  // Any problem but a stake over the maximum stops the booking: under the
  // minimum included.
  const stakeProblem = totals.problem?.code === "BET_STAKE_TOO_HIGH";
  if (totals.problem && !stakeProblem) return null;

  const typed = stakeToPrice(stake);
  return {
    betType: totals.betType,
    systemSizes: totals.betType === "system" ? [totals.systemK] : [],
    outcomeIds: live.map((s) => s.outcomeId),
    stake: typed && !stakeProblem ? normaliseMoney(typed) : null,
  };
}
