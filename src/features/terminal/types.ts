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
 * `/api/terminal/config`. It carries nothing of the online rule set, so the
 * kiosk can't price a slip with it by mistake (D1.12: retail has its own).
 */
export interface TerminalConfigView {
  /** `features.retail` (C19 §11): off only when the tenant says `false`. */
  retail: boolean;
  /** The tenant's languages, in its order; the kiosk switches among them. */
  languages: Lang[];
  /** What the kiosk opens in (FD2: Amharic for `demo`). */
  defaultLanguage: Lang;
}

/** What the kiosk's board is asked for: a sport, a day, an order (F8ca). */
export interface KioskBoardFilters {
  sportId: string;
  /** `YYYY-MM-DD`, East Africa Time. */
  date: string;
  filter: "top" | "upcoming" | "today";
}
