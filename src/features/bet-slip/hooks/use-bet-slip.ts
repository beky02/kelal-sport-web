"use client";

import { useMemo } from "react";
import { BETTING } from "@/config/constants";
import { useWallet } from "@/features/wallet/hooks/use-wallet";
import { useSessionStore } from "@/stores/session.store";
import {
  calculateBetSlip,
  resolveCta,
  type BetSlipTotals,
  type CtaAction,
} from "../lib/calculate";
import { useBetSlipStore } from "../stores/bet-slip.store";

export interface BetSlipView {
  totals: BetSlipTotals;
  cta: { action: CtaAction; disabled: boolean };
  isGuest: boolean;
  balance: number | null;
}

/**
 * Everything the slip needs to render, in one place.
 *
 * The store holds selections and the stake; this derives the money. Nothing
 * downstream recomputes a total — if a number is on screen it came from here.
 */
export function useBetSlip(): BetSlipView {
  const selections = useBetSlipStore((s) => s.selections);
  const mode = useBetSlipStore((s) => s.mode);
  const stake = useBetSlipStore((s) => s.stake);
  const systemK = useBetSlipStore((s) => s.systemK);
  const acceptedUids = useBetSlipStore((s) => s.acceptedUids);
  const acceptAnyChange = useBetSlipStore((s) => s.acceptAnyChange);

  const isGuest = useSessionStore((s) => s.isGuest);
  const wallet = useWallet(!isGuest);
  const balance = isGuest ? null : (wallet.data?.balance ?? null);

  const totals = useMemo(
    () =>
      calculateBetSlip({
        selections,
        mode,
        stake,
        systemK,
        rates: {
          stakeTax: BETTING.stakeTaxRate,
          winTax: BETTING.winTaxRate,
          maxWinPerTicket: BETTING.maxWinPerTicket,
        },
        balance,
        acceptedUids,
        acceptAllOddsChanges: acceptAnyChange,
      }),
    [selections, mode, stake, systemK, balance, acceptedUids, acceptAnyChange],
  );

  return {
    totals,
    cta: resolveCta(totals, isGuest),
    isGuest,
    balance,
  };
}
