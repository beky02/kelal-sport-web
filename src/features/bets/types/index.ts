import type { Localized } from "@/types/common";

/** The contract's `BetStatus`. */
export type BetStatus =
  "open" | "won" | "lost" | "void" | "cashed_out" | "cancelled";

/**
 * A ticket's status as the public check reports it (`TicketCheck.status`):
 * a bet's, and for shop tickets `paid` (collected) and `expired`.
 */
export type TicketStatus = BetStatus | "paid" | "expired";

/**
 * The contract's `LegResult` — slipcalc's own. A void leg counts as odds 1.00
 * and a half result as half a win or half a loss (D1.5).
 */
export type LegResult =
  "open" | "win" | "lose" | "void" | "half_win" | "half_lose";

export type BetType = "single" | "multiple" | "system";

export interface BetLeg {
  outcomeId: string;
  fixtureId: string;
  /** `fixture_name`, `market_name` and `outcome_name`, in both languages. */
  match: Localized;
  market: Localized;
  pick: Localized;
  /** Kick-off, ISO 8601 UTC. */
  startTime: string;
  /** The contract's decimal string: the price taken (`odds_taken`). */
  odds: string;
  result: LegResult;
}

/**
 * A ticket as the API keeps it (`Bet`). Every figure is the API's decimal
 * string (FD4), shown as it comes: nothing on a ticket is priced in the
 * browser. A figure the API didn't send is `null`, never a made-up zero.
 */
export interface Bet {
  /** The API's bet id, opaque (D3): the ticket's address under My bets. */
  id: string;
  /** The ticket number, `XXXX-XXXX-C` (D3). */
  ticketId: string;
  status: BetStatus;
  betType: BetType;
  systemSizes: number[];
  lines: number;
  stake: string;
  /** The part of the stake paid from the bonus balance. */
  stakeBonus: string | null;
  stakeTax: string;
  /** Display only, single-line bets (D1.11). */
  totalOdds: string | null;
  /** What the bet pays if every open leg wins. */
  potentialPayout: string;
  accaBonus: string;
  /** What the bet paid; null while it is open. */
  payout: string | null;
  /** Decided at settlement; null while the bet is open. */
  winTax: string | null;
  legs: BetLeg[];
  placedAt: string;
  settledAt: string | null;
}

/** One page of `GET /v1/bets`: `nextCursor` is null on the last. */
export interface BetPage {
  items: Bet[];
  nextCursor: string | null;
}

/** The contract's filter on My bets (`status`). */
export type BetsTab = "open" | "settled";
