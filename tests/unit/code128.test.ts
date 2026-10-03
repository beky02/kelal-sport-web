import { describe, expect, it } from "vitest";
import {
  CODE128_PATTERNS,
  CODE128_STOP,
  code128,
  code128Values,
} from "@/lib/barcode/code128";

/** Widths (bar first) → the module string a scanner sees: 1 for a bar module, 0 for a space. */
const modules = (widths: readonly number[]) =>
  widths.map((w, i) => (i % 2 === 0 ? "1" : "0").repeat(w)).join("");

const digits = (pattern: string) => [...pattern].map(Number);

/**
 * Reads widths back into text with the symbology's own table: symbols of six
 * elements, Start B first, the mod-103 check character last, then Stop.
 */
function decode(widths: readonly number[]): string {
  const stop = widths.slice(-7).join("");
  if (stop !== CODE128_STOP) throw new Error("no stop pattern");
  const symbols: number[] = [];
  for (let i = 0; i < widths.length - 7; i += 6) {
    const value = CODE128_PATTERNS.indexOf(widths.slice(i, i + 6).join(""));
    if (value < 0) throw new Error(`unknown symbol at ${i}`);
    symbols.push(value);
  }
  const [start, ...rest] = symbols;
  const check = rest.pop()!;
  if (start !== 104) throw new Error("not code set B");
  const sum = rest.reduce((acc, value, i) => acc + value * (i + 1), start);
  if (sum % 103 !== check) throw new Error("bad check character");
  return String.fromCharCode(...rest.map((value) => value + 32));
}

describe("Code 128 (AC-8)", () => {
  it("has 107 distinct patterns of 11 modules with even bars and odd spaces", () => {
    // ISO/IEC 15417: values 0–105 are six elements, bar first, 11 modules;
    // the bars of every symbol add up to an even number of modules and the
    // spaces to an odd one, which is how a scanner checks each character.
    expect(CODE128_PATTERNS).toHaveLength(106);
    for (const pattern of CODE128_PATTERNS) {
      const w = digits(pattern);
      expect(w, pattern).toHaveLength(6);
      expect(
        w.every((x) => x >= 1 && x <= 4),
        pattern,
      ).toBe(true);
      expect(
        w.reduce((a, b) => a + b),
        pattern,
      ).toBe(11);
      expect((w[0] + w[2] + w[4]) % 2, pattern).toBe(0);
      expect((w[1] + w[3] + w[5]) % 2, pattern).toBe(1);
    }
    expect(new Set([...CODE128_PATTERNS, CODE128_STOP]).size).toBe(107);
    // The stop pattern: 13 modules ending in a bar.
    expect(digits(CODE128_STOP).reduce((a, b) => a + b)).toBe(13);
  });

  it("draws the well-known Start B, space, 'A' and Stop modules", () => {
    expect(modules(digits(CODE128_PATTERNS[104]))).toBe("11010010000");
    expect(modules(digits(CODE128_PATTERNS[0]))).toBe("11011001100");
    expect(modules(digits(CODE128_PATTERNS[33]))).toBe("10100011000");
    expect(modules(digits(CODE128_STOP))).toBe("1100011101011");
  });

  it("encodes K7Q2M9XPM as Start B, nine symbols, the check character and Stop", () => {
    // K=43 7=23 Q=49 2=18 M=45 9=25 X=56 P=48 M=45 (code set B: ASCII − 32).
    // Check: (104 + 1·43 + 2·23 + 3·49 + 4·18 + 5·45 + 6·25 + 7·56 + 8·48 +
    // 9·45) mod 103 = 1968 mod 103 = 11.
    expect(code128Values("K7Q2M9XPM")).toEqual([
      104, 43, 23, 49, 18, 45, 25, 56, 48, 45, 11,
    ]);

    const widths = code128("K7Q2M9XPM");
    expect(widths.slice(0, 6).join("")).toBe(CODE128_PATTERNS[104]);
    expect(widths.slice(-13, -7).join("")).toBe(CODE128_PATTERNS[11]);
    expect(widths.slice(-7).join("")).toBe(CODE128_STOP);
    // 11 symbols of 11 modules and a 13-module stop.
    expect(widths.reduce((a, b) => a + b)).toBe(134);
    // Bar first, bar last: an odd number of elements.
    expect(widths.length % 2).toBe(1);
  });

  it("decodes back to the text", () => {
    for (const text of [
      "K7Q2M9XPM",
      "R7K2M9XPK",
      "7KQ2M9X",
      "KS-260927-3381",
    ]) {
      expect(decode(code128(text))).toBe(text);
    }
  });

  it("refuses characters outside code set B", () => {
    expect(() => code128("")).toThrow(RangeError);
    expect(() => code128("ቅዱስ")).toThrow(RangeError);
    expect(() => code128("TAB\t")).toThrow(RangeError);
  });
});
