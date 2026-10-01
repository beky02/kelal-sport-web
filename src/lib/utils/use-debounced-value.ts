"use client";

import { useEffect, useState } from "react";

/**
 * Trails `value` by `delayMs`.
 *
 * The search field stays instant while the request it drives does not fire on
 * every keystroke. Only the query is delayed, never the typing.
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
