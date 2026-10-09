"use client";

import { useCallback } from "react";
import {
  useIsMutating,
  useMutation,
  useMutationState,
  useQueryClient,
  type MutationState,
} from "@tanstack/react-query";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { eventKeys, terminalKeys } from "@/lib/query/keys";
import { createSlipCode } from "../api/slip-codes";
import { pausedUntil, slipCodeRefusal } from "../lib/slip-code";
import { useKioskStore } from "../stores/kiosk.store";
import type { SlipCodeReceipt, SlipCodeRequest } from "../types";

/** Every Book bet, wherever the slip is mounted: one at a time. */
const BOOK = [...terminalKeys.all, "slip-code"] as const;

type Booking = { request: SlipCodeRequest; key: string };

/** One Book bet intent: the slip's request. */
const signatureOf = (request: SlipCodeRequest) => JSON.stringify(request);

/**
 * Book bet on the shop kiosk (F8cc): the slip on screen turned into a slip
 * code for the counter.
 *
 * The `Idempotency-Key` is made the first time a given slip is booked and sent
 * again on every retry of that same slip — after a dropped answer, a 5xx or a
 * 429 waited out — and a changed slip gets a new one (decision 5). The key and
 * the code live in the kiosk store by the slip's request, so both outlive the
 * sheet closing, and the same slip is never booked twice: Booked opens its
 * code again. Starting over drops them. Nothing moves money here, so nothing
 * is invalidated on success.
 *
 * What a refusal does is the mutation's own, so it lands even if the slip
 * that asked has closed (the phone sheet): a 429 holds Book bet for its
 * `Retry-After`; picks the API says can't be sold are marked, and drop out of
 * the next request; a refusal of the terminal itself has its status read
 * again, which decides.
 */
export function useBookSlip() {
  const queryClient = useQueryClient();
  const codes = useKioskStore((s) => s.codes);
  const mutation = useMutation({
    mutationKey: BOOK,
    mutationFn: ({ request, key }: Booking) => createSlipCode(request, key),
    onSuccess: (receipt, { key }) =>
      useKioskStore.getState().codeReceived(key, receipt),
    onError: (error, { request }) => {
      const refusal = slipCodeRefusal(error, request);
      if (refusal.kind === "paused") {
        useKioskStore
          .getState()
          .pauseCodes(pausedUntil(refusal.retryAfter, Date.now()));
      } else if (refusal.kind === "legs") {
        const slips = useBetSlipStore.getState();
        for (const outcomeId of refusal.outcomeIds) {
          const pick = slips.selections.find((s) => s.outcomeId === outcomeId);
          if (pick) slips.applyEventSuspension(pick.eventId, true);
        }
        // The board reads its prices again, so it shows what the API said
        // rather than the refused pick still open (review U1).
        void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      } else if (refusal.kind === "status") {
        void queryClient.invalidateQueries({
          queryKey: terminalKeys.status(),
        });
      }
    },
  });
  const { mutate } = mutation;
  const sending = useIsMutating({ mutationKey: BOOK }) > 0;
  // The latest Book bet from the shared cache, not this mount's observer: the
  // slip is mounted twice below `xl`, and a sheet opened after a refusal must
  // say it too (review Q4).
  const latest = useMutationState({
    filters: { mutationKey: BOOK },
    select: (m) => m.state as MutationState<SlipCodeReceipt, Error, Booking>,
  }).at(-1);

  const book = useCallback(
    (request: SlipCodeRequest) => {
      const kiosk = useKioskStore.getState();
      // Book bet waits out the terminal's limit, whatever the screen shows.
      if (
        kiosk.codesPausedUntil !== null &&
        Date.now() < kiosk.codesPausedUntil
      ) {
        return;
      }
      if (queryClient.isMutating({ mutationKey: BOOK }) > 0) return;
      const signature = signatureOf(request);
      const intent = kiosk.codes[signature];
      if (intent?.receipt) return;
      const key = intent?.key ?? crypto.randomUUID();
      if (!intent) kiosk.askCode(signature, key);
      mutate({ request, key });
    },
    [mutate, queryClient],
  );

  const failed = latest?.status === "error" ? latest : null;
  const failedFor = failed?.variables
    ? signatureOf(failed.variables.request)
    : null;

  return {
    book,
    sending,
    /** The code made for this slip, if it has one. */
    receiptFor: (request: SlipCodeRequest | null): SlipCodeReceipt | null =>
      request ? (codes[signatureOf(request)]?.receipt ?? null) : null,
    /**
     * Why booking this slip — of `lines` lines — last failed; a changed slip
     * shows nothing.
     */
    refusalFor: (request: SlipCodeRequest | null, lines: number) =>
      failed?.variables && request && failedFor === signatureOf(request)
        ? slipCodeRefusal(failed.error, failed.variables.request, lines)
        : null,
  };
}
