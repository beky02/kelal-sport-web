import { beforeEach, describe, expect, it } from "vitest";
import { redeemNotice, redeemOutcome } from "@/features/promotions/lib/redeem";
import { usePromoStore } from "@/features/promotions/stores/promo.store";
import { ApiError, ContractError } from "@/lib/api/errors";

const problem = (
  status: number,
  code: string,
  extra: { errors?: ApiError["errors"] } = {},
) =>
  new ApiError(
    `The API's own title for ${code}`,
    status,
    code,
    { type: "about:blank", title: "", status, code },
    extra.errors ?? [],
  );

describe("redeemOutcome (AC-12)", () => {
  it("treats no answer as unanswered, a 401 as the session's, and every code as a refusal", () => {
    for (const error of [
      new ApiError("Network request failed", 0, "network"),
      new ContractError("/promo-codes/redeem", "result: invalid"),
      new TypeError("boom"),
      problem(429, "RATE_LIMITED"),
      problem(500, "SERVICE_UNAVAILABLE"),
      problem(502, "SERVICE_UNAVAILABLE"),
      problem(503, "SERVICE_UNAVAILABLE"),
    ]) {
      expect(redeemOutcome(error), String(error)).toEqual({
        kind: "unanswered",
      });
    }
    expect(redeemOutcome(problem(401, "AUTH_TOKEN_EXPIRED"))).toEqual({
      kind: "session",
    });
    for (const [status, code] of [
      [422, "PROMO_INVALID"],
      [404, "PROMO_INVALID"],
      [422, "PROMO_ALREADY_USED"],
      [409, "PROMO_ALREADY_USED"],
      [404, "NOT_FOUND"],
      [422, "VALIDATION_FAILED"],
      [403, "KYC_REQUIRED"],
      [403, "RG_SELF_EXCLUDED"],
      [422, "IDEMPOTENCY_MISMATCH"],
    ] as const) {
      const error = problem(status, code);
      expect(redeemOutcome(error), code).toEqual({ kind: "refused", error });
    }
  });
});

describe("redeemNotice (AC-12)", () => {
  it("says a code isn't valid on PROMO_INVALID and NOT_FOUND, and offers to edit it", () => {
    for (const error of [
      problem(422, "PROMO_INVALID"),
      problem(404, "PROMO_INVALID"),
      problem(404, "NOT_FOUND"),
    ]) {
      expect(redeemNotice(error)).toEqual({
        title: "promotions.codeInvalidTitle",
        body: "promotions.codeInvalidBody",
        detail: null,
        fix: "edit",
      });
    }
  });

  it("says a code was already used on PROMO_ALREADY_USED", () => {
    expect(redeemNotice(problem(422, "PROMO_ALREADY_USED"))).toEqual({
      title: "promotions.codeUsedTitle",
      body: null,
      detail: null,
      fix: null,
    });
  });

  it("names the field's problem the API sent on VALIDATION_FAILED", () => {
    expect(
      redeemNotice(
        problem(422, "VALIDATION_FAILED", {
          errors: [
            { field: "other", code: "FORMAT", message: "Not this one" },
            { field: "code", code: "FORMAT", message: "Letters and digits" },
          ],
        }),
      ),
    ).toEqual({
      title: "promotions.codeCheckTitle",
      body: null,
      detail: "Letters and digits",
      fix: "edit",
    });
    expect(redeemNotice(problem(422, "VALIDATION_FAILED")).detail).toBeNull();
  });

  it("offers Verify on KYC_REQUIRED, and gives the API's title for anything else", () => {
    expect(redeemNotice(problem(403, "KYC_REQUIRED"))).toEqual({
      title: "promotions.codeRefusedTitle",
      body: null,
      detail: "The API's own title for KYC_REQUIRED",
      fix: "verify",
    });
    for (const code of [
      "RG_SELF_EXCLUDED",
      "RG_COOLING_OFF",
      "SOMETHING_NEW",
    ]) {
      expect(redeemNotice(problem(403, code)), code).toEqual({
        title: "promotions.codeRefusedTitle",
        body: null,
        detail: `The API's own title for ${code}`,
        fix: null,
      });
    }
  });
});

describe("one Idempotency-Key per intent (AC-12)", () => {
  beforeEach(() => usePromoStore.setState({ intent: null }));
  const send = (owner: string, code: string) =>
    usePromoStore.getState().send(owner, code);

  it("sends the same key again for the same code after no answer", () => {
    const first = send("p1", "DERBY50")!;
    usePromoStore.getState().unanswered(first.key);
    const again = send("p1", "DERBY50")!;

    expect(again.key).toBe(first.key);
    expect(again.again).toBe(true);
    expect(usePromoStore.getState().intent?.state).toBe("sending");
  });

  it("makes a new key for another code, another player, or a code that was answered", () => {
    const first = send("p1", "DERBY50")!;
    usePromoStore.getState().unanswered(first.key);
    const other = send("p1", "DERBY60")!;
    expect(other.key).not.toBe(first.key);
    expect(other.again).toBe(false);

    usePromoStore.getState().unanswered(other.key);
    const someoneElse = send("p2", "DERBY60")!;
    expect(someoneElse.key).not.toBe(other.key);

    usePromoStore.getState().answered(someoneElse.key);
    expect(usePromoStore.getState().intent).toBeNull();
    const afterAnswer = send("p2", "DERBY60")!;
    expect(afterAnswer.key).not.toBe(someoneElse.key);
  });

  it("sends nothing while a try is on its way", () => {
    const first = send("p1", "DERBY50")!;
    expect(send("p1", "DERBY50")).toBeNull();
    expect(send("p1", "OTHER")).toBeNull();
    usePromoStore.getState().unanswered(first.key);
    expect(send("p1", "DERBY50")).not.toBeNull();
  });

  it("ignores an answer for a key that is no longer the open one", () => {
    const first = send("p1", "DERBY50")!;
    usePromoStore.getState().unanswered(first.key);
    const second = send("p1", "OTHER")!;
    usePromoStore.getState().answered(first.key);
    usePromoStore.getState().unanswered(first.key);
    expect(usePromoStore.getState().intent).toMatchObject({
      key: second.key,
      state: "sending",
    });
  });
});
