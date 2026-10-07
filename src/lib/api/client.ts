import { z } from "zod";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { BOOKING_CODE } from "@/features/bookings/lib/code";
import type { Lang } from "@/types/common";
import { ApiError, ContractError, problemError } from "./errors";

type Params = Record<string, string | number | boolean | undefined>;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * The browser only ever talks to this app's own route handlers under `/api`
 * (D3). They call the sportsbook API from the server, with the tenant header
 * and the session cookie the browser never sees.
 *
 * On the shop kiosk the catalogue's reads, a booking's read by its code and
 * Book bet go to its own handlers, under `/api/terminal/` (FD1, F8ca): its root layout
 * says so on `<html data-api>`, so the same fetchers work on both sites.
 */
const BASE_PATH = "/api/";

/** The one other base a page may name: the terminal's mirror. */
const TERMINAL_BASE_PATH = "/api/terminal/";

/**
 * What the terminal mirrors (F8ca): catalogue reads, a booking read by its
 * code — exactly `bookings/{code}` (review SEC1) — and Book bet, exactly
 * `POST bookings`. Never the player's other calls. No `.` or `..` segment,
 * so nothing re-rooted can resolve outside the mirror.
 */
function mirrored(method: Method, path: string): boolean {
  if (method === "POST") return path === "bookings";
  if (method !== "GET") return false;
  if (
    path.split(/[/?]/).some((segment) => segment === "." || segment === "..")
  ) {
    return false;
  }
  return (
    path.startsWith("catalogue/") ||
    (path.startsWith("bookings/") && BOOKING_CODE.test(path.slice(9)))
  );
}

/**
 * Where a call goes: a mirrored read is re-rooted only when `<html data-api>`
 * is exactly the terminal's — anything else a page could say is ignored, so
 * no markup can send a call to another origin (reviews SEC2, Q8). A player
 * call on a terminal host then fails as a plain 404.
 */
function basePath(method: Method, path: string): string {
  if (typeof document === "undefined" || !mirrored(method, path)) {
    return BASE_PATH;
  }
  return document.documentElement.getAttribute("data-api") ===
    TERMINAL_BASE_PATH
    ? TERMINAL_BASE_PATH
    : BASE_PATH;
}

/**
 * The language the page is in, as `<html lang>` says — which each site keeps
 * in step with what is on screen (the player's preference, the kiosk's
 * choice) — so the API's own words come back in the script shown.
 */
const pageLanguage = (): Lang =>
  typeof document !== "undefined" && document.documentElement.lang === "am"
    ? "am"
    : "en";

function buildUrl(method: Method, path: string, params?: Params): string {
  const origin =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const relative = path.replace(/^\//, "");
  const url = new URL(`${basePath(method, relative)}${relative}`, origin);
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
  method: Method,
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
    response = await fetch(buildUrl(method, path, options.params), {
      method,
      signal: options.signal,
      // Same origin, so the session's HttpOnly cookie goes along by default.
      // It never reaches JavaScript — this is a financial product. Every
      // request that changes something carries the CSRF header the route
      // handlers insist on (C18 §4.4), and every request the UI's language so
      // the API's titles come back in the right script.
      headers: {
        Accept: "application/json",
        "Accept-Language": pageLanguage(),
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
    throw await problemError(response, `${method} ${path}`);
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
