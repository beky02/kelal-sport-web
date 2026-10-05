import {
  LIMIT_PERIODS,
  LIMIT_TYPES,
  type Exclusion,
  type LimitChange,
  type LimitPeriod,
  type LimitType,
  type RgLimit,
  type SelfExclusionRequest,
} from "@/features/responsible-gaming/types";
import type { components } from "@/lib/api/schema";

type ApiLimit = components["schemas"]["RgLimit"];
type ApiLimitSet = components["schemas"]["RgLimitSet"];
type ApiSelfExclusionRequest = components["schemas"]["SelfExclusionRequest"];
type ApiExclusion = components["schemas"]["Exclusion"];

const isLimitType = (type: string): type is LimitType =>
  (LIMIT_TYPES as readonly string[]).includes(type);

const isLimitPeriod = (period: string): period is LimitPeriod =>
  (LIMIT_PERIODS as readonly string[]).includes(period);

/**
 * One limit as the screens show it: the API's strings and times, and null for
 * whatever it left out — never a zero, which would read as a limit of nothing.
 */
export const toLimit = (limit: ApiLimit): RgLimit => ({
  type: limit.type,
  period: limit.period,
  amount: limit.amount ?? null,
  minutes: limit.minutes ?? null,
  effectiveFrom: limit.effective_from,
  used: limit.used ?? null,
  pending: limit.pending
    ? {
        amount: limit.pending.amount ?? null,
        minutes: limit.pending.minutes ?? null,
        effectiveFrom: limit.pending.effective_from,
      }
    : null,
});

/**
 * `/v1/me/limits` → the player's limits. One of a type or period the contract
 * adds after this build is left out: the screens have nowhere to show it, and
 * the API enforces it either way.
 */
export const toLimits = (items: readonly ApiLimit[]): RgLimit[] =>
  items
    .filter((limit) => isLimitType(limit.type) && isLimitPeriod(limit.period))
    .map(toLimit);

/**
 * A limit as `PUT /v1/me/limits` takes it, with only the field that applies:
 * the contract reads `amount: null` as removing the limit, so a time limit
 * never carries one.
 */
export const toLimitSet = (change: LimitChange): ApiLimitSet =>
  change.type === "session_minutes"
    ? { type: change.type, period: change.period, minutes: change.minutes }
    : { type: change.type, period: change.period, amount: change.amount };

export const toSelfExclusionRequest = (
  request: SelfExclusionRequest,
): ApiSelfExclusionRequest => ({
  kind: request.kind,
  duration: request.duration,
});

/** The exclusion the API started; a permanent one has no end. */
export const toExclusion = (exclusion: ApiExclusion): Exclusion => ({
  kind: exclusion.kind,
  startsAt: exclusion.starts_at,
  endsAt: exclusion.ends_at ?? null,
});
