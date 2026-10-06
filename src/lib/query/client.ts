import {
  hashKey,
  QueryCache,
  QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { sessionKeys } from "@/lib/query/keys";

/**
 * TanStack Query treats cached data as stale immediately unless told otherwise,
 * so every `staleTime` in this app is set deliberately at the call site from
 * STALE_TIME. Live odds are never refreshed by staleness — they arrive on the
 * realtime channel.
 *
 * `whoAmI` is the query that says who is calling — the player's `/api/me`, or
 * on the shop kiosk its terminal status (F8ca) — read again when any other
 * call is refused with a 401.
 */
export function createQueryClient({
  whoAmI = sessionKeys.me(),
}: { whoAmI?: QueryKey } = {}): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // A call the API no longer honours: ask who is calling again, so
        // every screen follows together — a player back to the guest state
        // (AC-8), a terminal to what its status now says.
        if (
          error instanceof ApiError &&
          error.status === 401 &&
          query.queryHash !== hashKey(whoAmI)
        ) {
          void client.invalidateQueries({ queryKey: whoAmI });
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
