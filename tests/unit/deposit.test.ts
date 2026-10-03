import { describe, expect, it } from "vitest";
import {
  amountProblem,
  depositOutcome,
  depositRefusal,
  isFinal,
  sameDeposit,
  shouldPoll,
  typedAmount,
} from "@/features/wallet/lib/deposit";
import type { Deposit, PaymentMethod } from "@/features/wallet/types";
import { ApiError, ContractError } from "@/lib/api/errors";
import { toPaymentMethods } from "@/lib/api/mappers/payments";
import { example } from "../contract";

/** The contract's telebirr: deposits of 20.00 to 100,000.00. */
const TELEBIRR: PaymentMethod = toPaymentMethods(
  example("/v1/payment-methods").items,
)[0];

const problem = (
  status: number,
  code: string,
  extra: { detail?: string; errors?: ApiError["errors"] } = {},
) =>
  new ApiError(
    `The API's own title for ${code}`,
    status,
    code,
    { type: "about:blank", title: "", status, code, ...extra },
    extra.errors ?? [],
  );

describe("amountProblem (AC-7)", () => {
  const range = TELEBIRR.deposit;

  it("compares a typed amount with the method's range as strings (AC-7)", () => {
    expect(range).toEqual({ min: "20.00", max: "100000.00" });
    for (const amount of ["", ".", "0", "0.00", "00"]) {
      expect(amountProblem(amount, range), amount).toBe("empty");
    }
    expect(amountProblem("19.99", range)).toBe("below");
    expect(amountProblem("100000.01", range)).toBe("above");
    // A number far past any limit is still an amount, and still above it.
    expect(amountProblem("9".repeat(22), range)).toBe("above");
    for (const amount of [
      "20",
      "20.00",
      "20.",
      "100000",
      "100000.00",
      "500.5",
    ]) {
      expect(amountProblem(amount, range), amount).toBeNull();
    }
  });

  it("sends what was typed in the contract's form", () => {
    expect(typedAmount("500")).toBe("500.00");
    expect(typedAmount("500.5")).toBe("500.50");
    expect(typedAmount("0500.")).toBe("500.00");
    expect(typedAmount("")).toBeNull();
    expect(typedAmount("0")).toBeNull();
  });

  it("knows one intent from another: the same method and amount, however written", () => {
    expect(
      sameDeposit(
        { method: "telebirr", amount: "500.00" },
        { method: "telebirr", amount: "500.00" },
      ),
    ).toBe(true);
    expect(
      sameDeposit(
        { method: "telebirr", amount: "500.00" },
        { method: "cbebirr", amount: "500.00" },
      ),
    ).toBe(false);
    expect(
      sameDeposit(
        { method: "telebirr", amount: "500.00" },
        { method: "telebirr", amount: "500.01" },
      ),
    ).toBe(false);
  });
});

describe("depositOutcome (AC-8)", () => {
  const kind = (error: unknown) => depositOutcome(error).kind;

  it("tells no answer from a final answer (AC-8)", () => {
    // Nothing settled it: the deposit may exist — the same key goes again.
    expect(kind(new ApiError("offline", 0, "network"))).toBe("unanswered");
    expect(kind(new DOMException("timed out", "TimeoutError"))).toBe(
      "unanswered",
    );
    expect(kind(new ContractError("/deposits", "bad shape"))).toBe(
      "unanswered",
    );
    expect(kind(problem(500, "http_error"))).toBe("unanswered");
    expect(kind(problem(503, "SERVICE_UNAVAILABLE"))).toBe("unanswered");
    expect(kind(problem(504, "http_error"))).toBe("unanswered");
    // The session is gone.
    expect(kind(problem(401, "AUTH_TOKEN_EXPIRED"))).toBe("session");
    // The API answered: a new intent takes a new key.
    expect(kind(problem(422, "PAY_AMOUNT_OUT_OF_RANGE"))).toBe("refused");
    expect(kind(problem(403, "RG_LIMIT_REACHED"))).toBe("refused");
    expect(kind(problem(422, "IDEMPOTENCY_MISMATCH"))).toBe("refused");
    expect(kind(problem(429, "RATE_LIMITED"))).toBe("refused");
    expect(kind(problem(502, "PAY_PROVIDER_ERROR"))).toBe("refused");
    expect(kind(problem(503, "REAL_MONEY_DISABLED"))).toBe("refused");
  });
});

describe("isFinal and shouldPoll", () => {
  const deposit = (over: Partial<Deposit>): Deposit => ({
    id: "d1",
    method: "cbebirr",
    amount: "500.00",
    status: "pending",
    nextAction: { type: "ussd_push", message: null },
    failureReason: null,
    expiresAt: null,
    createdAt: "2026-10-03T13:58:10Z",
    completedAt: null,
    ...over,
  });

  it("keeps reading a deposit that is still going, and stops at its end", () => {
    expect(
      ["completed", "failed", "expired"].map((s) => isFinal(s as never)),
    ).toEqual([true, true, true]);
    expect(isFinal("pending")).toBe(false);
    expect(isFinal("initiated")).toBe(false);

    expect(shouldPoll(undefined)).toBe(true);
    expect(shouldPoll(deposit({}))).toBe(true);
    expect(shouldPoll(deposit({ status: "initiated", nextAction: null }))).toBe(
      true,
    );
    expect(
      shouldPoll(
        deposit({ nextAction: { type: "redirect", url: "https://x.et/p" } }),
      ),
    ).toBe(true);
    // Nothing the player can do here: no point asking again.
    expect(
      shouldPoll(
        deposit({ nextAction: { type: "unsupported", reason: "app_sdk" } }),
      ),
    ).toBe(false);
    for (const status of ["completed", "failed", "expired"] as const) {
      expect(shouldPoll(deposit({ status, nextAction: null })), status).toBe(
        false,
      );
    }
  });
});

describe("depositRefusal (AC-9)", () => {
  const refuse = (
    error: ApiError,
    amount = "500.00",
    breakUntil: string | null = null,
  ) => depositRefusal(error, { method: TELEBIRR, amount, breakUntil });

  it("says what each deposit refusal means and offers its fix (AC-9)", () => {
    expect(refuse(problem(422, "PAY_METHOD_UNAVAILABLE"))).toEqual({
      title: { key: "deposit.refused.methodTitle" },
      body: { key: "deposit.refused.method", method: "telebirr" },
      detail: null,
      fixes: [{ kind: "chooseMethod" }],
    });

    expect(refuse(problem(502, "PAY_PROVIDER_ERROR"))).toMatchObject({
      title: { key: "deposit.refused.providerTitle" },
      body: { key: "deposit.refused.provider", method: "telebirr" },
      fixes: [{ kind: "retry" }, { kind: "chooseMethod" }],
    });

    expect(
      refuse(
        problem(403, "RG_LIMIT_REACHED", {
          detail:
            "Your daily deposit limit of 1,000.00 ETB resets at midnight.",
        }),
      ),
    ).toEqual({
      title: { key: "deposit.refused.limitTitle" },
      body: { key: "deposit.refused.limit" },
      detail: "Your daily deposit limit of 1,000.00 ETB resets at midnight.",
      fixes: [{ kind: "viewLimits" }],
    });

    for (const code of ["RG_SELF_EXCLUDED", "RG_COOLING_OFF"]) {
      expect(refuse(problem(403, code))).toMatchObject({
        title: { key: "deposit.refused.breakTitle" },
        body: { key: "deposit.refused.break" },
        fixes: [],
      });
      expect(
        refuse(problem(403, code), "500.00", "Fri 10 Oct, 18:00").body,
      ).toEqual({
        key: "deposit.refused.breakUntil",
        date: "Fri 10 Oct, 18:00",
      });
    }

    expect(refuse(problem(403, "KYC_REQUIRED"))).toMatchObject({
      title: { key: "deposit.refused.kycTitle" },
      body: { key: "deposit.refused.kyc" },
      fixes: [{ kind: "verify" }],
    });

    expect(refuse(problem(503, "REAL_MONEY_DISABLED"))).toMatchObject({
      title: { key: "deposit.refused.realMoneyTitle" },
      body: { key: "deposit.refused.realMoney" },
      fixes: [],
    });
  });

  it("offers the API's own limit when an amount is out of range, else the method's on that side", () => {
    // The API names the limit: that is the amount offered.
    expect(
      refuse(
        problem(422, "PAY_AMOUNT_OUT_OF_RANGE", {
          errors: [{ field: "amount", code: "MAX", limit: "300.00" }],
        }),
      ),
    ).toEqual({
      title: { key: "deposit.refused.amountTitle" },
      body: {
        key: "deposit.refused.amount",
        method: "telebirr",
        min: "20.00",
        max: "100000.00",
      },
      detail: null,
      fixes: [{ kind: "amount", amount: "300.00" }, { kind: "changeAmount" }],
    });
    // It doesn't: the method's minimum or maximum, on the side the amount fell.
    expect(
      refuse(problem(422, "PAY_AMOUNT_OUT_OF_RANGE"), "10.00").fixes,
    ).toEqual([{ kind: "amount", amount: "20.00" }, { kind: "changeAmount" }]);
    expect(
      refuse(problem(422, "PAY_AMOUNT_OUT_OF_RANGE"), "200000.00").fixes,
    ).toEqual([
      { kind: "amount", amount: "100000.00" },
      { kind: "changeAmount" },
    ]);
    // Within the method's range (a daily total, say) and no limit given, or a
    // "limit" that is no amount: only Change amount.
    expect(refuse(problem(422, "PAY_AMOUNT_OUT_OF_RANGE")).fixes).toEqual([
      { kind: "changeAmount" },
    ]);
    expect(
      refuse(
        problem(422, "PAY_AMOUNT_OUT_OF_RANGE", {
          errors: [{ field: "amount", code: "MAX", limit: "daily" }],
        }),
      ).fixes,
    ).toEqual([{ kind: "changeAmount" }]);
  });

  it("shows the API's own title for a code it has no words for, and the API's detail as its own line", () => {
    expect(
      refuse(
        problem(429, "RATE_LIMITED", { detail: "Try again in a minute." }),
      ),
    ).toEqual({
      title: { key: "deposit.refused.otherTitle" },
      body: { text: "The API's own title for RATE_LIMITED" },
      detail: "Try again in a minute.",
      fixes: [],
    });
    expect(
      refuse(
        problem(422, "VALIDATION_FAILED", {
          errors: [{ field: "amount", code: "FORMAT" }],
        }),
      ).fixes,
    ).toEqual([{ kind: "changeAmount" }]);
  });
});
