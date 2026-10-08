import { env } from "./env";

/**
 * Slip behaviour that is the UI's own. Every commercial number — taxes, stake
 * limits, the payout cap, the accumulator bonus, quick stakes — is the tenant's
 * rule set from `/v1/config/public` (D1.12), never a constant here.
 */
export const BETTING = {
  /** System bets need at least this many live selections (2/3 is the smallest). */
  minSystemSelections: 3,
} as const;

/**
 * The shares a partial cash-out can take, as exact fractions so the preview of
 * an amount never goes through a float.
 */
export const CASH_OUT_SHARES = [
  { fraction: 0.25, numerator: 1, denominator: 4, labelKey: "bets.part25" },
  { fraction: 0.5, numerator: 1, denominator: 2, labelKey: "bets.part50" },
  { fraction: 1, numerator: 1, denominator: 1, labelKey: "bets.partAll" },
] as const;

export const CURRENCY = { code: "ETB", amharic: "ብር" } as const;

/**
 * Copy for the system states, all **placeholders**.
 *
 * In production every one of these comes from the backend: a maintenance window
 * from a status endpoint. They sit here so the state can be built and reviewed
 * before that endpoint exists. A break's end and the limits are the account's
 * already (F7a), and so is the reality check's interval (F7b).
 */
export const SYSTEM = {
  maintenance: {
    backAt: "06:00 EAT",
    startedAt: "04:00 EAT",
    duration: "about 2 hours",
  },
} as const;

/** Placeholder licence copy shown in the sidebar footer. */
export const LICENCE = {
  authority: "Ethiopian Lottery Service",
  number: "ELS/SB/0000/2026",
  minimumAge: 21,
} as const;

/**
 * Cache windows per the data's own volatility.
 */
export const STALE_TIME = {
  sports: 30 * 60 * 1000,
  competitions: 10 * 60 * 1000,
  events: 30 * 1000,
  eventDetail: 30 * 1000,
  wallet: 15 * 1000,
  /** The player's limits: read again on focus and after a bet or a deposit. */
  limits: 30 * 1000,
  /** `/v1/config/public` says `max-age=60`. */
  config: 60 * 1000,
} as const;

/**
 * How often the board and event page re-read prices while realtime is off.
 * Release 1 polls every 30 s (D5); with realtime on, prices arrive as messages
 * and nothing polls. The local simulation ticks faster so moves are visible.
 */
export const ODDS_REFRESH_MS =
  env.realtime === "simulate" ? 8 * 1000 : 30 * 1000;
