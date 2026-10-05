import { ApiError } from "@/lib/api/errors";
import { MONEY_PATTERN } from "@/lib/api/patterns";
import { compareMoney, normaliseMoney } from "@/lib/money";
import {
  LIMIT_PERIODS,
  MONEY_LIMIT_TYPES,
  type LimitPeriod,
  type LimitType,
  type MoneyLimitType,
  type RgLimit,
} from "../types";

/** The player's limit of this type and period, or null where they set none. */
export const limitFor = (
  limits: readonly RgLimit[],
  type: LimitType,
  period: LimitPeriod,
): RgLimit | null =>
  limits.find((limit) => limit.type === type && limit.period === period) ??
  null;

/** Where a limit's card opens: the first period holding one, else the day. */
export const openingPeriod = (
  limits: readonly RgLimit[],
  type: LimitType,
): LimitPeriod =>
  LIMIT_PERIODS.find((period) => limitFor(limits, type, period) !== null) ??
  "day";

/** A limit counted in money: deposit, stake or loss. Throws for the time limit. */
export function moneyType(type: LimitType): MoneyLimitType {
  const money = MONEY_LIMIT_TYPES.find((t) => t === type);
  if (!money) throw new RangeError(`Not a money limit: ${type}`);
  return money;
}

/** What a typed limit sends, or why nothing can go yet. */
export type LimitValue =
  { amount: string } | { minutes: number } | "empty" | "tooLow" | "tooHigh";

/** Whole minutes, at most six digits — the route handler's own bound. */
const MAX_MINUTES = 999_999;

/**
 * A limit as the player typed it, in the contract's form: money as a `Money`
 * string above zero, time in whole minutes from one (plan decision 5). A zero
 * limit is not offered — the break is the tool for stopping altogether — and
 * whether the API takes the value is the API's to say.
 */
export function limitValue(type: LimitType, typed: string): LimitValue {
  const value = typed.replace(/\.$/, "");
  if (value === "") return "empty";
  if (type === "session_minutes") {
    if (!/^\d+$/.test(value)) return "empty";
    if (value.length > 6) return "tooHigh";
    const minutes = Number(value);
    if (minutes < 1) return "tooLow";
    return minutes > MAX_MINUTES ? "tooHigh" : { minutes };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return "empty";
  const amount = normaliseMoney(value);
  if (!MONEY_PATTERN.test(amount)) return "tooHigh";
  return compareMoney(amount, "0.00") > 0 ? { amount } : "tooLow";
}

/**
 * What a break that didn't come back means. `session`: the session is gone
 * (the route handler has refreshed once already). `unanswered`: no answer —
 * the network, 30 s, a rate limit, a 5xx or a reply this app couldn't read —
 * so it may have started; a second request can't start another, since a
 * break revokes the session the request rides on. `refused`: the API said
 * no; nothing started.
 */
export type ExclusionOutcome = "unanswered" | "session" | "refused";

export function exclusionOutcome(error: unknown): ExclusionOutcome {
  if (!(error instanceof ApiError) || error.status === 0) return "unanswered";
  if (error.status === 401) return "session";
  if (error.status === 429 || error.status >= 500) return "unanswered";
  return "refused";
}
