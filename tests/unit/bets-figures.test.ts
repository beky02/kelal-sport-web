import { describe, expect, it } from "vitest";
import { payoutView } from "@/features/bets/lib/figures";
import {
  betKindLabel,
  RESULT_KEY,
  STATUS_KEY,
} from "@/features/bets/lib/labels";
import type { BetStatus, TicketStatus } from "@/features/bets/types";
import { ticketPayout } from "@/features/tickets/lib/figures";
import { translate } from "@/lib/i18n";
import type { Translator } from "@/lib/i18n/use-translation";

/** The ticket's bottom line: the API's figure, labelled no more than the contract says. */
describe("payoutView (M2)", () => {
  const bet = (status: BetStatus, payout: string | null) => ({
    status,
    potentialPayout: "321.09",
    payout,
  });

  it.each([
    ["open", null, "bets.potentialPayout", "321.09", "plain"],
    ["won", "250.00", "bets.payout", "250.00", "win"],
    // The API's own zero, shown as it comes.
    ["lost", "0.00", "bets.payout", "0.00", "loss"],
    // All legs void: the API pays back the net stake (D1.9) — its figure.
    ["void", "85.00", "bets.payout", "85.00", "plain"],
    ["cashed_out", "120.00", "bets.cashedAmount", "120.00", "plain"],
    ["cancelled", "100.00", "bets.payout", "100.00", "plain"],
  ] as const)(
    "%s with payout %s → %s %s",
    (status, payout, labelKey, amount, tone) => {
      expect(payoutView(bet(status, payout))).toEqual({
        labelKey,
        amount,
        tone,
      });
    },
  );

  it("never shows an open bet's payout, only what it might pay", () => {
    expect(payoutView(bet("open", "999.99")).amount).toBe("321.09");
  });

  it.each(["won", "lost", "void", "cashed_out", "cancelled"] as const)(
    "shows nothing for a settled %s bet the API sent without a payout — never a 0.00",
    (status) => {
      expect(payoutView(bet(status, null)).amount).toBeNull();
    },
  );
});

describe("ticketPayout, the public check's payout line (M2)", () => {
  it.each([
    ["open", "bets.payout", "plain"],
    ["won", "bets.payout", "win"],
    ["paid", "bets.payout", "win"],
    ["lost", "bets.payout", "loss"],
    ["void", "bets.payout", "plain"],
    ["cashed_out", "bets.cashedAmount", "plain"],
    ["cancelled", "bets.payout", "plain"],
    ["expired", "bets.payout", "plain"],
  ] as const)(
    "%s → the API's payout under %s, for every status (plan gate)",
    (status, labelKey, tone) => {
      expect(ticketPayout({ status, payout: "289.17" })).toEqual({
        labelKey,
        amount: "289.17",
        tone,
      });
    },
  );

  it.each([
    "open",
    "won",
    "paid",
    "lost",
    "void",
    "cashed_out",
    "cancelled",
    "expired",
  ] as const)("draws no line for %s without a payout", (status) => {
    expect(ticketPayout({ status, payout: null })).toBeNull();
  });
});

describe("statuses and results in words", () => {
  const statuses = Object.keys(STATUS_KEY) as TicketStatus[];

  it("names all eight ticket statuses, and every leg result, in both languages", () => {
    expect(statuses.sort()).toEqual(
      [
        "cancelled",
        "cashed_out",
        "expired",
        "lost",
        "open",
        "paid",
        "void",
        "won",
      ].sort(),
    );
    const words = [...Object.values(STATUS_KEY), ...Object.values(RESULT_KEY)];
    for (const key of words) {
      expect(translate("en", key), key).not.toBe(key);
      expect(translate("am", key), key).not.toBe(key);
    }
  });

  it("gives void and cancelled different words in both languages", () => {
    for (const lang of ["en", "am"] as const) {
      expect(translate(lang, STATUS_KEY.void)).not.toBe(
        translate(lang, STATUS_KEY.cancelled),
      );
    }
  });
});

describe("betKindLabel", () => {
  const t = {
    lang: "en",
    t: (key, values) => translate("en", key, values),
  } as Translator;

  it.each([
    [{ betType: "single", legCount: 1, lines: 1 }, "Single"],
    [{ betType: "single", legCount: 3, lines: 3 }, "Singles · 3 bets"],
    [{ betType: "multiple", legCount: 2, lines: 1 }, "Multiple · 2 picks"],
    [
      { betType: "system", legCount: 3, systemSizes: [2], lines: 3 },
      "System 2/3 · 3 bets",
    ],
    [
      { betType: "system", legCount: 4, systemSizes: [2, 3], lines: 10 },
      "System 2, 3/4 · 10 bets",
    ],
    // The public check: no sizes, no lines.
    [{ betType: "system", legCount: 3 }, "System"],
    [{ betType: "single", legCount: 2 }, "Singles · 2 bets"],
  ] as const)("%o → %s", (bet, label) => {
    const sizes = "systemSizes" in bet ? [...bet.systemSizes] : undefined;
    expect(betKindLabel({ ...bet, systemSizes: sizes }, t)).toBe(label);
  });
});
