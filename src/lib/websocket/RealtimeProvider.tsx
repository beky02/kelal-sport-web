"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/config/env";
import { eventKeys, marketKeys } from "@/lib/query/keys";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import type { BoardSection } from "@/lib/api/mock/repository";
import type { Market } from "@/features/markets/types";
import { applyToBoard, applyToMarkets } from "./apply-updates";
import { RealtimeClient, type RealtimeState } from "./client";
import { startOddsSimulator } from "./simulator";

const RealtimeContext = createContext<{
  client: RealtimeClient | null;
  state: RealtimeState;
}>({ client: null, state: "idle" });

/**
 * Wires the realtime channel into the caches.
 *
 * A message never triggers a refetch. It patches the cached board and market
 * list in place — preserving the identity of everything it did not touch — and
 * separately corrects any affected pick already sitting in the bet slip, which
 * is what turns a silent price change into an explicit "accept this" prompt.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<RealtimeState>("idle");

  // One client for the life of the provider, created lazily so the server never
  // constructs one. A ref read during render would be the wrong tool here.
  const [client] = useState<RealtimeClient | null>(() =>
    env.realtime === "off" ? null : new RealtimeClient(env.wsUrl),
  );

  useEffect(() => {
    if (!client) return;

    const offState = client.onStateChange(setState);

    const offMessage = client.onMessage((message) => {
      queryClient.setQueriesData<BoardSection[]>(
        { queryKey: eventKeys.lists() },
        (sections) => (sections ? applyToBoard(sections, message) : sections),
      );

      if ("eventId" in message) {
        queryClient.setQueryData<Market[]>(
          marketKeys.byEvent(message.eventId),
          (markets) => (markets ? applyToMarkets(markets, message) : markets),
        );
      }

      // The slip holds its own copy of a price, because what matters there is
      // the gap between the odds the user accepted and the odds on offer now.
      const slip = useBetSlipStore.getState();
      if (message.type === "ODDS_UPDATED") {
        slip.applyOddsUpdate(
          {
            eventId: message.eventId,
            marketType: message.marketType,
            line: message.line,
            outcomeCode: message.outcomeCode,
          },
          message.odds,
        );
      }
      if (message.type === "EVENT_STATUS_CHANGED") {
        slip.applyEventSuspension(message.eventId, message.suspended);
      }
    });

    const stopSimulator =
      env.realtime === "simulate" ? startOddsSimulator(client) : undefined;
    if (env.realtime === "on") client.connect();

    return () => {
      offState();
      offMessage();
      stopSimulator?.();
      client.disconnect();
    };
  }, [client, queryClient]);

  const value = useMemo(() => ({ client, state }), [client, state]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Declares interest in topics for as long as the component is mounted.
 *
 * Opening a fixture subscribes to it; leaving unsubscribes. That is what keeps a
 * user on one match from receiving the whole book.
 */
export function useRealtimeTopics(topics: string[]): void {
  const { client } = useContext(RealtimeContext);
  // The joined string is the stable identity of the list; depending on the array
  // itself would resubscribe on every render.
  const key = topics.join("|");

  useEffect(() => {
    if (!client || key === "") return;
    return client.subscribe(key.split("|"));
  }, [client, key]);
}

export function useRealtimeState(): RealtimeState {
  return useContext(RealtimeContext).state;
}
