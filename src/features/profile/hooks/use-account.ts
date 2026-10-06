"use client";

import { useCallback } from "react";
import {
  useIsMutating,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
import type { SessionView } from "@/features/auth/types";
import { ApiError } from "@/lib/api/errors";
import { accountKeys, sessionKeys } from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import type { Lang } from "@/types/common";
import {
  getDeviceSessions,
  revokeDeviceSession,
  updateAccount,
} from "../api/account";
import type { AccountChange } from "../types";

/**
 * Saves a preference on the account (`PATCH /api/me`, AC-8). Nothing is
 * patched here: the API's answer — the account as it now is — becomes
 * `/api/me`'s entry, so every screen shows what was saved, not what was
 * asked. Saves run one after another (`scope`), so the last one sent is the
 * one the account keeps. An answer for a player no longer signed in (a logout
 * while it was out) is not put back: `/api/me` is read instead. A 401 means
 * the session is gone: `/api/me` is read again and the session-ended path
 * follows.
 */
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: accountKeys.update(),
    scope: { id: "account" },
    mutationFn: updateAccount,
    onSuccess: (view) => {
      const signedIn = queryClient.getQueryData<SessionView>(sessionKeys.me())
        ?.player?.id;
      if (signedIn !== undefined && signedIn === view.player?.id) {
        queryClient.setQueryData<SessionView>(sessionKeys.me(), view);
      } else {
        void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
      }
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
      }
    },
  });
}

/** Whether a preference is being saved on the account, from any screen. */
export const useAccountSaving = (): boolean =>
  useIsMutating({ mutationKey: accountKeys.update() }) > 0;

/**
 * Switches the language. The page changes at once — it is how this device
 * reads — and for a signed-in player the choice is saved on the account, so
 * their other devices and their next sign-in follow it (plan decision 5). It
 * is compared with the last language sent, not the account's until it
 * answers: a quick switch back is saved too (review Q2). A guest's choice
 * stays here.
 */
export function useChangeLanguage(): (lang: Lang) => void {
  const setLang = useUiStore((s) => s.setLang);
  const { player } = useSession();
  const { mutate } = useUpdateAccount();
  const sending = useMutationState({
    filters: { mutationKey: accountKeys.update(), status: "pending" },
    select: (mutation) =>
      (mutation.state.variables as AccountChange | undefined)?.language,
  }).filter((lang) => lang !== undefined);
  const latest = sending.at(-1) ?? player?.language;
  return useCallback(
    (lang: Lang) => {
      setLang(lang);
      if (player && latest !== lang) mutate({ language: lang });
    },
    [setLang, player, latest, mutate],
  );
}

/**
 * The devices signed in to the account (REG-10), read when Profile shows them
 * and again when the tab comes back: one may have signed in meanwhile.
 */
export function useDeviceSessions(enabled: boolean) {
  return useQuery({
    queryKey: accountKeys.sessions(),
    queryFn: ({ signal }) => getDeviceSessions(signal),
    enabled,
    refetchOnWindowFocus: true,
  });
}

/**
 * Signs one device out. Nothing leaves the list until the API has answered:
 * then the list is read again, and the sign-out counts as done only once that
 * read is back, so the row never shows a state the list then contradicts. A
 * 404 means it is gone already — signed out elsewhere, or expired — so the
 * list is read again the same way and the row leaves with it, no error shown.
 */
export function useRevokeDeviceSession() {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: accountKeys.sessions() });
  return useMutation({
    mutationFn: revokeDeviceSession,
    onSuccess: refresh,
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      if (error.status === 404) return refresh();
      if (error.status === 401) {
        return queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
      }
    },
  });
}
