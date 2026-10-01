import type { Crest, Localized } from "@/types/common";

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
