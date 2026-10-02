import { ApiError } from "@/lib/api/errors";
import type { MessageKey } from "@/lib/i18n";

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
  fix?: "logInAgain";
}

const detailOf = (error: ApiError): string | undefined => {
  const detail = (error.details as { detail?: unknown } | undefined)?.detail;
  return typeof detail === "string" && detail.trim() ? detail : undefined;
};

export function authErrorMessage(error: unknown): AuthErrorView {
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
      return { key: "auth.errors.AUTH_OTP_EXPIRED", fix: "logInAgain" };
    case "RATE_LIMITED":
    case "AUTH_OTP_RATE_LIMITED":
      return { key: "auth.errors.RATE_LIMITED" };
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
