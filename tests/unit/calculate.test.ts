import { describe, expect, it } from "vitest";
import {
  calculateBetSlip,
  resolveCta,
  settleBet,
  systemOptions,
  type BetSlipInput,
  type TaxRates,
} from "@/features/bet-slip/lib/calculate";
import {
  binomial,
  combinationProducts,
} from "@/features/bet-slip/lib/combinations";
import type { BetSelection, BetSlipMode } from "@/features/bet-slip/types";

const rates: TaxRates = {
  stakeTax: 0.15,
  winTax: 0.15,
  maxWinPerTicket: 1_000_000,
};

const sel = (
  uid: string,
  eventId: string,
  odds: number,
  extra: Partial<BetSelection> = {},
): BetSelection => ({
  uid,
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
    stake: 100,
    systemK: 2,
    rates,
    balance: 1250,
    acceptedUids: new Set<string>(),
    acceptAllOddsChanges: false,
    ...overrides,
  });

/** The design's default slip: Man City 1.62, Saint George X 3.05, Barça 1.38. */
const designDefault = [
  sel("m3#1x2||1", "m3", 1.62),
  sel("m4#1x2||X", "m4", 3.05),
  sel("m6#1x2||1", "m6", 1.38),
];

describe("combinatorics", () => {
  it("returns one product per k-subset, in lexicographic order", () => {
    expect(combinationProducts([2, 3, 5], 2)).toEqual([6, 10, 15]);
    expect(combinationProducts([2, 3, 5], 3)).toEqual([30]);
    expect(combinationProducts([2, 3, 5], 1)).toEqual([2, 3, 5]);
  });

  it("is empty when k is out of range", () => {
    expect(combinationProducts([2, 3], 0)).toEqual([]);
    expect(combinationProducts([2, 3], 3)).toEqual([]);
  });

  it("counts combinations", () => {
    expect(binomial(4, 2)).toBe(6);
    expect(binomial(5, 3)).toBe(10);
    expect(binomial(3, 4)).toBe(0);
  });
});

describe("calculateBetSlip — empty", () => {
  it("is all zeros with no selections", () => {
    const t = run([]);
    expect(t.count).toBe(0);
    expect(t.totalStake).toBe(0);
    expect(t.grossReturn).toBe(0);
    expect(t.payout).toBe(0);
    expect(t.capped).toBe(false);
    expect(t.insufficientBalance).toBe(false);
  });
});

describe("calculateBetSlip — multiple", () => {
  it("prices a single leg: 100 at 1.62 pays 132.05", () => {
    const t = run([sel("a", "m1", 1.62)]);
    expect(t.totalStake).toBe(100);
    expect(t.stakeTax).toBeCloseTo(15, 10);
    expect(t.netStake).toBeCloseTo(85, 10);
    expect(t.grossReturn).toBeCloseTo(137.7, 10);
    expect(t.winTax).toBeCloseTo(5.655, 10);
    expect(t.payout).toBeCloseTo(132.045, 10);
  });

  it("matches the design's reference slip at 507.64", () => {
    const t = run(designDefault);
    expect(t.totalOdds).toBeCloseTo(6.81858, 10);
    expect(t.totalStake).toBe(100);
    expect(t.grossReturn).toBeCloseTo(579.5793, 10);
    expect(t.payout).toBeCloseTo(507.642405, 6);
    // What the slip actually renders.
    expect(t.payout.toFixed(2)).toBe("507.64");
  });

  it("stakes once regardless of leg count", () => {
    expect(run(designDefault).totalStake).toBe(100);
  });
});

describe("calculateBetSlip — single", () => {
  it("stakes each leg separately and sums the returns", () => {
    const t = run(designDefault, { mode: "single" });
    expect(t.mode).toBe("single");
    expect(t.totalStake).toBe(300);
    expect(t.stakeTax).toBeCloseTo(45, 10);
    // 85 × (1.62 + 3.05 + 1.38)
    expect(t.grossReturn).toBeCloseTo(514.25, 10);
    expect(t.winTax).toBeCloseTo(32.1375, 10);
    expect(t.payout).toBeCloseTo(482.1125, 10);
  });

  it("reports a per-selection return for the row hint", () => {
    const t = run(designDefault, { mode: "single" });
    expect(t.returnByUid["m3#1x2||1"]).toBeCloseTo(137.7, 10);
    expect(t.returnByUid["m4#1x2||X"]).toBeCloseTo(259.25, 10);
  });
});

describe("calculateBetSlip — system", () => {
  it("places every 2-fold combination as its own bet", () => {
    const t = run(designDefault, { mode: "system", systemK: 2 });
    expect(t.mode).toBe("system");
    expect(t.combinationCount).toBe(3);
    expect(t.totalStake).toBe(300);
    // 85 × (1.62·3.05 + 1.62·1.38 + 3.05·1.38)
    expect(t.grossReturn).toBeCloseTo(967.776, 6);
    expect(t.payout).toBeCloseTo(867.6096, 6);
  });

  it("falls back to multiple below three live selections", () => {
    const t = run(designDefault.slice(0, 2), { mode: "system" });
    expect(t.systemAvailable).toBe(false);
    expect(t.mode).toBe("multiple");
  });

  it("clamps k so a system is never the full accumulator", () => {
    expect(run(designDefault, { mode: "system", systemK: 9 }).systemK).toBe(2);
    expect(run(designDefault, { mode: "system", systemK: 0 }).systemK).toBe(2);
  });

  it("offers each usable system size with its bet count", () => {
    expect(systemOptions(4)).toEqual([
      { k: 2, label: "2/4", betCount: 6 },
      { k: 3, label: "3/4", betCount: 4 },
    ]);
    expect(systemOptions(2)).toEqual([]);
  });
});

describe("calculateBetSlip — suspended selections", () => {
  const withSuspended = [
    sel("a", "m1", 1.62),
    sel("b", "m2", 2.0, { suspended: true }),
  ];

  it("keeps them in the count but out of the price", () => {
    const t = run(withSuspended);
    expect(t.count).toBe(2);
    expect(t.liveCount).toBe(1);
    expect(t.totalOdds).toBeCloseTo(1.62, 10);
    expect(t.suspendedSelection?.uid).toBe("b");
  });

  it("pays nothing when every leg is suspended", () => {
    const t = run([sel("b", "m2", 2.0, { suspended: true })]);
    expect(t.grossReturn).toBe(0);
    expect(t.payout).toBe(0);
  });
});

describe("calculateBetSlip — max win cap", () => {
  const capped: TaxRates = { ...rates, maxWinPerTicket: 1000 };

  it("caps a multiple before winnings tax", () => {
    const t = run([sel("a", "m1", 50)], { rates: capped });
    expect(t.capped).toBe(true);
    expect(t.grossReturn).toBe(1000);
    expect(t.winTax).toBeCloseTo(135, 10); // (1000 − 100) × 0.15
    expect(t.payout).toBeCloseTo(865, 10);
  });

  it("caps each single independently", () => {
    const t = run([sel("a", "m1", 50), sel("b", "m2", 2)], {
      mode: "single",
      rates: capped,
    });
    expect(t.capped).toBe(true);
    expect(t.grossReturn).toBeCloseTo(1170, 10); // 1000 + 85×2
  });

  it("leaves ordinary prices untouched", () => {
    expect(run(designDefault).capped).toBe(false);
  });
});

describe("calculateBetSlip — same-match conflicts", () => {
  const sameMatch = [
    sel("m3#1x2||1", "m3", 1.62),
    sel("m3#ou|2.5|Over", "m3", 1.72, { marketType: "ou", line: "2.5" }),
    sel("m6#1x2||1", "m6", 1.38),
  ];

  it("flags two picks from one match in a multiple", () => {
    const t = run(sameMatch);
    expect(t.hasConflict).toBe(true);
    expect(t.conflictEventIds).toEqual(["m3"]);
  });

  it("allows them as singles", () => {
    const t = run(sameMatch, { mode: "single" });
    expect(t.hasConflict).toBe(false);
    expect(t.conflictEventIds).toEqual([]);
  });
});

describe("calculateBetSlip — odds movement", () => {
  const moved = [
    sel("a", "m1", 1.62),
    sel("b", "m2", 3.05, { initialOdds: 2.95 }),
  ];

  it("reports unaccepted moves", () => {
    expect(run(moved).pendingOddsChanges.map((s) => s.uid)).toEqual(["b"]);
  });

  it("clears a move the user accepted individually", () => {
    const t = run(moved, { acceptedUids: new Set(["b"]) });
    expect(t.pendingOddsChanges).toEqual([]);
  });

  it("clears every move when accept-all is on", () => {
    const t = run(moved, { acceptAllOddsChanges: true });
    expect(t.pendingOddsChanges).toEqual([]);
  });

  it("always prices at the current odds", () => {
    expect(run(moved).totalOdds).toBeCloseTo(1.62 * 3.05, 10);
  });
});

describe("calculateBetSlip — balance", () => {
  it("flags a stake above the balance", () => {
    expect(run(designDefault, { stake: 2000 }).insufficientBalance).toBe(true);
  });

  it("skips the check for a guest", () => {
    const t = run(designDefault, { stake: 2000, balance: null });
    expect(t.insufficientBalance).toBe(false);
  });

  it("counts every single when checking affordability", () => {
    // 3 × 500 = 1500 > 1250, even though one bet alone is affordable.
    const t = run(designDefault, { mode: "single", stake: 500 });
    expect(t.totalStake).toBe(1500);
    expect(t.insufficientBalance).toBe(true);
  });
});

describe("resolveCta", () => {
  const cta = (selections: BetSelection[], o: Partial<BetSlipInput> = {}) =>
    resolveCta(run(selections, o), false);

  it("places a clean slip", () => {
    expect(cta(designDefault)).toEqual({ action: "place", disabled: false });
  });

  it("disables on a same-match conflict", () => {
    const conflict = [sel("a", "m3", 1.6), sel("b", "m3", 1.7)];
    expect(cta(conflict)).toEqual({
      action: "blocked-conflict",
      disabled: true,
    });
  });

  it("prioritises a conflict over a suspension", () => {
    const both = [
      sel("a", "m3", 1.6),
      sel("b", "m3", 1.7),
      sel("c", "m9", 2, { suspended: true }),
    ];
    expect(cta(both).action).toBe("blocked-conflict");
  });

  it("asks to drop a suspended pick", () => {
    const s = [sel("a", "m1", 1.6), sel("b", "m2", 2, { suspended: true })];
    expect(cta(s)).toEqual({ action: "remove-suspended", disabled: false });
  });

  it("asks to accept a move before placing", () => {
    const moved = [sel("a", "m1", 1.62, { initialOdds: 1.5 })];
    expect(cta(moved).action).toBe("accept-changes");
  });

  it("sends the user to deposit when short", () => {
    expect(cta(designDefault, { stake: 2000 }).action).toBe("deposit");
  });

  it("asks a guest to log in", () => {
    expect(resolveCta(run(designDefault), true)).toEqual({
      action: "login",
      disabled: false,
    });
  });

  it("disables an empty slip", () => {
    expect(cta([])).toEqual({ action: "place", disabled: true });
  });
});

describe("mode fallback is reported, not silently applied", () => {
  it("returns the effective mode so the UI can reflect it", () => {
    const modes: BetSlipMode[] = ["single", "multiple", "system"];
    for (const mode of modes) {
      const t = run([sel("a", "m1", 1.6)], { mode });
      expect(t.mode).toBe(mode === "system" ? "multiple" : mode);
    }
  });
});

describe("stakePerBet", () => {
  it("reports the stake the user typed, not a derived figure", () => {
    expect(run(designDefault, { stake: 250 }).stakePerBet).toBe(250);
    expect(run(designDefault, { mode: "single", stake: 250 }).stakePerBet).toBe(
      250,
    );
  });

  it("survives an empty slip, where dividing the total would give zero", () => {
    const t = run([], { stake: 250 });
    expect(t.totalStake).toBe(0);
    expect(t.stakePerBet).toBe(250);
  });
});

describe("settleBet", () => {
  it("matches what the slip computes for the same bet", () => {
    const slip = run(designDefault);
    const ticket = settleBet(slip.totalStake, slip.totalOdds, rates);

    expect(ticket.stakeTax).toBeCloseTo(slip.stakeTax, 10);
    expect(ticket.netStake).toBeCloseTo(slip.netStake, 10);
    expect(ticket.grossReturn).toBeCloseTo(slip.grossReturn, 10);
    expect(ticket.winTax).toBeCloseTo(slip.winTax, 10);
    expect(ticket.payout).toBeCloseTo(slip.payout, 10);
    expect(ticket.payout.toFixed(2)).toBe("507.64");
  });

  it("applies the cap before winnings tax", () => {
    const figures = settleBet(100, 50, { ...rates, maxWinPerTicket: 1000 });
    expect(figures.capped).toBe(true);
    expect(figures.grossReturn).toBe(1000);
    expect(figures.winTax).toBeCloseTo(135, 10);
    expect(figures.payout).toBeCloseTo(865, 10);
  });

  it("charges no winnings tax on a bet that did not gain", () => {
    // 85 × 1.10 = 93.50, less than the 100 staked.
    const figures = settleBet(100, 1.1, rates);
    expect(figures.winTax).toBe(0);
    expect(figures.payout).toBeCloseTo(93.5, 10);
  });
});
