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

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (kind: string) => [...transactionKeys.all, kind] as const,
};

/** A break or self-exclusion in force — server state, read like the balance. */
export const rgKeys = {
  all: ["responsible-gaming"] as const,
};

export const walletKeys = {
  all: ["wallet"] as const,
  balance: () => [...walletKeys.all, "balance"] as const,
};
