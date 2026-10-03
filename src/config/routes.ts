/** Every internal path in one place, so no component hardcodes a URL. */
export const routes = {
  home: "/",
  sport: (slug: string) => `/sports/${slug}`,
  live: "/live",
  competition: (id: string) => `/competition/${id}`,
  event: (id: string) => `/event/${id}`,
  search: "/search",
  /** A booking code's deep link (D7, FD3) — unprefixed until F2a adds `/{lang}`. */
  booking: (code: string) => `/b/${encodeURIComponent(code)}`,
  /** The public ticket check (D7, FD3): `/t/K7Q2-M9XP-M`, unprefixed until F2a. */
  ticket: (ticketId: string) => `/t/${encodeURIComponent(ticketId)}`,
  /** The ticket check's form; `?ticket=` sends a typed number to `ticket()`. */
  ticketCheck: "/t",
  /** Where the proxy renders `/t/{x}`'s 404 when x is no ticket number. */
  ticketMissing: "/t?missing=1",

  myBets: "/my-bets",
  bet: (id: string) => `/my-bets/${id}`,
  wallet: "/wallet",
  /** Opens the wallet straight into a deposit or withdrawal. */
  walletAction: (action: "deposit" | "withdraw") => `/wallet?action=${action}`,
  transactions: "/transactions",
  profile: "/profile",

  login: "/login",
  register: "/register",
  responsibleGaming: "/responsible-gaming",

  terms: "/terms",
  privacy: "/privacy",
  help: "/help",
  telegram: "/telegram",
} as const;
