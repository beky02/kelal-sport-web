"use client";

import { useEffect, useState } from "react";

const secondsTo = (deadline: number | null) =>
  deadline === null
    ? 0
    : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/**
 * Counts down to `deadline` (epoch ms), formatted `m:ss`; already elapsed
 * when there is none.
 *
 * A live timer rather than fixed text: "Resend code in 0:42" that never reaches
 * zero tells the user to wait forever.
 *
 * The deadline is wall-clock and fixed by whoever owns it — the challenge's
 * `resend_after`, counted from when it arrived — so a step that is remounted
 * after a refused code picks up where it was instead of starting over. The
 * remainder is recomputed from it on each tick rather than decremented:
 * decrementing drifts, and stalls completely while the tab is in the
 * background.
 */
export function useCountdown(deadline: number | null) {
  const [remaining, setRemaining] = useState(() => secondsTo(deadline));

  useEffect(() => {
    if (deadline === null) return;
    // Twice a second, so the number on screen is never visibly behind.
    const timer = setInterval(() => setRemaining(secondsTo(deadline)), 500);
    return () => clearInterval(timer);
  }, [deadline]);

  const minutes = Math.floor(remaining / 60);

  return {
    remaining,
    elapsed: remaining === 0,
    label: `${minutes}:${String(remaining % 60).padStart(2, "0")}`,
  };
}
