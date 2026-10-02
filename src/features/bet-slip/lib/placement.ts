import { ApiError } from "@/lib/api/errors";
import { normaliseMoney } from "@/lib/money";
import type {
  BetSelection,
  OddsPolicy,
  PlaceAttempt,
  PlaceBetRequest,
  PlaceRefusal,
} from "../types";
import { stakeToPrice, type BetSlipTotals } from "./calculate";

/** The contract's `Odds` pattern: a price the slip can take. */
const ODDS = /^\d{1,6}\.\d{2,3}$/;

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

/** One placing intent: the request's contents, in its fixed key order. */
export const signatureOf = (request: PlaceBetRequest): string =>
  JSON.stringify(request);

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

/**
 * The key to place `request` with now.
 *
 * The last attempt's own key only when this is the same request again and that
 * attempt never had an answer that settles it — then the bet may already
 * exist, and the same key makes the engine return that ticket instead of
 * taking a second stake (C08 §2). Anything else is a new intent with a new
 * key: a changed slip, accepted odds, or a second bet on the same slip after
 * the first was placed (the old key would only replay the first ticket).
 */
export function keyFor(
  attempt: PlaceAttempt | null,
  request: PlaceBetRequest,
  make: () => string = newIdempotencyKey,
): string {
  return attempt?.status === "unanswered" &&
    signatureOf(attempt.request) === signatureOf(request)
    ? attempt.key
    : make();
}

export type PlacementOutcome = "unanswered" | "session" | "refused";

/**
 * What a failed attempt means for its key.
 *
 * `unanswered`: nothing settled it — no response, a 5xx, or a reply this app
 * could not read (a ticket may exist, so only the same request with the same
 * key may go again). `session`: the session is gone (the route handler has
 * refreshed once already). `refused`: the engine said no — a 4xx, or
 * `REAL_MONEY_DISABLED` — and the key is spent.
 */
export function placementOutcome(error: unknown): PlacementOutcome {
  if (!(error instanceof ApiError)) return "unanswered";
  if (error.status === 0) return "unanswered";
  if (error.status === 401) return "session";
  if (error.status >= 500 && error.code !== "REAL_MONEY_DISABLED") {
    return "unanswered";
  }
  return "refused";
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
      if (error.current && ODDS.test(error.current)) {
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
