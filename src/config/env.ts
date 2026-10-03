import { z } from "zod";

/**
 * Environment contract. Parsed once at module load so a misconfigured deploy
 * fails loudly at startup instead of at the first fetch.
 *
 * Only NEXT_PUBLIC_* belongs here — anything in this file reaches the browser.
 */
const schema = z.object({
  wsUrl: z.string().url(),
  appEnv: z.enum(["development", "staging", "production"]),
  /**
   * Serve the in-repo mock repository for the features not yet rewired to the
   * contract (My bets, wallet, responsible gaming). The catalogue, auth,
   * bookings and placing a bet always go through the route handlers — point
   * API_BASE_URL at Prism to mock them.
   */
  useMocks: z.boolean(),
  /**
   * `on` connects to the gateway, `simulate` drives the same pipeline locally
   * so the realtime path is exercised without one, `off` disables it.
   */
  realtime: z.enum(["off", "simulate", "on"]),
  /** Release 2 features — see `config/features.ts`. */
  features: z.object({ live: z.boolean(), cashOut: z.boolean() }),
});

const parsed = schema.safeParse({
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/realtime",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  useMocks: (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true") === "true",
  // Release 1 refreshes odds by polling (D5); live betting is Release 2 (D8).
  realtime: process.env.NEXT_PUBLIC_REALTIME ?? "off",
  features: {
    live: process.env.NEXT_PUBLIC_FEATURE_LIVE === "true",
    cashOut: process.env.NEXT_PUBLIC_FEATURE_CASH_OUT === "true",
  },
});

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = parsed.data;
