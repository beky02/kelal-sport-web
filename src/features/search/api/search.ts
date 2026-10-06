import { apiClient } from "@/lib/api/client";
import { searchResultsSchema } from "@/lib/api/catalogue-schemas";
import type { SearchResults } from "../types";

export async function search(
  query: string,
  dataSaver: boolean,
  signal?: AbortSignal,
): Promise<SearchResults> {
  return apiClient.get("/catalogue/search", searchResultsSchema, {
    params: { q: query, lite: dataSaver ? 1 : undefined },
    signal,
  });
}

export type { SearchResults };
