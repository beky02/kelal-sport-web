import { ApiError } from "@/lib/api/errors";
import { ODDS_PATTERN } from "@/lib/api/patterns";
import { compareOdds, normaliseMoney } from "@/lib/money";
import type {
  BetSelection,
  OddsPolicy,
  PlaceAttempt,
  PlaceBetRequest,
  PlaceRefusal,
} from "../types";
import { stakeToPrice, type BetSlipTotals } from "./calculate";

/**
 * The slip as a bet, or null while it can't be placed as it stands: no price
 * yet (no rules, no stake, a stake refused), a same-match clash, a suspended
 * pick, or a move the player still has to accept.
 *
 * Each live pick goes with the odds on screen — the price the player agreed
 * to. The stake is the total as typed; the engine splits it per line exactly
 * as the preview did (D1.3).
 */
export function placeRequestFrom({
  selections,
  totals,
  stake,
  oddsPolicy,
}: {
  selections: readonly BetSelection[];
  totals: BetSlipTotals;
  stake: string;
  oddsPolicy: OddsPolicy;
}): PlaceBetRequest | null {
  const typed = stakeToPrice(stake);
  if (
    !typed ||
    !totals.quote ||
    totals.hasConflict ||
    totals.suspendedSelection ||
    totals.pendingOddsChanges.length > 0
  ) {
    return null;
  }
  return {
    betType: totals.betType,
    systemSizes: totals.betType === "system" ? [totals.systemK] : [],
    legs: selections
      .filter((s) => !s.suspended)
      .map((s) => ({ outcomeId: s.outcomeId, odds: s.currentOdds })),
    stake: normaliseMoney(typed),
    oddsPolicy,
  };
}

/**
 * The same bet: the same picks — in any order — the same bet type and size,
 * and the same stake. Prices and the odds policy are not what makes a bet:
 * the engine prices it when it arrives.
 */
export function sameBet(a: PlaceBetRequest, b: PlaceBetRequest): boolean {
  const picks = (r: PlaceBetRequest) =>
    r.legs
      .map((l) => l.outcomeId)
      .sort()
      .join();
  return (
    a.betType === b.betType &&
    a.systemSizes.join() === b.systemSizes.join() &&
    a.stake === b.stake &&
    picks(a) === picks(b)
  );
}

/** The same bet with every pick at the same price — `"3.05"` and `"3.050"` are one. */
export function samePrices(a: PlaceBetRequest, b: PlaceBetRequest): boolean {
  if (!sameBet(a, b)) return false;
  const odds = new Map(b.legs.map((l) => [l.outcomeId, l.odds]));
  return a.legs.every((l) => {
    const other = odds.get(l.outcomeId);
    return other !== undefined && compareOdds(l.odds, other) === 0;
  });
}

/**
 * Refusals about the bet's own prices or picks: a Try again of it would meet
 * them again, so they are the player's to settle on the slip.
 */
export const refusesPicks = (refusal: PlaceRefusal): boolean =>
  refusal.code === "BET_ODDS_CHANGED" ||
  refusal.code === "BET_EVENT_STARTED" ||
  refusal.code === "BET_MARKET_SUSPENDED";

/**
 * Whether the slip on screen still is the unconfirmed bet, so its main
 * button is Try again. A price that moved since doesn't make it another bet
 * — Try again sends it as it was, and the engine prices it under its own
 * policy — unless the engine has since refused that bet's prices or picks
 * (`stale`): then only the very same prices are it. Null — a slip that can't
 * be placed as it stands — is not.
 */
export function slipIsThatBet(
  slip: PlaceBetRequest | null,
  unconfirmed: PlaceAttempt,
  stale: boolean,
): boolean {
  if (slip === null) return false;
  return stale
    ? samePrices(slip, unconfirmed.request)
    : sameBet(slip, unconfirmed.request);
}

/**
 * A v4 UUID for an `Idempotency-Key`. `crypto.randomUUID` exists only in a
 * secure context, so a phone testing over plain HTTP on the LAN gets the same
 * from `getRandomValues`.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export type PlacementOutcome =
  | { kind: "unanswered" }
  | { kind: "session" }
  | { kind: "refused"; error: ApiError };

/**
 * What a failed attempt means.
 *
 * `unanswered`: nothing settled it — no response (a dropped connection, the
 * 30 s limit), a 5xx, or a reply this app could not read; a ticket may exist,
 * so the bet stays unconfirmed and only the same request with the same key
 * may go again. `session`: the session is gone (the route handler has
 * refreshed once already). `refused`: the engine said no to this attempt — a
 * 4xx, or `REAL_MONEY_DISABLED`.
 */
export function placementOutcome(error: unknown): PlacementOutcome {
  if (!(error instanceof ApiError) || error.status === 0) {
    return { kind: "unanswered" };
  }
  if (error.status === 401) return { kind: "session" };
  if (error.status >= 500 && error.code !== "REAL_MONEY_DISABLED") {
    return { kind: "unanswered" };
  }
  return { kind: "refused", error };
}

/** A refusal as the slip keeps it: the Problem's contract fields. */
export function refusalOf(error: ApiError): PlaceRefusal {
  const problem = error.details as { detail?: unknown } | null | undefined;
  return {
    status: error.status,
    code: error.code,
    title: error.message,
    detail: typeof problem?.detail === "string" ? problem.detail : null,
    errors: error.errors,
    retryAfter: error.retryAfter,
  };
}

/** A pick the engine re-priced: the price it was sent at, and the price now. */
export interface OddsUpdate {
  outcomeId: string;
  sent: string;
  current: string;
}

/**
 * What a refusal asks the slip to change. A 409 names legs by their place in
 * the request that was sent (`legs[1].odds`): `BET_ODDS_CHANGED` re-prices
 * each one with `errors[].current`, `BET_EVENT_STARTED` and
 * `BET_MARKET_SUSPENDED` close them. A leg that is not in the request, or a
 * "current" that is not a price, changes nothing.
 */
export function legUpdates(
  refusal: PlaceRefusal,
  request: PlaceBetRequest,
): { odds: OddsUpdate[]; closed: string[] } {
  const odds: OddsUpdate[] = [];
  const closed: string[] = [];
  for (const error of refusal.errors) {
    const index = /^legs\[(\d+)\]/.exec(error.field ?? "")?.[1];
    const leg = index === undefined ? undefined : request.legs[Number(index)];
    if (!leg) continue;
    if (refusal.code === "BET_ODDS_CHANGED") {
      if (error.current && ODDS_PATTERN.test(error.current)) {
        odds.push({
          outcomeId: leg.outcomeId,
          sent: leg.odds,
          current: error.current,
        });
      }
    } else if (
      refusal.code === "BET_EVENT_STARTED" ||
      refusal.code === "BET_MARKET_SUSPENDED"
    ) {
      closed.push(leg.outcomeId);
    }
  }
  return { odds, closed };
}
