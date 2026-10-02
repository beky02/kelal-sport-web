import "server-only";
import type {
  Booking,
  BookingLookup,
  BookingReceipt,
  BookingRequest,
} from "@/features/bookings/types";
import {
  toBooking,
  toBookingCreate,
  toBookingReceipt,
} from "@/lib/api/mappers/bookings";
import { UpstreamError, both, unwrap, upstream } from "./upstream";

/**
 * Booking codes (C09), as the slip and the `/b/{code}` page want them.
 *
 * Loading re-prices every leg from the current catalogue, so nothing here is
 * cached: a booking read a minute ago may already have a started match.
 */

/** A booking by its canonical code, names in both languages. Throws `UpstreamError` (404, 410…). */
export async function loadBooking(
  tenant: string,
  code: string,
  prefer?: string,
): Promise<Booking> {
  const pair = await both(async (lang) =>
    unwrap(
      await upstream("Bookings", { tenant, lang, prefer }).GET(
        "/v1/bookings/{code}",
        { params: { path: { code } } },
      ),
    ),
  );
  return toBooking(pair);
}

/**
 * Saves a slip as a code.
 *
 * `Idempotency-Key` is the browser's, made once per booking intent and reused
 * on retry; this never invents one. The contract does not declare it on this
 * operation yet (contract request 005), so the API may ignore it.
 */
export async function createBooking(
  tenant: string,
  request: BookingRequest,
  idempotencyKey: string,
  prefer?: string,
): Promise<BookingReceipt> {
  const result = await upstream("Bookings", {
    tenant,
    lang: "en",
    prefer,
  }).POST("/v1/bookings", {
    body: toBookingCreate(request),
    headers: { "Idempotency-Key": idempotencyKey },
  });
  const created = unwrap(result);
  // The API's clock, not ours or the phone's: the code lasts from then until
  // `expires_at`.
  const date = Date.parse(result.response.headers.get("date") ?? "");
  const issuedAt = new Date(
    Number.isNaN(date) ? Date.now() : date,
  ).toISOString();
  return toBookingReceipt(created, issuedAt);
}

/**
 * A booking for the `/b/{code}` page, which shows a state for every outcome.
 * Expired and missing codes are told apart by the Problem's `code`, never by
 * its title; anything else is a failure, not a missing booking.
 */
export async function lookupBooking(
  tenant: string,
  code: string,
  prefer?: string,
): Promise<BookingLookup> {
  try {
    return { status: "ok", booking: await loadBooking(tenant, code, prefer) };
  } catch (error) {
    const problem =
      error instanceof UpstreamError
        ? (error.problem as { code?: unknown } | null)
        : null;
    switch (problem?.code) {
      case "BOOKING_EXPIRED":
        return { status: "expired", code };
      case "BOOKING_NOT_FOUND":
      case "NOT_FOUND":
        return { status: "not_found", code };
    }
    console.error(error);
    return { status: "failed", code };
  }
}
