import type { MessageKey } from "@/lib/i18n";
import type { Bet } from "../types";

export type PayoutTone = "win" | "loss" | "plain";

/**
 * What to call the bottom-right figure on a ticket, and how much it is — the
 * API's own figure, never a recomputation (AC-3).
 *
 * An open bet shows what it might pay (`potential_payout`); a settled one what
 * it did (`payout`), and a cashed-out one what was taken early. "Payout", not
 * "net payout": the contract doesn't say whether payout taxes are out of it
 * (contract request 007). A settled bet without a `payout` shows nothing
 * rather than a zero the API didn't send.
 */
export function payoutView(
  bet: Pick<Bet, "status" | "potentialPayout" | "payout">,
): { labelKey: MessageKey; amount: string | null; tone: PayoutTone } {
  switch (bet.status) {
    case "open":
      return {
        labelKey: "bets.potentialPayout",
        amount: bet.potentialPayout,
        tone: "plain",
      };
    case "won":
      return { labelKey: "bets.payout", amount: bet.payout, tone: "win" };
    case "lost":
      return { labelKey: "bets.payout", amount: bet.payout, tone: "loss" };
    case "cashed_out":
      return {
        labelKey: "bets.cashedAmount",
        amount: bet.payout,
        tone: "plain",
      };
    case "void":
    case "cancelled":
      return { labelKey: "bets.payout", amount: bet.payout, tone: "plain" };
  }
}

export const PAYOUT_TONE: Record<PayoutTone, string> = {
  win: "text-win",
  loss: "text-loss",
  plain: "text-text",
};
