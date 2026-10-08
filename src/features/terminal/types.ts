import type { BettingRules } from "@/features/config/types";
import type { Lang } from "@/types/common";

/**
 * The shop terminal (C19 §4.1, F8b): a kiosk PC activated once with a one-time
 * code, holding a device key and a terminal token, with no player and no money.
 */

/** The shop a terminal belongs to, as `GET /v1/retail/terminal` says now. */
export interface TerminalShop {
  code: string;
  name: string;
  /** False while the shop is closed or suspended: the terminal shows "closed" (C19 §14). */
  openNow: boolean;
}

export interface TerminalInfo {
  id: string;
  /** What the shop calls this PC ("PC 3"), when the back office named it. */
  label: string | null;
  shop: TerminalShop;
  /** Seconds without a touch before the screen resets (F8c), when configured. */
  idleResetSeconds: number | null;
  /** Seconds a slip code stays on screen (F8c), when configured. */
  codeDisplaySeconds: number | null;
}

/**
 * What the terminal is, from the server's point of view:
 *
 * - `inactive` — not activated here (`new`), or its token lapsed (`expired`):
 *   the activation screen.
 * - `active` — the shop's terminal; `rotateDue` when fewer than 7 days of its
 *   token remain, so the browser signs a rotation.
 * - `blocked` — revoked, or this PC is not allowed: says so and offers nothing.
 */
export type TerminalStatus =
  | { state: "inactive"; reason: "new" | "expired" }
  | { state: "active"; terminal: TerminalInfo; rotateDue: boolean }
  | { state: "blocked"; reason: "revoked" | "device_not_allowed" };

/** What the activation screen sends: the code, and the device key's public half. */
export interface ActivationForm {
  /** 8 Crockford base32 characters, upper case, no spaces. */
  activationCode: string;
  /** The device key's public half: SPKI, base64. */
  devicePublicKey: string;
}

/** What activation answers the browser: which shop this PC now belongs to. */
export interface TerminalActivation {
  id: string;
  label: string | null;
  shop: { code: string; name: string };
}

/** `POST /api/terminal/token`'s answer: the token was replaced. */
export interface TokenRotation {
  rotated: true;
}

/**
 * What the kiosk needs from the tenant's public config (F8ca):
 * `/api/terminal/config`. It carries the shop's rule set and nothing of the
 * online one, so the kiosk can't price a slip with it by mistake (D1.12:
 * retail has its own).
 */
export interface TerminalConfigView {
  /** `features.retail` (C19 §11): off only when the tenant says `false`. */
  retail: boolean;
  /** `features.booking_codes`: whether the slip can load a shared code. */
  bookingCodes: boolean;
  /** The tenant's languages, in its order; the kiosk switches among them. */
  languages: Lang[];
  /** The tenant's default (FD2: Amharic for `demo`); the kiosk opens in it only without English. */
  defaultLanguage: Lang;
  /**
   * The shop's rule set (`retail_betting`, D1.12; one per brand, the user's
   * decision of 2026-10-07): what the kiosk's slip is priced with (F8cb).
   * Null when the tenant has none: the slip then shows no figure, never one
   * from the online `betting`.
   */
  rules: BettingRules | null;
}

/**
 * A slip to turn into a slip code (F8cc, C19 §4.2): the picks on sale, each
 * at the odds the kiosk showed, and the stake typed as a hint for the
 * counter. Decimal strings throughout (FD4).
 */
export interface SlipCodeRequest {
  betType: "single" | "multiple" | "system";
  /** `[k]` for a system bet; empty for any other. */
  systemSizes: number[];
  legs: Array<{ outcomeId: string; odds: string }>;
  /** The total stake as typed (`"50.00"`), or null to send the picks alone. */
  stakeHint: string | null;
}

/** The slip code the API made (`SlipCodeCreated`), as the kiosk shows it. */
export interface SlipCodeReceipt {
  /** Eight digits: what the counter types. */
  code: string;
  /** The code grouped for reading, `4829 1735`: never other digits than `code`'s. */
  display: string;
  /** ISO UTC. */
  expiresAt: string;
  /** What the QR code encodes. */
  qr: string;
}
