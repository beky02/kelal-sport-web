"use client";

import { useCallback } from "react";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { terminalKeys } from "@/lib/query/keys";
import { createSlipCode } from "../api/slip-codes";
import { pausedUntil, slipCodeRefusal } from "../lib/slip-code";
import { useKioskStore } from "../stores/kiosk.store";
import type { SlipCodeRequest } from "../types";

/** Every Get code, wherever the slip is mounted: one at a time. */
const GET_CODE = [...terminalKeys.all, "slip-code"] as const;

/** One Get code intent: the slip's request. */
const signatureOf = (request: SlipCodeRequest) => JSON.stringify(request);

/**
 * Get code (F8cc): the slip on screen turned into a slip code.
 *
 * The `Idempotency-Key` is made the first time a given slip is asked for and
 * sent again on every retry of that same slip — after a dropped answer, a 5xx
 * or a 429 waited out — and a changed slip gets a new one (decision 5). It
 * lives in the kiosk store, so it outlives the sheet closing; starting over
 * drops it. Nothing moves money here, so nothing is invalidated on success.
 *
 * What happens next is the mutation's own, so it lands even if the slip that
 * asked has closed (the phone sheet): a code goes on screen (the kiosk's
 * root shows it); a 429 holds Get code for its `Retry-After`; picks the API
 * says can't be sold are marked, and drop out of the next code; a refusal of
 * the terminal itself has its status read again, which decides.
 */
export function useGetCode() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: GET_CODE,
    mutationFn: ({
      request,
      key,
    }: {
      request: SlipCodeRequest;
      key: string;
      slip: number;
    }) => createSlipCode(request, key),
    onSuccess: (receipt, { slip }) =>
      useKioskStore.getState().showCode({ receipt, slip, at: Date.now() }),
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
      } else if (refusal.kind === "status") {
        void queryClient.invalidateQueries({
          queryKey: terminalKeys.status(),
        });
      }
    },
  });
  const { mutate } = mutation;
  const sending = useIsMutating({ mutationKey: GET_CODE }) > 0;

  const getCode = useCallback(
    (request: SlipCodeRequest) => {
      const kiosk = useKioskStore.getState();
      // Get code waits out the terminal's limit, whatever the screen shows.
      if (
        kiosk.codesPausedUntil !== null &&
        Date.now() < kiosk.codesPausedUntil
      ) {
        return;
      }
      if (queryClient.isMutating({ mutationKey: GET_CODE }) > 0) return;
      const signature = signatureOf(request);
      const intent = kiosk.codeIntent;
      const key =
        intent?.signature === signature ? intent.key : crypto.randomUUID();
      if (intent?.signature !== signature) {
        kiosk.setCodeIntent({ signature, key });
      }
      mutate({ request, key, slip: useBetSlipStore.getState().active });
    },
    [mutate, queryClient],
  );

  const failedFor = mutation.variables
    ? signatureOf(mutation.variables.request)
    : null;

  return {
    getCode,
    sending,
    /** Why getting a code for this slip last failed; a changed slip shows nothing. */
    refusalFor: (request: SlipCodeRequest | null) =>
      mutation.isError &&
      mutation.variables &&
      request &&
      failedFor === signatureOf(request)
        ? slipCodeRefusal(mutation.error, mutation.variables.request)
        : null,
  };
}
