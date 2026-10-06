import { z } from "zod";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { useUiStore } from "@/stores/ui.store";
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
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  schema: z.ZodType<T>,
  options: {
    params?: Params;
    body?: unknown;
    signal?: AbortSignal;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.params), {
      method,
      signal: options.signal,
      // Same origin, so the session's HttpOnly cookie goes along by default.
      // It never reaches JavaScript — this is a financial product. Every
      // request that changes something carries the CSRF header the route
      // handlers insist on (C18 §4.4), and every request the UI's language so
      // the API's titles come back in the right script.
      headers: {
        Accept: "application/json",
        "Accept-Language": useUiStore.getState().lang,
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(method !== "GET" ? { [CSRF_HEADER]: CSRF_VALUE } : {}),
        ...options.headers,
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
    const retryAfter = response.headers.get("retry-after")?.trim() ?? "";
    throw new ApiError(
      problem?.title ?? `${method} ${path} failed with ${response.status}`,
      response.status,
      problem?.code ?? "http_error",
      problem,
      problem?.errors ?? [],
      /^\d{1,6}$/.test(retryAfter) ? Number(retryAfter) : null,
    );
  }

  // A 204 has nothing to parse; its schema says so (`z.undefined()`).
  const parsed = schema.safeParse(
    response.status === 204 ? undefined : await response.json(),
  );
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
    options?: { signal?: AbortSignal; headers?: Record<string, string> },
  ) => request("POST", path, schema, { ...options, body }),

  /** Sets something to the value sent (a limit): repeating it changes nothing more. */
  put: <T>(
    path: string,
    schema: z.ZodType<T>,
    body: unknown,
    options?: { signal?: AbortSignal },
  ) => request("PUT", path, schema, { ...options, body }),

  /** Changes some fields of something (the account), leaving the rest as they are. */
  patch: <T>(
    path: string,
    schema: z.ZodType<T>,
    body: unknown,
    options?: { signal?: AbortSignal },
  ) => request("PATCH", path, schema, { ...options, body }),

  /** Removes or cancels something; a 204 parses with `z.undefined()`. */
  delete: <T>(
    path: string,
    schema: z.ZodType<T>,
    options?: { signal?: AbortSignal },
  ) => request("DELETE", path, schema, options),
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
