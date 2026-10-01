import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "@/lib/api/schema";
import type { Lang } from "@/types/common";
import { serverConfig } from "./config";

export type Upstream = ReturnType<typeof upstream>;

/** Who a request is for: the tenant from the host, the language from the UI. */
export interface RequestContext {
  tenant: string;
  lang: Lang;
}

/**
 * A typed client for the sportsbook API, scoped to one tenant and language.
 *
 * Every request carries `X-Tenant-Id` (D3) and a fresh `X-Request-Id`, so a
 * failure in the backend's logs can be traced to the page that caused it.
 */
export function upstream({ tenant, lang }: RequestContext) {
  const client = createClient<paths>({
    baseUrl: serverConfig.apiBaseUrl,
    headers: { "X-Tenant-Id": tenant, "Accept-Language": lang },
  });
  client.use({
    onRequest({ request }) {
      request.headers.set("X-Request-Id", crypto.randomUUID());
      return request;
    },
  });
  return client;
}

/**
 * The API answered with an error. Carries its `Problem` body unchanged, so the
 * route handler can pass the code and `errors[]` through to the UI.
 */
export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    readonly problem: unknown,
  ) {
    super(`Upstream responded ${status}`);
    this.name = "UpstreamError";
  }
}

/** `{ data, error }` → data, or throw. */
export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (result.data === undefined) {
    throw new UpstreamError(result.response.status, result.error ?? null);
  }
  return result.data;
}
