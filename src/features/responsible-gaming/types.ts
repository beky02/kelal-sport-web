/** The contract's `RgLimitType`, in its order: what a limit is on. */
export const LIMIT_TYPES = [
  "deposit",
  "stake",
  "loss",
  "session_minutes",
] as const;
export type LimitType = (typeof LIMIT_TYPES)[number];

/** A limit counted in money; `session_minutes` is counted in minutes. */
export const MONEY_LIMIT_TYPES = ["deposit", "stake", "loss"] as const;
export type MoneyLimitType = (typeof MONEY_LIMIT_TYPES)[number];

/** The contract's `RgPeriod`, in its order: what a limit is per. */
export const LIMIT_PERIODS = ["day", "week", "month"] as const;
export type LimitPeriod = (typeof LIMIT_PERIODS)[number];

/** A change the API has accepted but not applied yet (C12: an increase waits 24 h). */
export interface PendingLimit {
  /** The new amount; null with `minutes` null when the limit is being removed. */
  amount: string | null;
  minutes: number | null;
  /** When it applies — the API's time, never worked out here. */
  effectiveFrom: string;
}

/**
 * One of the player's limits, as `/v1/me/limits` states it. Read from the
 * account, never kept in the browser: a limit set on one device is the limit
 * on every other (RG-01).
 */
export interface RgLimit {
  type: LimitType;
  period: LimitPeriod;
  /** The contract's `Money` string for a money limit; null for a time limit. */
  amount: string | null;
  /** Minutes for a time limit; null for a money limit. */
  minutes: number | null;
  effectiveFrom: string;
  /** What the current period has used, as the API counts it; null when it sends none. */
  used: string | null;
  pending: PendingLimit | null;
}

/**
 * A limit the player sets: a money limit in the contract's `Money` form, or a
 * time limit in whole minutes. Each carries only its own field — a time limit
 * sent with `amount: null` would read as a removal.
 */
export type LimitChange =
  | { type: MoneyLimitType; period: LimitPeriod; amount: string }
  | { type: "session_minutes"; period: LimitPeriod; minutes: number };

/** The contract's `SelfExclusionRequest.kind`: a short break, or a self-exclusion. */
export const EXCLUSION_KINDS = ["time_out", "self_exclusion"] as const;
export type ExclusionKind = (typeof EXCLUSION_KINDS)[number];

/** The contract's durations, in its order. */
export const EXCLUSION_DURATIONS = [
  "24h",
  "7d",
  "30d",
  "6m",
  "1y",
  "5y",
  "permanent",
] as const;
export type ExclusionDuration = (typeof EXCLUSION_DURATIONS)[number];

export interface SelfExclusionRequest {
  kind: ExclusionKind;
  duration: ExclusionDuration;
}

/** An exclusion in force, as `POST /v1/me/self-exclusion` answers it. */
export interface Exclusion {
  kind: ExclusionKind | "operator_exclusion";
  startsAt: string;
  /** Null for a permanent one. */
  endsAt: string | null;
}

/**
 * A break or self-exclusion in force, as `/v1/me` reports it: until a time,
 * or `until: null` for one with no end. Whether one is running is the API's
 * to say — nothing in the browser can end it.
 */
export interface Break {
  until: string | null;
}
