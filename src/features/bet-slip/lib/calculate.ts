import { BETTING } from "@/config/constants";
import { binomial, combinationProducts } from "./combinations";
import type { BetSelection, BetSlipMode } from "../types";

export interface TaxRates {
  /** Withheld from the stake, before odds are applied. */
  stakeTax: number;
  /** Withheld from winnings (gross return − stake). */
  winTax: number;
  /** Payout ceiling, applied per bet before winnings tax. */
  maxWinPerTicket: number;
}

export interface BetSlipInput {
  selections: readonly BetSelection[];
  mode: BetSlipMode;
  /** Per bet: per selection in single, per combination in system. */
  stake: number;
  systemK: number;
  rates: TaxRates;
  /** Null for a guest — balance checks are skipped. */
  balance: number | null;
  /** Uids whose odds change the user has explicitly accepted. */
  acceptedUids: ReadonlySet<string>;
  acceptAllOddsChanges: boolean;
}

export interface BetSlipTotals {
  count: number;
  /** Selections that can actually be priced — suspended ones are excluded. */
  liveCount: number;

  /** Mode after falling back: `system` needs 3+ live selections. */
  mode: BetSlipMode;
  systemAvailable: boolean;
  /** Clamped into [2, liveCount − 1]. */
  systemK: number;
  combinationCount: number;

  totalOdds: number;
  /** Stake charged per bet — what the user typed. */
  stakePerBet: number;
  /** Stake charged across the whole slip. */
  totalStake: number;
  stakeTax: number;
  netStake: number;
  grossReturn: number;
  winTax: number;
  payout: number;
  /** At least one bet hit the per-ticket ceiling. */
  capped: boolean;

  insufficientBalance: boolean;
  /** Event ids appearing on more than one selection (multiple/system only). */
  conflictEventIds: string[];
  hasConflict: boolean;
  suspendedSelection: BetSelection | null;
  /** Moved selections the user has not yet accepted. */
  pendingOddsChanges: BetSelection[];

  /** Per-selection return, for the row hint in single mode. */
  returnByUid: Record<string, number>;
}

const product = (values: readonly number[]): number =>
  values.reduce((a, b) => a * b, 1);

export interface BetFigures {
  stakeTax: number;
  netStake: number;
  /** Return before winnings tax, already capped. */
  grossReturn: number;
  winTax: number;
  payout: number;
  capped: boolean;
}

/**
 * One bet's figures, from a stake and a price.
 *
 * Ethiopian withholding for a bet with one price: stake tax off the top, the cap
 * applied to the return, then winnings tax on what the bet actually gained.
 *
 * Used by settled tickets. `calculateBetSlip` keeps its own pass because singles
 * and systems are several bets under one winnings-tax calculation, which is not a
 * sum of individual settlements — but for a multiple the two agree exactly, and a
 * test pins that down so a placed ticket can never contradict the slip that
 * produced it.
 *
 *   net stake  = stake − stake × stakeTax
 *   gross      = min(net stake × odds, cap)
 *   winnings   = max(0, gross − stake)
 *   payout     = gross − winnings × winTax
 */
export function settleBet(
  stake: number,
  odds: number,
  rates: TaxRates,
): BetFigures {
  const stakeTax = stake * rates.stakeTax;
  const netStake = stake - stakeTax;
  const uncapped = netStake * odds;
  const grossReturn = Math.min(uncapped, rates.maxWinPerTicket);
  const winTax = Math.max(0, grossReturn - stake) * rates.winTax;

  return {
    stakeTax,
    netStake,
    grossReturn,
    winTax,
    payout: grossReturn - winTax,
    capped: uncapped > rates.maxWinPerTicket,
  };
}

/**
 * Turn the slip into every number the UI shows.
 *
 * Pure, synchronous, and deliberately the only place these formulas live.
 *
 * IMPORTANT: this is a *display estimate*. The backend recomputes stake tax,
 * winnings tax, the max-win cap and the final payout when the bet is placed,
 * and its answer wins. Never treat the output of this function as settlement.
 *
 * The order of operations matches the design spec and Ethiopian withholding:
 *
 *   net stake  = stake − stake × stakeTax
 *   gross      = min(net stake × odds, cap)     per bet, then summed
 *   winnings   = max(0, gross − total stake)
 *   payout     = gross − winnings × winTax
 */
export function calculateBetSlip(input: BetSlipInput): BetSlipTotals {
  const {
    selections,
    stake,
    rates,
    balance,
    acceptedUids,
    acceptAllOddsChanges,
  } = input;

  const count = selections.length;
  const live = selections.filter((s) => !s.suspended);
  const liveCount = live.length;

  const systemAvailable = liveCount >= BETTING.minSystemSelections;
  const mode: BetSlipMode =
    input.mode === "system" && !systemAvailable ? "multiple" : input.mode;

  const isSingle = mode === "single";
  const isSystem = mode === "system";

  // Two selections leave no room for a system: 2/2 is just a multiple.
  const systemK = Math.min(
    Math.max(input.systemK, 2),
    Math.max(2, liveCount - 1),
  );

  const odds = live.map((s) => s.currentOdds);
  const totalOdds = product(odds);
  const systemProducts = isSystem ? combinationProducts(odds, systemK) : [];
  const combinationCount = isSystem
    ? systemProducts.length
    : isSingle
      ? liveCount
      : liveCount > 0
        ? 1
        : 0;

  const betCount = isSingle ? liveCount : isSystem ? systemProducts.length : 1;
  const totalStake =
    count === 0 ? 0 : stake * (isSingle || isSystem ? betCount : 1);

  const stakeTax = totalStake * rates.stakeTax;
  const netStake = totalStake - stakeTax;

  // Net stake *per bet* — what actually multiplies into the odds.
  const perBetNet = stake * (1 - rates.stakeTax);
  const cap = rates.maxWinPerTicket;
  const capBet = (o: number) => Math.min(perBetNet * o, cap);

  let grossReturn: number;
  let capped: boolean;

  if (isSingle) {
    grossReturn = odds.reduce((sum, o) => sum + capBet(o), 0);
    capped = odds.some((o) => perBetNet * o > cap);
  } else if (isSystem) {
    grossReturn = systemProducts.reduce((sum, o) => sum + capBet(o), 0);
    capped = systemProducts.some((o) => perBetNet * o > cap);
  } else {
    grossReturn = liveCount > 0 ? Math.min(netStake * totalOdds, cap) : 0;
    capped = liveCount > 0 && netStake * totalOdds > cap;
  }

  const winTax = Math.max(0, grossReturn - totalStake) * rates.winTax;
  const payout = grossReturn - winTax;

  const seen = new Map<string, number>();
  for (const s of selections) {
    seen.set(s.eventId, (seen.get(s.eventId) ?? 0) + 1);
  }
  // A single is placed as its own bet, so two picks on one match never clash.
  const conflictEventIds = isSingle
    ? []
    : [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);

  const pendingOddsChanges = acceptAllOddsChanges
    ? []
    : selections.filter(
        (s) => s.currentOdds !== s.initialOdds && !acceptedUids.has(s.uid),
      );

  const returnByUid: Record<string, number> = {};
  for (const s of live) returnByUid[s.uid] = capBet(s.currentOdds);

  return {
    count,
    liveCount,
    mode,
    systemAvailable,
    systemK,
    combinationCount,
    totalOdds,
    stakePerBet: stake,
    totalStake,
    stakeTax,
    netStake,
    grossReturn,
    winTax,
    payout,
    capped,
    insufficientBalance: balance !== null && count > 0 && totalStake > balance,
    conflictEventIds,
    hasConflict: conflictEventIds.length > 0,
    suspendedSelection: selections.find((s) => s.suspended) ?? null,
    pendingOddsChanges,
    returnByUid,
  };
}

/** Options offered by the system-bet size picker, e.g. 2/4 · 6 bets. */
export function systemOptions(
  liveCount: number,
): Array<{ k: number; label: string; betCount: number }> {
  return Array.from(
    { length: Math.max(0, liveCount - 2) },
    (_, i) => i + 2,
  ).map((k) => ({
    k,
    label: `${k}/${liveCount}`,
    betCount: binomial(liveCount, k),
  }));
}

export type CtaAction =
  | "place"
  | "accept-changes"
  | "remove-suspended"
  | "deposit"
  | "blocked-conflict"
  | "login";

/**
 * What the primary button does right now.
 *
 * Order matters: a conflict is unfixable by the button (the user has to choose
 * which pick to drop), so it blocks. Everything below it is actionable.
 */
export function resolveCta(
  totals: BetSlipTotals,
  isGuest: boolean,
): { action: CtaAction; disabled: boolean } {
  if (isGuest) return { action: "login", disabled: false };
  if (totals.hasConflict) return { action: "blocked-conflict", disabled: true };
  if (totals.suspendedSelection)
    return { action: "remove-suspended", disabled: false };
  if (totals.pendingOddsChanges.length > 0)
    return { action: "accept-changes", disabled: false };
  if (totals.insufficientBalance) return { action: "deposit", disabled: false };
  return { action: "place", disabled: totals.count === 0 };
}
