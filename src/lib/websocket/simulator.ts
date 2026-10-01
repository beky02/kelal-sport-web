import type { BoardSection } from "@/features/events/types";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { compareOdds, scaleOdds } from "@/lib/money";
import type { RealtimeClient } from "./client";
import type { ServerMessage } from "./messages";

interface Candidate {
  eventId: string;
  outcomeCode: string;
  odds: string;
}

/**
 * Nudges prices around with no gateway behind it.
 *
 * Not aiming for realism: it exercises the realtime path end to end — parse,
 * patch the cache, tint the button, prompt the slip to have its change accepted
 * — so none of that is only theoretically wired up.
 *
 * Half the time it deliberately targets a price already in the bet slip, because
 * "the odds moved while I was deciding" is the case worth being able to see. Off
 * unless NEXT_PUBLIC_REALTIME=simulate.
 */
export function startOddsSimulator(
  client: RealtimeClient,
  {
    board: readBoard,
    intervalMs = 4000,
    slipBias = 0.5,
  }: {
    /** The board as currently cached — the prices worth moving. */
    board: () => BoardSection[];
    intervalMs?: number;
    slipBias?: number;
  },
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = () => {
    if (stopped) return;
    const board = readBoard();

    const candidates: Candidate[] = board
      .flatMap((section) => section.events)
      .filter(({ event }) => !event.suspended)
      .flatMap(({ event, markets }) =>
        (markets.matchResult?.outcomes ?? [])
          .filter((outcome) => outcome.odds !== null)
          .map((outcome) => ({
            eventId: event.id,
            outcomeCode: outcome.code,
            odds: outcome.odds!,
          })),
      );

    // Nothing on screen yet — the board may still be loading.
    if (candidates.length === 0) {
      timer = setTimeout(run, intervalMs);
      return;
    }

    /** A 1X2 pick currently in the slip, if there is one. */
    const held = (): Candidate | null => {
      const inSlip = useBetSlipStore
        .getState()
        .selections.filter((s) => s.marketType === "1x2" && !s.suspended);
      if (inSlip.length === 0) return null;

      const target = inSlip[Math.floor(Math.random() * inSlip.length)];
      return (
        candidates.find(
          (c) =>
            c.eventId === target.eventId &&
            c.outcomeCode === target.outcomeCode,
        ) ?? null
      );
    };

    const tick = () => {
      if (stopped) return;

      const target =
        (Math.random() < slipBias ? held() : null) ??
        candidates[Math.floor(Math.random() * candidates.length)];

      const current = target.odds;
      const direction = Math.random() > 0.5 ? 1 : -1;
      // A believable single step: 2–8 %, never below 1.01.
      const next = scaleOdds(
        current,
        direction * (2 + Math.floor(Math.random() * 7)),
      );

      const message: ServerMessage = {
        type: "ODDS_UPDATED",
        eventId: target.eventId,
        marketType: "1x2",
        line: null,
        outcomeCode: target.outcomeCode,
        odds: next,
        movement: compareOdds(next, current) > 0 ? "up" : "down",
      };
      target.odds = next;
      client.inject(message);

      timer = setTimeout(tick, intervalMs);
    };

    timer = setTimeout(tick, intervalMs);
  };

  run();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
