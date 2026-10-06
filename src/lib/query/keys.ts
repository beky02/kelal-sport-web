import type { EventFilters } from "@/features/events/types";

/**
 * Query keys, centralised.
 *
 * Hierarchical on purpose: invalidating `eventKeys.lists()` drops every board
 * variant without touching a cached event detail.
 */
/** Who is signed in (`/api/me`). Invalidated after login; set to a guest on logout. */
export const sessionKeys = {
  all: ["session"] as const,
  me: () => [...sessionKeys.all, "me"] as const,
};

export const configKeys = {
  all: ["config"] as const,
  public: () => [...configKeys.all, "public"] as const,
};

export const bookingKeys = {
  all: ["bookings"] as const,
  detail: (code: string) => [...bookingKeys.all, code] as const,
};

export const sportKeys = {
  all: ["sports"] as const,
  list: () => [...sportKeys.all, "list"] as const,
};

export const competitionKeys = {
  all: ["competitions"] as const,
  top: () => [...competitionKeys.all, "top"] as const,
  countries: () => [...competitionKeys.all, "countries"] as const,
};

export const eventKeys = {
  all: ["events"] as const,
  lists: () => [...eventKeys.all, "list"] as const,
  board: (filters: EventFilters, dataSaver: boolean) =>
    [...eventKeys.lists(), { ...filters, dataSaver }] as const,
  /** Prefix of every cached copy of one fixture, whatever the data saver. */
  details: (id: string) => [...eventKeys.all, "detail", id] as const,
  detail: (id: string, dataSaver: boolean) =>
    [...eventKeys.details(id), { dataSaver }] as const,
};

export const searchKeys = {
  all: ["search"] as const,
  query: (query: string, dataSaver: boolean) =>
    [...searchKeys.all, query, { dataSaver }] as const,
};

export const betKeys = {
  all: ["bets"] as const,
  list: (tab: string) => [...betKeys.all, "list", tab] as const,
  /** The aside's count: the first page of open bets alone, apart from the paged list. */
  openCount: () => [...betKeys.all, "open-count"] as const,
  detail: (id: string) => [...betKeys.all, "detail", id] as const,
};

/**
 * The wallet history — personal data, under one root the session watcher
 * drops when the player changes.
 */
export const transactionKeys = {
  all: ["transactions"] as const,
  /**
   * The paged history under one filter, in one language: a movement's label
   * is the API's, read with the UI's `Accept-Language`.
   */
  list: (filter: string, lang: string) =>
    [...transactionKeys.all, "list", filter, lang] as const,
  /** The wallet's recent activity: the latest few, apart from the paged list. */
  recent: (lang: string) => [...transactionKeys.all, "recent", lang] as const,
};

/**
 * The player's limits (F7a) — personal data, under one root the session
 * watcher drops when the player changes. A break in force is `/api/me`'s.
 */
export const rgKeys = {
  all: ["responsible-gaming"] as const,
  limits: () => [...rgKeys.all, "limits"] as const,
};

/**
 * The player's account (F7b): the devices signed in to it — personal data
 * (IPs), under one root the session watcher drops when the player changes.
 * `update` names the mutation that saves a preference, so any screen can tell
 * a save is under way.
 */
export const accountKeys = {
  all: ["account"] as const,
  sessions: () => [...accountKeys.all, "sessions"] as const,
  update: () => [...accountKeys.all, "update"] as const,
};

export const walletKeys = {
  all: ["wallet"] as const,
  balance: () => [...walletKeys.all, "balance"] as const,
};

/**
 * Payment methods, deposits, payout accounts and withdrawals — the player's
 * own (`playerAuth`), under one root the session watcher drops when the
 * player changes. Apart from the wallet's, so placing a bet (which re-reads
 * the balance) doesn't re-read the methods.
 */
export const paymentKeys = {
  all: ["payments"] as const,
  /** Every language's methods: read again when the API says one is down. */
  methodLists: () => [...paymentKeys.all, "methods"] as const,
  /** The methods offered to this player, in one language: names are the API's. */
  methods: (lang: string) => [...paymentKeys.methodLists(), lang] as const,
  /**
   * One deposit, polled while it is going, in one language: its next action's
   * message and its failure reason are the API's text.
   */
  deposit: (id: string, lang: string) =>
    [...paymentKeys.all, "deposit", id, lang] as const,
  /** The player's saved payout accounts: nothing in them is translated. */
  payoutAccounts: () => [...paymentKeys.all, "payout-accounts"] as const,
  /** Every language's copy of one withdrawal: read again after a cancel. */
  withdrawals: (id: string) => [...paymentKeys.all, "withdrawal", id] as const,
  /** One withdrawal in one language: its rejection reason is the API's text. */
  withdrawal: (id: string, lang: string) =>
    [...paymentKeys.withdrawals(id), lang] as const,
};

/**
 * The shop terminal (F8b) and its kiosk (F8ca). No player is ever signed in
 * on one, so nothing here is personal and no session watcher applies. The
 * kiosk's catalogue uses the player's keys: it is the player's fetchers.
 */
export const terminalKeys = {
  all: ["terminal"] as const,
  status: () => [...terminalKeys.all, "status"] as const,
  config: () => [...terminalKeys.all, "config"] as const,
};
