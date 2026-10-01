"use client";

import { useMemo } from "react";
import { usePublicConfig } from "@/features/config/hooks/use-public-config";
import type { BettingRules } from "@/features/config/types";
import { useWallet } from "@/features/wallet/hooks/use-wallet";
import { fromLegacyAmount } from "@/lib/money";
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
  /** The balance as a decimal string; null for a guest or while it loads. */
  balance: string | null;
  /** The tenant's rule set; null while loading or after a failure. */
  rules: BettingRules | null;
  rulesState: "loading" | "ready" | "error";
  retryRules: () => void;
}

/**
 * Everything the slip needs to render, in one place.
 *
 * The store holds selections and the stake, the config holds the tenant's rule
 * set, and slipcalc derives the money. Nothing downstream recomputes a total —
 * if a number is on screen it came from here.
 */
export function useBetSlip(): BetSlipView {
  const selections = useBetSlipStore((s) => s.selections);
  const mode = useBetSlipStore((s) => s.mode);
  const stake = useBetSlipStore((s) => s.stake);
  const systemK = useBetSlipStore((s) => s.systemK);
  const acceptedIds = useBetSlipStore((s) => s.acceptedIds);
  const acceptAnyChange = useBetSlipStore((s) => s.acceptAnyChange);

  const config = usePublicConfig();
  const rules = config.data?.betting ?? null;

  const isGuest = useSessionStore((s) => s.isGuest);
  const wallet = useWallet(!isGuest);
  // Wallet amounts become strings in F6; until then, bridged here.
  const walletBalance = wallet.data?.balance;
  const balance =
    isGuest || walletBalance === undefined
      ? null
      : fromLegacyAmount(walletBalance);

  const totals = useMemo(
    () =>
      calculateBetSlip({
        selections,
        mode,
        stake,
        systemK,
        rules: rules?.calc ?? null,
        balance,
        acceptedIds,
        acceptAllOddsChanges: acceptAnyChange,
      }),
    [
      selections,
      mode,
      stake,
      systemK,
      rules,
      balance,
      acceptedIds,
      acceptAnyChange,
    ],
  );

  return {
    totals,
    cta: resolveCta(totals, isGuest),
    isGuest,
    balance,
    rules,
    rulesState: rules ? "ready" : config.isError ? "error" : "loading",
    retryRules: () => void config.refetch(),
  };
}
