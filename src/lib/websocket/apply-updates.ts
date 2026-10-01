import type { Market, Outcome } from "@/features/markets/types";
import type {
  BoardMarkets,
  BoardSection,
  SportEvent,
} from "@/features/events/types";
import { compareOdds } from "@/lib/money";
import type { ServerMessage } from "./messages";

/** Same price, even if spelled `"2.1"` one time and `"2.10"` the next. */
const sameOdds = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : compareOdds(a, b) === 0;

/**
 * Applies one realtime message to a cached board.
 *
 * The important property here is **identity preservation**: every section,
 * event, market and outcome the message does not touch is returned by reference.
 * Combined with memoised rows, a single price change re-renders one button
 * rather than three hundred.
 *
 * `applyToBoard` returns the same array it was given when nothing matched, so a
 * message for an event that is not on screen costs a walk and no render.
 */
export function applyToBoard(
  sections: BoardSection[],
  message: ServerMessage,
): BoardSection[] {
  if (message.type === "PONG") return sections;

  let sectionsChanged = false;

  const next = sections.map((section) => {
    let eventsChanged = false;

    const events = section.events.map((boardEvent) => {
      if (boardEvent.event.id !== message.eventId) return boardEvent;

      switch (message.type) {
        case "ODDS_UPDATED": {
          const updated = updateMarkets(boardEvent.markets, (market) =>
            market.type === message.marketType && market.line === message.line
              ? updateOutcome(market, message.outcomeCode, (outcome) =>
                  sameOdds(outcome.odds, message.odds) &&
                  outcome.movement === message.movement
                    ? outcome
                    : {
                        ...outcome,
                        previousOdds: outcome.odds,
                        odds: message.odds,
                        movement: message.movement,
                      },
                )
              : market,
          );
          if (updated === boardEvent.markets) return boardEvent;
          eventsChanged = true;
          return { ...boardEvent, markets: updated };
        }

        case "MARKET_STATUS_CHANGED": {
          const updated = updateMarkets(boardEvent.markets, (market) =>
            market.type === message.marketType &&
            market.line === message.line &&
            market.status !== message.status
              ? { ...market, status: message.status }
              : market,
          );
          if (updated === boardEvent.markets) return boardEvent;
          eventsChanged = true;
          return { ...boardEvent, markets: updated };
        }

        case "SCORE_UPDATED": {
          const { score, minute } = boardEvent.event;
          if (
            score?.home === message.home &&
            score?.away === message.away &&
            minute === message.minute
          ) {
            return boardEvent;
          }
          eventsChanged = true;
          return {
            ...boardEvent,
            event: {
              ...boardEvent.event,
              score: { home: message.home, away: message.away },
              minute: message.minute,
            } satisfies SportEvent,
          };
        }

        case "EVENT_STATUS_CHANGED": {
          if (
            boardEvent.event.status === message.status &&
            boardEvent.event.suspended === message.suspended
          ) {
            return boardEvent;
          }
          eventsChanged = true;
          return {
            ...boardEvent,
            event: {
              ...boardEvent.event,
              status: message.status,
              suspended: message.suspended,
            } satisfies SportEvent,
          };
        }
      }
    });

    if (!eventsChanged) return section;
    sectionsChanged = true;
    return { ...section, events };
  });

  return sectionsChanged ? next : sections;
}

/** Maps over the board's three market slots, preserving identity. */
function updateMarkets(
  markets: BoardMarkets,
  update: (market: Market) => Market,
): BoardMarkets {
  const slot = (market: Market | null) => (market ? update(market) : null);
  const matchResult = slot(markets.matchResult);
  const doubleChance = slot(markets.doubleChance);
  const totalGoals = slot(markets.totalGoals);

  if (
    matchResult === markets.matchResult &&
    doubleChance === markets.doubleChance &&
    totalGoals === markets.totalGoals
  ) {
    return markets;
  }
  return { matchResult, doubleChance, totalGoals };
}

function updateOutcome(
  market: Market,
  code: string,
  update: (outcome: Outcome) => Outcome,
): Market {
  let changed = false;
  const outcomes = market.outcomes.map((outcome) => {
    if (outcome.code !== code) return outcome;
    const next = update(outcome);
    if (next !== outcome) changed = true;
    return next;
  });
  return changed ? { ...market, outcomes } : market;
}

/** Applies a message to a fixture's full market list. */
export function applyToMarkets(
  markets: Market[],
  message: ServerMessage,
): Market[] {
  if (
    message.type !== "ODDS_UPDATED" &&
    message.type !== "MARKET_STATUS_CHANGED"
  ) {
    return markets;
  }

  let changed = false;
  const next = markets.map((market) => {
    if (
      market.eventId !== message.eventId ||
      market.type !== message.marketType ||
      market.line !== message.line
    ) {
      return market;
    }

    const updated =
      message.type === "ODDS_UPDATED"
        ? updateOutcome(market, message.outcomeCode, (outcome) => ({
            ...outcome,
            previousOdds: outcome.odds,
            odds: message.odds,
            movement: message.movement,
          }))
        : market.status === message.status
          ? market
          : { ...market, status: message.status };

    if (updated !== market) changed = true;
    return updated;
  });

  return changed ? next : markets;
}
