import {
  quote,
  SlipError,
  type BetType,
  type LegResult,
  type Quote,
  type RuleSetJson,
  type Slip,
} from "@golden/slipcalc";
import { BETTING } from "@/config/constants";
import {
  compareMoney,
  maxMoney,
  mulMoney,
  roundUpToMultiple,
  toSantim,
} from "@/lib/money";
import { binomial } from "./combinations";
import {
  awaitsConsent,
  type BetSelection,
  type BetSlipMode,
  type OddsPolicy,
} from "../types";

/** Every figure the slip shows, as slipcalc computed it (decimal strings). */
export type SlipQuote = Quote;

export type PriceResult =
  { ok: true; quote: SlipQuote } | { ok: false; code: string };

/**
 * The one call into slipcalc (D1). Everything the slip and a ticket show is
 * this function's answer; `tests/unit/golden.test.ts` runs every golden row
 * through it.
 *
 * It is a preview: the betting engine prices the bet again when it is placed,
 * and its answer is the one that counts.
 */
export function priceSlip(
  slip: Slip,
  rules: RuleSetJson,
  settled = false,
): PriceResult {
  try {
    return { ok: true, quote: quote(slip, rules, settled) };
  } catch (error) {
    if (error instanceof SlipError) return { ok: false, code: error.code };
    throw error;
  }
}

/** Why the slip cannot be priced, and — where there is one — the fix. */
export type SlipProblem =
  /** `stake` is the smallest total stake that would be accepted. */
  | { code: "BET_STAKE_TOO_LOW"; stake: string }
  /** `stake` is the largest total stake that would be accepted. */
  | { code: "BET_STAKE_TOO_HIGH"; stake: string }
  | { code: "BET_TOO_MANY_LEGS"; limit: number }
  | { code: "BET_TOO_MANY_LINES"; limit: number }
  | { code: "VALIDATION_FAILED" };

export interface BetSlipInput {
  selections: readonly BetSelection[];
  mode: BetSlipMode;
  /** The total stake as typed. slipcalc splits it across lines (D1.3). */
  stake: string;
  systemK: number;
  /** The tenant's rule set; null while it loads — then there is no quote. */
  rules: RuleSetJson | null;
  /** Null for a guest — balance checks are skipped. */
  balance: string | null;
  /** Which moves need the player's yes before the slip can be placed. */
  oddsPolicy: OddsPolicy;
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
  /** What slipcalc is asked to price: one live pick is a single whatever the tab says. */
  betType: BetType;
  /** Lines the slip places: one per pick, one, or C(n, k). */
  lineCount: number;

  /** slipcalc's answer. Null without a rule set, a stake or a live pick. */
  quote: SlipQuote | null;
  problem: SlipProblem | null;

  insufficientBalance: boolean;
  /** Event ids appearing on more than one selection (multiple/system only). */
  conflictEventIds: string[];
  hasConflict: boolean;
  suspendedSelection: BetSelection | null;
  /** Moves the player has to accept first, under the odds policy. */
  pendingOddsChanges: BetSelection[];
}

/**
 * The typed stake as an amount slipcalc can take, or null. `"12."` is a stake
 * being typed; an empty or zero stake asks nothing yet.
 */
export function stakeToPrice(stake: string): string | null {
  const value = stake.replace(/\.$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  return toSantim(value) > 0n ? value : null;
}

/**
 * The smallest total stake that clears `min` once split across `lines`.
 *
 * The minimum applies to the total actually charged — floor(stake / lines) ×
 * lines (D1.3) — and every line needs a santim. So it is the smallest whole
 * number of santim per line that clears both: 5.00 on three lines would charge
 * 4.98, so it is 5.01. Used for the tenant's minimum and for the engine's.
 */
export function smallestStake(min: string, lines: number): string {
  const n = Math.max(1, lines);
  return roundUpToMultiple(maxMoney(min, mulMoney("0.01", n)), n);
}

function problemFor(
  code: string,
  rules: RuleSetJson,
  lines: number,
): SlipProblem {
  switch (code) {
    case "BET_STAKE_TOO_LOW":
      return { code, stake: smallestStake(rules.min_stake, lines) };
    case "BET_STAKE_TOO_HIGH":
      return { code, stake: rules.max_stake };
    case "BET_TOO_MANY_LEGS":
      return { code, limit: rules.max_legs };
    case "BET_TOO_MANY_LINES":
      return { code, limit: rules.max_lines };
    default:
      return { code: "VALIDATION_FAILED" };
  }
}

/**
 * Turns the slip into everything the UI shows.
 *
 * The money is slipcalc's (D1) and nothing else: this only arranges its inputs
 * — which picks are live, which bet type and system size — and adds the UI's
 * own rules (same-match conflicts, suspended picks, unaccepted price moves).
 */
export function calculateBetSlip(input: BetSlipInput): BetSlipTotals {
  const { selections, rules, balance, oddsPolicy } = input;

  const count = selections.length;
  const live = selections.filter((s) => !s.suspended);
  const liveCount = live.length;

  const systemAvailable = liveCount >= BETTING.minSystemSelections;
  const mode: BetSlipMode =
    input.mode === "system" && !systemAvailable ? "multiple" : input.mode;

  // Two selections leave no room for a system: 2/2 is just a multiple.
  const systemK = Math.min(
    Math.max(input.systemK, 2),
    Math.max(2, liveCount - 1),
  );

  // One live pick is a single whatever the tab says: a multiple needs two.
  const betType: BetType = liveCount === 1 ? "single" : mode;
  const lineCount =
    liveCount === 0
      ? 0
      : betType === "single"
        ? liveCount
        : betType === "system"
          ? binomial(liveCount, systemK)
          : 1;

  const stake = stakeToPrice(input.stake);
  let quoteResult: SlipQuote | null = null;
  let problem: SlipProblem | null = null;
  if (rules && stake && liveCount > 0) {
    const priced = priceSlip(
      {
        betType,
        legs: live.map((s) => ({ odds: s.currentOdds })),
        stake,
        systemSizes: betType === "system" ? [systemK] : [],
      },
      rules,
    );
    if (priced.ok) quoteResult = priced.quote;
    else problem = problemFor(priced.code, rules, lineCount);
  }

  const seen = new Map<string, number>();
  for (const s of selections) {
    seen.set(s.eventId, (seen.get(s.eventId) ?? 0) + 1);
  }
  // A single is placed as its own bet, so two picks on one match never clash.
  const conflictEventIds =
    mode === "single"
      ? []
      : [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);

  const pendingOddsChanges = selections.filter((s) =>
    awaitsConsent(s, oddsPolicy),
  );

  return {
    count,
    liveCount,
    mode,
    systemAvailable,
    systemK,
    betType,
    lineCount,
    quote: quoteResult,
    problem,
    insufficientBalance:
      balance !== null &&
      quoteResult !== null &&
      compareMoney(quoteResult.totalStake, balance) > 0,
    conflictEventIds,
    hasConflict: conflictEventIds.length > 0,
    suspendedSelection: selections.find((s) => s.suspended) ?? null,
    pendingOddsChanges,
  };
}

/** A settled or open leg of a placed bet, for `settleBet`. */
export interface SettledLeg {
  odds: string;
  result: LegResult;
}

/**
 * A placed bet's figures, from the same calculator as the slip.
 *
 * With every leg settled it runs as a settlement (D1.10); with any leg still
 * open it is the same preview the slip showed. The server's figures win if the
 * two ever disagree — then this is the bug.
 */
export function settleBet(
  betType: BetType,
  legs: readonly SettledLeg[],
  stake: string,
  rules: RuleSetJson,
): PriceResult {
  const settled = legs.every((leg) => leg.result !== "open");
  return priceSlip({ betType, legs: [...legs], stake }, rules, settled);
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
  /** A bet is unconfirmed: send it again, same key (the slip sets this, not `resolveCta`). */
  | "retry"
  /** A bet is unconfirmed and the slip is another bet: place it, new key (the slip sets this too). */
  | "place-new"
  | "accept-changes"
  | "remove-suspended"
  | "deposit"
  | "blocked-conflict"
  | "login";

/**
 * What the primary button does right now.
 *
 * Order matters: a conflict is unfixable by the button (the user has to choose
 * which pick to drop), so it blocks. Everything below it is actionable. A slip
 * without a quote — no rule set yet, no stake, or a stake slipcalc refused —
 * cannot be placed; the alert above it carries the fix.
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
  if (totals.quote === null) return { action: "place", disabled: true };
  if (totals.insufficientBalance) return { action: "deposit", disabled: false };
  return { action: "place", disabled: false };
}
