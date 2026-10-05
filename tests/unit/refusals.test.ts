import { describe, expect, it } from "vitest";
import {
  refusalNotice,
  type RefusalContext,
} from "@/features/bet-slip/lib/refusals";
import { refusalOf } from "@/features/bet-slip/lib/placement";
import type { PlaceRefusal } from "@/features/bet-slip/types";
import { ApiError, type ProblemFieldError } from "@/lib/api/errors";
import { GOLDEN_RULES } from "../golden";
import { responseExample } from "../contract";

const refusal = (
  code: string,
  {
    status = 422,
    errors = [],
    title = code,
    detail,
    retryAfter = null,
  }: {
    status?: number;
    errors?: ProblemFieldError[];
    title?: string;
    detail?: string;
    retryAfter?: number | null;
  } = {},
): PlaceRefusal =>
  refusalOf(new ApiError(title, status, code, { detail }, errors, retryAfter));

const CTX: RefusalContext = {
  lines: 1,
  rules: GOLDEN_RULES.default_2026_10,
  pickChanged: false,
  pickClosed: false,
  retried: false,
  breakUntil: null,
};

const notice = (r: PlaceRefusal, ctx: Partial<RefusalContext> = {}) =>
  refusalNotice(r, { ...CTX, ...ctx });

describe("refusalNotice: the stake (AC-7)", () => {
  it("offers the engine's maximum from errors[] on the stake", () => {
    expect(
      notice(
        refusal("BET_STAKE_TOO_HIGH", {
          errors: [{ field: "stake", code: "MAX", limit: "50.00" }],
          detail: "Maximum stake is 50.00 ETB.",
        }),
      ),
    ).toEqual({
      title: { key: "betSlip.errors.stakeTooHighTitle" },
      body: { key: "betSlip.errors.stakeTooHighBody", amount: "50.00" },
      // The body says the limit; the API's sentence would repeat it.
      detail: null,
      fix: { kind: "stake", amount: "50.00" },
    });
  });

  it("offers the engine's minimum split across the slip's lines (D1.3)", () => {
    // 10.00 on three singles would charge 9.99; 10.02 charges 3 × 3.34.
    expect(
      notice(
        refusal("BET_STAKE_TOO_LOW", {
          errors: [{ field: "stake", code: "MIN", limit: "10.00" }],
        }),
        { lines: 3 },
      ),
    ).toMatchObject({
      body: { key: "betSlip.errors.stakeTooLowBody", amount: "10.02" },
      fix: { kind: "stake", amount: "10.02" },
    });
  });

  it("names the stake without a figure when the engine gives none, and keeps its detail", () => {
    expect(
      notice(refusal("BET_STAKE_TOO_LOW", { detail: "Too little." })),
    ).toEqual({
      title: { key: "betSlip.errors.stakeTooLowTitle" },
      body: { key: "betSlip.refused.stakeLow" },
      detail: "Too little.",
      fix: null,
    });
    expect(notice(refusal("BET_STAKE_TOO_HIGH"))?.body).toEqual({
      key: "betSlip.refused.stakeHigh",
    });
  });

  it("offers a limit for BET_LIMIT_EXCEEDED only when it is on the stake (M2)", () => {
    expect(
      notice(
        refusal("BET_LIMIT_EXCEEDED", {
          errors: [{ field: "stake", code: "LIMIT", limit: "2000.00" }],
        }),
      ),
    ).toMatchObject({
      body: { key: "betSlip.refused.limitWith", amount: "2000.00" },
      fix: { kind: "stake", amount: "2000.00" },
    });

    // A liability limit on a leg is not a stake: nothing to set.
    expect(
      notice(
        refusal("BET_LIMIT_EXCEEDED", {
          errors: [
            {
              field: "legs[0].outcome_id",
              code: "MAX_LIABILITY",
              limit: "20000.00",
            },
          ],
        }),
      ),
    ).toMatchObject({ body: { key: "betSlip.refused.limit" }, fix: null });
  });

  it("offers no stake for a limit that isn't an amount, and doesn't fail on one (SEC5)", () => {
    // The contract types `limit` as any string; a stake is set only from money.
    const odd = (code: string, limit: string) =>
      notice(
        refusal(code, { errors: [{ field: "stake", code: "X", limit }] }),
        {
          lines: 3,
        },
      );

    expect(odd("BET_STAKE_TOO_LOW", "5.00 ETB")).toMatchObject({
      body: { key: "betSlip.refused.stakeLow" },
      fix: null,
    });
    expect(odd("BET_STAKE_TOO_HIGH", "50")).toMatchObject({
      body: { key: "betSlip.refused.stakeHigh" },
      fix: null,
    });
    expect(odd("BET_LIMIT_EXCEEDED", "2,000.00")).toMatchObject({
      body: { key: "betSlip.refused.limit" },
      fix: null,
    });
  });
});

describe("refusalNotice: money and the player (AC-7)", () => {
  it("offers Deposit for the contract's insufficient funds", () => {
    const p = responseExample(
      "/v1/bets",
      "post",
      422,
      "insufficient_funds",
    ) as {
      title: string;
      code: string;
    };
    expect(
      notice(refusalOf(new ApiError(p.title, 422, p.code, p))),
    ).toMatchObject({
      title: { key: "betSlip.alerts.insufficientTitle" },
      body: { key: "betSlip.refused.insufficient" },
      fix: { kind: "deposit" },
    });
  });

  it("offers Verify for KYC_REQUIRED and View limits for RG_LIMIT_REACHED, with its detail", () => {
    expect(notice(refusal("KYC_REQUIRED", { status: 403 }))?.fix).toEqual({
      kind: "verify",
    });
    expect(
      notice(
        refusal("RG_LIMIT_REACHED", {
          status: 403,
          detail: "Your daily stake limit resets at 00:00.",
        }),
      ),
    ).toEqual({
      title: { key: "betSlip.refused.rgLimitTitle" },
      body: { key: "betSlip.refused.rgLimit" },
      detail: "Your daily stake limit resets at 00:00.",
      fix: { kind: "viewLimits" },
    });
  });

  it("says betting is paused during a break, until its end when known, and offers View limits (F7a)", () => {
    for (const code of ["RG_SELF_EXCLUDED", "RG_COOLING_OFF"]) {
      expect(notice(refusal(code, { status: 403 }))).toMatchObject({
        title: { key: "betSlip.refused.breakTitle" },
        body: { key: "betSlip.refused.break" },
        // F7a's scope: the RG refusals come with View limits, wherever they appear.
        fix: { kind: "viewLimits" },
      });
      expect(
        notice(refusal(code, { status: 403 }), {
          breakUntil: "09/10 · 12:00",
        })?.body,
      ).toEqual({ key: "betSlip.refused.breakUntil", date: "09/10 · 12:00" });
    }
  });

  it("says how long to wait when rate-limited, if the API said", () => {
    expect(
      notice(refusal("RATE_LIMITED", { status: 429, retryAfter: 30 }))?.body,
    ).toEqual({ key: "betSlip.refused.rateLimitedSeconds", seconds: 30 });
    expect(notice(refusal("RATE_LIMITED", { status: 429 }))?.body).toEqual({
      key: "betSlip.refused.rateLimited",
    });
  });

  it("says real-money betting is not available, with nothing to retry", () => {
    expect(
      notice(refusal("REAL_MONEY_DISABLED", { status: 503 })),
    ).toMatchObject({ body: { key: "betSlip.refused.realMoney" }, fix: null });
  });
});

describe("refusalNotice: the picks", () => {
  it("leaves odds changed and closed picks to the slip's own alerts once a pick shows it", () => {
    expect(
      notice(refusal("BET_ODDS_CHANGED", { status: 409 }), {
        pickChanged: true,
      }),
    ).toBeNull();
    expect(
      notice(refusal("BET_MARKET_SUSPENDED", { status: 409 }), {
        pickClosed: true,
      }),
    ).toBeNull();
  });

  it("still says the bet wasn't placed when no pick shows it", () => {
    expect(notice(refusal("BET_ODDS_CHANGED", { status: 409 }))?.body).toEqual({
      key: "betSlip.refused.oddsUnknown",
    });
    expect(notice(refusal("BET_EVENT_STARTED", { status: 409 }))?.body).toEqual(
      { key: "betSlip.refused.closedUnknown" },
    );
  });

  it("says a Try again met moved odds or a closed pick, even with the pick showing it (N2)", () => {
    // The pick alerts can't say it — "wasn't placed" is not for a Try again.
    expect(
      notice(refusal("BET_ODDS_CHANGED", { status: 409 }), {
        retried: true,
        pickChanged: true,
      }),
    ).toMatchObject({
      title: { key: "betSlip.unconfirmed.retryRefused" },
      body: { key: "betSlip.unconfirmed.oddsChanged" },
    });
    expect(
      notice(refusal("BET_EVENT_STARTED", { status: 409 }), {
        retried: true,
        pickClosed: true,
      }),
    ).toMatchObject({
      title: { key: "betSlip.unconfirmed.retryRefused" },
      body: { key: "betSlip.unconfirmed.closed" },
    });
  });

  it("counts the slip's limits from the rule set when the API gives none", () => {
    expect(notice(refusal("BET_TOO_MANY_LEGS"))?.body).toEqual({
      key: "betSlip.errors.tooManyLegsBody",
      n: 30,
    });
    expect(
      notice(refusal("BET_TOO_MANY_LINES"), { rules: null })?.body,
    ).toEqual({ key: "betSlip.placeFailedBody" });
  });
});

describe("refusalNotice: a refused Try again (M8, N2)", () => {
  it("is titled as a Try again that didn't go through, never as a bet not accepted", () => {
    // A refusal of a retry says nothing about the first try, which may
    // still have gone through.
    for (const r of [
      refusal("RATE_LIMITED", { status: 429, retryAfter: 30 }),
      refusal("REAL_MONEY_DISABLED", { status: 503 }),
      refusal("BET_RELATED_SELECTIONS"),
      refusal("BET_FREE_BET_INVALID", { title: "This free bet has expired" }),
      refusal("WALLET_INSUFFICIENT_FUNDS"),
      refusal("RG_LIMIT_REACHED", { status: 403 }),
    ]) {
      expect(notice(r, { retried: true })?.title, r.code).toEqual({
        key: "betSlip.unconfirmed.retryRefused",
      });
    }
  });

  it("keeps the reason and the fix of a first try's refusal", () => {
    const retried = (r: PlaceRefusal) => notice(r, { retried: true });

    expect(
      retried(refusal("RATE_LIMITED", { status: 429, retryAfter: 30 }))?.body,
    ).toEqual({ key: "betSlip.refused.rateLimitedSeconds", seconds: 30 });
    expect(retried(refusal("WALLET_INSUFFICIENT_FUNDS"))).toMatchObject({
      body: { key: "betSlip.refused.insufficient" },
      fix: { kind: "deposit" },
    });
    expect(
      retried(
        refusal("BET_STAKE_TOO_HIGH", {
          errors: [{ field: "stake", code: "MAX", limit: "50.00" }],
        }),
      ),
    ).toEqual({
      title: { key: "betSlip.unconfirmed.retryRefused" },
      body: { key: "betSlip.errors.stakeTooHighBody", amount: "50.00" },
      detail: null,
      fix: { kind: "stake", amount: "50.00" },
    });
  });
});

describe("refusalNotice: codes it has no copy of (Q5)", () => {
  it("shows the API's own translated title", () => {
    expect(
      notice(
        refusal("BET_FREE_BET_INVALID", { title: "This free bet has expired" }),
      ),
    ).toEqual({
      title: { key: "betSlip.placeFailed" },
      body: { text: "This free bet has expired" },
      detail: null,
      fix: null,
    });
  });

  it("never shows the app's own technical message for an answer that wasn't a Problem", () => {
    expect(
      notice(
        refusal("http_error", {
          status: 403,
          title: "POST /bets failed with 403",
        }),
      )?.body,
    ).toEqual({ key: "betSlip.placeFailedBody" });
  });
});
