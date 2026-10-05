import { describe, expect, it } from "vitest";
import {
  cancelOutcome,
  isCancellable,
  isFinal,
  pollInterval,
  REVIEW_POLL_MS,
  reviewReasonKey,
  sameWithdrawal,
  WITHDRAWAL_POLL_MS,
  withdrawalOutcome,
  withdrawalRefusal,
} from "@/features/wallet/lib/withdrawal";
import {
  WITHDRAWAL_STATUSES,
  type PaymentMethod,
  type Withdrawal,
  type WithdrawalRequest,
} from "@/features/wallet/types";
import { ApiError, ContractError } from "@/lib/api/errors";
import { toPaymentMethods } from "@/lib/api/mappers/payments";
import { example } from "../contract";

/** The contract's telebirr: withdrawals of 50.00 to 50,000.00. */
const TELEBIRR: PaymentMethod = toPaymentMethods(
  example("/v1/payment-methods").items,
)[0];
const RANGE = TELEBIRR.withdrawal!;

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

const withdrawal = (status: Withdrawal["status"]): Withdrawal => ({
  id: "01J9A7Y0000000000000000001",
  method: "telebirr",
  amount: "2000.00",
  status,
  accountMasked: "+2519••••567",
  reviewReason: null,
  rejectionReason: null,
  createdAt: "2026-10-04T09:00:00Z",
  paidAt: null,
});

describe("withdrawalOutcome (AC-8)", () => {
  const kind = (error: unknown) => withdrawalOutcome(error).kind;

  it("tells no answer from a final answer (AC-8)", () => {
    // Nothing settled it: the withdrawal may exist — the same key goes again.
    expect(kind(new ApiError("offline", 0, "network"))).toBe("unanswered");
    expect(kind(new DOMException("timed out", "TimeoutError"))).toBe(
      "unanswered",
    );
    expect(kind(new ContractError("/withdrawals", "bad shape"))).toBe(
      "unanswered",
    );
    expect(kind(problem(500, "http_error"))).toBe("unanswered");
    expect(kind(problem(503, "SERVICE_UNAVAILABLE"))).toBe("unanswered");
    expect(kind(problem(429, "RATE_LIMITED"))).toBe("unanswered");
    // No 502 is in the contract for a withdrawal: whatever it says, a
    // same-key retry can never request a second one.
    expect(kind(problem(502, "PAY_PROVIDER_ERROR"))).toBe("unanswered");
    // The session is gone.
    expect(kind(problem(401, "AUTH_TOKEN_EXPIRED"))).toBe("session");
    // The API answered: a new intent takes a new key.
    expect(kind(problem(403, "KYC_REQUIRED"))).toBe("refused");
    expect(kind(problem(409, "PAY_WITHDRAWAL_NOT_CANCELLABLE"))).toBe(
      "refused",
    );
    expect(kind(problem(422, "WALLET_INSUFFICIENT_FUNDS"))).toBe("refused");
    expect(kind(problem(422, "IDEMPOTENCY_MISMATCH"))).toBe("refused");
    expect(kind(problem(503, "REAL_MONEY_DISABLED"))).toBe("refused");
  });
});

describe("cancelOutcome (AC-10)", () => {
  it("tells a cancel's answers apart: too late, gone, no answer, a refusal", () => {
    const kind = (error: unknown) => cancelOutcome(error).kind;
    expect(kind(problem(409, "PAY_WITHDRAWAL_NOT_CANCELLABLE"))).toBe(
      "tooLate",
    );
    expect(kind(problem(404, "NOT_FOUND"))).toBe("gone");
    expect(kind(problem(401, "AUTH_TOKEN_EXPIRED"))).toBe("session");
    expect(kind(new ApiError("offline", 0, "network"))).toBe("unanswered");
    expect(kind(problem(503, "SERVICE_UNAVAILABLE"))).toBe("unanswered");
    expect(kind(problem(429, "RATE_LIMITED"))).toBe("unanswered");
    // Another conflict is the API's to name: its title, not "too late".
    expect(kind(problem(409, "VALIDATION_FAILED"))).toBe("refused");
    expect(kind(problem(403, "PERMISSION_DENIED"))).toBe("refused");
  });
});

describe("statuses (AC-1, AC-10)", () => {
  it("knows which statuses are final and which can still be cancelled", () => {
    const final = WITHDRAWAL_STATUSES.filter(isFinal);
    expect(final).toEqual(["paid", "failed", "rejected", "cancelled"]);
    expect(WITHDRAWAL_STATUSES.filter(isCancellable)).toEqual([
      "requested",
      "review",
    ]);
  });

  it("reads a moving withdrawal every 10 s, one in review every minute, and a decided one never", () => {
    expect(WITHDRAWAL_POLL_MS).toBe(10_000);
    expect(REVIEW_POLL_MS).toBe(60_000);
    // Not read yet, or the last read failed: try again on the short beat.
    expect(pollInterval(undefined)).toBe(WITHDRAWAL_POLL_MS);
    for (const status of ["requested", "approved", "processing"] as const) {
      expect(pollInterval(withdrawal(status)), status).toBe(WITHDRAWAL_POLL_MS);
    }
    expect(pollInterval(withdrawal("review"))).toBe(REVIEW_POLL_MS);
    for (const status of ["paid", "failed", "rejected", "cancelled"] as const) {
      expect(pollInterval(withdrawal(status)), status).toBe(false);
    }
  });

  it("names a review reason it knows, and never shows one it doesn't (AC-1)", () => {
    expect(reviewReasonKey("FIRST_WITHDRAWAL")).toBe(
      "withdraw.reviewReason.FIRST_WITHDRAWAL",
    );
    // An AML hold, a code added later, nothing: no line, never a raw code.
    expect(reviewReasonKey("LOW_PLAY_CASHOUT")).toBeNull();
    expect(reviewReasonKey("toString")).toBeNull();
    expect(reviewReasonKey("")).toBeNull();
    expect(reviewReasonKey(null)).toBeNull();
  });
});

describe("sameWithdrawal (AC-8)", () => {
  const base: WithdrawalRequest = {
    method: "telebirr",
    amount: "500.00",
    to: { kind: "saved", payoutAccountId: "01J9A7X0000000000000000001" },
  };

  it("knows one intent from another: the same method, account and amount, however written", () => {
    expect(sameWithdrawal(base, { ...base, amount: "500.0" })).toBe(true);
    expect(sameWithdrawal(base, { ...base, amount: "500.01" })).toBe(false);
    expect(sameWithdrawal(base, { ...base, method: "cbebirr" })).toBe(false);
    expect(
      sameWithdrawal(base, {
        ...base,
        to: { kind: "saved", payoutAccountId: "01J9A7X0000000000000000002" },
      }),
    ).toBe(false);
    const fresh: WithdrawalRequest = {
      ...base,
      to: { kind: "new", account: "+251911234567" },
    };
    expect(sameWithdrawal(base, fresh)).toBe(false);
    expect(sameWithdrawal(fresh, { ...fresh })).toBe(true);
    expect(
      sameWithdrawal(fresh, {
        ...fresh,
        to: { kind: "new", account: "+251911234568" },
      }),
    ).toBe(false);
  });
});

describe("withdrawalRefusal (AC-9)", () => {
  const refuse = (
    error: ApiError,
    { amount = "2000.00", cash = "5000.00", retried = false } = {},
  ) =>
    withdrawalRefusal(error, {
      method: TELEBIRR,
      range: RANGE,
      amount,
      cash,
      retried,
    });

  it("says what each withdrawal refusal means and offers its fix (AC-9)", () => {
    expect(refuse(problem(403, "KYC_REQUIRED"))).toEqual({
      title: { key: "withdraw.refused.kycTitle" },
      body: { key: "withdraw.refused.kyc" },
      detail: null,
      fixes: [{ kind: "verify" }],
    });

    expect(
      refuse(
        problem(422, "PAY_ACTIVE_BONUS_WAGERING", {
          detail: "Withdrawing now forfeits your bonus of 500.00 ETB.",
        }),
      ),
    ).toEqual({
      title: { key: "withdraw.refused.bonusTitle" },
      body: { key: "withdraw.refused.bonus" },
      // The API's own figure, as its own line: nothing worked out here.
      detail: "Withdrawing now forfeits your bonus of 500.00 ETB.",
      fixes: [{ kind: "keepWagering" }],
    });

    expect(refuse(problem(422, "WALLET_INSUFFICIENT_FUNDS"))).toMatchObject({
      title: { key: "withdraw.refused.fundsTitle" },
      body: { key: "withdraw.refused.funds" },
      fixes: [{ kind: "changeAmount" }],
    });

    for (const code of ["RG_SELF_EXCLUDED", "RG_COOLING_OFF"]) {
      expect(refuse(problem(403, code))).toMatchObject({
        title: { key: "withdraw.refused.breakTitle" },
        body: { key: "withdraw.refused.break" },
        fixes: [{ kind: "help" }],
      });
    }

    expect(refuse(problem(503, "REAL_MONEY_DISABLED"))).toMatchObject({
      title: { key: "withdraw.refused.realMoneyTitle" },
      body: { key: "withdraw.refused.realMoney" },
      fixes: [],
    });

    expect(refuse(problem(422, "PAY_METHOD_UNAVAILABLE"))).toMatchObject({
      title: { key: "withdraw.refused.methodTitle" },
      body: { key: "withdraw.refused.method", method: "telebirr" },
      fixes: [{ kind: "chooseMethod" }],
    });

    // Outside the method's range: the range says it, and its limit on the
    // side the amount fell is offered.
    expect(
      refuse(problem(422, "PAY_AMOUNT_OUT_OF_RANGE"), {
        amount: "60000.00",
        cash: "60000.00",
      }),
    ).toEqual({
      title: { key: "withdraw.refused.amountTitle" },
      body: {
        key: "withdraw.refused.amount",
        method: "telebirr",
        min: "50.00",
        max: "50000.00",
      },
      detail: null,
      fixes: [{ kind: "amount", amount: "50000.00" }, { kind: "changeAmount" }],
    });
  });

  it("offers only an amount the method takes and the balance covers (AC-9)", () => {
    // Inside the method's range, another limit applied: the API's words say
    // which, and its limit for the amount is offered.
    expect(
      refuse(
        problem(422, "PAY_AMOUNT_OUT_OF_RANGE", {
          errors: [
            { field: "amount", code: "DAILY_MAX", limit: "1500.00" },
            { field: "count", code: "DAILY_COUNT", limit: "3" },
          ],
        }),
      ),
    ).toMatchObject({
      body: { text: "The API's own title for PAY_AMOUNT_OUT_OF_RANGE" },
      fixes: [{ kind: "amount", amount: "1500.00" }, { kind: "changeAmount" }],
    });

    // A limit the cash balance doesn't cover is never offered: only the way
    // back to the amount.
    expect(
      refuse(
        problem(422, "PAY_AMOUNT_OUT_OF_RANGE", {
          errors: [{ field: "amount", code: "DAILY_MAX", limit: "1500.00" }],
        }),
        { cash: "1200.00" },
      ).fixes,
    ).toEqual([{ kind: "changeAmount" }]);
    expect(
      refuse(problem(422, "PAY_AMOUNT_OUT_OF_RANGE"), {
        amount: "60000.00",
        cash: "40000.00",
      }).fixes,
    ).toEqual([{ kind: "changeAmount" }]);
  });

  it("titles a refused Try again as one, and never offers a new withdrawal of the same amount", () => {
    const notice = refuse(problem(422, "VALIDATION_FAILED"), { retried: true });

    expect(notice.title).toEqual({ key: "withdraw.refused.retryTitle" });
    expect(notice.fixes).toEqual([]);
  });

  it("shows the API's own title for a code it has no words for, with the fix its errors name", () => {
    expect(
      refuse(
        problem(422, "VALIDATION_FAILED", {
          detail: "That account can't receive payouts.",
          errors: [{ field: "payout_account_id", code: "NOT_ALLOWED" }],
        }),
      ),
    ).toEqual({
      title: { key: "withdraw.refused.otherTitle" },
      body: { text: "The API's own title for VALIDATION_FAILED" },
      detail: "That account can't receive payouts.",
      fixes: [{ kind: "chooseAccount" }],
    });
    expect(
      refuse(
        problem(422, "VALIDATION_FAILED", {
          errors: [{ field: "account", code: "FORMAT" }],
        }),
      ).fixes,
    ).toEqual([{ kind: "chooseAccount" }]);
    expect(
      refuse(
        problem(422, "VALIDATION_FAILED", {
          errors: [{ field: "amount", code: "FORMAT" }],
        }),
      ).fixes,
    ).toEqual([{ kind: "changeAmount" }]);
    expect(refuse(problem(409, "IDEMPOTENCY_MISMATCH")).fixes).toEqual([
      { kind: "retry" },
    ]);
  });
});
