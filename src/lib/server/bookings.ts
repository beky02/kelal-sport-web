import "server-only";
import type {
  Booking,
  BookingReceipt,
  BookingRequest,
} from "@/features/bookings/types";
import {
  toBooking,
  toBookingCreate,
  toBookingReceipt,
} from "@/lib/api/mappers/bookings";
import { both, unwrap, upstream } from "./upstream";

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
  const created = unwrap(
    await upstream("Bookings", { tenant, lang: "en", prefer }).POST(
      "/v1/bookings",
      {
        body: toBookingCreate(request),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    ),
  );
  return toBookingReceipt(created);
}
