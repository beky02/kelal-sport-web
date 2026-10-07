import { apiClient } from "@/lib/api/client";
import { bookingReceiptSchema, bookingSchema } from "@/lib/api/booking-schemas";
import type { Booking, BookingReceipt, BookingRequest } from "../types";

/** A booking by its canonical code (see `normaliseBookingCode`). */
export function getBooking(
  code: string,
  signal?: AbortSignal,
): Promise<Booking> {
  return apiClient.get(`/bookings/${code}`, bookingSchema, { signal });
}

/** Saves the slip as a code. `idempotencyKey` is one per booking intent. */
export function createBooking(
  request: BookingRequest,
  idempotencyKey: string,
): Promise<BookingReceipt> {
  return apiClient.post("/bookings", bookingReceiptSchema, request, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
