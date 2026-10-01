/**
 * Slip behaviour that is the UI's own. Every commercial number — taxes, stake
 * limits, the payout cap, the accumulator bonus, quick stakes — is the tenant's
 * rule set from `/v1/config/public` (D1.12), never a constant here.
 */
export const BETTING = {
  /** System bets need at least this many live selections (2/3 is the smallest). */
  minSystemSelections: 3,
  /** The total stake a fresh slip starts with. */
  defaultStake: "100",
} as const;

export const CURRENCY = { code: "ETB", amharic: "ብር" } as const;

/**
 * Copy for the system states, all **placeholders**.
 *
 * In production every one of these comes from the backend: a maintenance window
 * from a status endpoint, a cool-off end from the user's responsible-gaming
 * settings, a deposit-limit reset from their limits. They sit here so the states
 * can be built and reviewed before those endpoints exist.
 */
export const SYSTEM = {
  maintenance: {
    backAt: "06:00 EAT",
    startedAt: "04:00 EAT",
    duration: "about 2 hours",
  },
  coolOff: { until: "Wed 30 Sep, 14:00" },
  depositLimit: { dailyLimit: 2000, resetTime: "00:00 EAT" },
  realityCheck: { after: "1 hour" },
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
  /** `/v1/config/public` says `max-age=60`. */
  config: 60 * 1000,
} as const;

/**
 * How often the board and event page re-read prices while realtime is off.
 * Release 1 polls every 30 s (D5); with realtime on, prices arrive as messages
 * and nothing polls.
 */
export const ODDS_REFRESH_MS = 30 * 1000;
