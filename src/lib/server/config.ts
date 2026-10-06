import "server-only";
import { isIP } from "node:net";
import { z } from "zod";

/** A public host name: dot-separated labels, at least two. */
const HOST_NAME =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * The provider pages in the contract's own deposit examples, so a deposit
 * against Prism can be followed in `next dev` and in the tests. Never a
 * production default: there the list is whatever is configured, or nothing.
 */
const CONTRACT_EXAMPLE_PROVIDER_HOSTS = [
  "checkout.chapa.co",
  "app.ethiotelecom.et",
];

/**
 * Server-only configuration. Nothing here reaches the browser: the browser
 * never calls the API (D3), so it never needs to know where it is.
 */
const schema = z
  .object({
    /** The sportsbook API — Prism on :4010 locally, the backend on :8000. */
    apiBaseUrl: z.string().url(),
    /**
     * The real backend, for the OpenAPI tags in `apiRealTags` (D7). Screens move
     * from Prism to the backend one tag at a time as its pieces land.
     */
    apiRealUrl: z.string().url().optional(),
    apiRealTags: z
      .array(z.string())
      .refine((tags) => !tags.includes("Bookings") && !tags.includes("Auth"), {
        // Bookings and logins would reach the API from this server's address, so
        // its per-IP and per-device limits (booking codes, OTP sends, failed
        // passwords) would be one bucket for every player. Refused until contract
        // request 004 (X-Client-IP / X-Client-Device) lands.
        message:
          "Bookings and Auth cannot use the real API yet: contract request 004 (client IP and device) must land first",
      }),
    /** Tenant for hosts not in the map. `demo` locally. */
    defaultTenant: z.string().min(1),
    /** `host=tenant` pairs, comma-separated: `kelalsport.et=kelal,localhost=demo`. */
    tenantHostMap: z.record(z.string(), z.string()),
    /**
     * The shop terminal's hosts (FD1), `host=tenant` pairs like the player's:
     * `terminal.kelalsport.et=kelal`. A host here serves only the terminal; a
     * host in neither map is the player site (`src/proxy.ts`).
     */
    terminalHostMap: z.record(z.string(), z.string()),
    /**
     * How many proxies of ours stand in front of this server and set
     * `X-Forwarded-*`. At 0 (the default) only `Host` is believed: a forwarded
     * host or address is whatever the client typed (F4 AC-7, contract request
     * 004). At n, the edge's `X-Forwarded-Host` and `-Proto` are trusted and the
     * player's address is the n-th `X-Forwarded-For` entry from the right — the
     * one the trusted edge appended, never the first.
     */
    trustedProxyHops: z.number().int().nonnegative(),
    /**
     * The payment providers' pages a deposit may send the player to
     * (`next_action.redirect`), as exact host names: `checkout.chapa.co`. No
     * wildcards, no schemes, no ports — see `isAllowedProviderUrl`.
     */
    paymentRedirectHosts: z.array(
      z
        .string()
        .regex(
          HOST_NAME,
          "PAYMENT_REDIRECT_HOSTS takes host names, like checkout.chapa.co",
        ),
    ),
  })
  .refine(
    ({ tenantHostMap, terminalHostMap }) =>
      !Object.keys(terminalHostMap).some((host) =>
        Object.hasOwn(tenantHostMap, host),
      ),
    {
      // One host, one site: which one it serves must never depend on the order
      // the maps are read in.
      message:
        "A host cannot be in both TENANT_HOST_MAP and TERMINAL_HOST_MAP: it serves the player site or the terminal",
      path: ["terminalHostMap"],
    },
  );

/**
 * Lets `next dev` and the tests run with no `.env.local`. Production refuses
 * it — and refuses to start with no secret at all (`instrumentation.ts`) — so
 * it can never seal a real player's tokens.
 */
export const DEVELOPMENT_SESSION_SECRET =
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

/**
 * The secrets a cookie may have been sealed with: the current one first, then
 * `SESSION_SECRET_PREVIOUS` during a rotation, so players stay signed in while
 * the old key is retired. New cookies always use the current one.
 */
export function sessionSecrets(): string[] {
  const current = sessionSecret();
  const previous = process.env.SESSION_SECRET_PREVIOUS?.trim() ?? "";
  return previous.length >= 32 && previous !== current
    ? [current, previous]
    : [current];
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

/**
 * `TERMINAL_HOST_MAP`. Unset or blank: no terminal host in production — no
 * host serves the terminal until one is configured (fail closed) — and
 * `terminal.localhost` for the default tenant anywhere else, so `next dev` and
 * Playwright can reach it (Chrome sends any `*.localhost` to this machine).
 */
function terminalHostMap(
  raw: string | undefined,
  defaultTenant: string,
): Record<string, string> {
  const listed = parseHostMap(raw);
  if (Object.keys(listed).length > 0) return listed;
  return process.env.NODE_ENV === "production"
    ? {}
    : { "terminal.localhost": defaultTenant };
}

/**
 * `PAYMENT_REDIRECT_HOSTS`, comma-separated. Unset or blank: none in
 * production — every redirect is refused until hosts are listed (fail
 * closed) — and the contract's example hosts anywhere else.
 */
function paymentRedirectHosts(raw: string | undefined): string[] {
  const listed = (raw ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (listed.length > 0) return listed;
  return process.env.NODE_ENV === "production"
    ? []
    : CONTRACT_EXAMPLE_PROVIDER_HOSTS;
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
  terminalHostMap: terminalHostMap(
    process.env.TERMINAL_HOST_MAP,
    process.env.DEFAULT_TENANT ?? "demo",
  ),
  trustedProxyHops: Number(process.env.TRUSTED_PROXY_HOPS?.trim() || "0"),
  paymentRedirectHosts: paymentRedirectHosts(
    process.env.PAYMENT_REDIRECT_HOSTS,
  ),
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

/** A host without its port, in lower case: the key both host maps use. */
const hostName = (host: string | null): string =>
  (host ?? "").split(":")[0].toLowerCase();

/** A map's own entry for `name` — never one inherited from Object (`toString`). */
const entry = (map: Record<string, string>, name: string) =>
  Object.hasOwn(map, name) ? map[name] : undefined;

/** The tenant a request belongs to, from the host it arrived on. */
export function tenantForHost(host: string | null): string {
  const name = hostName(host);
  return (
    entry(serverConfig.tenantHostMap, name) ??
    entry(serverConfig.terminalHostMap, name) ??
    serverConfig.defaultTenant
  );
}

/**
 * Whether a request arrived on a shop terminal's host (FD1): one in
 * `TERMINAL_HOST_MAP`. Every other host is the player site. Pass it
 * `requestHost(headers)`, so it reads the host tenants are read from.
 */
export const isTerminalHost = (host: string | null): boolean =>
  Object.hasOwn(serverConfig.terminalHostMap, hostName(host));

/**
 * The first value of a forwarded header. Proxies that append (`a, b`) put the
 * original first; the whole list is never a host.
 */
const firstOf = (value: string | null): string | null =>
  value?.split(",")[0]?.trim() || null;

/**
 * A forwarded header (`X-Forwarded-Host`, `-Proto`, `-For`), believed only
 * behind a trusted proxy (AC-7), and then only the entry our edge appended:
 * the n-th from the right for n trusted hops. Whatever a client sent sits to
 * the left of it. Null with no trusted proxy or too few entries.
 */
export function forwardedHeader(headers: Headers, name: string): string | null {
  const hops = serverConfig.trustedProxyHops;
  if (hops === 0) return null;
  const entries = (headers.get(name) ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries[entries.length - hops] ?? null;
}

/** The host a request arrived on: the trusted edge's, else `Host` itself. */
export const requestHost = (headers: Headers): string | null =>
  forwardedHeader(headers, "x-forwarded-host") ?? firstOf(headers.get("host"));

/**
 * The player's own address, for contract request 004: the `X-Forwarded-For`
 * entry the trusted edge appended, when it is an address — never a guess.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const candidate = forwardedHeader(headers, "x-forwarded-for");
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

  const proto = forwardedHeader(headers, "x-forwarded-proto")?.toLowerCase();
  const scheme =
    proto === "http" || proto === "https"
      ? proto
      : LOCAL.test(host)
        ? "http"
        : "https";
  return `${scheme}://${host}`;
}

/**
 * The provider page a deposit may send the player to — `url` as the parser
 * read it, so what reaches the browser is exactly what was checked — or null
 * (09-security, Redirects). Only `https:`, on the default port, with no user
 * name or password, and a host on the list exactly: a subdomain, a longer
 * name ending in a listed one, or one with a trailing dot is another host.
 * Anything that doesn't parse is refused.
 */
export function allowedProviderUrl(
  url: string,
  hosts: readonly string[] = serverConfig.paymentRedirectHosts,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return parsed.protocol === "https:" &&
    parsed.username === "" &&
    parsed.password === "" &&
    parsed.port === "" &&
    hosts.includes(parsed.hostname)
    ? parsed.href
    : null;
}

/** Whether a deposit may send the player to `url` (`allowedProviderUrl`). */
export const isAllowedProviderUrl = (
  url: string,
  hosts?: readonly string[],
): boolean => allowedProviderUrl(url, hosts) !== null;

/**
 * This site's origin for `tenant`, only when the tenant owns a host in
 * `TENANT_HOST_MAP` — never a host a request merely arrived on. Null when it
 * owns none: nothing built from it may point anywhere a client chose.
 */
export function ownedOrigin(headers: Headers, tenant: string): string | null {
  return Object.values(serverConfig.tenantHostMap).includes(tenant)
    ? publicOrigin(headers, tenant)
    : null;
}
