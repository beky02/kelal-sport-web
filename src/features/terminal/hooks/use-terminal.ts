"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { terminalKeys } from "@/lib/query/keys";
import {
  activateTerminal,
  getTerminalStatus,
  rotateTerminalToken,
} from "../api/terminal";
import { STATUS_INTERVAL_MS } from "../lib/calls";

/** The token rotation's mutations, found again by any screen that reads the status. */
const ROTATION = [...terminalKeys.all, "rotate"] as const;

/**
 * What this terminal is, from the server: read on boot and every 5 minutes
 * (AC-5), in the background too — a kiosk is never "away". A blocked terminal
 * stops asking until it is reloaded, which asks again.
 *
 * When fewer than 7 days of the token remain (`rotateDue`), the token is
 * rotated in the background — once per status read, however many screens
 * read it — and the status read again afterwards. The query keeps its data throughout, so the screen never
 * changes for it; a rotation that fails is tried again at the next read.
 */
export function useTerminalStatus() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: terminalKeys.status(),
    // No abort signal: a status read is not worth cancelling, and consuming
    // the signal would cancel and repeat the boot read whenever its screen
    // remounts (React's strict mode does, in development).
    queryFn: () => getTerminalStatus(),
    staleTime: STATUS_INTERVAL_MS,
    refetchInterval: (current) =>
      current.state.data?.state === "blocked" ? false : STATUS_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  const { mutate: rotate } = useMutation({
    mutationKey: ROTATION,
    mutationFn: rotateTerminalToken,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: terminalKeys.status() }),
  });

  const { data, dataUpdatedAt } = query;
  useEffect(() => {
    if (data?.state !== "active" || !data.rotateDue) return;
    // Once per status read, wherever the hook is mounted and however often:
    // the mutation cache, not this component, remembers what was sent.
    const sent = queryClient
      .getMutationCache()
      .findAll({ mutationKey: ROTATION })
      .some(
        (rotation) =>
          rotation.state.status === "pending" ||
          rotation.state.submittedAt >= dataUpdatedAt,
      );
    if (!sent) rotate();
  }, [data, dataUpdatedAt, queryClient, rotate]);

  return query;
}

/**
 * Activates this PC with a normalised code. On success the status is reset
 * and read again with the new key: the "not activated" answer it held is
 * dropped at once, so the activation form never shows again for a terminal
 * that is now activated — if that read fails, the screen says the server
 * can't be reached and offers Try again, never a second activation that
 * would replace the key the terminal is bound to (review Q1).
 */
export function useActivateTerminal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateTerminal,
    onSuccess: () =>
      queryClient.resetQueries({ queryKey: terminalKeys.status() }),
  });
}
