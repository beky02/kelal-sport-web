import { describe, expect, it } from "vitest";
import { formatMoney, formatNumber, formatOdds } from "@/lib/i18n/format";

describe("display formatters (FD4: strings in, no floats)", () => {
  it("groups a money string without parsing it", () => {
    expect(formatNumber("1000000.00")).toBe("1,000,000.00");
    expect(formatNumber("-1250.5")).toBe("-1,250.50");
  });

  it("keeps the currency and the amount together on one line", () => {
    expect(formatMoney("1000.00", "en")).toBe("ETB 1,000.00");
    expect(formatMoney("1000.00", "am")).toBe("1,000.00 ብር");
  });

  it("floors three-decimal odds to two, never rounding a price up", () => {
    expect(formatOdds("2.105")).toBe("2.10");
    expect(formatOdds("2.119")).toBe("2.11");
    expect(formatOdds("1.005")).toBe("1.00");
    expect(formatOdds("3")).toBe("3.00");
  });
});
