"use client";

import { useEffect } from "react";
import { useBetSlipStore } from "../stores/bet-slip.store";

/**
 * Each slip's stake starts at the rule set's minimum (the user's decision,
 * 2026-10-08), on the player's slip with `betting` and on the kiosk with
 * `retail_betting`: `"5.00"` reads `"5"`, as a quick stake does. Once per
 * slip (`startStake`): a stake typed, tapped, cleared or loaded from a code is
 * kept, so it runs when the rules arrive and when a slip first comes on
 * screen (F3c), not on every change after.
 */
export function useStartingStake(minStake: string | null) {
  const active = useBetSlipStore((s) => s.active);
  useEffect(() => {
    if (minStake) useBetSlipStore.getState().startStake(minStake);
  }, [minStake, active]);
}
