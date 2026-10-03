import { describe, expect, it } from "vitest";
import type { PlaceBetRequest } from "@/features/bet-slip/types";
import { toBetReceipt, toPlaceBetRequest } from "@/lib/api/mappers/bets";
import type { components } from "@/lib/api/schema";
import { betReceiptSchema, placeBetRequestSchema } from "@/lib/api/schemas";
import { requestExample, responseExample } from "../contract";

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
