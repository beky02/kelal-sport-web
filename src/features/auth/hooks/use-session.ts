"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  betKeys,
  sessionKeys,
  transactionKeys,
  walletKeys,
} from "@/lib/query/keys";
import { useSystemStore } from "@/stores/system.store";
import { getMe, login, logout } from "../api/auth";
import type { Player, SessionView } from "../types";

export interface SessionState {
  /** `/api/me` has not answered yet: show neither a guest nor a player. */
  isLoading: boolean;
  isGuest: boolean;
  player: Player | null;
  kycVerified: boolean;
  /** The API's verdict when it gave one, else whether the ID is verified. */
  canWithdraw: boolean;
}

/**
 * Who is signed in, from `/api/me`.
 *
 * Safety state is server state: whether someone may bet, withdraw or see their
 * bets is read from the API on every page load and again when the tab comes
 * back, never from a flag the browser keeps. Until the answer arrives the
 * caller treats the visitor as a guest for gating and shows neither state.
 */
export function useSession(): SessionState {
  const query = useQuery({
    queryKey: sessionKeys.me(),
    queryFn: ({ signal }) => getMe(signal),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const player = query.data?.player ?? null;
  return {
    isLoading: query.isPending,
    isGuest: player === null,
    player,
    kycVerified: player?.kycStatus === "verified",
    canWithdraw: player?.canWithdraw ?? player?.kycStatus === "verified",
  };
}

/** Set by a logout, read by `SessionWatcher`: this guest state was asked for. */
let signedOut = false;

/** Logs in. On success `/api/me` is read again, so every screen flips together. */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: async (result) => {
      if (result.status !== "ok") return;
      // Read who is signed in now, whether or not a screen is watching: the
      // cache entry may not have a query function yet.
      await queryClient.fetchQuery({
        queryKey: sessionKeys.me(),
        queryFn: ({ signal }) => getMe(signal),
        staleTime: 0,
      });
    },
  });
}

/**
 * Logs out. Whatever the API answered, the cookie is gone, so the session and
 * everything only a player may see are dropped from the cache at once.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onMutate: () => {
      signedOut = true;
    },
    onSettled: () => {
      queryClient.setQueryData<SessionView>(sessionKeys.me(), { player: null });
      for (const key of [walletKeys.all, betKeys.all, transactionKeys.all]) {
        queryClient.removeQueries({ queryKey: key });
      }
    },
  });
}

/**
 * Notices a player becoming a guest without having logged out — the API no
 * longer honours the session — and says so, once, over whatever page they are
 * on. The bet slip underneath is untouched.
 */
export function SessionWatcher() {
  const { player, isLoading } = useSession();
  const show = useSystemStore((s) => s.show);
  const wasPlayer = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (player) {
      wasPlayer.current = true;
      signedOut = false;
      return;
    }
    if (!wasPlayer.current) return;
    wasPlayer.current = false;
    if (signedOut) signedOut = false;
    else show("session");
  }, [player, isLoading, show]);

  return null;
}
