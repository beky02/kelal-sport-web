"use client";

import { useQuery } from "@tanstack/react-query";
import { searchKeys } from "@/lib/query/keys";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";
import { useSportsbookChrome } from "@/features/sportsbook/chrome";
import { search } from "../api/search";

/**
 * Search results for what the user has typed.
 *
 * The term is debounced, so typing stays immediate while the request does not
 * fire per keystroke. Results are cached per term: backspacing to something
 * already typed shows instantly.
 */
export function useSearch(query: string) {
  const { useDataSaver } = useSportsbookChrome();
  const dataSaver = useDataSaver();
  const term = useDebouncedValue(query.trim(), 200);

  return useQuery({
    queryKey: searchKeys.query(term, dataSaver),
    queryFn: ({ signal }) => search(term, dataSaver, signal),
    enabled: term.length > 0,
    staleTime: 60_000,
  });
}
