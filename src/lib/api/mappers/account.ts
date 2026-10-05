import type { AccountChange, DeviceSession } from "@/features/profile/types";
import type { components } from "@/lib/api/schema";

type MePatch = components["schemas"]["MePatch"];
type Session = components["schemas"]["Session"];

/**
 * The account's preferences and devices (C01). Pure: contract shape in,
 * domain type out. What the API left out stays `null` — never guessed.
 */

/** A change to the account as the contract's `MePatch`: only what changed. */
export function toMePatch(change: AccountChange): MePatch {
  return {
    ...(change.language !== undefined ? { language: change.language } : {}),
    ...(change.marketingConsent !== undefined
      ? { marketing_consent: change.marketingConsent }
      : {}),
  };
}

export function toDeviceSession(session: Session): DeviceSession {
  return {
    id: session.id,
    platform: session.platform,
    userAgent: session.user_agent ?? null,
    ip: session.ip ?? null,
    createdAt: session.created_at,
    lastUsedAt: session.last_used_at,
    current: session.current,
  };
}

/** The devices signed in to the account (`/v1/me/sessions`), in the API's order. */
export const toDeviceSessions = (items: Session[]): DeviceSession[] =>
  items.map(toDeviceSession);
