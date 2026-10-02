import "server-only";
import { isIP } from "node:net";
import { z } from "zod";

/**
 * Server-only configuration. Nothing here reaches the browser: the browser
 * never calls the API (D3), so it never needs to know where it is.
 */
const schema = z.object({
  /** The sportsbook API — Prism on :4010 locally, the backend on :8000. */
  apiBaseUrl: z.string().url(),
  /**
   * The real backend, for the OpenAPI tags in `apiRealTags` (D7). Screens move
   * from Prism to the backend one tag at a time as its pieces land.
   */
  apiRealUrl: z.string().url().optional(),
  apiRealTags: z
    .array(z.string())
    .refine((tags) => !tags.includes("Bookings"), {
      // Anonymous bookings would reach the API from this server's address, so
      // its per-IP and per-device limits would be one bucket for every guest.
      // Refused until contract request 004 (X-Client-IP / X-Client-Device) and a
      // trusted-proxy setting land.
      message:
        "Bookings cannot use the real API yet: contract request 004 (client IP and device) must land first",
    }),
  /** Tenant for hosts not in the map. `demo` locally. */
  defaultTenant: z.string().min(1),
  /** `host=tenant` pairs, comma-separated: `kelalsport.et=kelal,localhost=demo`. */
  tenantHostMap: z.record(z.string(), z.string()),
  /**
   * How many proxies of ours stand in front of this server and set
   * `X-Forwarded-*`. At 0 (the default) only `Host` is believed: a forwarded
   * host or address is whatever the client typed (F4 AC-7, contract request
   * 004). At n, the edge's `X-Forwarded-Host` and `-Proto` are trusted and the
   * player's address is the n-th `X-Forwarded-For` entry from the right — the
   * one the trusted edge appended, never the first.
   */
  trustedProxyHops: z.number().int().nonnegative(),
});

/**
 * Lets `next dev` and the tests run with no `.env.local`. Production refuses
 * it — and refuses to start with no secret at all (`instrumentation.ts`) — so
 * it can never seal a real player's tokens.
 */
const DEVELOPMENT_SESSION_SECRET =
  "kelalsport-development-only-session-secret-never-in-production";

/**
 * What seals the session cookie (`lib/server/session.ts`).
 *
 * Read when first needed, not at import: `next build` runs with
 * `NODE_ENV=production` and evaluates the route handlers, and a build must not
 * need a runtime secret. The production server checks it at startup instead.
 */
export function sessionSecret(): string {
  const raw = process.env.SESSION_SECRET?.trim() ?? "";
  if (process.env.NODE_ENV === "production") {
    if (raw.length < 32 || raw === DEVELOPMENT_SESSION_SECRET) {
      throw new Error(
        "SESSION_SECRET must be set to at least 32 characters in production",
      );
    }
    return raw;
  }
  return raw.length >= 32 ? raw : DEVELOPMENT_SESSION_SECRET;
}

/** Everything a production server must have before it takes a request. */
export function assertServerSecrets(): void {
  sessionSecret();
}

function parseHostMap(raw: string | undefined): Record<string, string> {
  return Object.fromEntries(
    (raw ?? "")
      .split(",")
      .map((pair) => pair.trim().split("="))
      .filter(
        (pair): pair is [string, string] =>
          pair.length === 2 && !!pair[0] && !!pair[1],
      )
      .map(([host, tenant]) => [host.trim().toLowerCase(), tenant.trim()]),
  );
}

const parsed = schema.safeParse({
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:4010",
  apiRealUrl: process.env.API_REAL_URL || undefined,
  apiRealTags: (process.env.API_REAL_TAGS ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean),
  defaultTenant: process.env.DEFAULT_TENANT ?? "demo",
  tenantHostMap: parseHostMap(process.env.TENANT_HOST_MAP),
  trustedProxyHops: Number(process.env.TRUSTED_PROXY_HOPS?.trim() || "0"),
});

if (!parsed.success) {
  throw new Error(
    `Invalid server configuration:\n${z.prettifyError(parsed.error)}`,
  );
}

export const serverConfig = parsed.data;

/** Where calls tagged `tag` in the contract go: the real API, or the mock (D7). */
export function baseUrlFor(tag: ApiTag): string {
  return usesRealApi(tag) && serverConfig.apiRealUrl
    ? serverConfig.apiRealUrl
    : serverConfig.apiBaseUrl;
}

/** True when calls tagged `tag` go to the real API rather than the mock (D7). */
export function usesRealApi(tag: ApiTag): boolean {
  return !!serverConfig.apiRealUrl && serverConfig.apiRealTags.includes(tag);
}

/** OpenAPI tags, as `contracts/openapi.yaml` names them. */
export type ApiTag =
  | "Auth"
  | "Me"
  | "KYC"
  | "Wallet"
  | "Payments"
  | "Catalogue"
  | "Slips"
  | "Bets"
  | "Bookings"
  | "Promotions"
  | "Responsible gambling"
  | "Inbox"
  | "Config";

/** The tenant a request belongs to, from the host it arrived on. */
export function tenantForHost(host: string | null): string {
  const name = (host ?? "").split(":")[0].toLowerCase();
  return serverConfig.tenantHostMap[name] ?? serverConfig.defaultTenant;
}

/**
 * The first value of a forwarded header. Proxies that append (`a, b`) put the
 * original first; the whole list is never a host.
 */
const firstOf = (value: string | null): string | null =>
  value?.split(",")[0]?.trim() || null;

/** A forwarded header, believed only behind a trusted proxy (AC-7). */
const forwarded = (headers: Headers, name: string): string | null =>
  serverConfig.trustedProxyHops > 0 ? firstOf(headers.get(name)) : null;

/** The host a request arrived on: the trusted edge's, else `Host` itself. */
export const requestHost = (headers: Headers): string | null =>
  forwarded(headers, "x-forwarded-host") ?? firstOf(headers.get("host"));

/**
 * The player's own address, for contract request 004: the `X-Forwarded-For`
 * entry the trusted edge appended. Null with no trusted proxy, with too few
 * entries, or when the entry is not an address — never a guess.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const hops = serverConfig.trustedProxyHops;
  if (hops === 0) return null;
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const candidate = entries[entries.length - hops];
  return candidate && isIP(candidate) ? candidate : null;
}

/** The tenant for a request's headers — route handlers and pages alike. */
export const tenantFromHeaders = (headers: Headers): string =>
  tenantForHost(requestHost(headers));

const HOST = /^[a-z0-9.-]+(:\d{1,5})?$/i;
const LOCAL = /^(localhost|127\.0\.0\.1)(:|$)/;

/**
 * The origin to put in a link to this site (Open Graph `og:url`): the request's
 * own host when the tenant owns it — keeping a local port — otherwise the
 * tenant's first mapped host. A forwarded host the tenant doesn't own never
 * makes it into a link, and a malformed one can't throw.
 */
export function publicOrigin(headers: Headers, tenant: string): string {
  const owned = Object.entries(serverConfig.tenantHostMap)
    .filter(([, t]) => t === tenant)
    .map(([host]) => host);
  const asked = requestHost(headers)?.toLowerCase() ?? null;
  const askedName = asked?.split(":")[0] ?? null;

  let host: string;
  if (
    asked &&
    HOST.test(asked) &&
    (owned.length === 0 || (askedName !== null && owned.includes(askedName)))
  ) {
    host = asked;
  } else if (owned.length > 0) {
    host = owned[0];
  } else {
    host = "localhost";
  }

  const proto = forwarded(headers, "x-forwarded-proto")?.toLowerCase();
  const scheme =
    proto === "http" || proto === "https"
      ? proto
      : LOCAL.test(host)
        ? "http"
        : "https";
  return `${scheme}://${host}`;
}
