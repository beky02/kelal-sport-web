"use client";

import { useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingKeys } from "@/lib/query/keys";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { createBooking, getBooking } from "../api/bookings";
import { slipFromBooking } from "../lib/to-slip";
import type { Booking, BookingReceipt, BookingRequest } from "../types";

/**
 * Loads a code into the slip, replacing it — unless none of its legs can be
 * added now, in which case the slip is left alone and the notice says why.
 *
 * Always a fresh read: loading re-prices every leg (C09), so a booking cached a
 * minute ago may already hold a started match. A mutation rather than a query
 * because it runs when the player asks, and its result goes into the slip.
 */
export function useLoadBooking(onLoaded?: (booking: Booking) => void) {
  const queryClient = useQueryClient();
  const replaceSlip = useBetSlipStore((s) => s.replaceSlip);
  const showBookingNotice = useBetSlipStore((s) => s.showBookingNotice);

  return useMutation({
    mutationFn: (code: string) =>
      queryClient.fetchQuery({
        queryKey: bookingKeys.detail(code),
        queryFn: ({ signal }) => getBooking(code, signal),
        staleTime: 0,
      }),
    onSuccess: (booking) => {
      const slip = slipFromBooking(booking);
      if (slip.selections.length > 0) replaceSlip(slip);
      else showBookingNotice(slip.notice);
      onLoaded?.(booking);
    },
  });
}

/** One booking intent: the slip's contents. */
export const signatureOf = (request: BookingRequest) => JSON.stringify(request);

/** setTimeout holds at most ~24.8 days; a later expiry re-arms on remount. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * Saves the slip as a code.
 *
 * The `Idempotency-Key` is made the first time a given slip is booked and sent
 * again on every retry of that same slip; a changed slip is a new intent and
 * gets a new key. The key and the code live in the slip store, so both
 * survive the sheet closing: reopening shows the same code, and a retry after
 * a remount still sends the same key. A code is dropped when it expires.
 */
export function useCreateBooking() {
  const intent = useBetSlipStore((s) => s.bookingIntent);
  const setIntent = useBetSlipStore((s) => s.setBookingIntent);

  const mutation = useMutation({
    mutationFn: ({ request, key }: { request: BookingRequest; key: string }) =>
      createBooking(request, key),
    // To the slip that asked, by its key, even if another is on screen now
    // (F3c).
    onSuccess: (receipt, { key }) =>
      useBetSlipStore.getState().bookingReceived(key, receipt),
  });
  const { mutate } = mutation;

  const book = useCallback(
    (request: BookingRequest) => {
      const signature = signatureOf(request);
      const current = useBetSlipStore.getState().bookingIntent;
      const key =
        current?.signature === signature ? current.key : crypto.randomUUID();
      if (current?.signature !== signature) {
        setIntent({ signature, key, receipt: null, receivedAt: null });
      }
      mutate({ request, key });
    },
    [mutate, setIntent],
  );

  // An expired code is no use at a shop, and must not keep Book switched off.
  // Its lifetime is the server's (issued → expires), counted on this device
  // from when it arrived, so a phone clock that is hours out changes nothing.
  useEffect(() => {
    if (!intent?.receipt || intent.receivedAt === null) return;
    const { expiresAt, issuedAt } = intent.receipt;
    const lifetime = Date.parse(expiresAt) - Date.parse(issuedAt);
    const left = lifetime - (Date.now() - intent.receivedAt);
    const timer = setTimeout(
      () => setIntent(null),
      Math.max(0, Math.min(left, MAX_TIMER_MS)),
    );
    return () => clearTimeout(timer);
  }, [intent, setIntent]);

  const failedFor = mutation.variables
    ? signatureOf(mutation.variables.request)
    : null;

  return {
    book,
    /** The code issued for this slip, if it has one. */
    receiptFor: (signature: string): BookingReceipt | null =>
      intent?.signature === signature ? intent.receipt : null,
    /** Why booking this slip last failed; a changed slip shows nothing. */
    errorFor: (signature: string): unknown =>
      mutation.isError && failedFor === signature ? mutation.error : null,
    isPending: mutation.isPending,
  };
}
