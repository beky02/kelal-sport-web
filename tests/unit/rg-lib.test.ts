import { describe, expect, it } from "vitest";
import { breakOf } from "@/features/responsible-gaming/lib/break";
import type { Player } from "@/features/auth/types";
import { CONTRACT_PLAYER } from "../component/render";

const player = (
  status: Player["status"],
  excludedUntil: string | null,
): Player => ({
  ...CONTRACT_PLAYER,
  status,
  flags: { ...CONTRACT_PLAYER.flags, excludedUntil },
});

describe("breakOf: whether a break is in force, as /api/me says (AC-2)", () => {
  it("is none for a guest or a player /v1/me reports no break for", () => {
    expect(breakOf(null)).toBeNull();
    // The contract's own player: active, no `excluded_until`.
    expect(breakOf(CONTRACT_PLAYER)).toBeNull();
  });

  it("runs until the time /v1/me gives, whatever the status says", () => {
    expect(breakOf(player("active", "2026-10-10T15:00:00Z"))).toEqual({
      until: "2026-10-10T15:00:00Z",
    });
    expect(breakOf(player("self_excluded", "2031-10-05T09:00:00Z"))).toEqual({
      until: "2031-10-05T09:00:00Z",
    });
  });

  it("has no end for a self-excluded player with no date: a permanent exclusion", () => {
    expect(breakOf(player("self_excluded", null))).toEqual({ until: null });
  });

  it("is never ended by this browser's clock: an end already past still counts until the API drops it", () => {
    // The API decides when a break is over; a stale /api/me errs locked.
    expect(breakOf(player("active", "2020-01-01T00:00:00Z"))).toEqual({
      until: "2020-01-01T00:00:00Z",
    });
  });

  it("is none for a status that isn't a break", () => {
    expect(breakOf(player("suspended", null))).toBeNull();
    expect(breakOf(player("closed", null))).toBeNull();
  });
});
