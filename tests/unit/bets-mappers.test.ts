import { describe, expect, it } from "vitest";
import type { PlaceBetRequest } from "@/features/bet-slip/types";
import {
  toBet,
  toBetPage,
  toBetReceipt,
  toPlaceBetRequest,
} from "@/lib/api/mappers/bets";
import type { components } from "@/lib/api/schema";
import {
  betPageSchema,
  betReceiptSchema,
  placeBetRequestSchema,
} from "@/lib/api/schemas";
import { example, requestExample, responseExample } from "../contract";
import { GOLDEN_ROWS } from "../golden";

type PlacedBet = components["schemas"]["PlacedBet"];

const placed = () =>
  responseExample("/v1/bets", "post", 201) as unknown as PlacedBet;

/** The contract's request example, as the slip asks `/api/bets` for it. */
const REQUEST: PlaceBetRequest = {
  betType: "multiple",
  systemSizes: [],
  legs: [
    { outcomeId: "oc_ac_1", odds: "2.10" },
    { outcomeId: "oc_rb_o25", odds: "1.62" },
  ],
  stake: "100.00",
  oddsPolicy: "higher",
};

describe("toPlaceBetRequest", () => {
  it("sends the contract's own request example, bonus money and free bets off", () => {
    expect(placeBetRequestSchema.parse(REQUEST)).toEqual(REQUEST);
    expect(toPlaceBetRequest(REQUEST)).toEqual(
      requestExample("/v1/bets", "post"),
    );
  });

  it("sends a system's sizes, and none for any other bet", () => {
    const system: PlaceBetRequest = {
      ...REQUEST,
      betType: "system",
      systemSizes: [2],
      legs: [...REQUEST.legs, { outcomeId: "oc_sg_1", odds: "1.95" }],
    };
    expect(toPlaceBetRequest(system)).toMatchObject({
      bet_type: "system",
      system_sizes: [2],
    });
    expect(toPlaceBetRequest(REQUEST)).not.toHaveProperty("system_sizes");
  });
});

describe("toBetReceipt (AC-3)", () => {
  it("maps the contract's PlacedBet example without touching a figure", () => {
    expect(toBetReceipt(placed())).toEqual({
      id: "01J9A7V0000000000000000001",
      ticketId: "K7Q2-M9XP-M",
      placedAt: "2026-10-03T14:05:22Z",
      betType: "multiple",
      systemSizes: [],
      lines: 1,
      legCount: 2,
      stake: "100.00",
      stakeTax: "15.00",
      totalOdds: "3.40",
      accaBonus: "0.00",
      potentialPayout: "289.17",
    });
  });

  it("keeps a multi-line ticket's total odds empty, as the API sends them", () => {
    const singles = { ...placed(), bet_type: "single", lines: 2 } as PlacedBet;
    singles.total_odds = null;
    expect(toBetReceipt(singles).totalOdds).toBeNull();
  });

  it("produces what the browser's schema accepts, and nothing about the balance", () => {
    const receipt = betReceiptSchema.parse(toBetReceipt(placed()));
    expect(JSON.stringify(receipt)).not.toContain("919.78");
  });
});

type ApiBet = components["schemas"]["Bet"];

/** The contract's own `GET /v1/bets/{id}` example, with Amharic names. */
const inAmharic = (bet: ApiBet): ApiBet => ({
  ...bet,
  legs: bet.legs.map((leg) => ({
    ...leg,
    fixture_name: `${leg.fixture_name} (am)`,
    market_name: `${leg.market_name} (am)`,
    outcome_name: `${leg.outcome_name} (am)`,
  })),
});

describe("toBet (AC-3)", () => {
  it("maps the contract's Bet example without touching a figure, names in both languages", () => {
    const en = example("/v1/bets/{id}");
    expect(toBet({ en, am: inAmharic(en) })).toEqual({
      id: "01J9A7V0000000000000000001",
      ticketId: "K7Q2-M9XP-M",
      status: "won",
      betType: "multiple",
      systemSizes: [],
      lines: 1,
      stake: "100.00",
      stakeBonus: "0.00",
      stakeTax: "15.00",
      totalOdds: "3.40",
      potentialPayout: "289.17",
      accaBonus: "0.00",
      payout: "289.17",
      winTax: "0.00",
      placedAt: "2026-10-03T14:05:22Z",
      settledAt: "2026-10-04T21:02:00Z",
      legs: [
        {
          outcomeId: "oc_ac_1",
          fixtureId: "fx_arsenal_chelsea",
          match: { en: "Arsenal v Chelsea", am: "Arsenal v Chelsea (am)" },
          market: { en: "1X2", am: "1X2 (am)" },
          pick: { en: "1", am: "1 (am)" },
          startTime: "2026-10-04T14:00:00Z",
          odds: "2.10",
          result: "win",
        },
        {
          outcomeId: "oc_rb_o25",
          fixtureId: "fx_real_barca",
          match: {
            en: "Real Madrid v Barcelona",
            am: "Real Madrid v Barcelona (am)",
          },
          market: { en: "Total 2.5", am: "Total 2.5 (am)" },
          pick: { en: "Over 2.5", am: "Over 2.5 (am)" },
          startTime: "2026-10-04T19:00:00Z",
          odds: "1.62",
          result: "win",
        },
      ],
    });
  });

  it("keeps a figure the API didn't send empty, never zero", () => {
    const bet = example("/v1/bets/{id}");
    delete bet.stake_bonus;
    delete bet.total_odds;
    delete bet.payout;
    delete bet.win_tax;
    delete bet.settled_at;
    delete bet.system_sizes;
    expect(toBet({ en: bet, am: bet })).toMatchObject({
      stakeBonus: null,
      totalOdds: null,
      payout: null,
      winTax: null,
      settledAt: null,
      systemSizes: [],
    });
  });

  it("matches legs by outcome, not by position", () => {
    const en = example("/v1/bets/{id}");
    const am = inAmharic(en);
    am.legs.reverse();
    const [first] = toBet({ en, am }).legs;
    expect(first.match).toEqual({
      en: "Arsenal v Chelsea",
      am: "Arsenal v Chelsea (am)",
    });
  });
});

describe("toBetPage (AC-5)", () => {
  it("maps the contract's page with its cursor, in the API's order", () => {
    const en = example("/v1/bets");
    en.next_cursor = "c2";
    const page = toBetPage({ en, am: en });
    expect(page.nextCursor).toBe("c2");
    expect(page.items.map((bet) => bet.ticketId)).toEqual([
      "M3HX-7PQA-V",
      "K7Q2-M9XP-M",
    ]);
    expect(page.items[0]).toMatchObject({
      status: "open",
      potentialPayout: "82.87",
      payout: null,
      winTax: null,
    });
  });

  it("takes each bet's Amharic names by id, and keeps the English for one the other read missed", () => {
    const en = example("/v1/bets");
    const am = example("/v1/bets");
    // A bet placed between the two reads shifts the Amharic page by one.
    am.items = [inAmharic(am.items[1])];
    const [open, won] = toBetPage({ en, am }).items;
    expect(open.legs[0].match).toEqual({
      en: "Saint George v Fasil Kenema",
      am: "Saint George v Fasil Kenema",
    });
    expect(won.legs[0].match.am).toBe("Arsenal v Chelsea (am)");
  });

  it("produces what the browser's schema accepts", () => {
    const page = toBetPage({
      en: example("/v1/bets"),
      am: example("/v1/bets"),
    });
    expect(betPageSchema.parse(page)).toEqual(page);
  });

  it("accepts every accumulator's total odds the engine can produce, the biggest included (M1)", () => {
    // D1.11 floors the product of the odds: eight legs at 9.00 make
    // 43046721.00 (golden CAP_DEFAULT_HUGE_ODDS), beyond the per-leg Odds
    // pattern's six digits. One such ticket must not take My bets down.
    const huge = GOLDEN_ROWS.find(
      (row) => row.case_id === "CAP_DEFAULT_HUGE_ODDS",
    )!;
    const totals = GOLDEN_ROWS.map((row) => row.total_odds).filter(Boolean);
    expect(totals).toContain(huge.total_odds);
    for (const total_odds of totals) {
      const raw = { ...example("/v1/bets/{id}"), total_odds };
      const page = toBetPage({
        en: { items: [raw], next_cursor: null },
        am: { items: [raw], next_cursor: null },
      });
      expect(betPageSchema.safeParse(page).success, total_odds).toBe(true);
    }
  });
});
