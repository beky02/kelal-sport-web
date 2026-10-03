import type { TicketCheck } from "@/features/tickets/types";
import type { components } from "@/lib/api/schema";
import type { Bilingual } from "./catalogue";

type ApiTicketCheck = components["schemas"]["TicketCheck"];

/**
 * A ticket check read in both languages → one ticket with `Localized` names.
 *
 * Everything but the names comes from the English read, untouched. Its legs
 * carry no ids, so the Amharic names are matched by position — both reads are
 * of the same ticket — and a leg the other read lacks keeps its English names.
 */
export function toTicketCheck({
  en,
  am,
}: Bilingual<ApiTicketCheck>): TicketCheck {
  return {
    ticketId: en.ticket_id,
    status: en.status,
    betType: en.bet_type,
    placedAt: en.placed_at,
    settledAt: en.settled_at ?? null,
    stake: en.stake,
    payout: en.payout ?? null,
    legs: en.legs.map((leg, i) => {
      const other = am.legs[i];
      return {
        match: {
          en: leg.fixture_name,
          am: other?.fixture_name ?? leg.fixture_name,
        },
        market: {
          en: leg.market_name,
          am: other?.market_name ?? leg.market_name,
        },
        pick: {
          en: leg.outcome_name,
          am: other?.outcome_name ?? leg.outcome_name,
        },
        odds: leg.odds,
        result: leg.result,
      };
    }),
  };
}
