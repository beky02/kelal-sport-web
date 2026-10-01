import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/messages/en.json";
import am from "@/lib/i18n/messages/am.json";
import { translate } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const english = flatten(en as Tree);
const amharic = flatten(am as Tree);
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("message catalogues", () => {
  it("cover exactly the same keys", () => {
    expect([...amharic.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("has no empty strings", () => {
    for (const [key, value] of [...english, ...amharic]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("uses the same placeholders in both languages", () => {
    for (const [key, source] of english) {
      expect(placeholders(amharic.get(key)!), key).toEqual(
        placeholders(source),
      );
    }
  });

  it("writes Amharic in Ethiopic, not transliterated Latin", () => {
    // Every Amharic string should carry Ethiopic unless it is purely symbolic
    // (a currency-free template, a code, a number).
    const ethiopic = /[ሀ-፿]/;
    // Strings that are numerals, codes or brand names in both languages, and so
    // carry no Ethiopic by design.
    const symbolic = new Set([
      "board.moreMarkets",
      "header.currency",
      "clock.eat",
      "sidebar.licence",
      "bets.part25",
      "bets.part50",
      // "{tax} · {rate}": both placeholders are filled with Amharic.
      "betSlip.taxRate",
    ]);
    for (const [key, value] of amharic) {
      if (symbolic.has(key)) continue;
      expect(ethiopic.test(value), `${key} = ${value}`).toBe(true);
    }
  });
});

describe("translate", () => {
  it("returns the requested language", () => {
    expect(translate("en", "betSlip.placeBet")).toBe("Place bet");
    expect(translate("am", "betSlip.placeBet")).toBe("ውርርድ አስይዝ");
  });

  it("fills placeholders", () => {
    expect(translate("en", "board.startsIn", { n: 12 })).toBe(
      "Starts in 12 min ·",
    );
    expect(translate("en", "betSlip.remove", { pick: "Man City" })).toBe(
      "Remove Man City",
    );
  });

  it("leaves an unsupplied placeholder visible rather than blanking it", () => {
    expect(translate("en", "board.startsIn")).toBe("Starts in {n} min ·");
  });

  it("falls back to the key when a message is missing", () => {
    expect(translate("en", "nope.not.here" as MessageKey)).toBe(
      "nope.not.here",
    );
  });
});
