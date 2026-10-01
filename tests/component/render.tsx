import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender } from "@testing-library/react";
import type { ReactElement } from "react";
import type { BettingRules } from "@/features/config/types";
import { toBettingRules } from "@/lib/api/mappers/config";
import { configKeys } from "@/lib/query/keys";
import { example } from "../contract";

/** The tenant rule set Prism serves: the contract's own example. */
export const CONTRACT_RULES: BettingRules = toBettingRules(
  example("/v1/config/public").betting,
);

/**
 * Renders a component with the providers the app gives it.
 *
 * Retries are off and caches are per-test, so a failing query surfaces
 * immediately instead of being retried into a timeout. The tenant's rule set is
 * in the cache already, as the contract's example, unless a test passes its own
 * — or `null` to see the slip before the rules arrive.
 */
export function render(
  ui: ReactElement,
  {
    rules = CONTRACT_RULES,
    bookingCodes = true,
  }: { rules?: BettingRules | null; bookingCodes?: boolean } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
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
