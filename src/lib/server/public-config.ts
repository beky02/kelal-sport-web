import "server-only";
import type { components } from "@/lib/api/schema";
import type { PublicConfigView } from "@/features/config/types";
import { toBettingRules } from "@/lib/api/mappers/config";
import { unwrap, upstream } from "./upstream";

type PublicConfig = components["schemas"]["PublicConfig"];

/** The operation's own `Cache-Control: public, max-age=60`. */
const CONFIG_TTL_MS = 60 * 1000;
const configs = new Map<string, { value: PublicConfig; expires: number }>();

/**
 * The tenant's public configuration — branding, flags and the betting rule set.
 * Held per tenant for a minute; everything that needs it reads it from here.
 */
export async function loadPublicConfig(tenant: string): Promise<PublicConfig> {
  const cached = configs.get(tenant);
  if (cached && cached.expires > Date.now()) return cached.value;

  const value = unwrap(
    await upstream("Config", { tenant, lang: "en" }).GET("/v1/config/public"),
  );
  configs.set(tenant, { value, expires: Date.now() + CONFIG_TTL_MS });
  return value;
}

export async function loadPublicConfigView(
  tenant: string,
): Promise<PublicConfigView> {
  const config = await loadPublicConfig(tenant);
  return { betting: toBettingRules(config.betting) };
}
