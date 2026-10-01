import type { Crest, Localized } from "@/types/common";
import type { Competition } from "@/features/competitions/types";
import type { Market, MarketGroup } from "@/features/markets/types";

export type EventStatus = "scheduled" | "starting_soon" | "live" | "finished";

export interface Team {
  id: string;
  name: Localized;
  crest: Crest;
}

export interface Score {
  home: number;
  away: number;
}

export interface SportEvent {
  id: string;
  sportId: string;
  competitionId: string;

  home: Team;
  away: Team;

  status: EventStatus;
  /**
   * Trading is paused on this event — every market is locked. Distinct from
   * `status`, because a live event can be briefly suspended and then reopen.
   */
  suspended: boolean;

  /** Calendar date of the fixture, ISO `YYYY-MM-DD` in East Africa Time. */
  startDate: string;
  /** Kickoff as HH:mm in East Africa Time. Formatted for display per clock. */
  kickoff: string | null;
  /** Elapsed time on a live event, already formatted, e.g. `63'`. */
  minute: string | null;
  score: Score | null;
  /** Minutes until kickoff, when close enough to show a countdown. */
  startsInMinutes: number | null;

  /** Total markets available, for the `+58 ›` affordance. */
  marketCount: number;
}

/**
 * The three market columns a board row shows.
 *
 * Each can be missing: `/v1/events` carries one `main` market per fixture, so
 * double chance and total goals are only filled where the API provides them,
 * and a fixture whose main market is not priced yet has none at all. A missing
 * market renders as empty cells, never as made-up prices.
 */
export interface BoardMarkets {
  matchResult: Market | null;
  doubleChance: Market | null;
  totalGoals: Market | null;
}

export interface BoardEvent {
  event: SportEvent;
  markets: BoardMarkets;
}

export interface BoardSection {
  competition: Competition;
  events: BoardEvent[];
}

/** A fixture with its full book, for the event page. */
export interface EventDetail {
  event: SportEvent;
  competition: Competition;
  markets: Market[];
  /** The groups this fixture has markets in, in dictionary order. */
  groups: MarketGroup[];
}

export interface EventFilters {
  /** Contract sport ID, e.g. `s_football`. */
  sportId?: string;
  /** Narrow to one competition, for its own page. */
  competitionId?: string;
  /** Only in-play events. Release 2; ignored by the Release 1 catalogue. */
  live?: boolean;
  /** `top` sorts by popularity; `upcoming` by kickoff; `today` pins today. */
  filter?: "top" | "upcoming" | "today";
  /** Local date (EAT), `YYYY-MM-DD`. */
  date?: string;
}
