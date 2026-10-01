import type { Localized } from "@/types/common";

export type MarketType = "1x2" | "dc" | "ou" | "btts" | "hc" | "cs";

export type MarketCategory = "main" | "goals" | "hc" | "cs";

export type MarketStatus = "open" | "suspended";

export type OddsMovement = "up" | "down";

export interface Outcome {
  /** Stable within a market: `1`, `X`, `2`, `Over`, `Yes`, `2–1`… */
  code: string;
  /** Resolved for display, e.g. "Man City" for `1`, "Over 2.5" for `Over`. */
  label: Localized;
  /** Null means this outcome is closed — render the lock, never a price. */
  odds: number | null;
  previousOdds: number | null;
  /** Set for a few seconds after a move, to tint the button and show ▲ / ▼. */
  movement: OddsMovement | null;
}

export interface Market {
  /** `${eventId}:${type}:${line ?? ""}` */
  id: string;
  eventId: string;
  type: MarketType;
  category: MarketCategory;
  name: Localized;
  /** Handicap or goal line, e.g. `2.5`, `−1`. Null for unlined markets. */
  line: string | null;
  status: MarketStatus;
  outcomes: Outcome[];
}

/** Identifies one price anywhere in the book. */
export interface OutcomeRef {
  eventId: string;
  marketType: MarketType;
  line: string | null;
  outcomeCode: string;
}

export const outcomeKey = (ref: OutcomeRef): string =>
  `${ref.eventId}#${ref.marketType}|${ref.line ?? ""}|${ref.outcomeCode}`;
