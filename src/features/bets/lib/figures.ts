import type { LegResult, RuleSetJson } from "@golden/slipcalc";
import { settleBet, type SlipQuote } from "@/features/bet-slip/lib/calculate";
import type { Bet, LegStatus } from "../types";

const LEG_RESULT: Record<LegStatus, LegResult> = {
  open: "open",
  live: "open",
  won: "win",
  lost: "lose",
  void: "void",
};

/**
 * A ticket's money, from the same calculator the bet slip uses (D1).
 *
 * For a settled bet the backend has already decided these; this recomputes them
 * only so the breakdown can be shown. If the two ever disagree, the server is
 * right and this is the bug. Null while the rule set loads.
 */
export function betFigures(
  bet: Bet,
  rules: RuleSetJson | null,
): SlipQuote | null {
  if (!rules) return null;
  const result = settleBet(
    bet.legs.length === 1 ? "single" : "multiple",
    bet.legs.map((leg) => ({ odds: leg.odds, result: LEG_RESULT[leg.status] })),
    bet.stake,
    rules,
  );
  return result.ok ? result.quote : null;
}

export type PayoutTone = "win" | "loss" | "plain";

/**
 * What to call the bottom-right figure on a ticket, and how much it is.
 *
 * Four different things depending on state: what a bet might pay, what it did
 * pay, what was taken early, or nothing at all. Labelling all four "payout"
 * would be the easy mistake. `amount` is null while the figures load.
 */
export function payoutView(
  bet: Bet,
  figures: SlipQuote | null,
): { labelKey: string; amount: string | null; tone: PayoutTone } {
  switch (bet.status) {
    case "won":
      return {
        labelKey: "bets.netPayout",
        amount: figures?.netPayout ?? null,
        tone: "win",
      };
    case "lost":
      return { labelKey: "bets.lostPayout", amount: "0.00", tone: "loss" };
    case "cashed":
      return {
        labelKey: "bets.cashedAmount",
        amount: bet.cashedOutAmount ?? "0.00",
        tone: "plain",
      };
    default:
      return {
        labelKey: "bets.potentialPayout",
        amount: figures?.netPayout ?? null,
        tone: "plain",
      };
  }
}

export const PAYOUT_TONE: Record<PayoutTone, string> = {
  win: "text-win",
  loss: "text-loss",
  plain: "text-text",
};
