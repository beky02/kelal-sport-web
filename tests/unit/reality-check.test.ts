import { describe, expect, it } from "vitest";
import {
  nextCheckAt,
  playedMinutes,
} from "@/features/system/lib/reality-check";

const MIN = 60_000;
const START = Date.parse("2026-10-05T09:00:00Z");

describe("the reality check's clock (AC-10)", () => {
  it("comes due one interval after the visit starts", () => {
    expect(nextCheckAt(START, 60, null)).toBe(START + 60 * MIN);
    expect(nextCheckAt(START, 30, null)).toBe(START + 30 * MIN);
  });

  it("after an answer, comes due at the next whole interval of the visit", () => {
    // Answered as it opened, or a little after: an interval later.
    expect(nextCheckAt(START, 60, START + 60 * MIN)).toBe(START + 120 * MIN);
    expect(nextCheckAt(START, 60, START + 61 * MIN)).toBe(START + 120 * MIN);
    // Answered late (it waited behind another dialog): the next one after.
    expect(nextCheckAt(START, 60, START + 150 * MIN)).toBe(START + 180 * MIN);
  });

  it("follows a changed interval from the last answer", () => {
    expect(nextCheckAt(START, 30, START + 60 * MIN)).toBe(START + 90 * MIN);
  });

  it("counts whole minutes played, never fewer than none", () => {
    expect(playedMinutes(START, START + 60 * MIN)).toBe(60);
    expect(playedMinutes(START, START + 90 * MIN + 59_000)).toBe(90);
    expect(playedMinutes(START, START - MIN)).toBe(0);
  });
});
