import { describe, expect, it } from "vitest";
import { GOLDEN_RULES } from "../golden";
import { example } from "../contract";
import { toBooking } from "@/lib/api/mappers/bookings";
import { slipFromBooking, stakeHintOf } from "@/features/bookings/lib/to-slip";
import { bookingRequestFrom } from "@/features/bookings/lib/request";
import { calculateBetSlip } from "@/features/bet-slip/lib/calculate";
import { oddsMoved, type BetSelection } from "@/features/bet-slip/types";
import type { Booking } from "@/features/bookings/types";

const booking = (): Booking => {
  const raw = example("/v1/bookings/{code}");
  return toBooking({ en: raw, am: raw });
};

describe("slipFromBooking", () => {
  it("puts 7KQ2M9X's open leg in the slip at today's 2.10, showing the move from the code's 2.05", () => {
    const slip = slipFromBooking(booking());

    expect(slip.selections).toHaveLength(1);
    const [arsenal] = slip.selections;
    expect(arsenal).toMatchObject({
      outcomeId: "oc_ac_1",
      eventId: "fx_arsenal_chelsea",
      marketId: "mk_ac_1x2",
      eventName: { en: "Arsenal v Chelsea" },
      marketName: { en: "1X2" },
      outcomeName: { en: "1" },
      initialOdds: "2.05",
      currentOdds: "2.10",
      suspended: false,
    });
    // The slip's accept-changes flow takes it from here.
    expect(oddsMoved(arsenal)).toBe(true);
  });

  it("counts what it added, for the notice", () => {
    expect(slipFromBooking(booking()).notice.added).toBe(1);
  });

  it("reads a stake hint only when it is a positive amount", () => {
    expect(stakeHintOf({ ...booking(), stakeHint: "50.00" })).toBe("50.00");
    expect(stakeHintOf({ ...booking(), stakeHint: "0.00" })).toBeNull();
    expect(stakeHintOf({ ...booking(), stakeHint: "-5.00" })).toBeNull();
    expect(stakeHintOf({ ...booking(), stakeHint: null })).toBeNull();
  });

  it("reports the started match instead of adding it", () => {
    const { selections, notice } = slipFromBooking(booking());
    expect(selections.map((s) => s.outcomeId)).not.toContain("oc_sg_1");
    expect(notice.code).toBe("7KQ2M9X");
    expect(notice.notAdded).toHaveLength(1);
    expect(notice.notAdded[0]).toMatchObject({
      outcomeId: "oc_sg_1",
      unavailable: "EVENT_STARTED",
      eventName: { en: "Saint George v Fasil Kenema" },
    });
  });

  it("sets the stake from the hint and the bet type from the code", () => {
    expect(slipFromBooking(booking())).toMatchObject({
      mode: "multiple",
      stake: "50.00",
      systemK: null,
    });
    expect(slipFromBooking({ ...booking(), stakeHint: null }).stake).toBeNull();
  });

  it.each(["0.00", "-50.00"])(
    "keeps the slip's stake when the hint is %s",
    (stakeHint) => {
      expect(slipFromBooking({ ...booking(), stakeHint }).stake).toBeNull();
    },
  );

  it("starts at today's price when the code kept no earlier one", () => {
    const b = booking();
    b.legs[0] = { ...b.legs[0], oddsAtCode: null };
    expect(slipFromBooking(b).selections[0]).toMatchObject({
      initialOdds: "2.10",
      currentOdds: "2.10",
    });
  });

  it("loads a system with its size, and says so when the code has several", () => {
    const system: Booking = {
      ...booking(),
      betType: "system",
      systemSizes: [2],
    };
    expect(slipFromBooking(system)).toMatchObject({
      mode: "system",
      systemK: 2,
    });
    // The notice keeps the code's sizes; the slip decides whether to mention them.
    expect(slipFromBooking(system).notice.systemSizes).toEqual([2]);

    const trixie = slipFromBooking({ ...system, systemSizes: [2, 3] });
    expect(trixie.systemK).toBe(2);
    expect(trixie.notice.systemSizes).toEqual([2, 3]);
  });
});

const pick = (id: string, eventId: string, extra: Partial<BetSelection> = {}) =>
  ({
    outcomeId: id,
    eventId,
    marketId: `${eventId}:1x2`,
    marketType: "1x2",
    line: null,
    outcomeCode: "1",
    eventName: { en: eventId, am: eventId },
    marketName: { en: "1X2", am: "1X2" },
    outcomeName: { en: "1", am: "1" },
    initialOdds: "1.80",
    currentOdds: "1.80",
    suspended: false,
    ...extra,
  }) satisfies BetSelection;

function requestFor(
  selections: BetSelection[],
  { mode = "multiple", stake = "100", systemK = 2 } = {},
) {
  const totals = calculateBetSlip({
    selections,
    mode: mode as "single" | "multiple" | "system",
    stake,
    systemK,
    rules: GOLDEN_RULES.default_2026_10,
    balance: null,
    oddsPolicy: "none",
  });
  return bookingRequestFrom({ selections, totals, stake });
}

describe("bookingRequestFrom", () => {
  it("saves the live picks, the bet type and the typed total stake", () => {
    expect(requestFor([pick("a", "m1"), pick("b", "m2")])).toEqual({
      betType: "multiple",
      systemSizes: [],
      outcomeIds: ["a", "b"],
      stake: "100.00",
    });
  });

  it("saves a system with its size, and the stake as typed rather than as charged", () => {
    expect(
      requestFor([pick("a", "m1"), pick("b", "m2"), pick("c", "m3")], {
        mode: "system",
      }),
    ).toMatchObject({ betType: "system", systemSizes: [2], stake: "100.00" });
  });

  it("leaves out a suspended pick", () => {
    expect(
      requestFor([pick("a", "m1"), pick("b", "m2", { suspended: true })])
        ?.outcomeIds,
    ).toEqual(["a"]);
  });

  it("saves the picks without a stake when the stake is empty or refused", () => {
    expect(requestFor([pick("a", "m1")], { stake: "" })?.stake).toBeNull();
    expect(requestFor([pick("a", "m1")], { stake: "2" })?.stake).toBeNull();
  });

  it("can't book an empty slip or two picks from one match", () => {
    expect(requestFor([])).toBeNull();
    expect(requestFor([pick("a", "m1"), pick("b", "m1")])).toBeNull();
  });
});
