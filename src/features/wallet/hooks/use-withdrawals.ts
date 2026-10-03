"use client";

import { useCallback, useRef, useState } from "react";
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
  paymentKeys,
  rgKeys,
  sessionKeys,
  transactionKeys,
  walletKeys,
} from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import {
  addPayoutAccount,
  cancelWithdrawal,
  createWithdrawal,
  getPayoutAccounts,
  getWithdrawal,
  removePayoutAccount,
  withdrawalDeadline,
} from "../api/withdrawals";
import {
  cancelOutcome,
  pollInterval,
  sameWithdrawal,
  WITHDRAWAL_POLL_MS,
  withdrawalOutcome,
} from "../lib/withdrawal";
import {
  ownWithdrawalIntents,
  useWithdrawalStore,
  type WithdrawalAttempt,
} from "../stores/withdrawal.store";
import type {
  PayoutAccount,
  PayoutAccountRequest,
  Withdrawal,
  WithdrawalRequest,
} from "../types";

/** How long the saved accounts are fresh: only this player changes them, and each change re-reads them. */
const ACCOUNTS_STALE_MS = 60_000;

/** The player's saved payout accounts. A signed-in player's only (`enabled`). */
export function usePayoutAccounts(enabled: boolean) {
  return useQuery({
    queryKey: paymentKeys.payoutAccounts(),
    queryFn: ({ signal }) => getPayoutAccounts(signal),
    staleTime: ACCOUNTS_STALE_MS,
    enabled,
  });
}

/** The session is gone, or changed hands: the wallet follows `/api/me`, read again. */
const readSessionAgain = (queryClient: QueryClient): void =>
  void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });

const readAccountsAgain = (queryClient: QueryClient): void =>
  void queryClient.invalidateQueries({
    queryKey: paymentKeys.payoutAccounts(),
  });

/**
 * Saves a payout account. The API's own answer goes into the list at once,
 * so the new account can be chosen straight away, and the list is read
 * again; a refusal re-reads it too — a 409 may mean it was already saved.
 */
export function useAddPayoutAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: PayoutAccountRequest) => addPayoutAccount(request),
    onSuccess: (account) => {
      queryClient.setQueryData<PayoutAccount[]>(
        paymentKeys.payoutAccounts(),
        (list) =>
          list && !list.some((saved) => saved.id === account.id)
            ? [...list, account]
            : list,
      );
      readAccountsAgain(queryClient);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        readSessionAgain(queryClient);
        return;
      }
      readAccountsAgain(queryClient);
    },
  });
}

/**
 * Removes a payout account. Gone either way — removed now, or not there (a
 * 404) — it leaves the list at once, and the list is read again.
 */
export function useRemovePayoutAccount() {
  const queryClient = useQueryClient();
  const removed = (id: string) => {
    queryClient.setQueryData<PayoutAccount[]>(
      paymentKeys.payoutAccounts(),
      (list) => list?.filter((saved) => saved.id !== id),
    );
    readAccountsAgain(queryClient);
  };
  return useMutation({
    mutationFn: (id: string) => removePayoutAccount(id),
    onSuccess: (_, id) => removed(id),
    onError: (error, id) => {
      if (error instanceof ApiError && error.status === 404) removed(id);
      else if (error instanceof ApiError && error.status === 401) {
        readSessionAgain(queryClient);
      }
    },
  });
}

/**
 * Money may have moved: the balance and the history are read again — the
 * only way a withdrawal shows up in this browser — never adjusted here.
 */
function moneyMoved(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: walletKeys.all });
  void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
}

/** An answer that ends the reading: not this player's withdrawal, or no session. */
const settledBy = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 404 || error.status === 401);

/**
 * One withdrawal, as the API states it: read again every 10 s while it moves
 * on its own, every minute while a person reviews it (`pollInterval`), only
 * while its screen is open and the tab visible — read at once when the tab
 * comes back — until the API decides. Whenever a read shows its status has
 * changed, the balance and the history are read again: paying it, failing
 * it, rejecting or cancelling it each move money (C03 §6), and the browser
 * assumes nothing about when. Keyed by language (its rejection reason is the
 * API's text); another language's copy shows until its own lands.
 */
export function useWithdrawal(id: string | null) {
  const queryClient = useQueryClient();
  const lang = useUiStore((s) => s.lang);
  return useQuery({
    queryKey: paymentKeys.withdrawal(id ?? "", lang),
    queryFn: async ({ signal }) => {
      const before = queryClient.getQueryData<Withdrawal>(
        paymentKeys.withdrawal(id!, lang),
      );
      const withdrawal = await getWithdrawal(id!, signal);
      if (before && before.status !== withdrawal.status) {
        moneyMoved(queryClient);
      }
      return withdrawal;
    },
    enabled: id !== null,
    // The answer it starts from is as fresh as a read: the first read is
    // the next beat's, not another one straight away.
    staleTime: WITHDRAWAL_POLL_MS,
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      settledBy(query.state.error) ? false : pollInterval(query.state.data),
    refetchOnWindowFocus: true,
  });
}

/** The player's withdrawal intents as this page knows them (`withdrawal.store.ts`): theirs only. */
export function useWithdrawalIntents(owner: string | null) {
  const intents = useWithdrawalStore((s) => s.intents);
  return ownWithdrawalIntents(intents, owner);
}

/** The API's no to an attempt this flow sent, while it is the one on screen. */
export interface WithdrawalRefusalState {
  attempt: WithdrawalAttempt;
  error: ApiError;
  /** It answered a Try again: the first try may still have gone through. */
  retried: boolean;
}

/** A Try again found someone else signed in now, or no one: nothing was sent. */
class NotTheirSession extends Error {}

/** The player still signed in, as `/api/me` last said. */
const signedIn = (queryClient: QueryClient): string | null =>
  queryClient.getQueryData<SessionView>(sessionKeys.me())?.player?.id ?? null;

/**
 * Requests withdrawals for the signed-in player `owner`.
 *
 * Nothing is optimistic: a withdrawal is money, so the wallet waits for the
 * API's answer and shows the withdrawal it accepted. One intent, one
 * `Idempotency-Key`, made when the player confirms: while an intent is
 * unanswered, confirming the same method, account and amount sends it again
 * with its key (Try again) — from this screen or after leaving and coming
 * back — so a dropped connection never asks for a second withdrawal. A Try
 * again first asks `/api/me` who is signed in, within the attempt's 30 s,
 * and sends nothing for anyone else. One attempt is on its way at a time,
 * however quickly Confirm is pressed.
 *
 * What an answer means is recorded by the mutation itself
 * (`withdrawal.store.ts`), which runs whether or not the flow that asked is
 * still on screen: an accepted withdrawal re-reads the balance and is shown
 * when the player comes back. Only showing it, and a refusal, wait for the
 * flow.
 */
export function useWithdrawalAttempt(owner: string | null) {
  const queryClient = useQueryClient();
  const mine = useWithdrawalIntents(owner);
  const [refusal, setRefusal] = useState<WithdrawalRefusalState | null>(null);

  const { mutate } = useMutation({
    mutationFn: async ({
      attempt,
      again,
    }: {
      attempt: WithdrawalAttempt;
      again: boolean;
    }) => {
      // One deadline for the whole attempt, whatever it asks.
      const deadline = withdrawalDeadline();
      if (again) {
        const { player } = await getMe(deadline);
        if (player?.id !== attempt.owner) throw new NotTheirSession();
      }
      return createWithdrawal(attempt.request, attempt.key, deadline);
    },
    onSuccess: (withdrawal, { attempt }) => {
      useWithdrawalStore.getState().started(attempt.key, withdrawal.id);
      // The API's own answer, for its status screen to start from — while
      // it is still this player's to see.
      if (signedIn(queryClient) === attempt.owner) {
        queryClient.setQueryData(
          paymentKeys.withdrawal(withdrawal.id, useUiStore.getState().lang),
          withdrawal,
        );
      }
      // Accepted: the amount left the cash balance for pending withdrawals.
      moneyMoved(queryClient);
      // A new number is saved by the API as a payout account.
      if (attempt.request.to.kind === "new") readAccountsAgain(queryClient);
    },
    onError: (error, { attempt, again }) => {
      const store = useWithdrawalStore.getState();
      if (error instanceof NotTheirSession) {
        // Nothing went. The wallet follows /api/me, read again.
        store.dropped(attempt.key);
        readSessionAgain(queryClient);
        return;
      }
      const outcome = withdrawalOutcome(error);
      switch (outcome.kind) {
        case "unanswered":
          store.unanswered(attempt.key);
          return;
        case "session":
          store.dropped(attempt.key);
          readSessionAgain(queryClient);
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
          // The amount step's ceiling is the balance the API sends next.
          if (code === "WALLET_INSUFFICIENT_FUNDS") {
            void queryClient.invalidateQueries({ queryKey: walletKeys.all });
          }
          // Whether the player may withdraw at all is `/api/me`'s to say.
          if (code === "KYC_REQUIRED") readSessionAgain(queryClient);
          if (code.startsWith("RG_")) {
            // A break is server state: read it again.
            readSessionAgain(queryClient);
            void queryClient.invalidateQueries({ queryKey: rgKeys.all });
          }
        }
      }
    },
  });

  /**
   * Confirm withdrawal: a new intent with a new key — or, while this very
   * request is unanswered, Try again with its key.
   */
  const confirm = useCallback(
    (
      request: WithdrawalRequest,
      accountLabel: string,
      onStarted: (withdrawal: Withdrawal) => void,
    ) => {
      if (!owner) return;
      const { unanswered } = ownWithdrawalIntents(
        useWithdrawalStore.getState().intents,
        owner,
      );
      const again =
        unanswered !== null && sameWithdrawal(unanswered.request, request);
      const attempt: WithdrawalAttempt = again
        ? unanswered
        : { request, key: newIdempotencyKey(), owner, accountLabel };
      // One on its way at a time: read from the store, not the render, so
      // two presses in the same moment can't both go.
      if (!useWithdrawalStore.getState().sent(attempt)) return;
      setRefusal(null);
      mutate(
        { attempt, again },
        {
          onSuccess: onStarted,
          onError: (error) => {
            const outcome =
              error instanceof NotTheirSession
                ? null
                : withdrawalOutcome(error);
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

/** Where a cancel the player asked for stands, while its screen is open. */
export type CancelState =
  | { kind: "idle" }
  | { kind: "sending" }
  /** No answer: it may have gone through. The status is read again. */
  | { kind: "unanswered" }
  /** The API says it can no longer be cancelled. The status is read again. */
  | { kind: "tooLate" }
  | { kind: "refused"; error: ApiError };

/**
 * Cancels the signed-in player's withdrawal while it is `requested` or in
 * `review`. No key: the contract takes none, and a withdrawal can only be
 * cancelled once — a repeat is the API's 409 — so Try again after no answer
 * can do no harm. The answer is the cancelled withdrawal: shown as it is,
 * with the balance and the history read again (its money is back in cash).
 * Anything else reads the withdrawal again, so the screen says where it
 * really stands. One cancel at a time.
 */
export function useCancelWithdrawal(owner: string | null) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<CancelState>({ kind: "idle" });
  const busy = useRef(false);

  const { mutate } = useMutation({
    mutationFn: (id: string) => cancelWithdrawal(id, withdrawalDeadline()),
    onSuccess: (withdrawal, id) => {
      if (signedIn(queryClient) === owner) {
        queryClient.setQueryData(
          paymentKeys.withdrawal(id, useUiStore.getState().lang),
          withdrawal,
        );
      }
      moneyMoved(queryClient);
    },
    onError: (error, id) => {
      if (cancelOutcome(error).kind === "session") {
        readSessionAgain(queryClient);
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: paymentKeys.withdrawals(id),
      });
    },
    onSettled: () => {
      busy.current = false;
    },
  });

  const cancel = useCallback(
    (id: string) => {
      if (busy.current) return;
      busy.current = true;
      setState({ kind: "sending" });
      mutate(id, {
        onSuccess: () => setState({ kind: "idle" }),
        onError: (error) => {
          const outcome = cancelOutcome(error);
          setState(
            outcome.kind === "unanswered" || outcome.kind === "tooLate"
              ? { kind: outcome.kind }
              : outcome.kind === "refused"
                ? { kind: "refused", error: outcome.error }
                : { kind: "idle" },
          );
        },
      });
    },
    [mutate],
  );

  return { state, cancel };
}
