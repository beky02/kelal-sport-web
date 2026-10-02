import { QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { sessionKeys } from "@/lib/query/keys";

/**
 * TanStack Query treats cached data as stale immediately unless told otherwise,
 * so every `staleTime` in this app is set deliberately at the call site from
 * STALE_TIME. Live odds are never refreshed by staleness — they arrive on the
 * realtime channel.
 */
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // A player's call the API no longer honours: ask /api/me again, so
        // every screen returns to the guest state together (AC-8).
        if (
          error instanceof ApiError &&
          error.status === 401 &&
          query.queryKey[0] !== sessionKeys.all[0]
        ) {
          void client.invalidateQueries({ queryKey: sessionKeys.me() });
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (attempt, error) => {
          if (error instanceof ApiError && !error.retryable) return false;
          return attempt < 2;
        },
      },
      mutations: {
        // Money-moving mutations are never retried automatically.
        retry: false,
      },
    },
  });
  return client;
}
