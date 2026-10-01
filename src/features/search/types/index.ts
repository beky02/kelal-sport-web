import type { Competition } from "@/features/competitions/types";
import type { SportEvent } from "@/features/events/types";

export interface SearchResults {
  leagues: Array<{ competition: Competition; eventCount: number }>;
  events: Array<{ event: SportEvent; competition: Competition }>;
}
