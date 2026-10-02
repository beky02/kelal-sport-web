import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "@/lib/api/schema";
import type { Lang } from "@/types/common";
import { baseUrlFor, usesRealApi, type ApiTag } from "./config";

export type Upstream = ReturnType<typeof upstream>;

/** Who a request is for: the tenant from the host, the language from the UI. */
export interface RequestContext {
  tenant: string;
  lang: Lang;
  /**
   * Prism's `Prefer` (`code=410`, `example=odds_changed`), so error states can
   * be exercised end to end in development. See `mockPreference`.
   */
  prefer?: string;
  /**
   * `Bearer <access token>` for a call made for a player — only ever from the
   * session cookie, through `withSession()` (`lib/server/session.ts`).
   */
  authorization?: string;
}

/**
 * The browser's `Prefer` header, if it is one of Prism's forms and this is
 * `next dev`. Fails closed: any other build (production, staging, test)
 * forwards nothing, and `upstream()` sends it only to the mock, never to the
 * real API.
 */
export function mockPreference(header: string | null): string | undefined {
  if (process.env.NODE_ENV !== "development" || !header) return undefined;
  return /^(code=\d{3}|example=[\w-]+)$/.test(header) ? header : undefined;
}

const LANGS: readonly Lang[] = ["en", "am"];

/**
 * The same read in both languages. Names come back in one language per
 * request, but the UI switches language without refetching, so reads that
 * carry names are made in both and merged by the mappers.
 */
export async function both<T>(
  read: (lang: Lang) => Promise<T>,
): Promise<Record<Lang, T>> {
  const [en, am] = await Promise.all(LANGS.map(read));
  return { en, am };
}

/**
 * A typed client for the sportsbook API, scoped to one tenant and language,
 * pointed at the mock or the real API by the contract tag of what it calls (D7).
 *
 * Every request carries `X-Tenant-Id` (D3) and a fresh `X-Request-Id`, so a
 * failure in the backend's logs can be traced to the page that caused it.
 */
export function upstream(
  tag: ApiTag,
  { tenant, lang, prefer, authorization }: RequestContext,
) {
  const client = createClient<paths>({
    baseUrl: baseUrlFor(tag),
    headers: {
      "X-Tenant-Id": tenant,
      "Accept-Language": lang,
      ...(prefer && !usesRealApi(tag) ? { Prefer: prefer } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
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

/** A `204` answered, or throw: openapi-fetch gives no `data` for an empty body. */
export function unwrapEmpty(result: {
  error?: unknown;
  response: Response;
}): void {
  if (!result.response.ok) {
    throw new UpstreamError(result.response.status, result.error ?? null);
  }
}
