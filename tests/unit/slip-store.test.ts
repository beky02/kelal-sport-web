import { beforeEach, describe, expect, it } from "vitest";
import {
  selectionFrom,
  useBetSlipStore,
} from "@/features/bet-slip/stores/bet-slip.store";
import type { OutcomeRef } from "@/features/markets/types";
import type {
  BetReceipt,
  PlaceAttempt,
  PlaceRefusal,
} from "@/features/bet-slip/types";

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
  slip().forgetPlacement();
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
    slip().toggleSelection(pick("m3", "3.00"));
    const untouched = selection("oc_m3");
    slip().applyOddsUpdate(ref("m1"), "1.95");
    slip().applyOddsUpdate(ref("m2"), "1.90");
    slip().acceptAllPending();
    expect(
      slip().selections.map((s) => [s.initialOdds, s.currentOdds]),
    ).toEqual([
      ["1.95", "1.95"],
      ["1.90", "1.90"],
      ["3.00", "3.00"],
    ]);
    // An unmoved pick is the same object: nothing re-renders for it.
    expect(selection("oc_m3")).toBe(untouched);
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

const ATTEMPT = (key: string, stake = "100.00"): PlaceAttempt => ({
  key,
  totalStake: stake,
  lines: 1,
  request: {
    betType: "multiple",
    systemSizes: [],
    legs: [
      { outcomeId: "oc_m1", odds: "2.10" },
      { outcomeId: "oc_m2", odds: "1.80" },
    ],
    stake,
    oddsPolicy: "higher",
  },
});
const RECEIPT = { ticketId: "K7Q2-M9XP-M" } as BetReceipt;
const REFUSAL: PlaceRefusal = {
  status: 409,
  code: "BET_ODDS_CHANGED",
  title: "Odds have changed",
  detail: null,
  errors: [{ field: "legs[1].odds", code: "ODDS_CHANGED", current: "1.55" }],
  retryAfter: null,
};
const placement = () => slip().placement;

/** Sent with key k1 for player p1, and never answered. */
function unanswered() {
  slip().placementSent(ATTEMPT("k1"), "p1");
  slip().placementUnanswered("k1");
  expect(placement().unconfirmed?.key).toBe("k1");
}

describe("the slip store: a bet that had no answer (SEC1, M1)", () => {
  it("keeps it through any change to the slip, even one that changes nothing", () => {
    unanswered();
    slip().setStake("100");
    slip().setStake("50");
    slip().setStake("100");
    slip().setMode("multiple");
    slip().setSystemK(2);
    slip().setOddsPolicy("any");
    slip().toggleSelection(pick("m3", "3.00"));
    slip().removeSelection("oc_m3");
    slip().applyOddsUpdate(ref("m1"), "2.40");
    slip().acceptAllPending();
    slip().clear();
    expect(placement().unconfirmed).toEqual(ATTEMPT("k1"));
  });

  it("keeps it when a retry is refused or the session ends: neither says the first try failed", () => {
    unanswered();
    slip().placementSent(ATTEMPT("k1"), "p1");
    slip().placementRefused("k1", REFUSAL);
    expect(placement()).toMatchObject({
      sending: null,
      refused: { key: "k1", problem: REFUSAL },
      unconfirmed: ATTEMPT("k1"),
    });

    slip().placementSent(ATTEMPT("k1"), "p1");
    slip().placementSessionEnded("k1");
    expect(placement()).toMatchObject({
      sending: null,
      unconfirmed: ATTEMPT("k1"),
    });
  });

  it("ends it with the ticket for its own key", () => {
    unanswered();
    slip().placementSent(ATTEMPT("k1"), "p1");
    slip().placementPlaced("k1", RECEIPT);
    expect(placement()).toMatchObject({
      sending: null,
      unconfirmed: null,
      receipt: RECEIPT,
    });
  });

  it("keeps it while a bet placed as new goes, and when that bet is refused (N4)", () => {
    unanswered();
    slip().placementSent(ATTEMPT("k2", "50.00"), "p1");
    expect(placement()).toMatchObject({
      sending: ATTEMPT("k2", "50.00"),
      unconfirmed: ATTEMPT("k1"),
    });

    // Refused for the balance — likeliest exactly when the first went through.
    slip().placementRefused("k2", {
      ...REFUSAL,
      status: 422,
      code: "WALLET_INSUFFICIENT_FUNDS",
    });
    expect(placement()).toMatchObject({
      sending: null,
      unconfirmed: ATTEMPT("k1"),
      refused: { key: "k2" },
    });
  });

  it("ends it with a ticket for the bet placed as new; tracks that one if it has no answer", () => {
    unanswered();
    slip().placementSent(ATTEMPT("k2", "50.00"), "p1");
    slip().placementPlaced("k2", RECEIPT);
    expect(placement()).toMatchObject({ unconfirmed: null, receipt: RECEIPT });

    slip().forgetPlacement();
    unanswered();
    slip().placementSent(ATTEMPT("k2", "50.00"), "p1");
    slip().placementUnanswered("k2");
    expect(placement().unconfirmed).toEqual(ATTEMPT("k2", "50.00"));
  });

  it("marks it stale only when a Try again of it is refused for its prices or picks (N2)", () => {
    const retry = (refusal: PlaceRefusal) => {
      slip().placementSent(ATTEMPT("k1"), "p1");
      slip().placementRefused("k1", refusal);
    };
    unanswered();

    retry({ ...REFUSAL, status: 429, code: "RATE_LIMITED" });
    expect(placement().stale).toBe(false);
    // A different bet's refusal says nothing about this one's prices.
    slip().placementSent(ATTEMPT("k2", "50.00"), "p1");
    slip().placementRefused("k2", REFUSAL);
    expect(placement().stale).toBe(false);

    retry(REFUSAL);
    expect(placement().stale).toBe(true);
    // Still it after a later Try again with no answer, and through the slip
    // changing; a ticket ends it.
    slip().placementSent(ATTEMPT("k1"), "p1");
    slip().placementUnanswered("k1");
    slip().setStake("50");
    expect(placement()).toMatchObject({ stale: true, refused: null });
    slip().placementSent(ATTEMPT("k1"), "p1");
    slip().placementPlaced("k1", RECEIPT);
    expect(placement().stale).toBe(false);
  });
});

describe("the slip store: whose placement it is (SEC2, Q1)", () => {
  it("starts afresh for another player", () => {
    unanswered();
    slip().placementSent(ATTEMPT("k9"), "p2");
    expect(placement()).toMatchObject({
      owner: "p2",
      unconfirmed: null,
      sending: ATTEMPT("k9"),
    });
  });

  it("forgets everything on request, and ignores an answer for an attempt no longer on its way", () => {
    slip().placementSent(ATTEMPT("k1"), "p1");
    slip().forgetPlacement();
    slip().placementPlaced("k1", RECEIPT);
    slip().placementUnanswered("k1");
    expect(placement()).toEqual({
      owner: null,
      sending: null,
      unconfirmed: null,
      stale: false,
      refused: null,
      receipt: null,
    });
  });
});

describe("the slip store: a refusal", () => {
  it("goes once the slip changes; the ticket stays until it is dismissed", () => {
    slip().placementSent(ATTEMPT("k1"), "p1");
    slip().placementRefused("k1", REFUSAL);
    slip().setStake("50");
    expect(placement().refused).toBeNull();

    slip().placementSent(ATTEMPT("k2"), "p1");
    slip().placementPlaced("k2", RECEIPT);
    slip().setStake("100");
    expect(placement().receipt).toBe(RECEIPT);
    slip().dismissReceipt();
    expect(placement().receipt).toBeNull();
  });
});
