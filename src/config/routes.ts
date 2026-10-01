/** Every internal path in one place, so no component hardcodes a URL. */
export const routes = {
  home: "/",
  sport: (slug: string) => `/sports/${slug}`,
  live: "/live",
  competition: (id: string) => `/competition/${id}`,
  event: (id: string) => `/event/${id}`,
  search: "/search",

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
