import type { Player } from "@/features/auth/types";
import { ApiError } from "@/lib/api/errors";
import type { Break } from "../types";

/**
 * Whether a break or self-exclusion is in force for this player, as `/v1/me`
 * reports it: until `flags.excluded_until`, or with no end when the player is
 * `self_excluded` and no date is given (a permanent exclusion's `ends_at` is
 * null). Never measured against this browser's clock — the API says when a
 * break is over, and until it does the slip stays locked.
 */
export function breakOf(player: Player | null): Break | null {
  if (!player) return null;
  if (player.flags.excludedUntil) return { until: player.flags.excludedUntil };
  if (player.status === "self_excluded") return { until: null };
  return null;
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

/**
 * The API answered with a Problem, whose title is written for the player. An
 * answer that wasn't one (a proxy's page) has only this app's technical words.
 */
export const isProblem = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  error.code !== "http_error" &&
  error.code !== "network";
