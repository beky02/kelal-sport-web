"use client";

import { useEffect } from "react";
import { useBetSlipStore } from "../stores/bet-slip.store";

/**
 * Each slip's stake starts at the rule set's minimum (the user's decision,
 * 2026-10-08), on the player's slip with `betting` and on the kiosk with
 * `retail_betting`: `"5.00"` reads `"5"`, as a quick stake does. The store
 * remembers the minimum and starts each slip at it once, the first time it is
 * on screen (`startStake`, `switchSlip`, `resetAll`); a stake typed, tapped,
 * cleared or loaded from a code is kept.
 */
export function useStartingStake(minStake: string | null) {
  useEffect(() => {
    if (minStake) useBetSlipStore.getState().startStake(minStake);
  }, [minStake]);
}
