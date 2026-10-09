"use client";

import { useCallback, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { getMe } from "@/features/auth/api/auth";
import type { SessionView } from "@/features/auth/types";
import { ApiError } from "@/lib/api/errors";
import { newIdempotencyKey } from "@/lib/idempotency";
import {
  bonusKeys,
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
  isFinal,
  sameDeposit,
  shouldPoll,
} from "../lib/deposit";
import {
  ownIntents,
  useDepositStore,
  type DepositAttempt,
} from "../stores/deposit.store";
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

/**
 * The money arrived: the balance, the history, the limits (a deposit limit's
 * used) and the bonus (a deposit can grant one, or apply a code that waited
 * for it — C11 §5) are read again, never adjusted here.
 */
function moneyArrived(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: walletKeys.all });
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  void queryClient.invalidateQueries({ queryKey: rgKeys.all });
  void queryClient.invalidateQueries({ queryKey: bonusKeys.all });
}

/** An answer that ends the reading: not this player's deposit, or no session. */
const settledBy = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 404 || error.status === 401);

/**
 * One deposit, as the API states it, read every 3 s while it is still going
 * (the contract) — paused while the tab is hidden, and read at once when it
 * comes back, as it does after the phone's prompt. It stops at a final
 * status. The moment it is `completed` the balance and the history are read
 * again: the only way money shows up in this browser. Keyed by language (its
 * texts are the API's); another language's copy shows until its own lands.
 */
export function useDeposit(id: string | null) {
  const queryClient = useQueryClient();
  const lang = useUiStore((s) => s.lang);
  return useQuery({
    queryKey: paymentKeys.deposit(id ?? "", lang),
    queryFn: async ({ signal }) => {
      const before = queryClient.getQueryData<Deposit>(
        paymentKeys.deposit(id!, lang),
      );
      const deposit = await getDeposit(id!, signal);
      if (deposit.status === "completed" && before?.status !== "completed") {
        moneyArrived(queryClient);
      }
      return deposit;
    },
    enabled: id !== null,
    // The 201 it starts from is as fresh as a read: the first read is the
    // next tick's, not another one straight away.
    staleTime: DEPOSIT_POLL_MS,
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      !settledBy(query.state.error) && shouldPoll(query.state.data)
        ? DEPOSIT_POLL_MS
        : false,
    refetchOnWindowFocus: true,
  });
}

/** The player's deposits as this page knows them (`deposit.store.ts`): theirs only. */
export function useDepositIntents(owner: string | null) {
  const intents = useDepositStore((s) => s.intents);
  return ownIntents(intents, owner);
}

/** The API's no to an attempt this flow sent, while it is the one on screen. */
export interface DepositRefusalState {
  attempt: DepositAttempt;
  error: ApiError;
  /** It answered a Try again: the first try may still have started. */
  retried: boolean;
}

/** A Try again found someone else signed in now, or no one: nothing was sent. */
class NotTheirSession extends Error {}

/** The player still signed in, as `/api/me` last said. */
const signedIn = (queryClient: QueryClient): string | null =>
  queryClient.getQueryData<SessionView>(sessionKeys.me())?.player?.id ?? null;

/**
 * Starts deposits for the signed-in player `owner`.
 *
 * Nothing is optimistic: a deposit is money, so the wallet waits for the
 * API's answer and shows the deposit it started. One intent, one
 * `Idempotency-Key`, made when the player confirms: while an intent is
 * unanswered, confirming the same method and amount sends it again with its
 * key (Try again) — from this screen or after leaving and coming back — so a
 * dropped connection never starts a second deposit. A Try again first asks
 * `/api/me` who is signed in, within the attempt's 30 s, and sends nothing
 * for anyone else. One attempt is on its way at a time, however quickly
 * Confirm is pressed.
 *
 * What an answer means is recorded by the mutation itself
 * (`deposit.store.ts`), which runs whether or not the flow that asked is
 * still on screen: a deposit that started after the player left is shown
 * when they come back and followed meanwhile; one that completed re-reads
 * the balance. Only what the flow on screen does with it — show it, leave
 * for the provider, show a refusal — waits for that flow.
 */
export function useDepositAttempt(owner: string | null) {
  const queryClient = useQueryClient();
  const mine = useDepositIntents(owner);
  const [refusal, setRefusal] = useState<DepositRefusalState | null>(null);

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
    onSuccess: (deposit, { attempt }) => {
      useDepositStore
        .getState()
        .started(
          attempt.key,
          deposit.id,
          !isFinal(deposit.status) &&
            deposit.nextAction?.type !== "unsupported",
        );
      // The API's own answer, for its status screen to start from — while it
      // is still this player's to see.
      if (signedIn(queryClient) === attempt.owner) {
        queryClient.setQueryData(
          paymentKeys.deposit(deposit.id, useUiStore.getState().lang),
          deposit,
        );
      }
      if (deposit.status === "completed") moneyArrived(queryClient);
    },
    onError: (error, { attempt, again }) => {
      const store = useDepositStore.getState();
      if (error instanceof NotTheirSession) {
        // Nothing went. The wallet follows /api/me, read again.
        store.dropped(attempt.key);
        void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
        return;
      }
      const outcome = depositOutcome(error);
      switch (outcome.kind) {
        case "unanswered":
          store.unanswered(attempt.key);
          return;
        case "session":
          store.dropped(attempt.key);
          void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
          return;
        case "refused": {
          store.refused(attempt.key, again);
          const { code } = outcome.error;
          if (
            code === "PAY_METHOD_UNAVAILABLE" ||
            code === "PAY_AMOUNT_OUT_OF_RANGE"
          ) {
            // The tile, or the limits, say so once the methods are read again.
            void queryClient.invalidateQueries({
              queryKey: paymentKeys.methodLists(),
            });
          }
          if (code.startsWith("RG_")) {
            // A break or a limit is server state: read it again.
            void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
            void queryClient.invalidateQueries({ queryKey: rgKeys.all });
          }
        }
      }
    },
  });

  /**
   * Confirm and pay: a new intent with a new key — or, while this very
   * request is unanswered, Try again with its key.
   */
  const confirm = useCallback(
    (request: DepositRequest, onStarted: (deposit: Deposit) => void) => {
      if (!owner) return;
      const { unanswered } = ownIntents(
        useDepositStore.getState().intents,
        owner,
      );
      const again =
        unanswered !== null && sameDeposit(unanswered.request, request);
      const attempt: DepositAttempt = again
        ? unanswered
        : { request, key: newIdempotencyKey(), owner };
      // One on its way at a time: read from the store, not the render, so
      // two presses in the same moment can't both go.
      if (!useDepositStore.getState().sent(attempt)) return;
      setRefusal(null);
      mutate(
        { attempt, again },
        {
          onSuccess: onStarted,
          onError: (error) => {
            const outcome =
              error instanceof NotTheirSession ? null : depositOutcome(error);
            if (outcome?.kind === "refused") {
              setRefusal({ attempt, error: outcome.error, retried: again });
            }
          },
        },
      );
    },
    [owner, mutate],
  );

  /** The player moved on from a refusal: it no longer applies. */
  const dismiss = useCallback(() => setRefusal(null), []);

  return {
    sending: mine.sending,
    unanswered: mine.unanswered,
    refusal,
    confirm,
    dismiss,
  };
}
