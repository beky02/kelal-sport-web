import { describe, expect, it } from "vitest";
import {
  toMyBonuses,
  toPromotions,
  toRedeemResult,
} from "@/lib/api/mappers/promotions";
import {
  myBonusesSchema,
  promotionsSchema,
  redeemCodeSchema,
  redeemResultSchema,
} from "@/lib/api/promotion-schemas";
import { example, requestExample } from "../contract";

describe("toPromotions (AC-11)", () => {
  it("maps the contract's offers as the API sends them", () => {
    const offers = toPromotions(example("/v1/promotions").items);

    expect(offers).toEqual([
      {
        id: "01J9A810000000000000000001",
        title: "100% first deposit bonus",
        summary: "Up to 1,000 ETB, 5x wagering on 3+ leg accumulators at 1.50+",
        terms: "Full terms…",
        imageUrl: "https://cdn.example.et/promo/welcome.webp",
        startsAt: "2026-11-01T00:00:00Z",
        endsAt: null,
        requiresCode: false,
      },
      {
        id: "01J9A810000000000000000002",
        title: "Accumulator bonus",
        summary: "Up to 100% extra profit on 20+ legs",
        terms: "…",
        imageUrl: null,
        startsAt: null,
        endsAt: null,
        requiresCode: false,
      },
    ]);
    expect(promotionsSchema.parse(offers)).toEqual(offers);
  });

  it("keeps an offer's image only when it is https", () => {
    const [offer] = example("/v1/promotions").items;
    for (const url of [
      "http://cdn.example.et/promo.webp",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "/promo.webp",
      "//cdn.example.et/promo.webp",
      "not a url",
      "",
    ]) {
      expect(
        toPromotions([{ ...offer, image_url: url }])[0].imageUrl,
        url,
      ).toBeNull();
    }
    expect(
      toPromotions([
        { ...offer, image_url: "https://cdn.example.et/a b.webp" },
      ])[0].imageUrl,
    ).toBe("https://cdn.example.et/a%20b.webp");
  });

  it("leaves out terms the API didn't write, and a code the player doesn't need to see", () => {
    const [offer] = example("/v1/promotions").items;
    const withoutTerms = { ...offer };
    delete withoutTerms.terms_md;
    const [mapped] = toPromotions([
      { ...withoutTerms, requires_code: undefined },
    ]);
    expect(mapped.terms).toBeNull();
    expect(mapped.requiresCode).toBe(false);
    expect(toPromotions([{ ...offer, terms_md: "  " }])[0].terms).toBeNull();
    expect(JSON.stringify(mapped)).not.toContain("WELCOME_100");
  });

  it("carries an offer that needs a promo code", () => {
    const [offer] = example("/v1/promotions").items;
    expect(
      toPromotions([{ ...offer, requires_code: true }])[0].requiresCode,
    ).toBe(true);
  });
});

describe("toMyBonuses (AC-11)", () => {
  it("maps the active bonus's wagering required and done and its expiry as the API's strings", () => {
    const bonuses = toMyBonuses(example("/v1/me/bonuses"));

    expect(bonuses.active).toEqual({
      id: "01J9A820000000000000000001",
      title: "100% first deposit bonus",
      amount: "500.00",
      wageringRequired: "2500.00",
      wageringDone: "850.00",
      expiresAt: "2026-10-17T09:00:00Z",
    });
    expect(myBonusesSchema.parse(bonuses)).toEqual(bonuses);
  });

  it("maps each free bet with its conditions, and no active bonus to null", () => {
    const contract = example("/v1/me/bonuses");
    expect(toMyBonuses(contract).freeBets).toEqual([
      {
        id: "01J9A830000000000000000001",
        stake: "50.00",
        minLegs: 3,
        minLegOdds: "1.50",
        minTotalOdds: null,
        expiresAt: "2026-10-10T21:00:00Z",
      },
    ]);

    const none = toMyBonuses({ active: null, free_bets: [] });
    expect(none).toEqual({ active: null, freeBets: [] });
    expect(myBonusesSchema.parse(none)).toEqual(none);
  });

  it("names a bonus by its offer only when the API does", () => {
    const { active, free_bets } = example("/v1/me/bonuses");
    const untitled = { ...active! };
    delete untitled.title;
    expect(toMyBonuses({ active: untitled, free_bets }).active?.title).toBe(
      null,
    );
  });

  it("refuses figures that aren't money, rather than showing them", () => {
    const bonuses = toMyBonuses(example("/v1/me/bonuses"));
    expect(
      myBonusesSchema.safeParse({
        ...bonuses,
        active: { ...bonuses.active, wageringDone: "850" },
      }).success,
    ).toBe(false);
  });
});

describe("redeeming a code (AC-12)", () => {
  it("maps the API's answer, its own words kept", () => {
    const answer = toRedeemResult({
      result: "granted",
      message: "50 ETB free bet added",
    });
    expect(answer).toEqual({
      result: "granted",
      message: "50 ETB free bet added",
    });
    expect(redeemResultSchema.parse(answer)).toEqual(answer);
    expect(toRedeemResult({ result: "pending_deposit" })).toEqual({
      result: "pending_deposit",
      message: null,
    });
    expect(toRedeemResult({ result: "granted", message: " " }).message).toBe(
      null,
    );
  });

  it("accepts from the browser a code of 1 to 32 characters and nothing else", () => {
    expect(
      redeemCodeSchema.safeParse(
        requestExample("/v1/promo-codes/redeem", "post"),
      ).success,
    ).toBe(true);
    expect(redeemCodeSchema.safeParse({ code: "x".repeat(32) }).success).toBe(
      true,
    );
    for (const refused of [
      {},
      { code: "" },
      { code: "x".repeat(33) },
      { code: 50 },
      { code: null },
      { code: "DERBY50", key: "3f0c8b8e-6a3d-4c1e-9d0f-1b2a3c4d5e6f" },
      { promo: "DERBY50" },
      null,
      [],
      "DERBY50",
    ]) {
      expect(
        redeemCodeSchema.safeParse(refused).success,
        JSON.stringify(refused),
      ).toBe(false);
    }
  });
});
