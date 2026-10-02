import { afterEach, describe, expect, it, vi } from "vitest";
import { toBooking } from "@/lib/api/mappers/bookings";
import { bookingMetadata } from "@/features/bookings/lib/metadata";
import { example, responseExample } from "../contract";

vi.mock("server-only", () => ({}));
const { lookupBooking } = await import("@/lib/server/bookings");

const BOOKING = () => {
  const raw = example("/v1/bookings/{code}");
  return toBooking({ en: raw, am: raw });
};
const URL_7KQ = "https://example.et/b/7KQ2M9X";
const page = { lang: "en" as const, siteName: "Demo Bet", url: URL_7KQ };

afterEach(() => vi.restoreAllMocks());

describe("the /b/{code} page's metadata", () => {
  it("names the code and only the matches it can still load", () => {
    const meta = bookingMetadata({ status: "ok", booking: BOOKING() }, page);

    expect(meta.title).toBe("Bet slip 7KQ2M9X · Demo Bet");
    // Saint George v Fasil Kenema has started: it cannot come into a slip.
    expect(meta.description).toBe("Selections: Arsenal v Chelsea");
    expect(meta.openGraph).toMatchObject({
      title: "Bet slip 7KQ2M9X",
      description: "Selections: Arsenal v Chelsea",
      url: URL_7KQ,
      siteName: "Demo Bet",
      type: "website",
    });
    // Codes expire within days; they are shared, not searched for.
    expect(meta.robots).toMatchObject({ index: false });
  });

  it("shows nothing of a booking when the tenant has booking codes off", () => {
    const meta = bookingMetadata(
      { status: "ok", booking: BOOKING() },
      { ...page, bookingCodes: false },
    );
    expect(meta).toEqual({ robots: { index: false, follow: false } });
  });

  it("writes them in the language it is given", () => {
    const meta = bookingMetadata(
      { status: "ok", booking: BOOKING() },
      { ...page, lang: "am" },
    );
    expect(meta.openGraph?.title).toBe("የውርርድ ትኬት 7KQ2M9X");
  });

  it.each([
    ["expired", "This booking code has expired."],
    ["not_found", "No booking with this code."],
  ] as const)("titles and describes a %s code as such", (status, title) => {
    const meta = bookingMetadata({ status, code: "7KQ2M9X" }, page);
    expect(meta.title).toBe(`${title} · Demo Bet`);
    expect(meta.openGraph).toMatchObject({ title, description: title });
  });

  it("offers no preview card for a passing failure, which a bot would cache", () => {
    const meta = bookingMetadata({ status: "failed", code: "7KQ2M9X" }, page);
    // Nothing a bot could keep says the booking failed.
    expect(meta.title).toBe("Bet slip 7KQ2M9X · Demo Bet");
    expect(meta.description).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
  });

  it("names no brand when the tenant's config could not be read", () => {
    const meta = bookingMetadata(
      { status: "ok", booking: BOOKING() },
      { ...page, siteName: null },
    );
    expect(meta.title).toBe("Bet slip 7KQ2M9X");
    expect(meta.openGraph).not.toHaveProperty("siteName");
  });
});

describe("lookupBooking (the /b/{code} page)", () => {
  const answer = (status: number, body: unknown) =>
    vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json(body, { status }));

  it("finds the booking", async () => {
    answer(200, example("/v1/bookings/{code}"));
    const result = await lookupBooking("demo", "7KQ2M9X");
    expect(result.status === "ok" && result.booking.code).toBe("7KQ2M9X");
  });

  it("calls a 410 BOOKING_EXPIRED expired", async () => {
    answer(410, responseExample("/v1/bookings/{code}", "get", 410));
    expect(await lookupBooking("demo", "7KQ2M9X")).toEqual({
      status: "expired",
      code: "7KQ2M9X",
    });
  });

  it.each(["NOT_FOUND", "BOOKING_NOT_FOUND"])(
    "calls a 404 %s not found",
    async (code) => {
      answer(404, { type: "x", title: "x", status: 404, code });
      expect(await lookupBooking("demo", "7KQ2M9X")).toEqual({
        status: "not_found",
        code: "7KQ2M9X",
      });
    },
  );

  it("calls anything else a failure, not a missing booking", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("down"));
    expect(await lookupBooking("demo", "7KQ2M9X")).toEqual({
      status: "failed",
      code: "7KQ2M9X",
    });
  });
});
