"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { useKioskStore } from "../stores/kiosk.store";

/**
 * The kiosk back to its start for the next customer (F8cc decision 8): the
 * one action the idle reset and a closed code screen both take, so neither
 * depends on the order of anyone's effects (F8cb review M2/Q3).
 *
 * Every slip empty, Slip 1 on screen and its stake at the shop's minimum
 * (`resetAll`); the kiosk's first language; no Get code intent or code on
 * screen; the board's filters, which live in the address, gone with it (home);
 * and a new round of the page, so a typed search, an open sheet or dialog and
 * a half-typed booking code go too. `idle` says whether anyone is there: no
 * one after the idle time or a code that timed out; the customer on Done.
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

/**
 * The code screen closing (F8cc decision 2, the user's answer at the gate):
 * the slip it came from is emptied; the kiosk starts over unless another slip
 * still holds picks, which then comes up, in the customer's language and on
 * their page, so they can get its code too — the idle reset still clears
 * everything once they walk away.
 */
export function useCloseCode() {
  const startOver = useStartOver();
  return useCallback(
    ({ timedOut }: { timedOut: boolean }) => {
      const kiosk = useKioskStore.getState();
      const shown = kiosk.shownCode;
      if (!shown) return;
      const slips = useBetSlipStore.getState();
      const picks = (n: number) =>
        n === slips.active
          ? slips.selections.length
          : slips.slips[n].selections.length;
      const next = slips.slips.findIndex(
        (_, n) => n !== shown.slip && picks(n) > 0,
      );
      if (next < 0) {
        startOver({ idle: timedOut });
        return;
      }
      slips.switchSlip(shown.slip);
      useBetSlipStore.getState().clear();
      useBetSlipStore.getState().switchSlip(next);
      kiosk.setCodeIntent(null);
      kiosk.closeCode();
    },
    [startOver],
  );
}
