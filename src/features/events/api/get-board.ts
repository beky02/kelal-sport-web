import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import {
  boardSectionSchema,
  eventDetailSchema,
} from "@/lib/api/catalogue-schemas";
import type {
  BoardSection,
  EventDetail,
  EventFilters,
} from "@/features/events/types";

const boardResponse = z.array(boardSectionSchema);

/**
 * The sportsbook board: competitions and their fixtures, each with the market
 * columns a row shows. One request, because the board is one screen; the route
 * handler turns `/v1/events` and the dictionary into this shape.
 */
export async function getBoard(
  filters: EventFilters,
  dataSaver: boolean,
  signal?: AbortSignal,
): Promise<BoardSection[]> {
  return apiClient.get("/catalogue/board", boardResponse, {
    params: {
      sport: filters.sportId,
      competition: filters.competitionId,
      live: filters.live ? 1 : undefined,
      filter: filters.filter,
      date: filters.date,
      lite: dataSaver ? 1 : undefined,
    },
    signal,
  });
}

/** A fixture with its full book, or `null` if there is no such fixture. */
export async function getEvent(
  id: string,
  dataSaver: boolean,
  signal?: AbortSignal,
): Promise<EventDetail | null> {
  return apiClient.get(
    `/catalogue/events/${encodeURIComponent(id)}`,
    eventDetailSchema,
    { params: { lite: dataSaver ? 1 : undefined }, signal },
  );
}

export type { EventFilters };
