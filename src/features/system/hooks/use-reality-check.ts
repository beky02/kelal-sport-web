"use client";

import { useEffect } from "react";
import { useSession } from "@/features/auth/hooks/use-session";
import { useRealityCheckStore } from "@/stores/reality-check.store";
import { useSystemStore } from "@/stores/system.store";
import { nextCheckAt, playedMinutes } from "../lib/reality-check";

/** The longest a browser timer can wait (about 24.8 days): longer than a tab stays open. */
const MAX_DELAY = 2 ** 31 - 1;

/**
 * Opens the reality check every `flags.reality_check_minutes` of play (RG-04,
 * AC-10), over whatever page the player is on.
 *
 * The interval is the account's, from `/api/me`; without one there is no
 * check — the browser invents none. The visit starts when this tab first
 * shows the player and ends when nobody is signed in. One timer, set for the
 * next check; while another dialog is up it waits, and opens as that one
 * closes if it came due meanwhile.
 */
export function RealityCheckWatcher() {
  const { player, isLoading, isError } = useSession();
  const playerId = player?.id ?? null;
  const minutes = player?.flags.realityCheckMinutes ?? null;

  const begin = useRealityCheckStore((s) => s.begin);
  const end = useRealityCheckStore((s) => s.end);
  const shown = useRealityCheckStore((s) => s.shown);
  const visitOf = useRealityCheckStore((s) => s.playerId);
  const startedAt = useRealityCheckStore((s) => s.startedAt);
  const answeredAt = useRealityCheckStore((s) => s.answeredAt);
  const overlay = useSystemStore((s) => s.overlay);
  const show = useSystemStore((s) => s.show);

  // Only an answer ends the visit: a read of `/api/me` that failed (a weak
  // connection after a reload) says nothing about who is signed in.
  useEffect(() => {
    if (isLoading) return;
    if (playerId) begin(playerId, Date.now());
    else if (!isError) end();
  }, [isLoading, isError, playerId, begin, end]);

  useEffect(() => {
    if (!playerId || visitOf !== playerId || startedAt === null) return;
    if (!minutes || minutes <= 0 || overlay !== null) return;
    const wait = nextCheckAt(startedAt, minutes, answeredAt) - Date.now();
    if (wait > MAX_DELAY) return;
    const timer = setTimeout(
      () => {
        shown(Date.now());
        show("reality");
      },
      Math.max(0, wait),
    );
    return () => clearTimeout(timer);
  }, [playerId, visitOf, startedAt, answeredAt, minutes, overlay, shown, show]);

  return null;
}

/**
 * The open check: how long the player had been playing when it opened, and
 * the answer every one of its actions gives — the next check is an interval
 * after it.
 */
export function useRealityCheck() {
  const startedAt = useRealityCheckStore((s) => s.startedAt);
  const shownAt = useRealityCheckStore((s) => s.shownAt);
  const answer = useRealityCheckStore((s) => s.answer);
  const dismiss = useSystemStore((s) => s.dismiss);
  return {
    playedMinutes:
      startedAt !== null && shownAt !== null
        ? playedMinutes(startedAt, shownAt)
        : 0,
    answer: () => {
      answer(Date.now());
      dismiss();
    },
  };
}
