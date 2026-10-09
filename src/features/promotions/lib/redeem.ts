import { ApiError } from "@/lib/api/errors";
import type { MessageKey } from "@/lib/i18n";

/**
 * What a failed redeem means for the code the player sent.
 *
 * - `unanswered`: it may have gone through — no response, 30 s, an
 *   unreadable reply, a 5xx, a rate limit. The same code goes again with the
 *   same key (Try again), so it is never used twice.
 * - `session`: the session is gone (401); the session-ended path follows.
 * - `refused`: the API said no, with a code. The next try is a new intent with
 *   a new key.
 */
export type RedeemOutcome =
  | { kind: "unanswered" }
  | { kind: "session" }
  | { kind: "refused"; error: ApiError };

export function redeemOutcome(error: unknown): RedeemOutcome {
  if (!(error instanceof ApiError) || error.status === 0) {
    return { kind: "unanswered" };
  }
  if (error.status === 401) return { kind: "session" };
  // "Not now" says nothing about whether this key already redeemed it.
  if (error.status === 429 || error.status >= 500) {
    return { kind: "unanswered" };
  }
  return { kind: "refused", error };
}

/** What a refusal offers: change the code in the field, or verify an ID first. */
export type RedeemFix = "edit" | "verify";

/** A refusal in the player's words: our line where we have one, else the API's. */
export interface RedeemNotice {
  title: MessageKey;
  /** Our own line under the title, or null. */
  body: MessageKey | null;
  /** The API's own words — its translated title, or the field's message. */
  detail: string | null;
  fix: RedeemFix | null;
}

/**
 * A refusal, by its Problem `code` — never its title or its status, which the
 * contract doesn't fix for the promo codes (05-errors).
 */
export function redeemNotice(error: ApiError): RedeemNotice {
  switch (error.code) {
    case "PROMO_INVALID":
    // The contract's 404 for a code the API doesn't know.
    case "NOT_FOUND":
      return {
        title: "promotions.codeInvalidTitle",
        body: "promotions.codeInvalidBody",
        detail: null,
        fix: "edit",
      };
    case "PROMO_ALREADY_USED":
      return {
        title: "promotions.codeUsedTitle",
        body: null,
        detail: null,
        fix: null,
      };
    case "VALIDATION_FAILED":
      return {
        title: "promotions.codeCheckTitle",
        body: null,
        detail:
          error.errors.find((e) => e.field === "code")?.message?.trim() || null,
        fix: "edit",
      };
    default:
      return {
        title: "promotions.codeRefusedTitle",
        body: null,
        detail: error.message,
        fix: error.code === "KYC_REQUIRED" ? "verify" : null,
      };
  }
}
