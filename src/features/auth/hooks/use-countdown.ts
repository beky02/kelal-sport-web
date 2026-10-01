"use client";

import { useEffect, useState } from "react";

/**
 * Counts down from `seconds`, formatted `m:ss`.
 *
 * A live timer rather than fixed text: "Resend code in 0:42" that never reaches
 * zero tells the user to wait forever.
 *
 * The deadline is wall-clock and fixed once per run, and the remainder is
 * recomputed from it on each tick rather than decremented. Decrementing drifts,
 * and stalls completely while the tab is in the background — a timer that is
 * wrong after a moment away is worse than no timer.
 */
export function useCountdown(seconds: number, running: boolean) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (!running) return;

    const deadline = Date.now() + seconds * 1000;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

    // Twice a second, so the number on screen is never visibly behind.
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [seconds, running]);

  const minutes = Math.floor(remaining / 60);

  return {
    remaining,
    elapsed: remaining === 0,
    label: `${minutes}:${String(remaining % 60).padStart(2, "0")}`,
  };
}
