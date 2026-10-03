import { describe, expect, it } from "vitest";
import {
  toDeposit,
  toDepositRequest,
  toPaymentMethods,
} from "@/lib/api/mappers/payments";
import type { components } from "@/lib/api/schema";
import { depositSchema, paymentMethodsSchema } from "@/lib/api/schemas";
import { example, responseExample } from "../contract";

type ApiDeposit = components["schemas"]["Deposit"];
type ApiMethod = components["schemas"]["PaymentMethod"];

const created = (name: "redirect" | "ussd_push") =>
  responseExample("/v1/deposits", "post", 201, name) as ApiDeposit;
const read = (name: "completed" | "pending") =>
  responseExample("/v1/deposits/{id}", "get", 200, name) as ApiDeposit;

const allowAll = () => true;

describe("toPaymentMethods (AC-7)", () => {
  it("maps the contract's methods: names, flows, availability and limits as strings", () => {
    const methods = toPaymentMethods(example("/v1/payment-methods").items);

    expect(methods).toEqual([
      {
        code: "telebirr",
        name: "telebirr",
        flow: "app_or_web",
        available: true,
        deposit: { min: "20.00", max: "100000.00" },
        withdrawal: { min: "50.00", max: "50000.00" },
      },
      {
        code: "cbebirr",
        name: "CBE Birr",
        flow: "ussd_push",
        available: true,
        deposit: { min: "20.00", max: "100000.00" },
        withdrawal: { min: "50.00", max: "50000.00" },
      },
      {
        code: "chapa",
        name: "Bank card / bank (Chapa)",
        flow: "redirect",
        available: false,
        deposit: { min: "50.00", max: "100000.00" },
        withdrawal: null,
      },
    ]);
    // What the route handler answers is what the browser accepts.
    expect(paymentMethodsSchema.parse(methods)).toEqual(methods);
  });

  it("leaves out a method the contract added after this build, and names no flow it doesn't know", () => {
    const [telebirr, cbebirr] = example("/v1/payment-methods").items;
    const added = { ...telebirr, code: "lottery_pay" } as unknown as ApiMethod;
    const qr = { ...cbebirr, flow: "qr" } as unknown as ApiMethod;

    const methods = toPaymentMethods([added, qr]);

    expect(methods.map((method) => method.code)).toEqual(["cbebirr"]);
    expect(methods[0].flow).toBe("other");
    expect(paymentMethodsSchema.parse(methods)).toEqual(methods);
  });

  it("keeps an absent withdrawal range absent, never a zero range", () => {
    const [telebirr] = example("/v1/payment-methods").items;
    delete telebirr.withdrawal;

    expect(toPaymentMethods([telebirr])[0].withdrawal).toBeNull();
  });
});

describe("toDeposit", () => {
  it("maps the contract's redirect deposit, its page allowed (AC-3)", () => {
    const deposit = toDeposit(created("redirect"), allowAll);

    expect(deposit).toEqual({
      id: "01J9A7W0000000000000000002",
      method: "chapa",
      amount: "500.00",
      status: "pending",
      nextAction: {
        type: "redirect",
        url: "https://checkout.chapa.co/checkout/payment/abc123",
      },
      failureReason: null,
      expiresAt: "2026-10-03T14:13:10Z",
      createdAt: "2026-10-03T13:58:10Z",
      completedAt: null,
    });
    expect(depositSchema.parse(deposit)).toEqual(deposit);
  });

  it("turns a redirect it may not follow into can't-continue-here, without the URL (AC-3)", () => {
    const asked: string[] = [];

    const deposit = toDeposit(created("redirect"), (url) => {
      asked.push(url);
      return false;
    });

    expect(asked).toEqual([
      "https://checkout.chapa.co/checkout/payment/abc123",
    ]);
    expect(deposit.nextAction).toEqual({
      type: "unsupported",
      reason: "redirect_refused",
    });
    expect(JSON.stringify(deposit)).not.toContain("checkout.chapa.co");
    expect(depositSchema.parse(deposit)).toEqual(deposit);
  });

  it("maps the contract's phone deposit with the API's own message", () => {
    const deposit = toDeposit(created("ussd_push"), allowAll);

    expect(deposit).toMatchObject({
      id: "01J9A7W0000000000000000003",
      method: "cbebirr",
      amount: "500.00",
      status: "pending",
      nextAction: {
        type: "ussd_push",
        message: "Approve the payment on your phone",
      },
    });
    expect(depositSchema.parse(deposit)).toEqual(deposit);
  });

  it("maps the contract's completed and pending reads", () => {
    const completed = toDeposit(read("completed"), allowAll);
    expect(completed).toMatchObject({
      status: "completed",
      nextAction: null,
      completedAt: "2026-10-03T13:58:41Z",
    });
    expect(depositSchema.parse(completed)).toEqual(completed);

    const pending = toDeposit(read("pending"), allowAll);
    expect(pending).toMatchObject({
      status: "pending",
      nextAction: {
        type: "redirect",
        url: "https://app.ethiotelecom.et/pay/abc",
      },
      completedAt: null,
    });
  });

  it("can't follow an app-only payment, a redirect without a page, or a kind the contract adds", () => {
    const base = created("ussd_push");
    const withAction = (next_action: unknown) =>
      toDeposit({ ...base, next_action } as ApiDeposit, allowAll).nextAction;

    expect(
      withAction({ type: "app_sdk", sdk_payload: { order: "x" } }),
    ).toEqual({ type: "unsupported", reason: "app_sdk" });
    expect(withAction({ type: "redirect" })).toEqual({
      type: "unsupported",
      reason: "redirect_refused",
    });
    expect(withAction({ type: "qr_code" })).toEqual({
      type: "unsupported",
      reason: "unknown",
    });
    expect(withAction({ type: "ussd_push" })).toEqual({
      type: "ussd_push",
      message: null,
    });
    expect(withAction(null)).toBeNull();
    expect(withAction(undefined)).toBeNull();
  });

  it("keeps the API's failure reason, and leaves absent times empty", () => {
    const rest = read("pending");
    delete rest.expires_at;
    const failed = toDeposit(
      {
        ...rest,
        status: "failed",
        next_action: null,
        failure_reason: "Declined by the wallet",
      },
      allowAll,
    );

    expect(failed).toMatchObject({
      status: "failed",
      failureReason: "Declined by the wallet",
      expiresAt: null,
      completedAt: null,
    });
    expect(depositSchema.parse(failed)).toEqual(failed);
  });
});

describe("toDepositRequest", () => {
  it("sends the method and the amount with this site's return address, and nothing else", () => {
    expect(
      toDepositRequest(
        { method: "cbebirr", amount: "500.00" },
        "http://localhost:3000/wallet?deposit=return",
      ),
    ).toEqual({
      method: "cbebirr",
      amount: "500.00",
      return_url: "http://localhost:3000/wallet?deposit=return",
    });
  });
});
