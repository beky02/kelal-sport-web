"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionKeys } from "@/lib/query/keys";
import { resetPassword, sendOtp } from "../api/auth";
import { startFayda, verifyFayda } from "../api/kyc";

/**
 * The account steps that are not a sign-in. Mutations only: nothing here is
 * optimistic, and none is retried on its own — each one sends an SMS or
 * spends a code.
 */

/** Sends an SMS code — to register, or to reset a password. */
export const useSendOtp = () => useMutation({ mutationFn: sendOtp });

/** Sets a new password with the reset code. */
export const useResetPassword = () =>
  useMutation({ mutationFn: resetPassword });

/** Asks Fayda for a code to the ID holder's phone. */
export const useStartFayda = () => useMutation({ mutationFn: startFayda });

/**
 * Sends Fayda's code back. Whatever the verdict, the player's KYC status may
 * have changed, so `/api/me` — which the profile badge and the wallet's lock
 * read — is asked again.
 */
export function useVerifyFayda() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: verifyFayda,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: sessionKeys.me() }),
  });
}
