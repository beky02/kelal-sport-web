import { describe, expect, it } from "vitest";
import {
  advanceLiveMatchState,
  buildLiveSimulationGroups,
  LIVE_SIMULATION_GROUPS,
} from "@/lib/api/mock/fixtures";

describe("live sportsbook simulation", () => {
  it("creates a large set of simulated fixtures and markets", () => {
    const groups = buildLiveSimulationGroups();

    expect(groups.length).toBeGreaterThan(6);
    expect(
      groups.reduce((sum, group) => sum + group.matches.length, 0),
    ).toBeGreaterThan(8);

    const liveMatches = groups.flatMap((group) =>
      group.matches.filter((match) => match.status === "live"),
    );

    expect(liveMatches.length).toBeGreaterThan(0);
    expect(liveMatches[0].marketCount).toBeGreaterThan(20);
  });

  it("moves odds and scores while the match is live", () => {
    const match = LIVE_SIMULATION_GROUPS[0].matches[0];
    const before = JSON.parse(JSON.stringify(match));
    const next = advanceLiveMatchState(match, 1);

    expect(next.id).toBe(match.id);
    expect(next.minute).not.toBe(before.minute);
    expect(next.odds).not.toEqual(before.odds);
    expect(next.homeScore).toBeGreaterThanOrEqual(0);
    expect(next.awayScore).toBeGreaterThanOrEqual(0);
  });
});
