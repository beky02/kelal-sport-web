import type { BetType, LegResult, TicketStatus } from "@/features/bets/types";
import type { Localized } from "@/types/common";

/**
 * A ticket as the public check reports it (`TicketCheck`): anonymised — no
 * owner — for online and shop tickets alike. Figures are the API's decimal
 * strings; a payout it didn't send is null.
 */
export interface TicketCheck {
  ticketId: string;
  status: TicketStatus;
  betType: BetType;
  placedAt: string;
  settledAt: string | null;
  stake: string;
  payout: string | null;
  legs: Array<{
    match: Localized;
    market: Localized;
    pick: Localized;
    odds: string;
    result: LegResult;
  }>;
}

/**
 * What the `/t/{ticket}` page found. Not found and failed are told apart by
 * the Problem's `code`, never its title: a failure is not a missing ticket.
 */
export type TicketLookup =
  | { status: "ok"; ticket: TicketCheck }
  | { status: "not_found"; ticketId: string }
  | { status: "failed"; ticketId: string };
