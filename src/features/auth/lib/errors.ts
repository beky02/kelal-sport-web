import { ApiError } from "@/lib/api/errors";
import type { MessageKey } from "@/lib/i18n";

/** What a refusal offers to do about it (05-errors). */
export type AuthFix =
  | "logInAgain"
  | "logInInstead"
  | "sendNewCode"
  | "doThisLater"
  | "responsibleGaming";

/**
 * What to tell the player when the API refuses, by the Problem's `code` —
 * never its title. A refusal the player can act on names the action (`fix`);
 * a lock-out passes on the API's `detail`, which says how long it lasts.
 */
export interface AuthErrorView {
  /** Our own words, in both languages, for a code we know. */
  key?: MessageKey;
  /** The API's translated title, for a code we don't. */
  text?: string;
  detail?: string;
  fix?: AuthFix;
  /**
   * `VALIDATION_FAILED`: the API's message for each field of this step it
   * named — `null` when it gave a code but no words.
   */
  fields?: Record<string, string | null>;
}

export interface AuthErrorOptions {
  /**
   * What an expired code offers: at login a fresh login brings a fresh code;
   * elsewhere the code is sent again.
   */
  expired?: "logInAgain" | "sendNewCode";
  /** The fields the step on screen has, by the contract's names. */
  fields?: readonly string[];
}

const detailOf = (error: ApiError): string | undefined => {
  const detail = (error.details as { detail?: unknown } | undefined)?.detail;
  return typeof detail === "string" && detail.trim() ? detail : undefined;
};

/**
 * `errors[]` split between the fields the step has (shown under each) and the
 * rest (their messages, one per line, in the notice).
 */
function validation(error: ApiError, known: readonly string[]): AuthErrorView {
  const fields: Record<string, string | null> = {};
  const rest: string[] = [];
  for (const entry of error.errors) {
    if (entry.field && known.includes(entry.field)) {
      fields[entry.field] = entry.message?.trim() || null;
    } else if (entry.message?.trim()) {
      rest.push(entry.message.trim());
    }
  }
  return {
    key: "auth.errors.VALIDATION_FAILED",
    ...(Object.keys(fields).length > 0 ? { fields } : {}),
    ...(rest.length > 0 ? { detail: rest.join("\n") } : {}),
  };
}

export function authErrorMessage(
  error: unknown,
  { expired = "logInAgain", fields = [] }: AuthErrorOptions = {},
): AuthErrorView {
  if (!(error instanceof ApiError)) return { key: "auth.errors.failed" };
  switch (error.code) {
    case "AUTH_INVALID_CREDENTIALS":
      return { key: "auth.errors.AUTH_INVALID_CREDENTIALS" };
    case "AUTH_LOCKED": {
      const detail = detailOf(error);
      return detail
        ? { key: "auth.errors.AUTH_LOCKED", detail }
        : { key: "auth.errors.AUTH_LOCKED" };
    }
    case "AUTH_OTP_INVALID":
      return { key: "auth.errors.AUTH_OTP_INVALID" };
    case "AUTH_OTP_EXPIRED":
      return expired === "sendNewCode"
        ? { key: "auth.errors.otpExpiredResend", fix: "sendNewCode" }
        : { key: "auth.errors.AUTH_OTP_EXPIRED", fix: "logInAgain" };
    case "RATE_LIMITED":
    case "AUTH_OTP_RATE_LIMITED":
      return { key: "auth.errors.RATE_LIMITED" };
    case "AUTH_OTP_UNAVAILABLE":
      return { key: "auth.errors.AUTH_OTP_UNAVAILABLE" };
    case "REG_PHONE_TAKEN":
      return { key: "auth.errors.REG_PHONE_TAKEN", fix: "logInInstead" };
    case "REG_ID_TAKEN":
      return { key: "auth.errors.REG_ID_TAKEN" };
    case "REG_UNDERAGE":
      return { key: "auth.errors.REG_UNDERAGE", fix: "responsibleGaming" };
    case "KYC_PROVIDER_UNAVAILABLE":
      return {
        key: "auth.errors.KYC_PROVIDER_UNAVAILABLE",
        fix: "doThisLater",
      };
    case "AUTH_TOKEN_EXPIRED":
      // Only a route that needs a player says this to the browser: the
      // session could not be kept (F4a refreshes everything it can).
      return { key: "auth.errors.AUTH_TOKEN_EXPIRED", fix: "logInAgain" };
    case "VALIDATION_FAILED":
      return validation(error, fields);
  }
  // The network, the API down, or a response that was not a Problem.
  if (
    error.retryable ||
    error.code === "network" ||
    error.code === "http_error"
  ) {
    return { key: "auth.errors.failed" };
  }
  return { text: error.message };
}

/** The codes the API checks on the call after the code step (C01 §6). */
export const isCodeRefusal = (error: unknown): boolean =>
  error instanceof ApiError &&
  (error.code === "AUTH_OTP_INVALID" || error.code === "AUTH_OTP_EXPIRED");
