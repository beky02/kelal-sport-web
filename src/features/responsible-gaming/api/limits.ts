import { apiClient } from "@/lib/api/client";
import { rgLimitSchema, rgLimitsSchema } from "@/lib/api/schemas";
import type { LimitChange, RgLimit } from "../types";

/**
 * How long saving a limit is waited for before the page says it couldn't:
 * saving again sends the same value, which changes nothing more.
 */
const SAVE_DEADLINE_MS = 30_000;

/** The player's limits, current and pending, from the account (`/api/me/limits`). */
export const getLimits = (signal?: AbortSignal): Promise<RgLimit[]> =>
  apiClient.get("/me/limits", rgLimitsSchema, { signal });

/**
 * Sets or changes one limit. The answer is the API's limit — in force at
 * once, or holding the change back until its `pending.effectiveFrom`.
 */
export const changeLimit = (change: LimitChange): Promise<RgLimit> =>
  apiClient.put("/me/limits", rgLimitSchema, change, {
    signal: AbortSignal.timeout(SAVE_DEADLINE_MS),
  });
