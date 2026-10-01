import { z } from "zod";
import { env } from "@/config/env";
import { apiClient, assertContract } from "@/lib/api/client";
import { mockRepository, type EventFilters } from "@/lib/api/mock/repository";
import {
  boardSectionSchema,
  eventSchema,
  competitionSchema,
} from "@/lib/api/schemas";
import type { BoardSection } from "@/lib/api/mock/repository";

const boardResponse = z.array(boardSectionSchema);

/**
 * The sportsbook board: competitions, their events, and the three market groups
 * each row shows. One request, because the board is one screen.
 */
export async function getBoard(
  filters: EventFilters,
  dataSaver: boolean,
  signal?: AbortSignal,
): Promise<BoardSection[]> {
  if (env.useMocks) {
    return assertContract(
      "/events/board",
      boardResponse,
      await mockRepository.listBoard(filters, dataSaver),
    );
  }
  return apiClient.get("/events/board", boardResponse, {
    params: {
      sport: filters.sportId,
      competition: filters.competitionId,
      live: filters.live,
      filter: filters.filter,
      date: filters.date,
      lite: dataSaver || undefined,
    },
    signal,
  });
}

const eventDetailResponse = z.object({
  event: eventSchema,
  competition: competitionSchema,
});

export async function getEvent(
  id: string,
  dataSaver: boolean,
  signal?: AbortSignal,
) {
  if (env.useMocks) {
    const found = await mockRepository.getEvent(id, dataSaver);
    if (!found) return null;
    return assertContract(`/events/${id}`, eventDetailResponse, found);
  }
  return apiClient.get(`/events/${id}`, eventDetailResponse, { signal });
}

export type { EventFilters };
