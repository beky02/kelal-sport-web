import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { mockRepository, type SearchResults } from "@/lib/api/mock/repository";
import { searchResultsSchema } from "@/lib/api/schemas";

export async function search(
  query: string,
  dataSaver: boolean,
  signal?: AbortSignal,
): Promise<SearchResults> {
  if (env.useMocks) {
    return assertContract(
      "/search",
      searchResultsSchema,
      await mockRepository.search(query, dataSaver),
    );
  }
  return apiClient.get("/search", searchResultsSchema, {
    params: { q: query, lite: dataSaver || undefined },
    signal,
  });
}

export type { SearchResults };
