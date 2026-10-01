import "server-only";
import { z } from "zod";

/**
 * Server-only configuration. Nothing here reaches the browser: the browser
 * never calls the API (D3), so it never needs to know where it is.
 */
const schema = z.object({
  /** The sportsbook API — Prism on :4010 locally, the backend on :8000. */
  apiBaseUrl: z.string().url(),
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
  defaultTenant: process.env.DEFAULT_TENANT ?? "demo",
  tenantHostMap: parseHostMap(process.env.TENANT_HOST_MAP),
});

if (!parsed.success) {
  throw new Error(
    `Invalid server configuration:\n${z.prettifyError(parsed.error)}`,
  );
}

export const serverConfig = parsed.data;

/** The tenant a request belongs to, from the host it arrived on. */
export function tenantForHost(host: string | null): string {
  const name = (host ?? "").split(":")[0].toLowerCase();
  return serverConfig.tenantHostMap[name] ?? serverConfig.defaultTenant;
}
