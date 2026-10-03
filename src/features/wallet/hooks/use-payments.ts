"use client";

import { useCallback, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { getMe } from "@/features/auth/api/auth";
import { ApiError } from "@/lib/api/errors";
import { newIdempotencyKey } from "@/lib/idempotency";
import {
  paymentKeys,
  rgKeys,
  sessionKeys,
  transactionKeys,
  walletKeys,
} from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import {
  createDeposit,
  depositDeadline,
  getDeposit,
  getPaymentMethods,
} from "../api/payments";
import {
  DEPOSIT_POLL_MS,
  depositOutcome,
  sameDeposit,
  shouldPoll,
} from "../lib/deposit";
import type { Deposit, DepositRequest } from "../types";

/**
 * How long the methods are fresh. Short: a provider that goes down is marked
 * unavailable by the API within a minute (C04's circuit breaker).
 */
const METHODS_STALE_MS = 30_000;

/**
 * The payment methods offered to this player, with their limits, in the UI's
 * language. A signed-in player's only (`enabled`).
 */
export function usePaymentMethods(enabled: boolean) {
  const lang = useUiStore((s) => s.lang);
  return useQuery({
    queryKey: paymentKeys.methods(lang),
    queryFn: ({ signal }) => getPaymentMethods(signal),
    staleTime: METHODS_STALE_MS,
    enabled,
  });
}

/** The money arrived: the balance and the history are read again, never adjusted here. */
function moneyArrived(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: walletKeys.all });
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
}

/** An answer that ends the reading: not this player's deposit, or no session. */
const settledBy = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 404 || error.status === 401);

/**
 * One deposit, as the API states it, read every 3 s while it is still going
 * (the contract) — paused while the tab is hidden, and read at once when it
 * comes back, as it does after the phone's prompt. It stops at a final
 * status. The moment it is `completed` the balance and the history are read
 * again: the only way money shows up in this browser.
 */
export function useDeposit(id: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: paymentKeys.deposit(id ?? ""),
    queryFn: async ({ signal }) => {
      const before = queryClient.getQueryData<Deposit>(
        paymentKeys.deposit(id!),
      );
      const deposit = await getDeposit(id!, signal);
      if (deposit.status === "completed" && before?.status !== "completed") {
        moneyArrived(queryClient);
      }
      return deposit;
    },
    enabled: id !== null,
    staleTime: 0,
    refetchInterval: (query) =>
      !settledBy(query.state.error) && shouldPoll(query.state.data)
        ? DEPOSIT_POLL_MS
        : false,
    refetchOnWindowFocus: true,
  });
}

/** One deposit intent: what was asked, its key, and for whom. */
export interface DepositAttempt {
  request: DepositRequest;
  key: string;
  owner: string;
}

/**
 * Where the intent stands. `sending`: on its way. `unanswered`: no answer
 * settled it, so it may exist — only Try again, the same request with the
 * same key, may go. `refused`: the API said no; the next Confirm is a new
 * intent. A started deposit leaves the attempt (`idle`) for its status screen.
 */
export type AttemptState =
  | { phase: "idle" }
  | { phase: "sending"; attempt: DepositAttempt }
  | { phase: "unanswered"; attempt: DepositAttempt }
  | { phase: "refused"; attempt: DepositAttempt; error: ApiError };

/** A Try again found someone else signed in now, or no one: nothing was sent. */
class NotTheirSession extends Error {}

/**
 * Starts deposits for the signed-in player `owner`.
 *
 * Nothing is optimistic: a deposit is money, so the wallet waits for the
 * API's answer and shows the deposit it started. One intent, one
 * `Idempotency-Key`, made when the player confirms: while an intent is
 * unanswered, confirming the same method and amount sends it again with its
 * key (Try again), so a dropped connection never starts a second deposit. A
 * Try again first asks `/api/me` who is signed in, within the attempt's 30 s,
 * and sends nothing for anyone else.
 *
 * Outcomes land in component state from the call's own callbacks, which run
 * only while the flow that asked is on screen — and the flow is the signed-in
 * player's alone, so an answer that lands after someone else signed in goes
 * nowhere.
 */
export function useDepositAttempt(owner: string | null) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AttemptState>({ phase: "idle" });
  // One attempt on its way at a time, whatever the render says: two presses
  // in the same moment both see `idle` until it re-renders.
  const sending = useRef(false);

  const { mutate } = useMutation({
    mutationFn: async ({
      attempt,
      again,
    }: {
      attempt: DepositAttempt;
      again: boolean;
    }) => {
      // One deadline for the whole attempt, whatever it asks.
      const deadline = depositDeadline();
      if (again) {
        const { player } = await getMe(deadline);
        if (player?.id !== attempt.owner) throw new NotTheirSession();
      }
      return createDeposit(attempt.request, attempt.key, deadline);
    },
  });

  const send = useCallback(
    (
      attempt: DepositAttempt,
      again: boolean,
      onStarted: (deposit: Deposit) => void,
    ) => {
      if (sending.current) return;
      sending.current = true;
      setState({ phase: "sending", attempt });
      mutate(
        { attempt, again },
        {
          onSettled: () => {
            sending.current = false;
          },
          onSuccess: (deposit) => {
            // The API's own answer, kept for the status screen to start from.
            queryClient.setQueryData(paymentKeys.deposit(deposit.id), deposit);
            if (deposit.status === "completed") moneyArrived(queryClient);
            setState({ phase: "idle" });
            onStarted(deposit);
          },
          onError: (error) => {
            if (error instanceof NotTheirSession) {
              // Nothing went. The wallet follows /api/me, read again.
              setState({ phase: "idle" });
              void queryClient.invalidateQueries({
                queryKey: sessionKeys.me(),
              });
              return;
            }
            const outcome = depositOutcome(error);
            switch (outcome.kind) {
              case "unanswered":
                setState({ phase: "unanswered", attempt });
                return;
              case "session":
                setState({ phase: "idle" });
                void queryClient.invalidateQueries({
                  queryKey: sessionKeys.me(),
                });
                return;
              case "refused": {
                setState({ phase: "refused", attempt, error: outcome.error });
                const { code } = outcome.error;
                if (code === "PAY_METHOD_UNAVAILABLE") {
                  // Its tile says so once the methods are read again.
                  void queryClient.invalidateQueries({
                    queryKey: [...paymentKeys.all, "methods"],
                  });
                }
                if (code.startsWith("RG_")) {
                  // A break or a limit is server state: read it again.
                  void queryClient.invalidateQueries({
                    queryKey: sessionKeys.me(),
                  });
                  void queryClient.invalidateQueries({ queryKey: rgKeys.all });
                }
              }
            }
          },
        },
      );
    },
    [mutate, queryClient],
  );

  /**
   * Confirm and pay: a new intent with a new key — or, while this very
   * request is unanswered, Try again with its key.
   */
  const confirm = useCallback(
    (request: DepositRequest, onStarted: (deposit: Deposit) => void) => {
      if (!owner || state.phase === "sending") return;
      if (
        state.phase === "unanswered" &&
        sameDeposit(state.attempt.request, request)
      ) {
        send(state.attempt, true, onStarted);
        return;
      }
      send({ request, key: newIdempotencyKey(), owner }, false, onStarted);
    },
    [owner, state, send],
  );

  /** The player moved on: whatever the last attempt said no longer applies. */
  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, confirm, reset };
}
