"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useKioskStore } from "../stores/kiosk.store";

/**
 * The kiosk back to its start for the next customer (F8cc decision 8): the
 * one action the idle reset takes, so it doesn't depend on the order of
 * anyone's effects (F8cb review M2/Q3).
 *
 * Every slip empty, Slip 1 on screen and its stake at the shop's minimum
 * (`resetAll`); the kiosk's first language; no slip's code or its key; the
 * board's filters, which live in the address, gone with it (home); and a new
 * round of the page, so a typed search, an open sheet or dialog — a code left
 * open included — and a half-typed booking code go too. `idle` says whether
 * anyone is there.
 */
export function useStartOver() {
  const router = useRouter();
  return useCallback(
    ({ idle }: { idle: boolean }) => {
      useBetSlipStore.getState().resetAll();
      useKioskStore.getState().startOver(idle);
      router.replace(routes.home);
    },
    [router],
  );
}
