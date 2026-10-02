import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender } from "@testing-library/react";
import type { ReactElement } from "react";
import type { Player } from "@/features/auth/types";
import type { BettingRules } from "@/features/config/types";
import { toPlayer } from "@/lib/api/mappers/auth";
import { toBettingRules } from "@/lib/api/mappers/config";
import { configKeys, sessionKeys } from "@/lib/query/keys";
import { example } from "../contract";

/** The tenant rule set Prism serves: the contract's own example. */
export const CONTRACT_RULES: BettingRules = toBettingRules(
  example("/v1/config/public").betting,
);

/** The signed-in player Prism serves: the contract's `/v1/me` example. */
export const CONTRACT_PLAYER: Player = toPlayer(example("/v1/me"));

/**
 * Renders a component with the providers the app gives it.
 *
 * Retries are off and caches are per-test, so a failing query surfaces
 * immediately instead of being retried into a timeout. The tenant's rule set is
 * in the cache already, as the contract's example, unless a test passes its own
 * — or `null` to see the slip before the rules arrive. Who is signed in is in
 * the cache too: the contract's player by default, `"guest"` for nobody, a
 * `Player` of the test's own, or `null` to see the moment before `/api/me`
 * answers.
 */
export function render(
  ui: ReactElement,
  {
    rules = CONTRACT_RULES,
    bookingCodes = true,
    session = "player",
  }: {
    rules?: BettingRules | null;
    bookingCodes?: boolean;
    session?: "player" | "guest" | Player | null;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  if (session !== null) {
    queryClient.setQueryData(sessionKeys.me(), {
      player:
        session === "guest"
          ? null
          : session === "player"
            ? CONTRACT_PLAYER
            : session,
    });
    queryClient.setQueryDefaults(sessionKeys.me(), { staleTime: Infinity });
  }
  if (rules) {
    queryClient.setQueryData(configKeys.public(), {
      betting: rules,
      features: { bookingCodes },
    });
    // Fresh for the test's lifetime, so nothing refetches over the seed.
    queryClient.setQueryDefaults(configKeys.public(), {
      staleTime: Infinity,
    });
  }

  return {
    queryClient,
    ...rtlRender(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
  };
}
