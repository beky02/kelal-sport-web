import { describe, expect, it } from "vitest";
import { betFigures, payoutView } from "@/features/bets/lib/figures";
import type { Bet } from "@/features/bets/types";
import { BETS, WON_TICKET_WINNINGS } from "@/lib/api/mock/bets";
import { toBettingRules } from "@/lib/api/mappers/config";
import { example } from "../contract";

const rules = toBettingRules(example("/v1/config/public").betting).calc;
const bet = (id: string): Bet => BETS.find((b) => b.id === id)!;

describe("ticket figures (D1)", () => {
  it("credits the won ticket's net payout to the wallet, to the santim", () => {
    expect(betFigures(bet("KS-260926-1177"), rules)?.netPayout).toBe(
      WON_TICKET_WINNINGS,
    );
  });

  it("prices an open ticket as the slip's preview of the same legs", () => {
    // 1.62 × 3.05 × 1.38 at 100: the slip's reference slip, 594.40 under D1.
    const figures = betFigures(bet("KS-260927-3381"), rules);
    expect(figures?.netPayout).toBe("594.40");
    expect(payoutView(bet("KS-260927-3381"), figures)).toMatchObject({
      labelKey: "bets.potentialPayout",
      amount: "594.40",
    });
  });

  it("settles a won ticket with a void leg at 1.00 for that leg", () => {
    const withVoid = BETS.find(
      (b) => b.status === "won" && b.legs.some((l) => l.status === "void"),
    )!;
    const figures = betFigures(withVoid, rules)!;
    const live = withVoid.legs.filter((l) => l.status !== "void");
    expect(figures.lines).toBe(1);
    // The void leg drops out of the gross: same as betting the other legs.
    const alone = betFigures({ ...withVoid, legs: live }, rules)!;
    expect(figures.grossPayout).toBe(alone.grossPayout);
  });

  it("shows nothing rather than a guess while the rule set loads", () => {
    expect(betFigures(bet("KS-260927-3381"), null)).toBeNull();
    expect(payoutView(bet("KS-260927-3381"), null).amount).toBeNull();
  });

  it("pays nothing on a lost ticket", () => {
    const lost = BETS.find((b) => b.status === "lost")!;
    expect(payoutView(lost, betFigures(lost, rules)).amount).toBe("0.00");
  });
});
