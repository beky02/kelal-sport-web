import "server-only";
import type { components } from "@/lib/api/schema";
import type { PublicConfigView } from "@/features/config/types";
import type { TerminalConfigView } from "@/features/terminal/types";
import type { Lang } from "@/types/common";
import {
  toPublicConfigView,
  toTerminalConfigView,
} from "@/lib/api/mappers/config";
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
  return toPublicConfigView(await loadPublicConfig(tenant));
}

/** What the shop kiosk needs from the same config (F8ca, `/api/terminal/config`). */
export async function loadTerminalConfigView(
  tenant: string,
): Promise<TerminalConfigView> {
  return toTerminalConfigView(await loadPublicConfig(tenant));
}

/**
 * What a page a link-preview bot reads needs from config: the language (with
 * no language in the URL yet and no stored choice, the tenant's default —
 * FD2), the brand, and whether booking codes are on. If config can't be read
 * the page still renders — in English, with no brand rather than another
 * tenant's.
 */
export async function loadPageLocale(tenant: string): Promise<{
  lang: Lang;
  siteName: string | null;
  bookingCodes: boolean;
}> {
  try {
    const config = await loadPublicConfig(tenant);
    return {
      lang: config.default_language,
      siteName: config.brand.name,
      bookingCodes: toPublicConfigView(config).features.bookingCodes,
    };
  } catch (error) {
    console.error(error);
    return { lang: "en", siteName: null, bookingCodes: true };
  }
}
