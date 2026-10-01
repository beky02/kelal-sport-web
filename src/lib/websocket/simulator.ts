import { mockRepository } from "@/lib/api/mock/repository";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { outcomeKey } from "@/features/markets/types";
import type { RealtimeClient } from "./client";
import type { ServerMessage } from "./messages";

interface Candidate {
  eventId: string;
  outcomeCode: string;
  odds: number;
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
    intervalMs = 4000,
    slipBias = 0.5,
  }: { intervalMs?: number; slipBias?: number } = {},
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = async () => {
    const board = await mockRepository.listBoard({ sportId: "soccer" });

    const candidates: Candidate[] = board
      .flatMap((section) => section.events)
      .filter(({ event }) => !event.suspended)
      .flatMap(({ event, markets }) =>
        markets.matchResult.outcomes
          .filter((outcome) => outcome.odds !== null)
          .map((outcome) => ({
            eventId: event.id,
            outcomeCode: outcome.code,
            odds: outcome.odds!,
          })),
      );

    if (candidates.length === 0) return;

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
            outcomeKey({
              eventId: c.eventId,
              marketType: "1x2",
              line: null,
              outcomeCode: c.outcomeCode,
            }) === target.uid,
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
      // A believable single step: a few percent, never below evens.
      const next =
        Math.round(
          Math.max(
            1.01,
            current * (1 + direction * (0.02 + Math.random() * 0.06)),
          ) * 100,
        ) / 100;

      const message: ServerMessage = {
        type: "ODDS_UPDATED",
        eventId: target.eventId,
        marketType: "1x2",
        line: null,
        outcomeCode: target.outcomeCode,
        odds: next,
        movement: next > current ? "up" : "down",
      };
      target.odds = next;
      client.inject(message);

      timer = setTimeout(tick, intervalMs);
    };

    timer = setTimeout(tick, intervalMs);
  };

  void run();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
