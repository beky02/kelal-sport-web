import { describe, expect, it } from "vitest";
import {
  toWalletBalances,
  toWalletTxn,
  toWalletTxnPage,
} from "@/lib/api/mappers/wallet";
import type { components } from "@/lib/api/schema";
import { walletBalancesSchema, walletTxnPageSchema } from "@/lib/api/schemas";
import { example } from "../contract";

type ApiWalletTxn = components["schemas"]["WalletTxn"];

describe("toWalletBalances (AC-5)", () => {
  it("maps the contract's wallet example without touching an amount", () => {
    const balances = toWalletBalances(example("/v1/wallet"));
    expect(balances).toEqual({
      cash: "1208.95",
      bonus: "50.00",
      locked: "0.00",
      debt: "0.00",
      currency: "ETB",
    });
    // What the route handler answers is what the browser accepts.
    expect(walletBalancesSchema.parse(balances)).toEqual(balances);
  });

  it("keeps an absent debt empty, never zero", () => {
    const wallet = example("/v1/wallet");
    delete wallet.debt;
    expect(toWalletBalances(wallet).debt).toBeNull();
    expect(
      walletBalancesSchema.parse(toWalletBalances(wallet)).debt,
    ).toBeNull();
  });
});

describe("toWalletTxnPage (AC-6)", () => {
  it("maps the contract's history example: kinds, signed amounts, balance after, references", () => {
    const page = toWalletTxnPage(example("/v1/wallet/transactions"));
    expect(page).toEqual({
      items: [
        {
          id: "01J9A7U0000000000000000003",
          type: "win",
          amount: "289.17",
          balanceAfter: "1208.95",
          label: "K7Q2-M9XP-M",
          reference: { type: "bet", id: "01J9A7V0000000000000000001" },
          createdAt: "2026-10-04T21:02:00Z",
        },
        {
          id: "01J9A7U0000000000000000002",
          type: "bet",
          amount: "-100.00",
          balanceAfter: "919.78",
          label: "K7Q2-M9XP-M",
          reference: { type: "bet", id: "01J9A7V0000000000000000001" },
          createdAt: "2026-10-03T14:05:22Z",
        },
        {
          id: "01J9A7U0000000000000000001",
          type: "deposit",
          amount: "500.00",
          balanceAfter: "1019.78",
          label: "telebirr",
          reference: { type: "payment", id: "01J9A7W0000000000000000001" },
          createdAt: "2026-10-03T13:58:10Z",
        },
      ],
      nextCursor: null,
    });
    expect(walletTxnPageSchema.parse(page)).toEqual(page);
  });

  it("passes the next page's cursor on", () => {
    const page = { ...example("/v1/wallet/transactions"), next_cursor: "c2" };
    expect(toWalletTxnPage(page).nextCursor).toBe("c2");
  });

  it("keeps a movement with no reference, or half of one, without inventing the rest", () => {
    const [first] = example("/v1/wallet/transactions").items;
    const bare: ApiWalletTxn = { ...first, type: "adjustment" };
    delete bare.reference;
    expect(toWalletTxn(bare)).toMatchObject({ label: null, reference: null });

    // A label with no id still names the movement; it links nowhere.
    const labelOnly: ApiWalletTxn = {
      ...first,
      type: "bonus",
      reference: { label: "Welcome bonus" },
    };
    expect(toWalletTxn(labelOnly)).toMatchObject({
      label: "Welcome bonus",
      reference: null,
    });
  });
});
