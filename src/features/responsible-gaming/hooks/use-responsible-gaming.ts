"use client";

import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { forgetPlayer, useSession } from "@/features/auth/hooks/use-session";
import type { SessionView } from "@/features/auth/types";
import { STALE_TIME } from "@/config/constants";
import { ApiError } from "@/lib/api/errors";
import { rgKeys, sessionKeys } from "@/lib/query/keys";
import { useSystemStore } from "@/stores/system.store";
import { changeLimit, getLimits } from "../api/limits";
import { selfExclude } from "../api/self-exclusion";
import { breakOf } from "../lib/break";
import { exclusionOutcome } from "../lib/limits";
import type { Break, SelfExclusionRequest } from "../types";

/**
 * A break or self-exclusion in force, from `/api/me` — read on every load and
 * when the tab comes back, never from anything the browser keeps, so a
 * reload, another tab or another device can't end it. Null when there is
 * none, and while `/api/me` hasn't answered.
 */
export function useBreak(): Break | null {
  const { player } = useSession();
  return useMemo(() => breakOf(player), [player]);
}

/**
 * The player's limits, from the account: a limit set on another device is
 * the one shown (AC-1). Read again when the tab comes back, and after
 * anything that moves a limit's `used` — a bet, a deposit, an RG refusal.
 */
export function useLimits(enabled: boolean) {
  return useQuery({
    queryKey: rgKeys.limits(),
    queryFn: ({ signal }) => getLimits(signal),
    staleTime: STALE_TIME.limits,
    refetchOnWindowFocus: true,
    enabled,
  });
}

/**
 * Sets or changes one limit. Nothing is patched here: the answer says what
 * the API did — applied at once, or held back until its effective time
 * (AC-5) — and the limits are read again.
 */
export function useChangeLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: changeLimit,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rgKeys.limits() });
    },
    onError: (error) => {
      // The session is gone: /api/me says so, and every screen follows.
      if (error instanceof ApiError && error.status === 401) {
        void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
      }
    },
  });
}

/**
 * Takes a break or self-excludes — one request per Confirm, however quickly
 * it is pressed. The API revokes every session as it answers and the route
 * handler clears this one's cookie, so a 201 leaves the player signed out:
 * noted as a logout (the guest that follows is expected — no "session ended"),
 * and everything only a player may see is dropped, as on a logout. Without an
 * answer the break may have started, and with it the session gone: `/api/me`
 * is read again to say which.
 */
export function useSelfExclude() {
  const queryClient = useQueryClient();
  const noteLogout = useSystemStore((s) => s.noteLogout);
  const sending = useRef(false);
  const mutation = useMutation({
    mutationFn: selfExclude,
    onSuccess: () => {
      noteLogout();
      queryClient.setQueryData<SessionView>(sessionKeys.me(), { player: null });
      forgetPlayer(queryClient);
    },
    onError: (error) => {
      if (exclusionOutcome(error) !== "refused") {
        void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
      }
    },
    onSettled: () => {
      sending.current = false;
    },
  });
  const { mutate } = mutation;
  const start = useCallback(
    (request: SelfExclusionRequest) => {
      if (sending.current) return;
      sending.current = true;
      mutate(request);
    },
    [mutate],
  );
  return {
    start,
    isPending: mutation.isPending,
    /** The exclusion the API started: when it ends. */
    started: mutation.data ?? null,
    error: mutation.error,
    /** What was last asked for — what Try again sends. */
    request: mutation.variables ?? null,
  };
}
