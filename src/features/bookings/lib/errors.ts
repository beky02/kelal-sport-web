import { ApiError } from "@/lib/api/errors";
import type { Interpolations, MessageKey } from "@/lib/i18n";

/**
 * What to tell the player when loading or booking a code fails, by the
 * Problem's `code` — never its title. A stake the server refused carries the
 * stake it would take (`errors[].limit`) as `fixStake`, so the slip can offer
 * it; the message then takes that amount, formatted, as `{amount}`.
 */
export function bookingErrorMessage(
  error: unknown,
  code: string,
): { key: MessageKey; values?: Interpolations; fixStake?: string } {
  const problem = error instanceof ApiError ? error : null;
  const stakeLimit = problem?.errors.find((e) => e.field === "stake")?.limit;
  switch (problem?.code ?? null) {
    case "BET_STAKE_TOO_LOW":
      return stakeLimit
        ? { key: "betSlip.errors.stakeTooLowBody", fixStake: stakeLimit }
        : { key: "booking.errors.cannotBook" };
    case "BET_STAKE_TOO_HIGH":
      return stakeLimit
        ? { key: "betSlip.errors.stakeTooHighBody", fixStake: stakeLimit }
        : { key: "booking.errors.cannotBook" };
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
      // Any other refusal of the request itself is not a connection problem.
      return problem?.status === 422
        ? { key: "booking.errors.cannotBook" }
        : { key: "booking.errors.failed" };
  }
}
