import type { components } from "@/lib/api/schema";
import type { Localized } from "@/types/common";
import type {
  Booking,
  BookingLeg,
  BookingReceipt,
  BookingRequest,
  BookingUnavailableReason,
} from "@/features/bookings/types";
import type { Bilingual } from "./catalogue";

type ApiBooking = components["schemas"]["Booking"];
type ApiPricedLeg = components["schemas"]["PricedLeg"];
type ApiBookingCreated = components["schemas"]["BookingCreated"];
type ApiBookingCreate = components["schemas"]["BookingCreate"];

/** The contract's `Odds` pattern: a price the slip can be given. */
const ODDS = /^\d{1,6}\.\d{2,3}$/;

const localized = (
  en: string | undefined,
  am: string | undefined,
): Localized | null =>
  en === undefined && am === undefined
    ? null
    : { en: en ?? am ?? "", am: am ?? en ?? "" };

function toLeg(en: ApiPricedLeg, am: ApiPricedLeg | undefined): BookingLeg {
  const odds = en.available && en.odds && ODDS.test(en.odds) ? en.odds : null;
  const unavailable: BookingUnavailableReason | null = odds
    ? null
    : en.available
      ? "UNPRICED"
      : (en.reason ?? "NOT_FOUND");

  return {
    outcomeId: en.outcome_id,
    eventId: en.fixture_id ?? null,
    eventName: localized(en.fixture_name, am?.fixture_name),
    marketId: en.market_id ?? null,
    marketName: localized(en.market_name, am?.market_name),
    outcomeName: localized(en.outcome_name, am?.outcome_name),
    startTime: en.start_time ?? null,
    odds,
    oddsAtCode:
      en.odds_at_code && ODDS.test(en.odds_at_code) ? en.odds_at_code : null,
    unavailable,
  };
}

/**
 * A booking read in both languages → one booking with `Localized` names.
 *
 * Availability and prices come from the English read; the Amharic one only
 * contributes names, matched by outcome ID so a reordered list can't swap them.
 */
export function toBooking({ en, am }: Bilingual<ApiBooking>): Booking {
  const amById = new Map(am.legs.map((leg) => [leg.outcome_id, leg]));
  return {
    code: en.code,
    betType: en.bet_type,
    systemSizes: en.system_sizes ?? [],
    stakeHint: en.stake_hint ?? null,
    expiresAt: en.expires_at,
    legs: en.legs.map((leg) => toLeg(leg, amById.get(leg.outcome_id))),
  };
}

export const toBookingReceipt = (
  created: ApiBookingCreated,
): BookingReceipt => ({
  code: created.code,
  expiresAt: created.expires_at,
  shareUrl: created.share_url,
});

/** The browser's request → the contract's `BookingCreate`, field by field. */
export function toBookingCreate(request: BookingRequest): ApiBookingCreate {
  return {
    bet_type: request.betType,
    ...(request.systemSizes.length > 0
      ? { system_sizes: request.systemSizes }
      : {}),
    legs: request.outcomeIds.map((outcome_id) => ({ outcome_id })),
    ...(request.stake ? { stake: request.stake } : {}),
  };
}
