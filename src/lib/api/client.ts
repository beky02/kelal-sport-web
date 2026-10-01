import { z } from "zod";
import { env } from "@/config/env";
import { ApiError, ContractError } from "./errors";

type Params = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, params?: Params): string {
  const url = new URL(
    path.replace(/^\//, ""),
    env.apiUrl.endsWith("/") ? env.apiUrl : `${env.apiUrl}/`,
  );
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * The single place the frontend talks HTTP.
 *
 * Every response is validated against a Zod schema before it reaches a hook, so
 * a backend that starts sending `"1.62"` where the contract says `1.62` fails
 * here with a clear message instead of rendering `NaN` inside an odds button.
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
      // Session material lives in an HttpOnly cookie set by the backend, never
      // in localStorage — this is a financial product.
      credentials: "include",
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
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      (payload as { message?: string } | null)?.message ??
        `${method} ${path} failed with ${response.status}`,
      response.status,
      (payload as { code?: string } | null)?.code ?? "http_error",
      payload,
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
