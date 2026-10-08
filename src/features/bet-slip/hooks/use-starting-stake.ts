"use client";

import { useEffect } from "react";
import { useBetSlipStore } from "../stores/bet-slip.store";

/**
 * The stake starts at the rule set's minimum (the user's decision,
 * 2026-10-08), on the player's slip with `betting` and on the kiosk with
 * `retail_betting`: `"5.00"` reads `"5"`, as a quick stake does. Only an
 * untouched stake is set — one typed, tapped or loaded from a code is kept —
 * so it runs when the rules arrive, not on every change after.
 */
export function useStartingStake(minStake: string | null) {
  useEffect(() => {
    if (!minStake) return;
    const { stake, setStake } = useBetSlipStore.getState();
    if (stake === "") setStake(minStake.replace(/\.00$/, ""));
  }, [minStake]);
}
