import type { Localized } from "@/types/common";

export interface Sport {
  id: string;
  slug: string;
  name: Localized;
  eventCount: number;
  liveCount: number;
  /** SVG path `d` strings, stroked at 1.5 — see components/ui/SportIcon. */
  iconPaths: readonly string[];
}
