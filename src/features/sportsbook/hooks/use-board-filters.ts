"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { todayEat } from "@/lib/i18n/dates";

export type BoardFilter = "top" | "upcoming" | "today";

export interface BoardFilters {
  sport: string;
  filter: BoardFilter;
  date: string;
}

const FILTERS: readonly BoardFilter[] = ["top", "upcoming", "today"];
/** Today is the default day, so it is worked out per call, not once at load. */
const defaults = (): BoardFilters => ({
  sport: "football",
  filter: "top",
  date: todayEat(),
});

/**
 * Board filters live in the URL, not in a store.
 *
 * Refresh keeps the view, back goes back a filter, and a link to
 * `/?sport=football&date=2026-09-30` opens what the sender was looking at.
 * None of that works if this state sits in memory.
 */
export function useBoardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters = useMemo<BoardFilters>(() => {
    const filter = params.get("filter");
    const fallback = defaults();
    return {
      sport: params.get("sport") ?? fallback.sport,
      filter: FILTERS.includes(filter as BoardFilter)
        ? (filter as BoardFilter)
        : fallback.filter,
      date: params.get("date") ?? fallback.date,
    };
  }, [params]);

  const set = useCallback(
    (patch: Partial<BoardFilters>) => {
      const next = new URLSearchParams(params.toString());
      const fallback = defaults();
      for (const [key, value] of Object.entries(patch)) {
        // Keep the default out of the URL so the canonical view has a clean one.
        if (value === fallback[key as keyof BoardFilters]) next.delete(key);
        else next.set(key, String(value));
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  /** Back to the default view — the escape hatch from an empty board. */
  const reset = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  return { filters, set, reset };
}
