import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateBetSlip,
  type BetSlipInput,
} from "@/features/bet-slip/lib/calculate";
import {
  keyFor,
  legUpdates,
  newIdempotencyKey,
  placeRequestFrom,
  placementOutcome,
  refusalOf,
} from "@/features/bet-slip/lib/placement";
import type {
  BetSelection,
  PlaceAttempt,
  PlaceBetRequest,
} from "@/features/bet-slip/types";
import { ApiError, ContractError } from "@/lib/api/errors";
import { GOLDEN_RULES } from "../golden";
import { responseExample } from "../contract";

const sel = (
  id: string,
  eventId: string,
  odds: string,
  extra: Partial<BetSelection> = {},
): BetSelection => ({
  outcomeId: id,
  eventId,
  marketId: `${eventId}:1x2:`,
  marketType: "1x2",
  line: null,
  outcomeCode: "1",
  eventName: { en: eventId, am: eventId },
  marketName: { en: "1X2", am: "1X2" },
  outcomeName: { en: "1", am: "1" },
  initialOdds: odds,
  currentOdds: odds,
  suspended: false,
  ...extra,
});

function requestFor(
  selections: BetSelection[],
  input: Partial<BetSlipInput> = {},
) {
  const slip: BetSlipInput = {
    selections,
    mode: "multiple",
    stake: "100",
    systemK: 2,
    rules: GOLDEN_RULES.default_2026_10,
    balance: null,
    oddsPolicy: "higher",
    ...input,
  };
  return placeRequestFrom({
    selections,
    totals: calculateBetSlip(slip),
    stake: slip.stake,
    oddsPolicy: slip.oddsPolicy,
  });
}

const THREE = [
  sel("oc_a", "m1", "1.62"),
  sel("oc_b", "m2", "3.05"),
  sel("oc_c", "m3", "1.38"),
];

const REQUEST: PlaceBetRequest = {
  betType: "multiple",
  systemSizes: [],
  legs: [
    { outcomeId: "oc_a", odds: "1.62" },
    { outcomeId: "oc_b", odds: "3.05" },
    { outcomeId: "oc_c", odds: "1.38" },
  ],
  stake: "100.00",
  oddsPolicy: "higher",
};

describe("placeRequestFrom", () => {
  it("asks for the picks at the odds on screen, the bet type, the total stake as typed and the policy (AC-6)", () => {
    expect(requestFor(THREE)).toEqual(REQUEST);
  });

  it("sends a system's size, the stake as typed rather than as charged, and the player's policy", () => {
    // 100 over three 2/3 lines charges 99.99 (D1.3); the engine is sent the
    // total and splits it the same way.
    expect(
      requestFor(THREE, { mode: "system", oddsPolicy: "none" }),
    ).toMatchObject({
      betType: "system",
      systemSizes: [2],
      stake: "100.00",
      oddsPolicy: "none",
    });
  });

  it("sends the price the player agreed to after accepting a move", () => {
    const moved = [sel("oc_a", "m1", "1.55", { initialOdds: "1.55" })];
    expect(requestFor(moved)?.legs).toEqual([
      { outcomeId: "oc_a", odds: "1.55" },
    ]);
    expect(requestFor(moved)?.betType).toBe("single");
  });

  it("is null until the slip can be placed: a clash, a suspended pick, a move to accept or no price", () => {
    expect(
      requestFor([sel("oc_a", "m1", "1.62"), sel("oc_b", "m1", "3.40")]),
    ).toBeNull();
    expect(
      requestFor([...THREE, sel("oc_d", "m4", "2.00", { suspended: true })]),
    ).toBeNull();
    expect(
      requestFor([sel("oc_a", "m1", "1.50", { initialOdds: "1.62" })]),
    ).toBeNull();
    expect(requestFor(THREE, { stake: "" })).toBeNull();
    expect(requestFor(THREE, { stake: "2" })).toBeNull();
    expect(requestFor(THREE, { rules: null })).toBeNull();
  });
});

describe("keyFor (AC-1)", () => {
  const attempt = (
    status: PlaceAttempt["status"],
    request = REQUEST,
  ): PlaceAttempt => ({ request, key: "key-1", status });
  const make = () => "key-new";

  it("reuses a key only for the same request after an attempt with no answer", () => {
    expect(keyFor(attempt("unanswered"), { ...REQUEST }, make)).toBe("key-1");
  });

  it("makes a new key for a first attempt, a changed request, or one still in flight", () => {
    expect(keyFor(null, REQUEST, make)).toBe("key-new");
    expect(
      keyFor(attempt("unanswered"), { ...REQUEST, stake: "50.00" }, make),
    ).toBe("key-new");
    expect(
      keyFor(
        attempt("unanswered"),
        {
          ...REQUEST,
          legs: [{ outcomeId: "oc_a", odds: "1.55" }, ...REQUEST.legs.slice(1)],
        },
        make,
      ),
    ).toBe("key-new");
    expect(keyFor(attempt("sending"), REQUEST, make)).toBe("key-new");
  });
});

describe("newIdempotencyKey", () => {
  const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  afterEach(() => vi.unstubAllGlobals());

  it("makes a v4 UUID, a new one each time", () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(UUID_V4);
    expect(newIdempotencyKey()).not.toBe(a);
  });

  it("still makes one on a plain-HTTP page, where there is no randomUUID", () => {
    // Insecure contexts (a phone on the LAN over http) get getRandomValues only.
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => real.getRandomValues(bytes),
    });
    expect(globalThis.crypto.randomUUID).toBeUndefined();
    expect(newIdempotencyKey()).toMatch(UUID_V4);
  });
});

describe("placementOutcome", () => {
  it("tells an attempt with no answer from a refusal and from a lost session", () => {
    expect(placementOutcome(new ApiError("offline", 0, "network"))).toBe(
      "unanswered",
    );
    expect(
      placementOutcome(new ApiError("down", 503, "SERVICE_UNAVAILABLE")),
    ).toBe("unanswered");
    expect(placementOutcome(new ApiError("gateway", 504, "http_error"))).toBe(
      "unanswered",
    );
    // A 201 this app could not read: the bet may well exist.
    expect(placementOutcome(new ContractError("/bets", "bad shape"))).toBe(
      "unanswered",
    );
    expect(placementOutcome(new SyntaxError("not JSON"))).toBe("unanswered");

    expect(
      placementOutcome(new ApiError("no", 503, "REAL_MONEY_DISABLED")),
    ).toBe("refused");
    expect(placementOutcome(new ApiError("no", 409, "BET_ODDS_CHANGED"))).toBe(
      "refused",
    );
    expect(placementOutcome(new ApiError("no", 429, "RATE_LIMITED"))).toBe(
      "refused",
    );
    expect(
      placementOutcome(new ApiError("gone", 401, "AUTH_TOKEN_EXPIRED")),
    ).toBe("session");
  });
});

describe("refusalOf and legUpdates", () => {
  const problem = (name: "odds_changed" | "event_started") =>
    responseExample("/v1/bets", "post", 409, name) as {
      title: string;
      code: string;
      detail?: string;
      errors: { field?: string; code: string; current?: string }[];
    };
  const refusal = (name: "odds_changed" | "event_started") => {
    const p = problem(name);
    return refusalOf(new ApiError(p.title, 409, p.code, p, p.errors));
  };

  it("keeps what the refusal said: the code, the API's title and detail, the fix", () => {
    expect(refusal("odds_changed")).toEqual({
      status: 409,
      code: "BET_ODDS_CHANGED",
      title: "Odds have changed",
      detail: "1 selection changed price.",
      errors: [
        { field: "legs[1].odds", code: "ODDS_CHANGED", current: "1.55" },
      ],
      retryAfter: null,
    });
  });

  it("maps legs[1] in a 409 to the pick sent second, with the price sent and the new one (AC-2)", () => {
    expect(legUpdates(refusal("odds_changed"), REQUEST)).toEqual({
      odds: [{ outcomeId: "oc_b", sent: "3.05", current: "1.55" }],
      closed: [],
    });
  });

  it("closes the pick a started match names", () => {
    expect(legUpdates(refusal("event_started"), REQUEST)).toEqual({
      odds: [],
      closed: ["oc_a"],
    });
  });

  it("leaves alone a leg it can't place, or a current price that isn't odds", () => {
    const odd = {
      ...refusal("odds_changed"),
      errors: [
        { field: "legs[9].odds", code: "ODDS_CHANGED", current: "1.55" },
        { field: "legs[0].odds", code: "ODDS_CHANGED", current: "lots" },
        { field: "legs[2].odds", code: "ODDS_CHANGED" },
        { code: "ODDS_CHANGED", current: "1.40" },
      ],
    };
    expect(legUpdates(odd, REQUEST)).toEqual({ odds: [], closed: [] });
  });

  it("changes nothing for a refusal that names no pick", () => {
    const stake = refusalOf(
      new ApiError("Stake too high", 422, "BET_STAKE_TOO_HIGH", null, [
        { field: "stake", code: "MAX", limit: "50.00" },
      ]),
    );
    expect(legUpdates(stake, REQUEST)).toEqual({ odds: [], closed: [] });
  });
});
