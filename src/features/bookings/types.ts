import type { Localized } from "@/types/common";
import type { BetSlipMode } from "@/features/bet-slip/types";

/**
 * Why a stored selection can't be backed now. The first four are the
 * contract's `PricedLeg.reason`; `UNPRICED` is a leg marked available that came
 * without a valid price, which the slip will not guess at.
 */
export type BookingUnavailableReason =
  | "EVENT_STARTED"
  | "MARKET_SUSPENDED"
  | "MARKET_CLOSED"
  | "NOT_FOUND"
  | "UNPRICED";

/** One stored selection, re-priced now (`PricedLeg`). */
export interface BookingLeg {
  /** The contract's outcome ID — what goes back into the slip. */
  outcomeId: string;
  eventId: string | null;
  /** Names in both languages; null when the API sent none. */
  eventName: Localized | null;
  marketId: string | null;
  marketName: Localized | null;
  outcomeName: Localized | null;
  /** Kickoff, ISO UTC. */
  startTime: string | null;
  /** Today's price as a decimal string; null when the leg can't be backed. */
  odds: string | null;
  /** The price when the code was made. */
  oddsAtCode: string | null;
  /** Null when the leg can be added to the slip. */
  unavailable: BookingUnavailableReason | null;
}

/** A booking loaded by its code (`Booking`). */
export interface Booking {
  code: string;
  betType: BetSlipMode;
  systemSizes: number[];
  /** The total stake the code was made with, if any. */
  stakeHint: string | null;
  /** ISO UTC. */
  expiresAt: string;
  legs: BookingLeg[];
}

/** What booking a slip returns (`BookingCreated`). */
export interface BookingReceipt {
  code: string;
  expiresAt: string;
  /** The link to share: the same `/b/{code}` path the app opens (D7). */
  shareUrl: string;
}

/** What the browser asks `/api/bookings` to save. */
export interface BookingRequest {
  betType: BetSlipMode;
  /** One size for a system bet, e.g. `[2]` for 2/3; empty otherwise. */
  systemSizes: number[];
  outcomeIds: string[];
  /** The total stake as a decimal string, or null to save the picks only. */
  stake: string | null;
}
