import type { Localized } from "@/types/common";
import type { MarketType } from "@/features/markets/types";
import { compareOdds } from "@/lib/money";

export type BetSlipMode = "single" | "multiple" | "system";

export type SelectionStatus = "active" | "suspended" | "odds_changed";

/**
 * One pick in the slip.
 *
 * `initialOdds` is what the user saw when they tapped; `currentOdds` is what
 * the book says now. The gap between them is the whole reason the slip has an
 * accept-changes flow, so both are kept rather than overwritten in place. Both
 * are the contract's decimal strings (FD4).
 */
export interface BetSelection {
  /** The contract's outcome ID (`oc_ac_1`): what slips, bookings and bets carry. */
  outcomeId: string;

  eventId: string;
  marketId: string;
  /**
   * Where the price sits on the board, so a realtime frame (which addresses a
   * price by event, market type, line and outcome code) can find it.
   */
  marketType: MarketType;
  line: string | null;
  outcomeCode: string;

  eventName: Localized;
  marketName: Localized;
  outcomeName: Localized;

  initialOdds: string;
  currentOdds: string;
  suspended: boolean;
}

/** The price moved since the pick was made — `"2.1"` to `"2.10"` is no move. */
export const oddsMoved = (s: BetSelection): boolean =>
  compareOdds(s.currentOdds, s.initialOdds) !== 0;

export const selectionStatus = (s: BetSelection): SelectionStatus =>
  s.suspended ? "suspended" : oddsMoved(s) ? "odds_changed" : "active";
