import { apiClient } from "@/lib/api/client";
import { exclusionSchema } from "@/lib/api/schemas";
import type { Exclusion, SelfExclusionRequest } from "../types";

/** How long a break is waited for before the page says it couldn't confirm it. */
const EXCLUSION_DEADLINE_MS = 30_000;

/**
 * Takes a break or self-excludes (`/api/me/self-exclusion`). The API revokes
 * every session as it answers, and the route handler clears this one's
 * cookie: whatever comes back, the player is signed out once it started.
 */
export const selfExclude = (
  request: SelfExclusionRequest,
): Promise<Exclusion> =>
  apiClient.post("/me/self-exclusion", exclusionSchema, request, {
    signal: AbortSignal.timeout(EXCLUSION_DEADLINE_MS),
  });
