/**
 * Payment methods, ported from `Screen Wallet.dc.html`, until F6b reads them
 * from `/v1/payment-methods`. The balances already come from `/v1/wallet`.
 */
import type { PaymentMethod } from "@/features/wallet/types";

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "telebirr",
    name: "telebirr",
    mono: "tb",
    kind: "mobile",
    minAmount: 10,
    maxAmount: 50_000,
    supportsWithdrawal: true,
  },
  {
    id: "cbebirr",
    name: "CBE Birr",
    mono: "CBE",
    kind: "mobile",
    minAmount: 10,
    maxAmount: 50_000,
    supportsWithdrawal: true,
  },
  {
    id: "mpesa",
    name: "M-Pesa",
    mono: "MP",
    kind: "mobile",
    minAmount: 10,
    maxAmount: 30_000,
    supportsWithdrawal: true,
  },
  {
    id: "chapa",
    name: "Chapa",
    mono: "CH",
    kind: "gateway",
    minAmount: 50,
    maxAmount: 100_000,
    supportsWithdrawal: true,
  },
  {
    id: "santimpay",
    name: "SantimPay",
    mono: "SP",
    kind: "gateway",
    minAmount: 50,
    maxAmount: 100_000,
    supportsWithdrawal: false,
  },
  {
    id: "arifpay",
    name: "ArifPay",
    mono: "AP",
    kind: "gateway",
    minAmount: 50,
    maxAmount: 100_000,
    supportsWithdrawal: false,
  },
];

/** The account money moves to and from, masked as the design shows it. */
export const PAYOUT_ACCOUNT = "+251 9•• ••• 482";
