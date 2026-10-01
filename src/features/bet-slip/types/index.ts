import type { Localized } from "@/types/common";
import type { MarketType } from "@/features/markets/types";

export type BetSlipMode = "single" | "multiple" | "system";

export type SelectionStatus = "active" | "suspended" | "odds_changed";

/**
 * One pick in the slip.
 *
 * `initialOdds` is what the user saw when they tapped; `currentOdds` is what
 * the book says now. The gap between them is the whole reason the slip has an
 * accept-changes flow, so both are kept rather than overwritten in place.
 */
export interface BetSelection {
  /** `${eventId}#${marketType}|${line}|${outcomeCode}` — see `outcomeKey`. */
  uid: string;

  eventId: string;
  marketId: string;
  marketType: MarketType;
  line: string | null;
  outcomeCode: string;

  eventName: Localized;
  marketName: Localized;
  outcomeName: Localized;

  initialOdds: number;
  currentOdds: number;
  suspended: boolean;
}

export const selectionStatus = (s: BetSelection): SelectionStatus =>
  s.suspended
    ? "suspended"
    : s.currentOdds !== s.initialOdds
      ? "odds_changed"
      : "active";
