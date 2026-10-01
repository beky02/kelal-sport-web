import { describe, expect, it } from "vitest";
import {
  calculateBetSlip,
  resolveCta,
  settleBet,
  systemOptions,
  type BetSlipInput,
} from "@/features/bet-slip/lib/calculate";
import { binomial } from "@/features/bet-slip/lib/combinations";
import {
  sanitiseStake,
  useBetSlipStore,
} from "@/features/bet-slip/stores/bet-slip.store";
import type { BetSelection } from "@/features/bet-slip/types";
import { GOLDEN_RULES } from "../golden";

/** The contract's example rule set (= golden `default_2026_10`). */
const rules = GOLDEN_RULES.default_2026_10;

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
  eventName: { en: "Home – Away", am: "Home – Away" },
  marketName: { en: "Match result", am: "የጨዋታ ውጤት" },
  outcomeName: { en: "Home", am: "Home" },
  initialOdds: odds,
  currentOdds: odds,
  suspended: false,
  ...extra,
});

const run = (
  selections: BetSelection[],
  overrides: Partial<BetSlipInput> = {},
) =>
  calculateBetSlip({
    selections,
    mode: "multiple",
    stake: "100",
    systemK: 2,
    rules,
    balance: "1250.00",
    acceptedIds: new Set<string>(),
    acceptAllOddsChanges: false,
    ...overrides,
  });

/** The design's default slip: Man City 1.62, Saint George X 3.05, Barça 1.38. */
const designDefault = [
  sel("a", "m3", "1.62"),
  sel("b", "m4", "3.05"),
  sel("c", "m6", "1.38"),
];

/** Fifteen legs on fifteen matches, for the limits. */
const many = (n: number) =>
  Array.from({ length: n }, (_, i) => sel(`l${i}`, `e${i}`, "1.50"));

describe("binomial", () => {
  it("counts combinations exactly", () => {
    expect(binomial(4, 2)).toBe(6);
    expect(binomial(15, 5)).toBe(3003);
    expect(binomial(3, 4)).toBe(0);
  });
});

describe("calculateBetSlip — what slipcalc is asked", () => {
  it("has no quote with no selections", () => {
    const t = run([]);
    expect(t.count).toBe(0);
    expect(t.quote).toBeNull();
    expect(t.problem).toBeNull();
  });

  it("asks nothing while the stake is empty or zero", () => {
    expect(run(designDefault, { stake: "" }).quote).toBeNull();
    expect(run(designDefault, { stake: "0" }).problem).toBeNull();
  });

  it("prices a stake being typed (`12.`) as 12", () => {
    expect(run(designDefault, { stake: "12." }).quote?.totalStake).toBe(
      "12.00",
    );
  });

  it("has no quote until the rule set arrives — never a guessed one", () => {
    const t = run(designDefault, { rules: null });
    expect(t.quote).toBeNull();
    expect(t.problem).toBeNull();
  });
});

describe("calculateBetSlip — multiple (D1)", () => {
  /**
   * 1.62 × 3.05 × 1.38 = 6.818580. Stake 100: stake tax 15% = 15.00, net
   * 85.00. Gross floor(85 × 6.81858) = floor(579.5793) = 579.57. Three legs at
   * ≥ 1.30 earn the 3% tier: floor((579.57 − 85.00) × 3%) = floor(14.8371) =
   * 14.83. 594.40 is under the 1,000.00 win-tax threshold: net payout 594.40.
   * (507.64 under the old float maths, which taxed winnings and had no bonus.)
   */
  it("prices the design's reference slip at D1's 594.40", () => {
    const q = run(designDefault).quote!;
    expect(q.totalStake).toBe("100.00");
    expect(q.stakeTax).toBe("15.00");
    expect(q.netStake).toBe("85.00");
    expect(q.totalOdds).toBe("6.81");
    expect(q.grossPayout).toBe("579.57");
    expect(q.accaBonus).toBe("14.83");
    expect(q.winTax).toBe("0.00");
    expect(q.netPayout).toBe("594.40");
  });

  it("prices one live pick as a single, whatever the tab says", () => {
    // 85.00 × 1.62 = 137.70; a single earns no bonus.
    const t = run([sel("a", "m1", "1.62")]);
    expect(t.lineCount).toBe(1);
    expect(t.quote?.netPayout).toBe("137.70");
  });
});

describe("calculateBetSlip — singles and systems split the total stake", () => {
  const golden = [
    sel("a", "m1", "1.50"),
    sel("b", "m2", "2.00"),
    sel("c", "m3", "3.25"),
  ];

  it("splits 100 across three singles as 33.33 each and charges 99.99", () => {
    // Golden row SINGLE_REMAINDER.
    const q = run(golden, { mode: "single" }).quote!;
    expect(q.lines).toBe(3);
    expect(q.stakePerLine).toBe("33.33");
    expect(q.totalStake).toBe("99.99");
    expect(q.netPayout).toBe("191.29");
    expect(q.warnings).toEqual(["STAKE_REMAINDER_NOT_CHARGED"]);
  });

  it("places every 2-fold of a 2/3 system as its own line", () => {
    const t = run(designDefault, { mode: "system", systemK: 2 });
    expect(t.lineCount).toBe(3);
    expect(t.quote).toMatchObject({
      lines: 3,
      stakePerLine: "33.33",
      totalStake: "99.99",
      totalOdds: null,
      netPayout: "322.65",
    });
  });

  it("sets the total stake, not the per-line stake, from a quick stake", () => {
    useBetSlipStore.getState().setStake("100");
    const t = run(designDefault, {
      mode: "system",
      systemK: 2,
      stake: useBetSlipStore.getState().stake,
    });
    expect(t.quote?.totalStake).toBe("99.99");
    expect(t.quote?.warnings).toContain("STAKE_REMAINDER_NOT_CHARGED");
  });

  it("falls back to multiple below three live selections", () => {
    const t = run(designDefault.slice(0, 2), { mode: "system" });
    expect(t.mode).toBe("multiple");
    expect(t.systemAvailable).toBe(false);
  });

  it("clamps k so a system is never the full accumulator", () => {
    expect(run(designDefault, { mode: "system", systemK: 3 }).systemK).toBe(2);
  });

  it("offers each usable system size with its bet count", () => {
    expect(systemOptions(4)).toEqual([
      { k: 2, label: "2/4", betCount: 6 },
      { k: 3, label: "3/4", betCount: 4 },
    ]);
  });
});

describe("calculateBetSlip — refusals carry their fix", () => {
  it("offers the minimum total stake", () => {
    expect(run(designDefault, { stake: "2" }).problem).toEqual({
      code: "BET_STAKE_TOO_LOW",
      stake: "5.00",
    });
  });

  it("offers a minimum that still clears it once split across lines", () => {
    // 5.00 over 3 lines charges 1.66 × 3 = 4.98 — under the minimum again.
    // 5.01 charges 1.67 × 3 = 5.01.
    const singles = run(designDefault, { mode: "single", stake: "2" });
    expect(singles.problem).toEqual({
      code: "BET_STAKE_TOO_LOW",
      stake: "5.01",
    });
    const fixed = run(designDefault, { mode: "single", stake: "5.01" });
    expect(fixed.problem).toBeNull();
    expect(fixed.quote?.totalStake).toBe("5.01");
    expect(
      run(designDefault, { mode: "system", systemK: 2, stake: "2" }).problem,
    ).toEqual({ code: "BET_STAKE_TOO_LOW", stake: "5.01" });
  });

  it("offers a santim per line when that is more than the minimum", () => {
    // 6/12 is 924 lines: 5.00 leaves each line under a santim.
    const t = run(many(12), { mode: "system", systemK: 6, stake: "5" });
    expect(t.problem).toEqual({ code: "BET_STAKE_TOO_LOW", stake: "9.24" });
  });

  it("offers the maximum total stake", () => {
    expect(run(designDefault, { stake: "60000" }).problem).toEqual({
      code: "BET_STAKE_TOO_HIGH",
      stake: "50000.00",
    });
  });

  it("states the leg limit", () => {
    expect(run(many(31)).problem).toEqual({
      code: "BET_TOO_MANY_LEGS",
      limit: 30,
    });
  });

  it("states the line limit", () => {
    // 5/15 is 3,003 lines, over the 1,024 allowed.
    expect(run(many(15), { mode: "system", systemK: 5 }).problem).toEqual({
      code: "BET_TOO_MANY_LINES",
      limit: 1024,
    });
  });

  it("refuses odds below 1.01 instead of pricing them", () => {
    expect(
      run([sel("a", "m1", "1.00"), sel("b", "m2", "2.00")]).problem,
    ).toEqual({ code: "VALIDATION_FAILED" });
  });
});

describe("calculateBetSlip — D1 warnings", () => {
  it("caps the payout before tax and says so", () => {
    const q = run(
      ["a", "b", "c", "d"].map((id) => sel(id, `m${id}`, "50.00")),
      { stake: "1000" },
    ).quote!;
    expect(q.capped).toBe(true);
    expect(q.warnings).toContain("MAX_PAYOUT_REACHED");
  });
});

describe("calculateBetSlip — suspended selections", () => {
  const withSuspended = [
    sel("a", "m1", "1.62"),
    sel("b", "m2", "3.05", { suspended: true }),
  ];

  it("keeps them in the count but out of the price", () => {
    const t = run(withSuspended);
    expect(t.count).toBe(2);
    expect(t.liveCount).toBe(1);
    expect(t.quote?.totalOdds).toBe("1.62");
    expect(t.suspendedSelection?.outcomeId).toBe("b");
  });

  it("has no quote when every leg is suspended", () => {
    expect(run([sel("a", "m1", "1.62", { suspended: true })]).quote).toBeNull();
  });
});

describe("calculateBetSlip — same-match conflicts", () => {
  const sameMatch = [
    sel("a", "m3", "1.62"),
    sel("b", "m3", "1.72", { marketType: "ou", line: "2.5" }),
  ];

  it("flags two picks from one match in a multiple", () => {
    expect(run(sameMatch).conflictEventIds).toEqual(["m3"]);
  });

  it("allows them as singles", () => {
    expect(run(sameMatch, { mode: "single" }).hasConflict).toBe(false);
  });
});

describe("calculateBetSlip — odds movement", () => {
  const moved = [
    sel("a", "m1", "1.62"),
    sel("b", "m2", "3.40", { initialOdds: "3.05" }),
  ];

  it("reports unaccepted moves", () => {
    expect(run(moved).pendingOddsChanges.map((s) => s.outcomeId)).toEqual([
      "b",
    ]);
  });

  it("does not count a respelled price as a move", () => {
    const respelled = [sel("a", "m1", "2.10", { initialOdds: "2.1" })];
    expect(run(respelled).pendingOddsChanges).toEqual([]);
  });

  it("clears a move the user accepted individually", () => {
    expect(
      run(moved, { acceptedIds: new Set(["b"]) }).pendingOddsChanges,
    ).toEqual([]);
  });

  it("clears every move when accept-all is on", () => {
    expect(
      run(moved, { acceptAllOddsChanges: true }).pendingOddsChanges,
    ).toEqual([]);
  });

  it("always prices at the current odds", () => {
    // 1.62 × 3.40 = 5.508
    expect(run(moved).quote?.totalOdds).toBe("5.50");
  });
});

describe("calculateBetSlip — balance", () => {
  it("flags a total stake above the balance", () => {
    expect(run(designDefault, { balance: "50.00" }).insufficientBalance).toBe(
      true,
    );
  });

  it("compares the stake actually charged (99.99), not the one typed", () => {
    expect(
      run(designDefault, { mode: "system", balance: "99.99" })
        .insufficientBalance,
    ).toBe(false);
  });

  it("skips the check for a guest", () => {
    expect(run(designDefault, { balance: null }).insufficientBalance).toBe(
      false,
    );
  });
});

describe("resolveCta", () => {
  const cta = (
    input: Partial<BetSlipInput>,
    guest = false,
    selections = designDefault,
  ) => resolveCta(run(selections, input), guest);

  it("places a clean slip", () => {
    expect(cta({})).toEqual({ action: "place", disabled: false });
  });

  it("disables on a same-match conflict", () => {
    expect(
      cta({}, false, [sel("a", "m3", "1.62"), sel("b", "m3", "2.00")]),
    ).toEqual({ action: "blocked-conflict", disabled: true });
  });

  it("asks to drop a suspended pick", () => {
    expect(
      cta({}, false, [
        ...designDefault,
        sel("d", "m9", "2.00", { suspended: true }),
      ]).action,
    ).toBe("remove-suspended");
  });

  it("asks to accept a move before placing", () => {
    expect(
      cta({}, false, [
        sel("a", "m1", "2.00", { initialOdds: "1.90" }),
        sel("b", "m2", "2.00"),
      ]).action,
    ).toBe("accept-changes");
  });

  it("cannot place without a quote — no rules, no stake, or a refused stake", () => {
    expect(cta({ rules: null })).toEqual({ action: "place", disabled: true });
    expect(cta({ stake: "" })).toEqual({ action: "place", disabled: true });
    expect(cta({ stake: "2" })).toEqual({ action: "place", disabled: true });
  });

  it("sends the user to deposit when short", () => {
    expect(cta({ balance: "10.00" }).action).toBe("deposit");
  });

  it("asks a guest to log in", () => {
    expect(cta({}, true)).toEqual({ action: "login", disabled: false });
  });
});

describe("sanitiseStake", () => {
  it("keeps digits and up to two decimals", () => {
    expect(sanitiseStake("0012.345x")).toBe("12.34");
    expect(sanitiseStake("1,000")).toBe("1000");
    expect(sanitiseStake(".5")).toBe("0.5");
    expect(sanitiseStake("")).toBe("");
  });
});

describe("settleBet", () => {
  it("matches what the slip computes for the same open bet", () => {
    const settled = settleBet(
      "multiple",
      [
        { odds: "1.62", result: "open" },
        { odds: "3.05", result: "open" },
        { odds: "1.38", result: "open" },
      ],
      "100.00",
      rules,
    );
    expect(settled.ok && settled.quote).toEqual(run(designDefault).quote);
  });

  it("settles when every leg has a result: a lost leg pays nothing", () => {
    const settled = settleBet(
      "multiple",
      [
        { odds: "1.62", result: "win" },
        { odds: "3.05", result: "lose" },
      ],
      "100.00",
      rules,
    );
    expect(settled.ok && settled.quote.netPayout).toBe("0.00");
  });
});
