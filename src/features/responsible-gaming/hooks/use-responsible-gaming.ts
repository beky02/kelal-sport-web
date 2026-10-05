"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
import { rgKeys } from "@/lib/query/keys";
import { getResponsibleGamingStatus, startBreak } from "../api/status";
import { breakOf } from "../lib/break";
import type { Break } from "../types";

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

const KEY = rgKeys.all;

/**
 * Whether a break or self-exclusion is running.
 *
 * Read from the server, not a client store: this is the one piece of state a user
 * must not be able to clear by reloading. Every odds button subscribes to it, so
 * it is cached hard and shared.
 */
export function useResponsibleGamingStatus() {
  return useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => getResponsibleGamingStatus(signal),
    staleTime: 60_000,
  });
}

/** True while betting is paused by the user's own choice. */
export function useCoolOffUntil(): string | null {
  const { data } = useResponsibleGamingStatus();
  return data?.selfExcludedUntil ?? data?.coolOffUntil ?? null;
}

export function useStartBreak() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      kind,
      until,
    }: {
      kind: "cool-off" | "self-exclusion";
      until: string;
    }) => startBreak(kind, until),
    onSuccess: (status) => {
      // Write the answer straight in — the board must lock on this render, not
      // after a refetch lands.
      queryClient.setQueryData(KEY, status);
    },
  });
}
