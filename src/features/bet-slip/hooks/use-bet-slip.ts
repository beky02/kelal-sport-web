"use client";

import { useMemo } from "react";
import { usePublicConfig } from "@/features/config/hooks/use-public-config";
import type { BettingRules } from "@/features/config/types";
import { useSession } from "@/features/auth/hooks/use-session";
import { useBreak } from "@/features/responsible-gaming/hooks/use-responsible-gaming";
import { useWallet } from "@/features/wallet/hooks/use-wallet";
import {
  calculateBetSlip,
  resolveCta,
  type BetSlipTotals,
  type CtaAction,
} from "../lib/calculate";
import { useBetSlipStore } from "../stores/bet-slip.store";
import { useStartingStake } from "./use-starting-stake";
import type { OddsPolicy } from "../types";

export interface BetSlipView {
  totals: BetSlipTotals;
  cta: { action: CtaAction; disabled: boolean };
  isGuest: boolean;
  /** The balance as a decimal string; null for a guest or while it loads. */
  balance: string | null;
  /** The tenant's rule set; null while loading or after a failure. */
  rules: BettingRules | null;
  /**
   * What happens when odds change: the player's choice, else the tenant's
   * `default_odds_policy`; `none` until the rules arrive, which asks about
   * everything.
   */
  oddsPolicy: OddsPolicy;
  rulesState: "loading" | "ready" | "error";
  retryRules: () => void;
  /**
   * The tenant offers booking codes (`features.booking_codes`). On until the
   * config says otherwise: only an explicit `false` turns them off.
   */
  bookingCodes: boolean;
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
  const chosenPolicy = useBetSlipStore((s) => s.oddsPolicy);

  const config = usePublicConfig();
  const rules = config.data?.betting ?? null;
  const oddsPolicy = chosenPolicy ?? rules?.defaultOddsPolicy ?? "none";

  const session = useSession();
  // Until /api/me answers, nobody is called a guest and nothing is placeable.
  const isGuest = !session.isLoading && session.isGuest;
  // A break the player took, as /api/me reports it: nothing new is placed.
  const paused = useBreak() !== null;
  const wallet = useWallet(!session.isLoading && !session.isGuest);
  // Cash, as the API sends it: bets are paid from cash, and bonus money never
  // counts here (`use_bonus` is false, F5a).
  const balance = isGuest ? null : (wallet.data?.cash ?? null);

  useStartingStake(rules?.calc.min_stake ?? null);

  const totals = useMemo(
    () =>
      calculateBetSlip({
        selections,
        mode,
        stake,
        systemK,
        rules: rules?.calc ?? null,
        balance,
        oddsPolicy,
      }),
    [selections, mode, stake, systemK, rules, balance, oddsPolicy],
  );

  return {
    totals,
    cta: session.isLoading
      ? { action: "place", disabled: true }
      : resolveCta(totals, isGuest, paused),
    isGuest,
    balance,
    rules,
    oddsPolicy,
    rulesState: rules ? "ready" : config.isError ? "error" : "loading",
    retryRules: () => void config.refetch(),
    bookingCodes: config.data?.features.bookingCodes ?? true,
  };
}
