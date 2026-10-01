import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";

/**
 * TanStack Query treats cached data as stale immediately unless told otherwise,
 * so every `staleTime` in this app is set deliberately at the call site from
 * STALE_TIME. Live odds are never refreshed by staleness — they arrive on the
 * realtime channel.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
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
}
