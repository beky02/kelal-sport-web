import { describe, expect, it } from "vitest";
import { formatLongDate } from "@/lib/i18n/dates";
import { formatEthiopianLong } from "@/lib/i18n/ethiopian-date";

describe("a date written out in full", () => {
  it("is Gregorian by default (D7), in the UI's language", () => {
    expect(formatLongDate("1998-04-12", "en", "gregorian")).toBe("12 Apr 1998");
    const amharic = formatLongDate("1998-04-12", "am", "gregorian");
    expect(amharic).toMatch(/1998/);
    expect(amharic).toMatch(/[ሀ-፿]/);
  });

  it("follows the Ethiopian calendar when that is the preference", () => {
    expect(formatLongDate("1998-04-12", "en", "ethiopian")).toBe(
      formatEthiopianLong("1998-04-12"),
    );
    expect(formatLongDate("1998-04-12", "am", "ethiopian")).toBe(
      formatEthiopianLong("1998-04-12"),
    );
  });
});
