import { describe, expect, it } from "vitest";
import {
  toExclusion,
  toLimit,
  toLimitSet,
  toLimits,
  toSelfExclusionRequest,
} from "@/lib/api/mappers/responsible-gambling";
import type { components } from "@/lib/api/schema";
import {
  exclusionSchema,
  limitChangeSchema,
  rgLimitSchema,
  rgLimitsSchema,
  selfExclusionRequestSchema,
} from "@/lib/api/schemas";
import { example, requestExample, responseExample } from "../contract";

type ApiLimit = components["schemas"]["RgLimit"];
type ApiExclusion = components["schemas"]["Exclusion"];

describe("toLimits (AC-1)", () => {
  it("maps the contract's limits: the API's strings, the pending change with its effective time", () => {
    const limits = toLimits(example("/v1/me/limits").items);

    expect(limits).toEqual([
      {
        type: "deposit",
        period: "week",
        amount: "1000.00",
        minutes: null,
        effectiveFrom: "2026-10-01T08:15:00Z",
        used: "500.00",
        pending: {
          amount: "2000.00",
          minutes: null,
          effectiveFrom: "2026-10-04T10:00:00Z",
        },
      },
      {
        type: "session_minutes",
        period: "day",
        amount: null,
        minutes: 120,
        effectiveFrom: "2026-10-01T08:15:00Z",
        used: null,
        pending: null,
      },
    ]);
    // What the route handler answers is what the browser accepts.
    expect(rgLimitsSchema.parse(limits)).toEqual(limits);
  });

  it("leaves out a limit of a type or period the contract added after this build", () => {
    const [deposit] = example("/v1/me/limits").items;
    const later = [
      { ...deposit, type: "games" },
      { ...deposit, period: "year" },
    ] as unknown as ApiLimit[];

    expect(toLimits([...later, deposit])).toEqual([toLimit(deposit)]);
  });

  it("reads what the API left out as null, never as zero", () => {
    const bare: ApiLimit = {
      type: "loss",
      period: "month",
      effective_from: "2026-10-01T08:15:00Z",
    };

    expect(toLimit(bare)).toEqual({
      type: "loss",
      period: "month",
      amount: null,
      minutes: null,
      effectiveFrom: "2026-10-01T08:15:00Z",
      used: null,
      pending: null,
    });
  });

  it("maps the limit PUT answers with: the change it holds back, and when it applies", () => {
    const limit = toLimit(
      responseExample("/v1/me/limits", "put", 200) as ApiLimit,
    );

    expect(limit.amount).toBe("1000.00");
    expect(limit.pending).toEqual({
      amount: "2000.00",
      minutes: null,
      effectiveFrom: "2026-10-04T10:00:00Z",
    });
    expect(rgLimitSchema.parse(limit)).toEqual(limit);
  });
});

describe("toLimitSet (AC-5)", () => {
  it("sends a money limit as the contract's own request: type, period and amount", () => {
    const change = {
      type: "deposit",
      period: "week",
      amount: "2000.00",
    } as const;

    expect(toLimitSet(change)).toEqual(requestExample("/v1/me/limits", "put"));
    expect(limitChangeSchema.parse(change)).toEqual(change);
  });

  it("sends a time limit in minutes alone, never with amount: null, which removes a limit", () => {
    const set = toLimitSet({
      type: "session_minutes",
      period: "day",
      minutes: 90,
    });

    expect(set).toEqual({
      type: "session_minutes",
      period: "day",
      minutes: 90,
    });
    expect(set).not.toHaveProperty("amount");
  });
});

describe("self-exclusion (AC-6)", () => {
  it("sends the contract's own request", () => {
    const request = { kind: "time_out", duration: "7d" } as const;

    expect(toSelfExclusionRequest(request)).toEqual(
      requestExample("/v1/me/self-exclusion", "post"),
    );
    expect(selfExclusionRequestSchema.parse(request)).toEqual(request);
  });

  it("maps the exclusion the API started, with when it ends", () => {
    const exclusion = toExclusion(
      responseExample("/v1/me/self-exclusion", "post", 201) as ApiExclusion,
    );

    expect(exclusion).toEqual({
      kind: "time_out",
      startsAt: "2026-10-03T12:00:00Z",
      endsAt: "2026-10-10T12:00:00Z",
    });
    expect(exclusionSchema.parse(exclusion)).toEqual(exclusion);
  });

  it("keeps a permanent exclusion's missing end as null", () => {
    const exclusion = toExclusion({
      kind: "self_exclusion",
      starts_at: "2026-10-03T12:00:00Z",
      ends_at: null,
    });

    expect(exclusion.endsAt).toBeNull();
    expect(exclusionSchema.parse(exclusion)).toEqual(exclusion);
  });
});

describe("what the route handlers accept from the browser", () => {
  it("takes a limit above zero in the contract's form, and nothing else", () => {
    const ok = [
      { type: "stake", period: "day", amount: "0.01" },
      { type: "loss", period: "month", amount: "999999999999.99" },
      { type: "session_minutes", period: "week", minutes: 1 },
    ];
    const refused = [
      { type: "deposit", period: "week", amount: "0.00" },
      { type: "deposit", period: "week", amount: "-5.00" },
      { type: "deposit", period: "week", amount: "100" },
      { type: "deposit", period: "week", amount: null },
      { type: "deposit", period: "week", minutes: 60 },
      { type: "deposit", period: "year", amount: "100.00" },
      { type: "session_minutes", period: "day", minutes: 0 },
      { type: "session_minutes", period: "day", minutes: 1.5 },
      { type: "session_minutes", period: "day", minutes: 1_000_000 },
      { type: "session_minutes", period: "day", amount: "100.00" },
      { type: "session_minutes", period: "day", minutes: 60, amount: null },
      { type: "deposit", period: "week", amount: "100.00", note: "x" },
      { type: "games", period: "week", amount: "100.00" },
    ];

    for (const body of ok) {
      expect(
        limitChangeSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(true);
    }
    for (const body of refused) {
      expect(
        limitChangeSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
  });

  it("takes an exclusion of the contract's kinds and durations, and nothing else", () => {
    expect(
      selfExclusionRequestSchema.safeParse({
        kind: "self_exclusion",
        duration: "5y",
      }).success,
    ).toBe(true);
    for (const body of [
      { kind: "operator_exclusion", duration: "7d" },
      { kind: "time_out", duration: "2d" },
      { kind: "time_out" },
      { kind: "time_out", duration: "7d", until: "2026-10-10" },
    ]) {
      expect(
        selfExclusionRequestSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
  });
});
