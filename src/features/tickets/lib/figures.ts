import type { PayoutTone } from "@/features/bets/lib/figures";
import type { MessageKey } from "@/lib/i18n";
import type { TicketCheck } from "../types";

/**
 * The public check's payout line, when the API gives one: "Cashed out" for a
 * ticket taken early, "Payout" for every other status — the API's figure,
 * labelled no more than the contract describes it (approved at the plan gate:
 * every status). No payout from the API, no line: never a made-up zero.
 */
export function ticketPayout(
  ticket: Pick<TicketCheck, "status" | "payout">,
): { labelKey: MessageKey; amount: string; tone: PayoutTone } | null {
  if (ticket.payout === null) return null;
  const tone: PayoutTone =
    ticket.status === "won" || ticket.status === "paid"
      ? "win"
      : ticket.status === "lost"
        ? "loss"
        : "plain";
  return {
    labelKey:
      ticket.status === "cashed_out" ? "bets.cashedAmount" : "bets.payout",
    amount: ticket.payout,
    tone,
  };
}
