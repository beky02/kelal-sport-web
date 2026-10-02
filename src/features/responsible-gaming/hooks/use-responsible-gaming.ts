"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rgKeys } from "@/lib/query/keys";
import { getResponsibleGamingStatus, startBreak } from "../api/status";

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
