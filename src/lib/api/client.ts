import { z } from "zod";
import { ApiError, ContractError, type ProblemFieldError } from "./errors";

type Params = Record<string, string | number | boolean | undefined>;

/**
 * The browser only ever talks to this app's own route handlers under `/api`
 * (D3). They call the sportsbook API from the server, with the tenant header
 * and the session cookie the browser never sees.
 */
const BASE_PATH = "/api/";

function buildUrl(path: string, params?: Params): string {
  const origin =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(`${BASE_PATH}${path.replace(/^\//, "")}`, origin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * The single place the browser talks HTTP.
 *
 * Every response is validated against a Zod schema before it reaches a hook, so
 * a route handler whose mapping drifts from the domain types fails here with a
 * clear message instead of rendering `NaN` inside an odds button.
 */
async function request<T>(
  method: "GET" | "POST",
  path: string,
  schema: z.ZodType<T>,
  options: { params?: Params; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.params), {
      method,
      signal: options.signal,
      // Same origin, so the session's HttpOnly cookie goes along by default.
      // It never reaches JavaScript — this is a financial product.
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    throw new ApiError(
      cause instanceof Error ? cause.message : "Network request failed",
      0,
      "network",
      cause,
    );
  }

  if (!response.ok) {
    // RFC 7807 `Problem`, passed through from the API by the route handler.
    const problem = (await response.json().catch(() => null)) as {
      title?: string;
      code?: string;
      errors?: ProblemFieldError[];
    } | null;
    throw new ApiError(
      problem?.title ?? `${method} ${path} failed with ${response.status}`,
      response.status,
      problem?.code ?? "http_error",
      problem,
      problem?.errors ?? [],
    );
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ContractError(path, z.prettifyError(parsed.error));
  }
  return parsed.data;
}

export const apiClient = {
  get: <T>(
    path: string,
    schema: z.ZodType<T>,
    options?: { params?: Params; signal?: AbortSignal },
  ) => request("GET", path, schema, options),

  post: <T>(
    path: string,
    schema: z.ZodType<T>,
    body: unknown,
    options?: { signal?: AbortSignal },
  ) => request("POST", path, schema, { ...options, body }),
};

/**
 * Validates data that did not come over the wire — the mock repository.
 *
 * Mocks are checked too: a fixture that drifts from the contract should fail in
 * development rather than quietly ship a shape the real backend never sends.
 */
export function assertContract<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ContractError(endpoint, z.prettifyError(parsed.error));
  }
  return parsed.data;
}
