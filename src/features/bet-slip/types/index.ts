import type { Localized } from "@/types/common";
import type { MarketType } from "@/features/markets/types";
import type { ProblemFieldError } from "@/lib/api/errors";
import { compareOdds } from "@/lib/money";

export type BetSlipMode = "single" | "multiple" | "system";

/**
 * What the engine may do with a price that moved before the bet reached it
 * (the contract's `OddsPolicy`): refuse any change, take a better price, or
 * take any price.
 */
export type OddsPolicy = "none" | "higher" | "any";

export const ODDS_POLICIES: readonly OddsPolicy[] = ["none", "higher", "any"];

export type SelectionStatus = "active" | "suspended" | "odds_changed";

/**
 * One pick in the slip.
 *
 * `initialOdds` is the price the player agreed to — when they tapped, or when
 * they last accepted a move; `currentOdds` is what the book says now. The gap
 * between them is the whole reason the slip has an accept-changes flow, so
 * both are kept rather than overwritten in place. Both are the contract's
 * decimal strings (FD4).
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

/** What the browser asks `/api/bets` to place: the slip as the player agreed to it. */
export interface PlaceBetRequest {
  betType: BetSlipMode;
  /** `[k]` for a system bet (k of n); empty for any other. */
  systemSizes: number[];
  /** Each live pick, with the odds on screen when Place was tapped. */
  legs: Array<{ outcomeId: string; odds: string }>;
  /** The total stake as typed, as a decimal string (`"100.00"`, D1.3). */
  stake: string;
  oddsPolicy: OddsPolicy;
}

/**
 * The ticket the engine issued (`PlacedBet`), as the slip confirms it. Every
 * figure is the API's — never the preview's — as decimal strings (FD4).
 */
export interface BetReceipt {
  /** The bet's own id: its page in My bets. */
  id: string;
  /** `K7Q2-M9XP-M` (D3): what the player reads out, types in, or has scanned. */
  ticketId: string;
  placedAt: string;
  betType: BetSlipMode;
  systemSizes: number[];
  lines: number;
  legCount: number;
  stake: string;
  stakeTax: string;
  /** Single-line bets only (D1.11); null otherwise. */
  totalOdds: string | null;
  accaBonus: string;
  potentialPayout: string;
}

/**
 * One request to place, and its `Idempotency-Key`. `sending` while in flight;
 * `unanswered` when it got no answer that settles it (no response, a 5xx, a
 * reply this app could not read) — then the bet may exist, and only the same
 * request with the same key may go again.
 */
export interface PlaceAttempt {
  request: PlaceBetRequest;
  key: string;
  status: "sending" | "unanswered";
}

/** The engine's refusal of the slip as it stands: its Problem, as kept and shown. */
export interface PlaceRefusal {
  status: number;
  /** The contract's `ErrorCode` — what the UI switches on. */
  code: string;
  /** The API's translated `title`, for a code this app has no copy of. */
  title: string;
  detail: string | null;
  errors: ProblemFieldError[];
  /** Seconds to wait (`Retry-After`), when the API said. */
  retryAfter: number | null;
}

/** The price moved since it was agreed — `"2.1"` to `"2.10"` is no move. */
export const oddsMoved = (s: BetSelection): boolean =>
  compareOdds(s.currentOdds, s.initialOdds) !== 0;

/**
 * The move needs the player's yes before the bet can go: every move under
 * `none`, a drop under `higher`, nothing under `any` — exactly the moves the
 * engine would refuse under the same policy (C08 §7).
 */
export function awaitsConsent(s: BetSelection, policy: OddsPolicy): boolean {
  const move = compareOdds(s.currentOdds, s.initialOdds);
  if (move === 0) return false;
  switch (policy) {
    case "none":
      return true;
    case "higher":
      return move < 0;
    case "any":
      return false;
  }
}

export const selectionStatus = (s: BetSelection): SelectionStatus =>
  s.suspended ? "suspended" : oddsMoved(s) ? "odds_changed" : "active";
