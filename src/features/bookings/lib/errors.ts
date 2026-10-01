import { ApiError } from "@/lib/api/errors";
import type { Interpolations, MessageKey } from "@/lib/i18n";

/**
 * What to tell the player when loading or booking a code fails, by the
 * Problem's `code` — never its title.
 */
export function bookingErrorMessage(
  error: unknown,
  code: string,
): { key: MessageKey; values?: Interpolations } {
  switch (error instanceof ApiError ? error.code : null) {
    case "BOOKING_EXPIRED":
      return { key: "booking.errors.expired", values: { code } };
    // The contract lists BOOKING_NOT_FOUND; its example (and Prism) say
    // NOT_FOUND. Both mean there is no booking with that code.
    case "BOOKING_NOT_FOUND":
    case "NOT_FOUND":
      return { key: "booking.errors.notFound", values: { code } };
    case "RATE_LIMITED":
      return { key: "booking.errors.rateLimited" };
    case "VALIDATION_FAILED":
      return { key: "booking.errors.cannotBook" };
    default:
      return { key: "booking.errors.failed" };
  }
}
