import { BETTING } from "@/config/constants";
import { settleBet, type BetFigures } from "@/features/bet-slip/lib/calculate";
import { totalOdds, type Bet } from "../types";

const RATES = {
  stakeTax: BETTING.stakeTaxRate,
  winTax: BETTING.winTaxRate,
  maxWinPerTicket: BETTING.maxWinPerTicket,
};

/**
 * A ticket's money, from the same function the bet slip uses.
 *
 * For a settled bet the backend has already decided these; this recomputes them
 * only so the breakdown can be shown. If the two ever disagree, the server is
 * right and this is the bug.
 */
export const betFigures = (bet: Bet): BetFigures & { odds: number } => {
  const odds = totalOdds(bet.legs);
  return { odds, ...settleBet(bet.stake, odds, RATES) };
};

export type PayoutTone = "win" | "loss" | "plain";

/**
 * What to call the bottom-right figure on a ticket, and how much it is.
 *
 * Four different things depending on state: what a bet might pay, what it did
 * pay, what was taken early, or nothing at all. Labelling all four "payout"
 * would be the easy mistake.
 */
export function payoutView(
  bet: Bet,
  figures: BetFigures,
): { labelKey: string; amount: number; tone: PayoutTone } {
  switch (bet.status) {
    case "won":
      return {
        labelKey: "bets.netPayout",
        amount: figures.payout,
        tone: "win",
      };
    case "lost":
      return { labelKey: "bets.lostPayout", amount: 0, tone: "loss" };
    case "cashed":
      return {
        labelKey: "bets.cashedAmount",
        amount: bet.cashedOutAmount ?? 0,
        tone: "plain",
      };
    default:
      return {
        labelKey: "bets.potentialPayout",
        amount: figures.payout,
        tone: "plain",
      };
  }
}

export const PAYOUT_TONE: Record<PayoutTone, string> = {
  win: "text-win",
  loss: "text-loss",
  plain: "text-text",
};

/** The share a partial cash-out takes. */
export const CASH_OUT_FRACTIONS = [0.25, 0.5, 1] as const;
