"use client";

import { useEffect, useRef } from "react";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  accountKeys,
  betKeys,
  paymentKeys,
  rgKeys,
  sessionKeys,
  transactionKeys,
  walletKeys,
} from "@/lib/query/keys";
import { useSystemStore } from "@/stores/system.store";
import { useUiStore } from "@/stores/ui.store";
import { getMe, login, logout, register } from "../api/auth";
import { FORGET_AT_ONCE } from "./use-account";
import type { Player, SessionView } from "../types";

export interface SessionState {
  /** `/api/me` has not answered yet: show neither a guest nor a player. */
  isLoading: boolean;
  /** `/api/me` could not be read; the visitor is shown as a guest meanwhile. */
  isError: boolean;
  isGuest: boolean;
  player: Player | null;
  kycVerified: boolean;
  /** The API's verdict (`can_withdraw`); nothing is inferred when it said none. */
  canWithdraw: boolean;
}

/**
 * How `/api/me` is read, wherever: every observer of who is signed in reads it
 * the same way (a hook that needs one fact of it adds a `select`).
 */
export const sessionQuery = queryOptions({
  queryKey: sessionKeys.me(),
  queryFn: ({ signal }) => getMe(signal),
  staleTime: 60_000,
  refetchOnWindowFocus: true,
});

/**
 * Who is signed in, from `/api/me`.
 *
 * Safety state is server state: whether someone may bet, withdraw or see their
 * bets is read from the API on every page load and again when the tab comes
 * back, never from a flag the browser keeps. Until the answer arrives the
 * caller treats the visitor as a guest for gating and shows neither state.
 */
export function useSession(): SessionState {
  const query = useQuery(sessionQuery);
  const player = query.data?.player ?? null;
  return {
    isLoading: query.isPending,
    isError: query.isError,
    isGuest: player === null,
    player,
    kycVerified: player?.kycStatus === "verified",
    canWithdraw: player?.canWithdraw ?? false,
  };
}

/**
 * Drops everything only a player may see. Done whenever the session changes
 * hands — logout, a session found gone, a login — so the next player never
 * sees the previous one's balance, payments, bets, break or devices, however
 * fresh the cache.
 */
export function forgetPlayer(queryClient: QueryClient): void {
  for (const key of [
    walletKeys.all,
    paymentKeys.all,
    betKeys.all,
    transactionKeys.all,
    rgKeys.all,
    accountKeys.all,
  ]) {
    queryClient.removeQueries({ queryKey: key });
  }
}

/**
 * Someone has just signed in — by logging in or by registering. Whatever the
 * previous player left in the cache goes, then `/api/me` is read so every
 * screen flips together. Answers with that read, or null when it failed.
 */
async function signedIn(queryClient: QueryClient): Promise<SessionView | null> {
  forgetPlayer(queryClient);
  try {
    // Read who is signed in now, whether or not a screen is watching: the
    // cache entry may not have a query function yet.
    return await queryClient.fetchQuery({
      queryKey: sessionKeys.me(),
      queryFn: ({ signal }) => getMe(signal),
      staleTime: 0,
    });
  } catch {
    // The cookie is set; the sign-in stood. `useSession` reads again on the
    // next mount or focus rather than asking for the password twice.
    return null;
  }
}

/**
 * Logs in. On success `/api/me` is read again, so every screen flips together,
 * and the page takes the language saved on the account: a player signing in
 * on another device reads it as they chose it (F7b, AC-8). If that read
 * failed, the page keeps the language it has.
 */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    ...FORGET_AT_ONCE,
    onSuccess: async (result) => {
      if (result.status !== "ok") return;
      const account = (await signedIn(queryClient))?.player?.language;
      if (account) useUiStore.getState().setLang(account);
    },
  });
}

/** Creates the account, which signs the new player in (the cookie is set). */
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: register,
    ...FORGET_AT_ONCE,
    // The language stays the one just chosen: registration sent it.
    onSuccess: () => signedIn(queryClient),
  });
}

/**
 * Logs out. Only an answer from the route handler ends the session here: the
 * cookie is cleared by that answer, so a request that never arrived has
 * cleared nothing, and the screens must keep saying who is signed in.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const noteLogout = useSystemStore((s) => s.noteLogout);
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      noteLogout();
      queryClient.setQueryData<SessionView>(sessionKeys.me(), { player: null });
      forgetPlayer(queryClient);
    },
  });
}

/**
 * Notices the session changing hands. A player becoming a guest: after a
 * logout it only clears the flag; otherwise the API no longer honours the
 * session, and it says so, once, over whatever page they are on. A player
 * becoming another player with no guest between — another tab logged out and
 * someone else in — says nothing. Every time, the previous player's caches go,
 * so the next one never sees their bets or balance. The bet slip underneath is
 * untouched.
 */
export function SessionWatcher() {
  const { player, isLoading } = useSession();
  const queryClient = useQueryClient();
  const show = useSystemStore((s) => s.show);
  const loggedOut = useSystemStore((s) => s.loggedOut);
  const clearLoggedOut = useSystemStore((s) => s.clearLoggedOut);
  /** Who was signed in when this last looked; null for nobody. */
  const lastPlayer = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (player) {
      if (lastPlayer.current !== null && lastPlayer.current !== player.id) {
        forgetPlayer(queryClient);
      }
      lastPlayer.current = player.id;
      if (loggedOut) clearLoggedOut();
      return;
    }
    if (lastPlayer.current === null) return;
    lastPlayer.current = null;
    forgetPlayer(queryClient);
    if (loggedOut) clearLoggedOut();
    else show("session");
  }, [player, isLoading, loggedOut, clearLoggedOut, show, queryClient]);

  return null;
}
