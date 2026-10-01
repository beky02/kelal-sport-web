import { describe, expect, it } from "vitest";
import {
  formatEthiopianLong,
  formatEthiopianShort,
  formatGregorianShort,
  isoToEthiopian,
} from "@/lib/i18n/ethiopian-date";

describe("Ethiopian calendar", () => {
  it("converts the design's reference date", () => {
    // kelal-data.js: "Mon 28 Sep 2026 = Meskerem 18, 2019 E.C."
    expect(isoToEthiopian("2026-09-28")).toEqual({
      year: 2019,
      month: 1,
      day: 18,
    });
    expect(formatEthiopianShort("2026-09-28")).toBe("መስ 18");
  });

  it("places Ethiopian new year on 11 September", () => {
    expect(isoToEthiopian("2026-09-11")).toEqual({
      year: 2019,
      month: 1,
      day: 1,
    });
  });

  it("shifts new year to 12 September before a Gregorian leap year", () => {
    // 2028 is a leap year, so Meskerem 1 of 2021 E.C. is 11 Sep 2028 and the
    // preceding year's new year slips a day.
    expect(isoToEthiopian("2027-09-12")).toEqual({
      year: 2020,
      month: 1,
      day: 1,
    });
  });

  it("handles the last day of the year, Pagumen", () => {
    const pagumen = isoToEthiopian("2026-09-10");
    expect(pagumen.month).toBe(13);
    expect(pagumen.year).toBe(2018);
  });

  it("round-trips every day across a four-year leap cycle", () => {
    const start = Date.UTC(2024, 0, 1);
    let previous = isoToEthiopian("2023-12-31");
    let days = 0;

    for (let i = 0; i < 366 * 4; i++) {
      const iso = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const current = isoToEthiopian(iso);

      // Each Gregorian day advances the Ethiopian date by exactly one day.
      const advancedWithinMonth =
        current.year === previous.year &&
        current.month === previous.month &&
        current.day === previous.day + 1;
      const rolledMonth =
        current.day === 1 &&
        ((current.year === previous.year &&
          current.month === previous.month + 1) ||
          (current.year === previous.year + 1 && current.month === 1));

      expect(
        advancedWithinMonth || rolledMonth,
        `${iso} → ${JSON.stringify(current)} after ${JSON.stringify(previous)}`,
      ).toBe(true);

      previous = current;
      days++;
    }
    expect(days).toBe(366 * 4);
  });

  it("formats the long form and the Gregorian short form", () => {
    expect(formatEthiopianLong("2026-09-28")).toBe("መስከረም 18 2019");
    expect(formatGregorianShort("2026-09-28")).toBe("28/09");
  });
});
