import type { Localized } from "@/types/common";
import type { BetSelection, BetSlipMode } from "@/features/bet-slip/types";
import type { Booking, BookingLeg } from "../types";

/** What the slip says after a code is loaded, until the player dismisses it. */
export interface BookingNotice {
  code: string;
  /** Legs the code had that can't be backed now, with why. */
  notAdded: BookingLeg[];
  /** Every system size the code had, when the slip can show only the first. */
  systemSizes: number[] | null;
}

/** A loaded booking, ready to replace the slip. */
export interface SlipFromBooking {
  selections: BetSelection[];
  mode: BetSlipMode;
  /** The system size to show; null for singles and multiples. */
  systemK: number | null;
  /** The total stake the code was made with; null keeps the slip's stake. */
  stake: string | null;
  notice: BookingNotice;
}

const NONE: Localized = { en: "", am: "" };

/**
 * One available leg as a slip selection.
 *
 * It starts at the price the code was made at and is priced at today's, so a
 * move since the code was shared goes through the slip's accept-changes flow
 * like any other. A booking leg carries only its outcome ID, not the market
 * type, line and outcome code a realtime frame addresses a price by (Release 2);
 * the board still highlights it, because buttons key on the outcome ID.
 */
function toSelection(leg: BookingLeg, odds: string): BetSelection {
  return {
    outcomeId: leg.outcomeId,
    // Same-match conflicts are found by event; without one, the leg is its own.
    eventId: leg.eventId ?? leg.outcomeId,
    marketId: leg.marketId ?? "",
    marketType: "other",
    line: null,
    outcomeCode: "",
    eventName: leg.eventName ?? NONE,
    marketName: leg.marketName ?? NONE,
    outcomeName: leg.outcomeName ?? NONE,
    initialOdds: leg.oddsAtCode ?? odds,
    currentOdds: odds,
    suspended: false,
  };
}

/**
 * A booking → the slip it describes. Legs that can't be backed are reported in
 * the notice rather than added (BKG-02).
 */
export function slipFromBooking(booking: Booking): SlipFromBooking {
  const selections: BetSelection[] = [];
  const notAdded: BookingLeg[] = [];
  for (const leg of booking.legs) {
    if (leg.unavailable === null && leg.odds !== null) {
      selections.push(toSelection(leg, leg.odds));
    } else {
      notAdded.push(leg);
    }
  }

  const sizes = booking.betType === "system" ? booking.systemSizes : [];
  return {
    selections,
    mode: booking.betType,
    systemK: sizes[0] ?? null,
    stake: booking.stakeHint,
    notice: {
      code: booking.code,
      notAdded,
      systemSizes: sizes.length > 1 ? sizes : null,
    },
  };
}
