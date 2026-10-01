/**
 * Commercial placeholders. The backend is authoritative for every one of
 * these — the values here only drive the display estimate in the bet slip and
 * must be replaced by whatever /config returns once that endpoint exists.
 */
export const BETTING = {
  /** Withheld from the stake before odds are applied. */
  stakeTaxRate: 0.15,
  /** Withheld from winnings (gross return − stake). */
  winTaxRate: 0.15,
  /** Payout ceiling per ticket, applied per bet before winnings tax. */
  maxWinPerTicket: 1_000_000,
  /** System bets need at least this many live selections. */
  minSystemSelections: 3,
  /** Ceiling the book applies to a single selection. Server-enforced. */
  maxStakePerSelection: 500,
  defaultStake: 100,
  stakeChips: [10, 50, 100, 500],
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
} as const;

/**
 * How often the board and event page re-read prices while realtime is off.
 * Release 1 polls every 30 s (D5); with realtime on, prices arrive as messages
 * and nothing polls.
 */
export const ODDS_REFRESH_MS = 30 * 1000;
