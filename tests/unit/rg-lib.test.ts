import { describe, expect, it } from "vitest";
import { breakOf } from "@/features/responsible-gaming/lib/break";
import {
  exclusionOutcome,
  limitFor,
  limitValue,
  openingPeriod,
} from "@/features/responsible-gaming/lib/limits";
import type { Player } from "@/features/auth/types";
import { toLimits } from "@/lib/api/mappers/responsible-gambling";
import { ApiError, ContractError } from "@/lib/api/errors";
import { example } from "../contract";
import { CONTRACT_PLAYER } from "../component/render";

/** Prism's player's limits: a weekly deposit limit and a daily time limit. */
const LIMITS = toLimits(example("/v1/me/limits").items);

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

describe("which limit a card shows", () => {
  it("finds the limit of a type and period, and none where the player has set none", () => {
    expect(limitFor(LIMITS, "deposit", "week")?.amount).toBe("1000.00");
    expect(limitFor(LIMITS, "session_minutes", "day")?.minutes).toBe(120);
    expect(limitFor(LIMITS, "deposit", "day")).toBeNull();
    expect(limitFor(LIMITS, "loss", "month")).toBeNull();
  });

  it("opens a card on the first period holding a limit, else on the day", () => {
    expect(openingPeriod(LIMITS, "deposit")).toBe("week");
    expect(openingPeriod(LIMITS, "session_minutes")).toBe("day");
    expect(openingPeriod(LIMITS, "stake")).toBe("day");
    expect(openingPeriod([], "loss")).toBe("day");
  });
});

describe("limitValue: what a typed limit sends (plan decision 5)", () => {
  it("sends money in the contract's form, above zero", () => {
    expect(limitValue("deposit", "1000")).toEqual({ amount: "1000.00" });
    expect(limitValue("stake", "250.5")).toEqual({ amount: "250.50" });
    expect(limitValue("loss", "0.01")).toEqual({ amount: "0.01" });
    expect(limitValue("deposit", "")).toBe("empty");
    expect(limitValue("deposit", "0")).toBe("tooLow");
    expect(limitValue("deposit", "0.00")).toBe("tooLow");
    expect(limitValue("deposit", "0.")).toBe("tooLow");
  });

  it("refuses an amount longer than the contract's money, rather than failing", () => {
    expect(limitValue("deposit", "1234567890123")).toBe("tooHigh");
    expect(limitValue("deposit", "999999999999.99")).toEqual({
      amount: "999999999999.99",
    });
  });

  it("sends a time limit in whole minutes from one", () => {
    expect(limitValue("session_minutes", "90")).toEqual({ minutes: 90 });
    expect(limitValue("session_minutes", "1")).toEqual({ minutes: 1 });
    expect(limitValue("session_minutes", "0")).toBe("tooLow");
    expect(limitValue("session_minutes", "")).toBe("empty");
    expect(limitValue("session_minutes", "1000000")).toBe("tooHigh");
  });
});

describe("exclusionOutcome: what an unfinished break means (plan decision 8)", () => {
  const answer = (status: number, code = "X") =>
    new ApiError("t", status, code);

  it("says the session is gone for a 401", () => {
    expect(exclusionOutcome(answer(401, "AUTH_TOKEN_EXPIRED"))).toBe("session");
  });

  it("can't say whether it started without an answer: network, 30 s, 429, a 5xx, an unreadable reply", () => {
    expect(exclusionOutcome(new ApiError("down", 0, "network"))).toBe(
      "unanswered",
    );
    expect(exclusionOutcome(answer(429, "RATE_LIMITED"))).toBe("unanswered");
    expect(exclusionOutcome(answer(503, "SERVICE_UNAVAILABLE"))).toBe(
      "unanswered",
    );
    expect(exclusionOutcome(new ContractError("/me/self-exclusion", "x"))).toBe(
      "unanswered",
    );
  });

  it("knows it didn't start when the API said no", () => {
    expect(exclusionOutcome(answer(422, "VALIDATION_FAILED"))).toBe("refused");
    expect(exclusionOutcome(answer(403, "PERMISSION_DENIED"))).toBe("refused");
  });
});
