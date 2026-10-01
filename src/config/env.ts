import { z } from "zod";

/**
 * Environment contract. Parsed once at module load so a misconfigured deploy
 * fails loudly at startup instead of at the first fetch.
 *
 * Only NEXT_PUBLIC_* belongs here — anything in this file reaches the browser.
 */
const schema = z.object({
  apiUrl: z.string().url(),
  wsUrl: z.string().url(),
  appEnv: z.enum(["development", "staging", "production"]),
  /** Serve the in-repo mock repository instead of calling the backend. */
  useMocks: z.boolean(),
  /**
   * `on` connects to the gateway, `simulate` drives the same pipeline locally
   * so the realtime path is exercised without one, `off` disables it.
   */
  realtime: z.enum(["off", "simulate", "on"]),
});

const parsed = schema.safeParse({
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/realtime",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  useMocks: (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true") === "true",
  realtime: process.env.NEXT_PUBLIC_REALTIME ?? "simulate",
});

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = parsed.data;
