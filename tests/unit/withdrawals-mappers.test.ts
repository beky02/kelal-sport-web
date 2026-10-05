import { describe, expect, it } from "vitest";
import {
  toPayoutAccount,
  toPayoutAccountCreate,
  toPayoutAccounts,
  toWithdrawal,
  toWithdrawalRequest,
} from "@/lib/api/mappers/withdrawals";
import type { components } from "@/lib/api/schema";
import {
  payoutAccountRequestSchema,
  payoutAccountSchema,
  payoutAccountsSchema,
  withdrawalRequestSchema,
  withdrawalSchema,
} from "@/lib/api/schemas";
import { example, responseExample } from "../contract";

type ApiAccount = components["schemas"]["PayoutAccount"];
type ApiWithdrawal = components["schemas"]["Withdrawal"];

const requested = (name: "processing" | "review") =>
  responseExample("/v1/withdrawals", "post", 201, name) as ApiWithdrawal;

describe("toPayoutAccounts (AC-10)", () => {
  it("maps the contract's payout accounts", () => {
    const accounts = toPayoutAccounts(example("/v1/me/payout-accounts").items);

    expect(accounts).toEqual([
      {
        id: "01J9A7X0000000000000000001",
        provider: "telebirr",
        accountMasked: "+2519••••567",
        holderName: "Abebe Kebede",
        verified: true,
        createdAt: "2026-10-01T09:00:00Z",
      },
    ]);
    // What the route handler answers is what the browser accepts.
    expect(payoutAccountsSchema.parse(accounts)).toEqual(accounts);
  });

  it("leaves out an account on a method the contract added after this build", () => {
    const [saved] = example("/v1/me/payout-accounts").items;
    const added = {
      ...saved,
      provider: "lottery_pay",
    } as unknown as ApiAccount;

    expect(toPayoutAccounts([added, saved]).map((a) => a.id)).toEqual([
      saved.id,
    ]);
  });

  it("maps the account the API just added, its holder not known yet", () => {
    const account = toPayoutAccount(
      responseExample("/v1/me/payout-accounts", "post", 201) as ApiAccount,
    );

    expect(account).toEqual({
      id: "01J9A7X0000000000000000002",
      provider: "telebirr",
      accountMasked: "+2519••••567",
      holderName: null,
      verified: false,
      createdAt: "2026-10-03T10:00:00Z",
    });
    expect(payoutAccountSchema.parse(account)).toEqual(account);
  });

  it("sends a new account as the contract's provider and account_ref", () => {
    const request = { provider: "cbebirr", account: "+251911234567" } as const;

    expect(payoutAccountRequestSchema.parse(request)).toEqual(request);
    expect(toPayoutAccountCreate(request)).toEqual({
      provider: "cbebirr",
      account_ref: "+251911234567",
    });
  });
});

describe("toWithdrawal (AC-1)", () => {
  it("maps the contract's withdrawals: processing, review, paid", () => {
    const processing = toWithdrawal(requested("processing"));
    expect(processing).toEqual({
      id: "01J9A7Y0000000000000000001",
      method: "telebirr",
      amount: "2000.00",
      status: "processing",
      accountMasked: "+2519••••567",
      reviewReason: null,
      rejectionReason: null,
      createdAt: "2026-10-04T09:00:00Z",
      paidAt: null,
    });

    const review = toWithdrawal(requested("review"));
    expect(review).toMatchObject({
      id: "01J9A7Y0000000000000000002",
      amount: "20000.00",
      status: "review",
      reviewReason: "FIRST_WITHDRAWAL",
    });

    const paid = toWithdrawal(example("/v1/withdrawals/{id}"));
    expect(paid).toMatchObject({
      status: "paid",
      paidAt: "2026-10-04T09:04:12Z",
    });

    for (const withdrawal of [processing, review, paid]) {
      expect(withdrawalSchema.parse(withdrawal)).toEqual(withdrawal);
    }
  });

  it("keeps the API's rejection reason as sent, and leaves what it didn't send empty", () => {
    const base = requested("processing");
    delete base.account_masked;
    const rejected = toWithdrawal({
      ...base,
      status: "rejected",
      review_reason: undefined,
      rejection_reason: "The account name does not match yours.",
    });

    expect(rejected).toMatchObject({
      status: "rejected",
      accountMasked: null,
      reviewReason: null,
      rejectionReason: "The account name does not match yours.",
      paidAt: null,
    });
    expect(withdrawalSchema.parse(rejected)).toEqual(rejected);
  });
});

describe("toWithdrawalRequest (AC-10)", () => {
  it("sends a saved account by its id and a new number as account, never both", () => {
    const saved = {
      method: "telebirr",
      amount: "2000.00",
      to: { kind: "saved", payoutAccountId: "01J9A7X0000000000000000001" },
    } as const;
    const fresh = {
      method: "cbebirr",
      amount: "500.00",
      to: { kind: "new", account: "+251911234567" },
    } as const;

    // The browser's body passes the route handler's schema as it is.
    expect(withdrawalRequestSchema.parse(saved)).toEqual(saved);
    expect(withdrawalRequestSchema.parse(fresh)).toEqual(fresh);

    // The contract's own example request is what a saved account becomes.
    expect(toWithdrawalRequest(saved)).toEqual({
      method: "telebirr",
      amount: "2000.00",
      payout_account_id: "01J9A7X0000000000000000001",
    });
    expect(toWithdrawalRequest(fresh)).toEqual({
      method: "cbebirr",
      amount: "500.00",
      account: "+251911234567",
    });
  });
});
