"use client";

import { useEffect, useState } from "react";
import { msToMidnightEat, todayEat } from "./dates";

/**
 * Today in East Africa Time, `YYYY-MM-DD` — and a new value at midnight EAT,
 * so a screen left open across it (a shop kiosk always is) moves to the new
 * day by itself instead of staying on yesterday (F8ca review Q2).
 */
export function useTodayEat(): string {
  const [today, setToday] = useState(todayEat);
  useEffect(() => {
    // Just past midnight, so the new day is the one read.
    const timer = setTimeout(
      () => setToday(todayEat()),
      msToMidnightEat() + 50,
    );
    return () => clearTimeout(timer);
  }, [today]);
  return today;
}
