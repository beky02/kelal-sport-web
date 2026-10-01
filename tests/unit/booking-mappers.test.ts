import { describe, expect, it } from "vitest";
import {
  toBooking,
  toBookingCreate,
  toBookingReceipt,
} from "@/lib/api/mappers/bookings";
import { bookingReceiptSchema, bookingSchema } from "@/lib/api/schemas";
import type { components } from "@/lib/api/schema";
import { example, requestExample, responseExample } from "../contract";

type ApiBooking = components["schemas"]["Booking"];

const bookingEn = () => example("/v1/bookings/{code}");

/** The same booking as the API would send it in Amharic. */
function bookingAm(): ApiBooking {
  const booking = bookingEn();
  booking.legs = booking.legs.map((leg) =>
    leg.outcome_id === "oc_ac_1"
      ? { ...leg, fixture_name: "አርሰናል ከ ቼልሲ", market_name: "1X2 ውጤት" }
      : leg,
  );
  return booking;
}

describe("toBooking", () => {
  it("maps the contract's booking 7KQ2M9X in both languages", () => {
    const booking = toBooking({ en: bookingEn(), am: bookingAm() });

    expect(booking).toMatchObject({
      code: "7KQ2M9X",
      betType: "multiple",
      systemSizes: [],
      stakeHint: "50.00",
      expiresAt: "2026-10-04T13:00:00Z",
    });
    expect(booking.legs).toHaveLength(2);
    expect(booking.legs[0]).toEqual({
      outcomeId: "oc_ac_1",
      eventId: "fx_arsenal_chelsea",
      eventName: { en: "Arsenal v Chelsea", am: "አርሰናል ከ ቼልሲ" },
      marketId: "mk_ac_1x2",
      marketName: { en: "1X2", am: "1X2 ውጤት" },
      outcomeName: { en: "1", am: "1" },
      startTime: "2026-10-04T14:00:00Z",
      odds: "2.10",
      oddsAtCode: "2.05",
      unavailable: null,
    });
  });

  it("keeps an unavailable leg, with its reason and no price", () => {
    const [, started] = toBooking({ en: bookingEn(), am: bookingEn() }).legs;
    expect(started).toMatchObject({
      outcomeId: "oc_sg_1",
      eventName: { en: "Saint George v Fasil Kenema" },
      odds: null,
      unavailable: "EVENT_STARTED",
    });
  });

  it("will not back a leg marked available that came without a valid price", () => {
    const raw = bookingEn();
    raw.legs[0] = { ...raw.legs[0], odds: undefined };
    raw.legs.push({ outcome_id: "oc_x", available: true, odds: "abc" });
    const legs = toBooking({ en: raw, am: raw }).legs;
    expect(legs[0]).toMatchObject({ odds: null, unavailable: "UNPRICED" });
    expect(legs[2]).toMatchObject({ odds: null, unavailable: "UNPRICED" });
  });

  it("produces what the browser's schema accepts", () => {
    expect(
      bookingSchema.parse(toBooking({ en: bookingEn(), am: bookingAm() })),
    ).toBeTruthy();
  });
});

describe("toBookingReceipt", () => {
  it("maps the contract's 201", () => {
    const receipt = toBookingReceipt(
      responseExample(
        "/v1/bookings",
        "post",
        201,
      ) as components["schemas"]["BookingCreated"],
    );
    expect(receipt).toEqual({
      code: "7KQ2M9X",
      expiresAt: "2026-10-04T13:00:00Z",
      shareUrl: "https://example.et/b/7KQ2M9X",
    });
    expect(bookingReceiptSchema.parse(receipt)).toEqual(receipt);
  });

  it("refuses a share link that isn't http(s)", () => {
    expect(() =>
      bookingReceiptSchema.parse({
        code: "7KQ2M9X",
        expiresAt: "2026-10-04T13:00:00Z",
        shareUrl: "javascript:alert(1)",
      }),
    ).toThrow();
  });
});

describe("toBookingCreate", () => {
  it("writes the contract's request body", () => {
    expect(
      toBookingCreate({
        betType: "multiple",
        systemSizes: [],
        outcomeIds: ["oc_ac_1", "oc_sg_1"],
        stake: "50.00",
      }),
    ).toEqual(requestExample("/v1/bookings", "post"));
  });

  it("sends system sizes for a system bet and leaves out a missing stake", () => {
    expect(
      toBookingCreate({
        betType: "system",
        systemSizes: [2],
        outcomeIds: ["a", "b", "c"],
        stake: null,
      }),
    ).toEqual({
      bet_type: "system",
      system_sizes: [2],
      legs: [{ outcome_id: "a" }, { outcome_id: "b" }, { outcome_id: "c" }],
    });
  });
});
