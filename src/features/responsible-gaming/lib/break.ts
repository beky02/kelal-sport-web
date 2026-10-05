import type { Player } from "@/features/auth/types";
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
