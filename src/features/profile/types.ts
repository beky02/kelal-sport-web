import type { Lang } from "@/types/common";

/**
 * What the player changes on their account (`PATCH /v1/me`): the language and
 * the marketing consent, one or both. Only what changed is sent.
 */
export interface AccountChange {
  language?: Lang;
  marketingConsent?: boolean;
}

/**
 * A device signed in to the account (`/v1/me/sessions`, REG-10). What the API
 * left out stays `null` — never guessed.
 */
export interface DeviceSession {
  id: string;
  platform: "android" | "ios" | "web";
  /** The API's own description, such as "Chrome 129 on Windows". */
  userAgent: string | null;
  /** Truncated by the API (`196.188.x.x`). */
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  /** The device this request came from. */
  current: boolean;
}
