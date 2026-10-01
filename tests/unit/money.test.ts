import { describe, expect, it } from "vitest";
import { money } from "@golden/slipcalc";
import {
  addMoney,
  compareMoney,
  compareOdds,
  fromLegacyAmount,
  fromSantim,
  maxMoney,
  mulMoney,
  normaliseMoney,
  share,
  toSantim,
} from "@/lib/money";
import { GOLDEN_ROWS, MONEY_COLUMNS } from "../golden";

describe("lib/money (FD4)", () => {
  it("round-trips every money value in slips.csv through slipcalc's money()", () => {
    const values = GOLDEN_ROWS.flatMap((row) =>
      MONEY_COLUMNS.map((column) => row[column]).filter(Boolean),
    );
    expect(values.length).toBeGreaterThan(3000);
    for (const value of values) {
      // Our parse feeding slipcalc's own formatter gives the string back…
      expect(money(toSantim(value))).toBe(value);
      // …and our formatter is slipcalc's.
      expect(fromSantim(toSantim(value))).toBe(value);
    }
  });

  it("parses like slipcalc: extra decimals are floored to the santim", () => {
    expect(toSantim("10")).toBe(1000n);
    expect(toSantim("10.5")).toBe(1050n);
    expect(toSantim("10.009")).toBe(1000n);
    expect(toSantim("-1.25")).toBe(-125n);
    expect(toSantim("-1.251")).toBe(-126n);
  });

  it("refuses anything that is not a plain decimal", () => {
    for (const bad of ["", "1e3", "1,000.00", " 5", "abc", "1.", ".5"]) {
      expect(() => toSantim(bad)).toThrow();
    }
  });

  it("compares, adds, multiplies and takes the larger amount exactly", () => {
    expect(compareMoney("0.10", "0.1")).toBe(0);
    expect(compareMoney("99.99", "100.00")).toBe(-1);
    expect(addMoney("0.10", "0.20")).toBe("0.30");
    expect(mulMoney("0.01", 1024)).toBe("10.24");
    expect(maxMoney("5.00", "10.24")).toBe("10.24");
    expect(normaliseMoney("100")).toBe("100.00");
  });

  it("takes a share floored to the santim", () => {
    expect(share("142.30", 1, 4)).toBe("35.57");
    expect(share("142.30", 1, 1)).toBe("142.30");
  });

  it("compares odds by value, not spelling", () => {
    expect(compareOdds("2.1", "2.10")).toBe(0);
    expect(compareOdds("2.105", "2.10")).toBe(1);
    expect(compareOdds("1.99", "2")).toBe(-1);
  });

  it("bridges a legacy numeric amount to a string (until F6)", () => {
    expect(fromLegacyAmount(1250)).toBe("1250.00");
    expect(fromLegacyAmount(0.1 + 0.2)).toBe("0.30");
  });
});

describe("scaleOdds (development simulator)", () => {
  it("moves odds by whole percent, floored to two decimals, never below 1.01", async () => {
    const { scaleOdds } = await import("@/lib/money");
    expect(scaleOdds("2.00", 5)).toBe("2.10");
    expect(scaleOdds("1.62", -3)).toBe("1.57");
    expect(scaleOdds("1.02", -8)).toBe("1.01");
  });
});
