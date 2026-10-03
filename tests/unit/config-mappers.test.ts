import { describe, expect, it } from "vitest";
import { toBettingRules, toPublicConfigView } from "@/lib/api/mappers/config";
import { publicConfigSchema } from "@/lib/api/schemas";
import { example } from "../contract";
import { GOLDEN_RULES } from "../golden";

describe("toBettingRules", () => {
  const config = example("/v1/config/public");

  it("hands the contract's rule set to slipcalc unchanged", () => {
    const rules = toBettingRules(config.betting);
    // The contract example is the golden `default_2026_10` set (D1.12).
    const golden = GOLDEN_RULES.default_2026_10;
    expect(rules.calc).toEqual({
      min_stake: golden.min_stake,
      max_stake: golden.max_stake,
      max_payout: golden.max_payout,
      max_legs: golden.max_legs,
      max_lines: golden.max_lines,
      acca_bonus_table: golden.acca_bonus_table,
      acca_bonus_min_leg_odds: golden.acca_bonus_min_leg_odds,
      acca_bonus_max: golden.acca_bonus_max,
      taxes: golden.taxes,
      refund_stake_tax_on_void: golden.refund_stake_tax_on_void,
    });
  });

  it("carries the version and the tenant's quick stakes", () => {
    const rules = toBettingRules(config.betting);
    expect(rules.version).toBe(7);
    expect(rules.quickStakes).toEqual(["20.00", "50.00", "100.00", "500.00"]);
  });

  it("reads the tenant's default odds policy (AC-6)", () => {
    expect(toBettingRules(config.betting).defaultOddsPolicy).toBe("higher");
    expect(
      toBettingRules({ ...config.betting, default_odds_policy: "none" })
        .defaultOddsPolicy,
    ).toBe("none");
  });

  it("has no quick stakes when the tenant sets none", () => {
    const betting = { ...config.betting, quick_stakes: undefined };
    expect(toBettingRules(betting).quickStakes).toEqual([]);
  });

  it("produces what the browser's schema accepts", () => {
    expect(publicConfigSchema.parse(toPublicConfigView(config))).toBeTruthy();
  });
});

describe("toPublicConfigView", () => {
  const config = () => example("/v1/config/public");

  it("carries the tenant's booking-codes switch", () => {
    expect(toPublicConfigView(config()).features).toEqual({
      bookingCodes: true,
    });
    expect(
      toPublicConfigView({
        ...config(),
        features: { ...config().features, booking_codes: false },
      }).features.bookingCodes,
    ).toBe(false);
  });

  it("keeps booking codes on when the tenant's config doesn't mention them", () => {
    expect(
      toPublicConfigView({ ...config(), features: {} }).features.bookingCodes,
    ).toBe(true);
  });

  it("produces what the browser's schema accepts", () => {
    expect(publicConfigSchema.parse(toPublicConfigView(config()))).toBeTruthy();
  });

  it("carries the tenant's terms version and minimum age, and nothing when it has none (F4b)", () => {
    expect(toPublicConfigView(config()).legal).toEqual({
      termsVersion: "2026-10",
      minAge: 21,
    });
    const none = config();
    delete none.legal;
    expect(toPublicConfigView(none).legal).toEqual({
      termsVersion: null,
      minAge: null,
    });
    expect(publicConfigSchema.parse(toPublicConfigView(none))).toBeTruthy();
  });
});
