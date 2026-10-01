"use client";

import { useCoolOffUntil } from "@/features/responsible-gaming/hooks/use-responsible-gaming";
import { useIsOnline } from "@/stores/system.store";

/**
 * Whether trading is locked for a reason outside the market itself.
 *
 * Two reasons, both of which stop a bet without being a market suspension:
 * offline means the prices on screen may already be wrong, and a break means the
 * user has asked not to be able to bet. They show the same lock, so the
 * affordance is consistent even though the causes differ.
 *
 * The break is read from the server rather than a client store — a break a user
 * could clear by reloading would not be one.
 */
export function useOddsLocked(): boolean {
  const online = useIsOnline();
  const coolOffUntil = useCoolOffUntil();
  return !online || coolOffUntil !== null;
}
