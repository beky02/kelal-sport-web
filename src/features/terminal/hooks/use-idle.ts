"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { eventKeys, searchKeys } from "@/lib/query/keys";
import { useKioskStore } from "../stores/kiosk.store";

/** What counts as someone at the kiosk: a touch or a click, a key, a wheel. */
const ACTIVITY = ["pointerdown", "keydown", "wheel"] as const;

/**
 * The kiosk's idle timer (F8cc, C19 §4.2: 90 s without a touch resets the
 * screen). After `idleMs` without activity anywhere on the page — captured on
 * the document, so nothing on it can swallow a touch — `onIdle` runs once and
 * the kiosk is idle: prices are no longer polled (C18 §5; `KIOSK_CHROME`).
 * The first touch after that wakes it: the prices on screen are read again at
 * once, and polled again. `paused` (a code on screen, which has its own
 * time) stops the timer; it starts afresh when unpaused.
 *
 * One timer, re-armed only when it fires early: a touch just notes the time.
 */
export function useIdle({
  idleMs,
  paused,
  onIdle,
}: {
  idleMs: number;
  paused: boolean;
  onIdle: () => void;
}) {
  const queryClient = useQueryClient();
  const idleRef = useRef(onIdle);
  useEffect(() => {
    idleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (paused) return;
    let last = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(check, ms);
    };
    function check() {
      if (useKioskStore.getState().idle) return;
      const left = last + idleMs - Date.now();
      if (left > 0) arm(left);
      else idleRef.current();
    }
    const touch = () => {
      last = Date.now();
      const kiosk = useKioskStore.getState();
      if (!kiosk.idle) return;
      kiosk.setIdle(false);
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
      void queryClient.invalidateQueries({ queryKey: searchKeys.all });
      arm(idleMs);
    };

    arm(idleMs);
    for (const type of ACTIVITY) {
      document.addEventListener(type, touch, { capture: true, passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const type of ACTIVITY) {
        document.removeEventListener(type, touch, { capture: true });
      }
    };
  }, [idleMs, paused, queryClient]);
}
