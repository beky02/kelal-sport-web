import type { Localized } from "@/types/common";

/**
 * Where a competition sits.
 *
 * Usually a country, sometimes a continent or an international body — every
 * competition has one, but not every one has a flag. AFCON qualifiers belong to
 * "Africa", which is a region with no code and no flag; the UI shows a globe.
 */
export interface Region {
  /** Country code, or null for a continental or international competition. */
  code: string | null;
  name: Localized;
  /** Null where there is no flag to show. */
  flag: string | null;
}

export interface Competition {
  id: string;
  sportId: string;
  name: Localized;
  /** Matchweek / round label, e.g. "Matchweek 6". */
  round: Localized;
  region: Region;
}

export interface CompetitionSummary {
  id: string;
  name: Localized;
  eventCount: number;
  flag: string | null;
}

/** A real country, for the A–Z browser. Regions without a code are excluded. */
export interface CountryWithLeagues {
  code: string;
  name: Localized;
  /** Null where there is no flag file for this country yet. */
  flag: string | null;
  leagues: Array<{ id: string; name: Localized; eventCount: number }>;
}
