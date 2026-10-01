import { describe, expect, it } from "vitest";
import { normaliseBookingCode } from "@/features/bookings/lib/code";

describe("normaliseBookingCode", () => {
  it("accepts the contract's example as it is", () => {
    expect(normaliseBookingCode("7KQ2M9X")).toBe("7KQ2M9X");
  });

  it("normalises with Crockford's rule and rejects anything else", () => {
    // Case, spaces and hyphens people add when reading a code out.
    expect(normaliseBookingCode(" 7kq2-m9x ")).toBe("7KQ2M9X");
    expect(normaliseBookingCode("7kq 2m9x")).toBe("7KQ2M9X");
    // Crockford base32 has no O, I or L: they are read as 0, 1, 1.
    expect(normaliseBookingCode("OIL2M9X")).toBe("0112M9X");
    // U is not in the alphabet and has no stand-in.
    expect(normaliseBookingCode("7KQ2M9U")).toBeNull();
    // Wrong length, or not a code at all.
    expect(normaliseBookingCode("7KQ2M9")).toBeNull();
    expect(normaliseBookingCode("7KQ2M9XX")).toBeNull();
    expect(normaliseBookingCode("")).toBeNull();
    expect(normaliseBookingCode("../../v1/me")).toBeNull();
  });
});
