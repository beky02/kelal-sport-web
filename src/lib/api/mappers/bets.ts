import type { BetReceipt, PlaceBetRequest } from "@/features/bet-slip/types";
import type { Bet, BetLeg, BetPage } from "@/features/bets/types";
import type { components, paths } from "@/lib/api/schema";
import type { Bilingual } from "./catalogue";

type ApiPlaceBetRequest = components["schemas"]["PlaceBetRequest"];
type ApiPlacedBet = components["schemas"]["PlacedBet"];
type ApiBet = components["schemas"]["Bet"];
type ApiBetLeg = components["schemas"]["BetLeg"];
type ApiBetPage =
  paths["/v1/bets"]["get"]["responses"][200]["content"]["application/json"];

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

function toBetLeg(en: ApiBetLeg, am: ApiBetLeg | undefined): BetLeg {
  return {
    outcomeId: en.outcome_id,
    fixtureId: en.fixture_id,
    match: { en: en.fixture_name, am: am?.fixture_name ?? en.fixture_name },
    market: { en: en.market_name, am: am?.market_name ?? en.market_name },
    pick: { en: en.outcome_name, am: am?.outcome_name ?? en.outcome_name },
    startTime: en.start_time,
    odds: en.odds_taken,
    result: en.result,
  };
}

/**
 * A bet read in both languages → one ticket with `Localized` names.
 *
 * Every figure comes from the English read, untouched; the Amharic read only
 * contributes names, matched by outcome so a reordered list can't swap them.
 * A figure the API left out stays empty — never a zero it didn't say.
 */
export function toBet({ en, am }: Bilingual<ApiBet>): Bet {
  const amLegs = new Map(am.legs.map((leg) => [leg.outcome_id, leg]));
  return {
    id: en.id,
    ticketId: en.ticket_id,
    status: en.status,
    betType: en.bet_type,
    systemSizes: en.system_sizes ?? [],
    lines: en.lines,
    stake: en.stake,
    stakeBonus: en.stake_bonus ?? null,
    stakeTax: en.stake_tax,
    totalOdds: en.total_odds ?? null,
    potentialPayout: en.potential_payout,
    accaBonus: en.acca_bonus,
    payout: en.payout ?? null,
    winTax: en.win_tax ?? null,
    legs: en.legs.map((leg) => toBetLeg(leg, amLegs.get(leg.outcome_id))),
    placedAt: en.placed_at,
    settledAt: en.settled_at ?? null,
  };
}

/**
 * A page of My bets read in both languages. The English read decides which
 * bets and in what order, and its cursor is the one used; a bet placed between
 * the two reads may be missing from the Amharic page, and keeps its English
 * names in both.
 */
export function toBetPage({ en, am }: Bilingual<ApiBetPage>): BetPage {
  const amBets = new Map(am.items.map((bet) => [bet.id, bet]));
  return {
    items: en.items.map((bet) =>
      toBet({ en: bet, am: amBets.get(bet.id) ?? bet }),
    ),
    nextCursor: en.next_cursor ?? null,
  };
}
