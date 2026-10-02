import type { BetReceipt, PlaceBetRequest } from "@/features/bet-slip/types";
import type { components } from "@/lib/api/schema";

type ApiPlaceBetRequest = components["schemas"]["PlaceBetRequest"];
type ApiPlacedBet = components["schemas"]["PlacedBet"];

/**
 * The slip's request → the contract's `PlaceBetRequest`, field by field.
 *
 * Bonus money and free bets stay off until F7 builds them, and say so
 * explicitly, as the contract's own example does, rather than leaning on a
 * default. The stake is the total as typed: the engine splits it per line
 * exactly as the preview did (D1.3).
 */
export function toPlaceBetRequest(
  request: PlaceBetRequest,
): ApiPlaceBetRequest {
  return {
    bet_type: request.betType,
    ...(request.systemSizes.length > 0
      ? { system_sizes: request.systemSizes }
      : {}),
    legs: request.legs.map((leg) => ({
      outcome_id: leg.outcomeId,
      odds: leg.odds,
    })),
    stake: request.stake,
    odds_policy: request.oddsPolicy,
    use_bonus: false,
    free_bet_id: null,
  };
}

/**
 * The engine's `PlacedBet` → the ticket the slip confirms. Every figure is the
 * API's, untouched. The balance it carries stays on the server: the wallet is
 * read again instead (F6 owns it).
 */
export function toBetReceipt(bet: ApiPlacedBet): BetReceipt {
  return {
    id: bet.id,
    ticketId: bet.ticket_id,
    placedAt: bet.placed_at,
    betType: bet.bet_type,
    systemSizes: bet.system_sizes ?? [],
    lines: bet.lines,
    legCount: bet.legs.length,
    stake: bet.stake,
    stakeTax: bet.stake_tax,
    totalOdds: bet.total_odds ?? null,
    accaBonus: bet.acca_bonus,
    potentialPayout: bet.potential_payout,
  };
}
