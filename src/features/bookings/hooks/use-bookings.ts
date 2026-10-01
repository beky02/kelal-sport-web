"use client";

import { useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingKeys } from "@/lib/query/keys";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { createBooking, getBooking } from "../api/bookings";
import { slipFromBooking } from "../lib/to-slip";
import type { BookingRequest } from "../types";

/**
 * Loads a code into the slip, replacing it.
 *
 * Always a fresh read: loading re-prices every leg (C09), so a booking cached a
 * minute ago may already hold a started match. A mutation rather than a query
 * because it runs when the player asks, and its result goes into the slip.
 */
export function useLoadBooking() {
  const queryClient = useQueryClient();
  const replaceSlip = useBetSlipStore((s) => s.replaceSlip);

  return useMutation({
    mutationFn: (code: string) =>
      queryClient.fetchQuery({
        queryKey: bookingKeys.detail(code),
        queryFn: ({ signal }) => getBooking(code, signal),
        staleTime: 0,
      }),
    onSuccess: (booking) => replaceSlip(slipFromBooking(booking)),
  });
}

/** One booking intent: the slip's contents, and the key made for them. */
const signatureOf = (request: BookingRequest) => JSON.stringify(request);

/**
 * Saves the slip as a code.
 *
 * The `Idempotency-Key` is made the first time a given slip is booked and sent
 * again on every retry of that same slip; a changed slip is a new intent and
 * gets a new key. `bookedFor` says which slip the current code belongs to, so a
 * code is never shown for a slip it doesn't describe.
 */
export function useCreateBooking() {
  const intent = useRef<{ signature: string; key: string } | null>(null);
  const mutation = useMutation({
    mutationFn: ({ request, key }: { request: BookingRequest; key: string }) =>
      createBooking(request, key),
  });
  const { mutate } = mutation;

  const book = useCallback(
    (request: BookingRequest) => {
      const signature = signatureOf(request);
      if (intent.current?.signature !== signature) {
        intent.current = { signature, key: crypto.randomUUID() };
      }
      mutate({ request, key: intent.current.key });
    },
    [mutate],
  );

  return {
    book,
    receipt: mutation.data ?? null,
    /** The slip the shown code (or error) is for. */
    bookedFor: mutation.variables ? signatureOf(mutation.variables.request) : null,
    isPending: mutation.isPending,
    error: mutation.error,
    signatureOf,
  };
}
