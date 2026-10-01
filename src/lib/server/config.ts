import "server-only";
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
});

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

/** The tenant for a request's headers — route handlers and pages alike. */
export const tenantFromHeaders = (headers: Headers): string =>
  tenantForHost(headers.get("x-forwarded-host") ?? headers.get("host"));
