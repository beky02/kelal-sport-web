import { beforeEach, describe, expect, it } from "vitest";
import {
  selectionFrom,
  useBetSlipStore,
} from "@/features/bet-slip/stores/bet-slip.store";
import type { OutcomeRef } from "@/features/markets/types";

const ref = (eventId: string): OutcomeRef => ({
  eventId,
  marketType: "1x2",
  line: null,
  outcomeCode: "1",
});

const pick = (eventId: string, odds: string) =>
  selectionFrom({
    outcomeId: `oc_${eventId}`,
    ref: ref(eventId),
    marketId: `${eventId}:1x2:`,
    eventName: { en: eventId, am: eventId },
    marketName: { en: "1X2", am: "1X2" },
    outcomeName: { en: "1", am: "1" },
    odds,
  });

const slip = () => useBetSlipStore.getState();
const selection = (outcomeId: string) =>
  slip().selections.find((s) => s.outcomeId === outcomeId)!;

beforeEach(() => {
  slip().clear();
  slip().toggleSelection(pick("m1", "2.10"));
  slip().toggleSelection(pick("m2", "1.80"));
});

describe("the slip store: agreeing to prices", () => {
  it("makes the shown price the agreed one when a move is accepted, so a later move asks again", () => {
    slip().applyOddsUpdate(ref("m1"), "1.95");
    slip().acceptSelection("oc_m1");
    expect(selection("oc_m1")).toMatchObject({
      initialOdds: "1.95",
      currentOdds: "1.95",
    });

    // Accepted once is not accepted for good: 1.95 → 1.70 is a new move.
    slip().applyOddsUpdate(ref("m1"), "1.70");
    expect(selection("oc_m1")).toMatchObject({
      initialOdds: "1.95",
      currentOdds: "1.70",
    });
  });

  it("agrees to every moved price at once with Accept all, and leaves the rest", () => {
    slip().applyOddsUpdate(ref("m1"), "1.95");
    slip().applyOddsUpdate(ref("m2"), "1.90");
    slip().acceptAllPending();
    expect(
      slip().selections.map((s) => [s.initialOdds, s.currentOdds]),
    ).toEqual([
      ["1.95", "1.95"],
      ["1.90", "1.90"],
    ]);
  });
});

describe("the slip store: the odds policy (AC-6)", () => {
  it("starts with the tenant's policy and keeps the player's choice", () => {
    expect(slip().oddsPolicy).toBeNull();
    slip().setOddsPolicy("any");
    expect(slip().oddsPolicy).toBe("any");
    slip().toggleSelection(pick("m3", "3.00"));
    expect(slip().oddsPolicy).toBe("any");
  });

  it("goes back to the tenant's policy when the slip is cleared or a booking is loaded", () => {
    slip().setOddsPolicy("any");
    slip().clear();
    expect(slip().oddsPolicy).toBeNull();

    slip().setOddsPolicy("none");
    slip().replaceSlip({
      selections: [pick("m4", "1.50")],
      mode: "single",
      systemK: null,
      stake: null,
      notice: { code: "7KQ2M9X", added: 1, notAdded: [], systemSizes: null },
    });
    expect(slip().oddsPolicy).toBeNull();
  });
});
