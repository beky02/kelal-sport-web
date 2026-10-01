import type { Localized } from "@/types/common";

/**
 * What the UI knows how to lay out. Derived from the contract's `template_id`
 * (`m_1x2` → `1x2`, `m_total` → `ou`…); a template the UI has no layout for is
 * `other` and renders as a plain grid of labelled prices.
 */
export type MarketType =
  "1x2" | "ml" | "dc" | "ou" | "btts" | "hc" | "cs" | "other";

/**
 * The market group code from the dictionary: `main`, `goals`, `halves`,
 * `handicap`, `corners`, `player`. A string, because the book adds groups.
 */
export type MarketCategory = string;

/** A market group the event page can filter by, named in both languages. */
export interface MarketGroup {
  code: MarketCategory;
  name: Localized;
}

export type MarketStatus = "open" | "suspended";

export type OddsMovement = "up" | "down";

export interface Outcome {
  /**
   * The contract's outcome ID (`oc_ac_1`). This, not the code, is what goes into
   * slips, bookings and bets.
   */
  id: string;
  /** Stable within a market: `1`, `X`, `2`, `Over`, `Yes`, `2–1`… */
  code: string;
  /** Resolved for display, e.g. "Man City" for `1`, "Over 2.5" for `Over`. */
  label: Localized;
  /**
   * The contract's decimal string (`"2.10"`). Null means this outcome is closed —
   * render the lock, never a price. Parsed only to display (FD4).
   */
  odds: string | null;
  previousOdds: string | null;
  /** Set for a few seconds after a move, to tint the button and show ▲ / ▼. */
  movement: OddsMovement | null;
}

export interface Market {
  /** The contract's market ID (`mk_ac_1x2`). */
  id: string;
  eventId: string;
  /** Dictionary template (`m_total`); markets sharing one are shown as one card. */
  templateId: string;
  type: MarketType;
  category: MarketCategory;
  /** This line's name: `Total 2.5`. */
  name: Localized;
  /** The market without its line, `Total` — the title of the card holding every line. */
  title: Localized;
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
