import { describe, expect, it } from "vitest";
import { ApiError, ContractError } from "@/lib/api/errors";
import { calculateBetSlip } from "@/features/bet-slip/lib/calculate";
import type { BetSelection } from "@/features/bet-slip/types";
import { toBettingRules } from "@/lib/api/mappers/config";
import {
  CODE_DISPLAY_SECONDS,
  IDLE_RESET_SECONDS,
  kioskTimings,
  minutesLeft,
  pausedUntil,
  slipCodeRefusal,
  slipCodeRequestFrom,
} from "@/features/terminal/lib/slip-code";
import type { SlipCodeRequest, TerminalInfo } from "@/features/terminal/types";
import { example, responseExample } from "../contract";

/** The shop's rule set (`retail_betting`), from the contract's config. */
const RULES = toBettingRules(example("/v1/config/public").retail_betting!).calc;

const pick = (
  outcomeId: string,
  eventId: string,
  odds: string,
  suspended = false,
): BetSelection => ({
  outcomeId,
  eventId,
  marketId: `mk_${eventId}`,
  marketType: "1x2",
  line: null,
  outcomeCode: "1",
  eventName: { en: eventId, am: eventId },
  marketName: { en: "1X2", am: "1X2" },
  outcomeName: { en: "1", am: "1" },
  initialOdds: odds,
  currentOdds: odds,
  suspended,
});

const requestOf = (selections: BetSelection[], stake: string) =>
  slipCodeRequestFrom({
    selections,
    stake,
    totals: calculateBetSlip({
      selections,
      mode: "multiple",
      stake,
      systemK: 2,
      rules: RULES,
      balance: null,
      oddsPolicy: "any",
    }),
  });

describe("the slip as a slip-code request (F8cc AC-c1)", () => {
  it("sends each live pick with the odds on screen, and the stake as its hint", () => {
    expect(
      requestOf(
        [pick("oc_ac_1", "fx_1", "2.10"), pick("oc_sg_1", "fx_2", "1.85")],
        "50",
      ),
    ).toEqual({
      betType: "multiple",
      systemSizes: [],
      legs: [
        { outcomeId: "oc_ac_1", odds: "2.10" },
        { outcomeId: "oc_sg_1", odds: "1.85" },
      ],
      stakeHint: "50.00",
    });
  });

  it("leaves a suspended pick out, and sends one pick as a single", () => {
    expect(
      requestOf(
        [
          pick("oc_ac_1", "fx_1", "2.10"),
          pick("oc_sg_1", "fx_2", "1.85", true),
        ],
        "50",
      ),
    ).toMatchObject({
      betType: "single",
      legs: [{ outcomeId: "oc_ac_1", odds: "2.10" }],
    });
  });

  it("gets no code under the shop's minimum, as Book bet (the user's decision, 2026-10-08)", () => {
    const picks = [
      pick("oc_ac_1", "fx_1", "2.10"),
      pick("oc_sg_1", "fx_2", "1.85"),
    ];
    expect(requestOf(picks, "")).toBeNull();
    expect(requestOf(picks, "0")).toBeNull();
    expect(requestOf(picks, "1")).toBeNull();
    expect(requestOf([], "50")).toBeNull();
  });

  it("never sends odds that aren't the contract's shape", () => {
    expect(
      requestOf(
        [pick("oc_ac_1", "fx_1", "2.1"), pick("oc_sg_1", "fx_2", "1.85")],
        "50",
      )?.legs,
    ).toEqual([
      { outcomeId: "oc_ac_1", odds: null },
      { outcomeId: "oc_sg_1", odds: "1.85" },
    ]);
  });
});

const REQUEST: SlipCodeRequest = {
  betType: "multiple",
  systemSizes: [],
  legs: [
    { outcomeId: "oc_ac_1", odds: "2.10" },
    { outcomeId: "oc_sg_1", odds: "1.85" },
  ],
  stakeHint: "5.00",
};

const problem = (
  status: number,
  code: string,
  errors: ApiError["errors"] = [],
  retryAfter: number | null = null,
) => new ApiError("Refused", status, code, null, errors, retryAfter);

describe("what a refused Get code says and offers (F8cc AC-6, AC-c3)", () => {
  it("waits out a 429 for its Retry-After", () => {
    expect(
      slipCodeRefusal(problem(429, "RATE_LIMITED", [], 240), REQUEST),
    ).toEqual({ kind: "paused", retryAfter: 240 });
    expect(slipCodeRefusal(problem(429, "RATE_LIMITED"), REQUEST)).toEqual({
      kind: "paused",
      retryAfter: null,
    });
  });

  it("offers the server's stake from the contract's example (field stake) and from request 015's (field stake_hint)", () => {
    const contract = responseExample(
      "/v1/retail/slip-codes",
      "post",
      422,
      "stake_too_low",
    ) as { code: string; errors: ApiError["errors"] };
    expect(
      slipCodeRefusal(problem(422, contract.code, contract.errors), REQUEST),
    ).toEqual({
      kind: "stake",
      key: "betSlip.errors.stakeTooLowBody",
      amount: "5.00",
    });
    expect(
      slipCodeRefusal(
        problem(422, "BET_STAKE_TOO_HIGH", [
          { field: "stake_hint", code: "MAX", limit: "50000.00" },
        ]),
        REQUEST,
      ),
    ).toEqual({
      kind: "stake",
      key: "betSlip.errors.stakeTooHighBody",
      amount: "50000.00",
    });
  });

  it("offers no stake that isn't an amount, or that is a leg's limit", () => {
    for (const errors of [
      [{ field: "stake_hint", code: "MIN", limit: "ten" }],
      [{ field: "legs[0].odds", code: "MIN", limit: "5.00" }],
      [],
    ]) {
      expect(
        slipCodeRefusal(problem(422, "BET_STAKE_TOO_LOW", errors), REQUEST),
      ).toEqual({ kind: "message", key: "terminal.code.cannot" });
    }
  });

  it("closes the picks a started or suspended leg names, by their place in the request", () => {
    expect(
      slipCodeRefusal(
        problem(422, "BET_EVENT_STARTED", [
          { field: "legs[1].outcome_id", code: "EVENT_STARTED" },
        ]),
        REQUEST,
      ),
    ).toEqual({ kind: "legs", refused: "started", outcomeIds: ["oc_sg_1"] });
    expect(
      slipCodeRefusal(
        problem(422, "BET_MARKET_SUSPENDED", [
          { field: "legs[0].outcome_id", code: "SUSPENDED" },
          { field: "legs[7].outcome_id", code: "SUSPENDED" },
        ]),
        REQUEST,
      ),
    ).toEqual({ kind: "legs", refused: "suspended", outcomeIds: ["oc_ac_1"] });
    // Naming no leg it can find, it says the slip can't be a code.
    expect(slipCodeRefusal(problem(422, "BET_EVENT_STARTED"), REQUEST)).toEqual(
      { kind: "message", key: "terminal.code.cannot" },
    );
  });

  it("lets the status decide on a 401, a disallowed device, a closed shop or a missing key", () => {
    for (const error of [
      problem(401, "AUTH_INVALID_CREDENTIALS"),
      problem(401, "AUTH_TOKEN_EXPIRED"),
      problem(403, "RETAIL_DEVICE_NOT_ALLOWED"),
      new ApiError("No key", 0, "device_key_missing"),
    ]) {
      expect(slipCodeRefusal(error, REQUEST)).toEqual({
        kind: "status",
        key: "terminal.code.failed",
      });
    }
    // Whatever status the API gives it (request 015 proposes 403).
    for (const status of [403, 422, 409]) {
      expect(
        slipCodeRefusal(problem(status, "RETAIL_SHOP_CLOSED"), REQUEST),
      ).toEqual({ kind: "status", key: "terminal.closed.title" });
    }
  });

  it("says try again when the server can't be reached or fails, and the slip can't be a code for any other refusal", () => {
    for (const error of [
      new ApiError("Offline", 0, "network"),
      problem(503, "SERVICE_UNAVAILABLE"),
      new ContractError("/api/terminal/slip-codes", "bad"),
      new Error("boom"),
    ]) {
      expect(slipCodeRefusal(error, REQUEST)).toEqual({
        kind: "message",
        key: "terminal.code.failed",
      });
    }
    for (const error of [
      problem(422, "VALIDATION_FAILED"),
      problem(422, "BET_TOO_MANY_LEGS"),
      problem(400, "VALIDATION_FAILED"),
      problem(403, "PERMISSION_DENIED"),
    ]) {
      expect(slipCodeRefusal(error, REQUEST)).toEqual({
        kind: "message",
        key: "terminal.code.cannot",
      });
    }
  });
});

const TERMINAL: TerminalInfo = {
  id: "t",
  label: null,
  shop: { code: "ADM-004", name: "Adama", openNow: true },
  idleResetSeconds: 30,
  codeDisplaySeconds: 45,
};

describe("the kiosk's timings (F8cc AC-1, AC-6)", () => {
  it("uses the terminal's idle and display times, and C19's 90 s and 60 s without them", () => {
    expect(kioskTimings(TERMINAL)).toEqual({ idleMs: 30_000, codeMs: 45_000 });
    expect(
      kioskTimings({
        ...TERMINAL,
        idleResetSeconds: null,
        codeDisplaySeconds: 0,
      }),
    ).toEqual({ idleMs: 90_000, codeMs: 60_000 });
    expect(IDLE_RESET_SECONDS).toBe(90);
    expect(CODE_DISPLAY_SECONDS).toBe(60);
    expect(kioskTimings({ ...TERMINAL, idleResetSeconds: -5 }).idleMs).toBe(
      90_000,
    );
    // Never past what a timer can hold.
    expect(
      kioskTimings({ ...TERMINAL, idleResetSeconds: 10 ** 9 }).idleMs,
    ).toBe(2 ** 31 - 1);
  });

  it("pauses Get code for the Retry-After, and not without one", () => {
    expect(pausedUntil(240, 1_000)).toBe(241_000);
    expect(pausedUntil(0, 1_000)).toBeNull();
    expect(pausedUntil(null, 1_000)).toBeNull();
  });

  it("counts the wait in whole minutes, rounded up", () => {
    expect(minutesLeft(241_000, 1_000)).toBe(4);
    expect(minutesLeft(241_000, 1_001)).toBe(4);
    expect(minutesLeft(241_000, 181_000)).toBe(1);
    expect(minutesLeft(241_000, 240_999)).toBe(1);
  });
});
